import {
  newId,
  normalizeParams,
  sanitizeNpName,
  type LocalizedText,
  type Recipe,
  type RecipeOrigin,
  type RecipeParams,
} from "./np3/recipe";
import { base64ToBytes } from "./storage";

/*
 * A backup file is data from outside the app (it may have been edited or sent by
 * someone else), so every field is checked and rebuilt rather than trusted.
 */

const ORIGIN_KINDS: RecipeOrigin["kind"][] = ["reddit", "imaging-cloud", "community", "text", "file", "card"];
const MAX_NP3_BYTES = 64 * 1024;
const MAX_TEXT = 500;

const str = (v: unknown, max = MAX_TEXT): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);

function text(v: unknown): LocalizedText | undefined {
  if (typeof v === "string") return v.slice(0, MAX_TEXT);
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const out = { ko: str(o.ko), en: str(o.en), ja: str(o.ja) };
  return out.ko || out.en || out.ja ? out : undefined;
}

function origin(v: unknown): RecipeOrigin | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!ORIGIN_KINDS.includes(o.kind as RecipeOrigin["kind"])) return undefined;
  // Only web links are ever opened; anything else (javascript:, file:) is dropped.
  const url = str(o.url, 2000);
  return { kind: o.kind as RecipeOrigin["kind"], url: url && /^https?:\/\//i.test(url) ? url : undefined, author: str(o.author, 100) };
}

function np3Bytes(v: unknown): Uint8Array | undefined {
  if (typeof v !== "string" || v.length > MAX_NP3_BYTES * 2) return undefined;
  try {
    const b = base64ToBytes(v);
    return b.length >= 32 && b.length <= MAX_NP3_BYTES && b[0] === 0x4e && b[1] === 0x43 && b[2] === 0x50 && b[3] === 0 ? b : undefined;
  } catch {
    return undefined;
  }
}

/** Turn one untrusted backup entry into a My-recipes entry, or null if it isn't a recipe. */
export function recipeFromBackup(v: unknown): Recipe | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const raw = np3Bytes(r.raw);
  let params: RecipeParams | null = null;
  if (r.params && typeof r.params === "object") {
    try {
      params = normalizeParams(r.params as Partial<RecipeParams>);
    } catch {
      params = null;
    }
  }
  if (!params && !raw) return null;
  const id = str(r.id, 100);
  const title = text(r.title) ?? "Imported";
  return {
    // Ids that belong to downloaded or card recipes stay theirs; a backup gets its own.
    id: id && !/^(community|card|builtin):/.test(id) ? id : newId("imp"),
    source: r.source === "mine" ? "mine" : "imported",
    title,
    npName: sanitizeNpName(str(r.npName, 40) ?? (typeof title === "string" ? title : "RECIPE")),
    description: text(r.description),
    use: text(r.use),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string").slice(0, 20).map((t) => t.slice(0, 40)) : [],
    author: str(r.author, 100),
    params,
    raw,
    origin: origin(r.origin),
    createdAt: typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
  };
}
