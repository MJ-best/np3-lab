import { signal } from "@preact/signals";
import { noteFor } from "./data/recipeNotes";
import { lookOf } from "./look";
import { parseNp3, type Recipe } from "./np3/recipe";
import { communitySourceUrl, describeCommunityFile } from "./recipeSources";
import { base64ToBytes, bytesToBase64, readStore, writeStore } from "./storage";

/*
 * Community recipes are downloaded by the user, inside the app, straight from the
 * original repositories. This project never redistributes them: the repositories
 * have no license and the recipes belong to Nikon and their creators.
 *
 * jsDelivr lists each repository with a SHA-256 per file (CORS, no GitHub API rate
 * limit). Blobs are stored by hash, so an update only downloads files that changed and
 * the same file in two sources is kept once. Files come from raw GitHub, with jsDelivr
 * as a mirror.
 */

export interface CommunitySource {
  id: string;
  repo: string;
  /** Only files under this path are recipes. */
  prefix: string;
  /** Where the recipes come from, for credit. */
  home: string;
  label: string;
}

export const COMMUNITY_SOURCES: CommunitySource[] = [
  {
    id: "shouryan01",
    repo: "shouryan01/Nikon-Recipes",
    prefix: "",
    home: "https://github.com/shouryan01/Nikon-Recipes",
    label: "shouryan01/Nikon-Recipes",
  },
  {
    id: "serbanjpg",
    repo: "vanlong20it/recipe-note",
    prefix: "assets/presets/serbanjpg/",
    home: "https://serbanjpg.com",
    label: "SerbanJPG",
  },
];

const STORE_KEY = "community2";
const LEGACY_KEY = "community";

interface StoredSource {
  commit: string;
  files: { path: string; hash: string }[];
}

interface Stored {
  v: 2;
  fetchedAt: string;
  sources: Record<string, StoredSource>;
  /** base64 NP3 bytes by SHA-256 (base64, as jsDelivr reports it). */
  blobs: Record<string, string>;
}

/** Format written by 0.2.0: one repository, bytes inline. */
interface LegacyStored {
  repo: string;
  commit: string;
  fetchedAt: string;
  files: { path: string; b64: string }[];
}

export interface CommunityInfo {
  fetchedAt: string;
  count: number;
  sources: { id: string; label: string; home: string; commit: string; count: number }[];
}

export const communityProgress = signal<{ done: number; total: number } | null>(null);

/** Recipe id; the first source keeps the 0.2.0 ids so photos and cards stay linked. */
const recipeId = (source: CommunitySource, path: string) =>
  source.id === COMMUNITY_SOURCES[0].id ? `community:${path}` : `community:${source.id}/${path.slice(source.prefix.length)}`;

const stemOf = (path: string) => (path.split("/").pop() ?? path).replace(/\.np3$/i, "");

/** Only Flexible Color NP3 files (header NCP, version 0310) can go on a Z-series card. */
const isFlexibleColor = (raw: Uint8Array) =>
  raw.length > 16 && String.fromCharCode(...raw.slice(0, 3)) === "NCP" && String.fromCharCode(...raw.slice(12, 16)) === "0310";

export function toCommunityRecipe(source: CommunitySource, commit: string, path: string, raw: Uint8Array): Recipe | null {
  try {
    const parsed = parseNp3(raw);
    const meta = describeCommunityFile(path.slice(source.prefix.length), source.id);
    const note = noteFor(source.id, stemOf(path));
    const look = parsed.params ? lookOf(parsed.params, meta.tags.includes("mono")) : null;
    const creator = note?.creator ?? meta.creator;
    return {
      id: recipeId(source, path),
      source: "builtin",
      title: note?.name ?? meta.title,
      npName: parsed.npName,
      description: note?.style,
      use: note?.use,
      released: note?.released,
      noteCredit: note?.credit,
      tags: [...new Set([...meta.tags, ...(look?.tags ?? [])])],
      author: creator,
      params: parsed.params,
      raw,
      origin: { kind: "community", author: creator, url: communitySourceUrl(source.repo, commit, path) },
    };
  } catch {
    return null;
  }
}

