import { normalizeParams, parseNp3, sanitizeNpName, type LocalizedText, type Recipe, type RecipeParams } from "./np3/recipe";
import { toneCurveFromPoints, type CurvePoint } from "./np3/toneCurve";

/** Shape of recipes/*.json. `curvePoints` is a friendlier alternative to a raw tone curve. */
interface RecipeFile {
  id: string;
  npName: string;
  title: LocalizedText;
  description?: LocalizedText;
  tags?: string[];
  author?: string;
  params: Partial<RecipeParams> & { curvePoints?: CurvePoint[] };
}

const jsonFiles = import.meta.glob("../recipes/*.json", { eager: true, import: "default" }) as Record<string, RecipeFile>;
// Your own NP3 files (e.g. exported from NX Studio) anywhere under recipes/.
// Community recipes are not bundled; users download them in the app (see community.ts).
const np3Files = import.meta.glob("../recipes/**/*.{np3,NP3}", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;

function fromJson(path: string, file: RecipeFile): Recipe {
  const { curvePoints, ...params } = file.params;
  if (curvePoints) params.toneCurve = toneCurveFromPoints(curvePoints);
  return {
    id: `builtin:${file.id ?? path}`,
    source: "builtin",
    title: file.title,
    npName: sanitizeNpName(file.npName),
    description: file.description,
    tags: file.tags ?? [],
    author: file.author,
    params: normalizeParams(params),
  };
}

export const BUILTIN_RECIPES: Recipe[] = Object.keys(jsonFiles)
  .sort()
  .map((path) => fromJson(path, jsonFiles[path]));

async function bytesFromUrl(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

async function fromNp3(path: string): Promise<Recipe | null> {
  try {
    const raw = await bytesFromUrl(np3Files[path]);
    const parsed = parseNp3(raw);
    const rel = path.replace(/^\.\.\/recipes\//, "");
    return {
      id: `builtin:np3:${rel}`,
      source: "builtin",
      title: rel.replace(/^.*\//, "").replace(/\.np3$/i, ""),
      npName: parsed.npName,
      tags: [],
      params: parsed.params,
      raw,
    };
  } catch (err) {
    console.warn(`[NP3 Lab] Skipping bundled ${path}`, err);
    return null;
  }
}

/** Recipes shipped as .np3 files; loaded asynchronously because they are binary. */
export async function loadBundledNp3(): Promise<Recipe[]> {
  const recipes = await Promise.all(Object.keys(np3Files).sort().map(fromNp3));
  return recipes.filter((r): r is Recipe => r !== null);
}
