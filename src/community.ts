import { signal } from "@preact/signals";
import { parseNp3, type Recipe } from "./np3/recipe";
import { communitySourceUrl, describeCommunityFile } from "./recipeSources";
import { base64ToBytes, bytesToBase64, readStore, writeStore } from "./storage";

/*
 * Community recipes are downloaded by the user, inside the app, straight from the
 * original repository. This project never redistributes them: the repository has
 * no license and the recipes belong to Nikon and their creators.
 */

export const COMMUNITY_REPO = "shouryan01/Nikon-Recipes";
const STORE_KEY = "community";

interface StoredCommunity {
  repo: string;
  commit: string;
  fetchedAt: string;
  files: { path: string; b64: string }[];
}

export interface CommunityInfo {
  repo: string;
  commit: string;
  fetchedAt: string;
  count: number;
}

export const communityProgress = signal<{ done: number; total: number } | null>(null);

function toRecipe(repo: string, commit: string, path: string, raw: Uint8Array): Recipe | null {
  try {
    const parsed = parseNp3(raw);
    const meta = describeCommunityFile(path);
    return {
      id: `community:${path}`,
      source: "builtin",
      title: meta.title,
      npName: parsed.npName,
      tags: meta.tags,
      author: meta.creator,
      params: parsed.params,
      raw,
      origin: { kind: "community", author: meta.creator, url: communitySourceUrl(repo, commit, path) },
    };
  } catch {
    return null;
  }
}

function fromStored(stored: StoredCommunity): Recipe[] {
  return stored.files
    .map((f) => toRecipe(stored.repo, stored.commit, f.path, base64ToBytes(f.b64)))
    .filter((r): r is Recipe => r !== null);
}

const initial = readStore<StoredCommunity>(STORE_KEY);

/** Recipes downloaded earlier (kept in app storage so they work offline). */
export const storedCommunityRecipes: Recipe[] = initial ? fromStored(initial) : [];

export const communityInfo = signal<CommunityInfo | null>(
  initial ? { repo: initial.repo, commit: initial.commit, fetchedAt: initial.fetchedAt, count: storedCommunityRecipes.length } : null,
);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/**
 * Download (or update) every Flexible Color NP3 in the community repository.
 * Returns null when the stored copy is already at the latest commit.
 */
export async function downloadCommunityRecipes(force = false): Promise<Recipe[] | null> {
  const repo = COMMUNITY_REPO;
  const { sha: commit } = await getJson<{ sha: string }>(`https://api.github.com/repos/${repo}/commits/main`);
  if (!force && communityInfo.value?.commit === commit) return null;
  const tree = await getJson<{ tree: { path: string; type: string }[] }>(
    `https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`,
  );
  const paths = tree.tree.filter((e) => e.type === "blob" && /\.np3$/i.test(e.path)).map((e) => e.path);

  const files: StoredCommunity["files"] = [];
  const recipes: Recipe[] = [];
  let done = 0;
  communityProgress.value = { done, total: paths.length };
  const queue = [...paths];
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const url = `https://raw.githubusercontent.com/${repo}/${commit}/${path.split("/").map(encodeURIComponent).join("/")}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const raw = new Uint8Array(await res.arrayBuffer());
          // Only Flexible Color NP3 files (header NCP, version 0310) can go on a Z-series card.
          const recipe = String.fromCharCode(...raw.slice(12, 16)) === "0310" ? toRecipe(repo, commit, path, raw) : null;
          if (recipe) {
            recipes.push(recipe);
            files.push({ path, b64: bytesToBase64(raw) });
          }
        }
      } finally {
        communityProgress.value = { done: ++done, total: paths.length };
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: 8 }, worker));
  } finally {
    communityProgress.value = null;
  }
  if (recipes.length === 0) throw new Error("no recipes");

  files.sort((a, b) => a.path.localeCompare(b.path));
  recipes.sort((a, b) => a.id.localeCompare(b.id));
  const stored: StoredCommunity = { repo, commit, fetchedAt: new Date().toISOString(), files };
  writeStore(STORE_KEY, stored);
  communityInfo.value = { repo, commit, fetchedAt: stored.fetchedAt, count: recipes.length };
  return recipes;
}

export const isCommunityRecipe = (r: Recipe) => r.id.startsWith("community:");