/** Build recipes from stored files, dropping byte-identical copies across sources. */
function build(stored: Stored): Recipe[] {
  const seen = new Set<string>();
  const out: Recipe[] = [];
  for (const source of COMMUNITY_SOURCES) {
    const s = stored.sources[source.id];
    if (!s) continue;
    for (const f of s.files) {
      const b64 = stored.blobs[f.hash];
      if (!b64 || seen.has(f.hash)) continue;
      seen.add(f.hash);
      const r = toCommunityRecipe(source, s.commit, f.path, base64ToBytes(b64));
      if (r) out.push(r);
    }
  }
  return out;
}

function infoOf(stored: Stored, recipes: Recipe[]): CommunityInfo {
  return {
    fetchedAt: stored.fetchedAt,
    count: recipes.length,
    sources: COMMUNITY_SOURCES.filter((s) => stored.sources[s.id]).map((s) => ({
      id: s.id,
      label: s.label,
      home: s.home,
      commit: stored.sources[s.id].commit,
      count: recipes.filter((r) => communitySourceOf(r) === s.id).length,
    })),
  };
}

const legacy = readStore<LegacyStored>(LEGACY_KEY);
const initial = readStore<Stored>(STORE_KEY);

function legacyRecipes(l: LegacyStored): Recipe[] {
  const source = COMMUNITY_SOURCES[0];
  return l.files
    .map((f) => toCommunityRecipe(source, l.commit, f.path, base64ToBytes(f.b64)))
    .filter((r): r is Recipe => r !== null);
}

/** Recipes downloaded earlier (kept in app storage so they work offline). */
export const storedCommunityRecipes: Recipe[] = initial?.v === 2 ? build(initial) : legacy ? legacyRecipes(legacy) : [];

export const communityInfo = signal<CommunityInfo | null>(
  initial?.v === 2
    ? infoOf(initial, storedCommunityRecipes)
    : legacy
      ? {
          fetchedAt: legacy.fetchedAt,
          count: storedCommunityRecipes.length,
          sources: [{ ...pick(COMMUNITY_SOURCES[0]), commit: legacy.commit, count: storedCommunityRecipes.length }],
        }
      : null,
);

function pick(s: CommunitySource) {
  return { id: s.id, label: s.label, home: s.home };
}

export async function sha256Base64(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return bytesToBase64(new Uint8Array(digest));
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/**
 * Pin "main" to a commit so the listing and the files agree and an unchanged source
 * can be skipped. One small GitHub API call per source (jsDelivr can't resolve
 * branches); falls back to "main" when the API is rate-limited or offline.
 */
async function resolveCommit(repo: string): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/main`, {
      headers: { Accept: "application/vnd.github.sha" },
    });
    const sha = res.ok ? (await res.text()).trim() : "";
    if (/^[0-9a-f]{40}$/i.test(sha)) return sha;
  } catch {
    /* use the branch */
  }
  return "main";
}

/** NP3 files in a source at a commit, with their SHA-256. */
export async function listSource(source: CommunitySource, commit: string): Promise<{ path: string; hash: string }[]> {
  const listing = await getJson<{ files: { name: string; hash: string }[] }>(
    `https://data.jsdelivr.com/v1/packages/gh/${source.repo}@${commit}?structure=flat`,
  );
  return listing.files
    .map((f) => ({ path: f.name.replace(/^\//, ""), hash: f.hash }))
    .filter((f) => f.path.startsWith(source.prefix) && /\.np3$/i.test(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** Community NP3 files are about 1 KB; anything much larger is not a recipe. */
const MAX_COMMUNITY_BYTES = 8 * 1024;

/**
 * Fetch a file and accept it only if its SHA-256 matches the listing, so a mirror can't
 * hand over different bytes than the repository commit holds.
 */
async function fetchVerified(repo: string, commit: string, path: string, hash: string): Promise<Uint8Array | null> {
  const urls = [
    // GitHub first: jsDelivr takes a few seconds per file it hasn't cached yet.
    `https://raw.githubusercontent.com/${repo}/${commit}/${encodePath(path)}`,
    `https://cdn.jsdelivr.net/gh/${repo}@${commit}/${encodePath(path)}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length <= MAX_COMMUNITY_BYTES && (await sha256Base64(bytes)) === hash) return bytes;
    } catch {
      /* try the next mirror */
    }
  }
  return null;
}

/** Blobs we already have, by hash — including 0.2.0's store, hashed once so nothing is downloaded again. */
async function knownBlobs(): Promise<Record<string, string>> {
  const current = readStore<Stored>(STORE_KEY);
  const blobs: Record<string, string> = { ...(current?.v === 2 ? current.blobs : {}) };
  const old = readStore<LegacyStored>(LEGACY_KEY);
  if (old) {
    for (const f of old.files) blobs[await sha256Base64(base64ToBytes(f.b64))] = f.b64;
  }
  return blobs;
}

/**
 * Download (or update) the recipes from every source. Only files whose hash is new
 * are fetched. Returns null when every source is already at the stored commit.
 */
export async function downloadCommunityRecipes(force = false): Promise<Recipe[] | null> {
  const previous = readStore<Stored>(STORE_KEY);
  const commits = await Promise.all(COMMUNITY_SOURCES.map((s) => resolveCommit(s.repo)));
  const unchanged = COMMUNITY_SOURCES.every((s, i) => commits[i] !== "main" && previous?.sources[s.id]?.commit === commits[i]);
  if (!force && previous?.v === 2 && unchanged) return null;

  const listings = await Promise.allSettled(COMMUNITY_SOURCES.map((s, i) => listSource(s, commits[i])));
  const blobs = await knownBlobs();
  const sources: Record<string, StoredSource> = {};
  const missing: { repo: string; commit: string; path: string; hash: string }[] = [];
  const queued = new Set<string>();
  COMMUNITY_SOURCES.forEach((s, i) => {
    const listing = listings[i];
    if (listing.status === "rejected") {
      // Keep what we had for a source that couldn't be reached this time.
      if (previous?.sources[s.id]) sources[s.id] = previous.sources[s.id];
      return;
    }
    sources[s.id] = { commit: commits[i], files: listing.value };
    for (const f of listing.value) {
      if (blobs[f.hash] || queued.has(f.hash)) continue;
      queued.add(f.hash);
      missing.push({ repo: s.repo, commit: commits[i], ...f });
    }
  });
  if (Object.keys(sources).length === 0) {
    const failed = listings.find((l): l is PromiseRejectedResult => l.status === "rejected");
    throw failed?.reason instanceof Error ? failed.reason : new Error("unreachable");
  }

  let done = 0;
  communityProgress.value = { done, total: missing.length };
  const queue = [...missing];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const raw = await fetchVerified(item.repo, item.commit, item.path, item.hash);
        if (raw && isFlexibleColor(raw)) blobs[item.hash] = bytesToBase64(raw);
      } finally {
        communityProgress.value = { done: ++done, total: missing.length };
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: 12 }, worker));
  } finally {
    communityProgress.value = null;
  }

  // Keep only listed files we actually have, and only the blobs they use.
  const used: Record<string, string> = {};
  for (const s of Object.values(sources)) {
    s.files = s.files.filter((f) => blobs[f.hash]);
    for (const f of s.files) used[f.hash] = blobs[f.hash];
  }
  const stored: Stored = { v: 2, fetchedAt: new Date().toISOString(), sources, blobs: used };
  const recipes = build(stored);
  if (recipes.length === 0) throw new Error("no recipes");
  recipes.sort((a, b) => a.id.localeCompare(b.id));
  if (writeStore(STORE_KEY, stored)) {
    try {
      localStorage.removeItem(`nikonpclab.${LEGACY_KEY}`);
    } catch {
      /* storage unavailable */
    }
  }
  communityInfo.value = infoOf(stored, recipes);
  return recipes;
}

// A function declaration (hoisted): the stored recipes are counted per source at module load.
export function isCommunityRecipe(r: Recipe): boolean {
  return r.id.startsWith("community:");
}

/** Which source a community recipe came from (see recipeId). */
export function communitySourceOf(r: Recipe): string | undefined {
  if (!isCommunityRecipe(r)) return undefined;
  const rest = r.id.slice("community:".length);
  return COMMUNITY_SOURCES.slice(1).find((s) => rest.startsWith(`${s.id}/`))?.id ?? COMMUNITY_SOURCES[0].id;
}
