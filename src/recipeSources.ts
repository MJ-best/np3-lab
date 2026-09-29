/*
 * Titles, creators and tags for recipe files bundled from recipes/community/,
 * derived from their path in github.com/shouryan01/Nikon-Recipes:
 *   Nikon Creators/<Recipe>_<Creator>.NP3
 *   Color Grading/<Recipe>.NP3
 *   NikonPC/<Recipe>.NP3
 *   Third Party Creators/<Creator>/[<Series>/]<Recipe>.NP3
 */

export interface CommunityMeta {
  title: string;
  creator?: string;
  tags: string[];
}

/** Black & white hints, including CamelCase names such as "BritFilmBW" or "EmotionalB&W". */
const isMono = (s: string) =>
  /b&w/i.test(s) || /BW(?![a-z])/.test(s) || /(^|[^a-z])bw([^a-z]|$)/i.test(s) || /mono|tri-?x|ilford|acros|t-?max|achromic|noir/i.test(s);

export function describeCommunityFile(relPath: string): CommunityMeta {
  const parts = relPath.split("/");
  const file = parts[parts.length - 1];
  let title = file.replace(/\.np3$/i, "").trim();
  const collection = parts[0];
  const tags: string[] = [];
  let creator: string | undefined;

  if (collection === "Nikon Creators") {
    tags.push("nikon-creators");
    const i = title.lastIndexOf("_");
    if (i > 0) {
      creator = title.slice(i + 1).trim();
      title = title.slice(0, i).trim();
    } else {
      creator = "Nikon";
    }
  } else if (collection === "Color Grading") {
    tags.push("color-grading");
    creator = "Nikon";
  } else if (collection === "NikonPC") {
    tags.push("nikonpc");
    creator = "nikonpc.com";
  } else if (collection === "Third Party Creators") {
    tags.push("third-party");
    creator = parts.length > 2 ? parts[1] : undefined;
    // "A-X+rossandhisjpegs" → "A-X"
    title = title.replace(/\+.*$/, "").trim() || title;
  }
  if (isMono(title) || parts.slice(0, -1).some((p) => /b&w|mono/i.test(p))) tags.push("mono");
  return { title, creator, tags };
}

/** Link to the file on GitHub, pinned to the fetched commit. */
export function communitySourceUrl(repo: string, commit: string, relPath: string): string {
  return `https://github.com/${repo}/blob/${commit}/${relPath.split("/").map(encodeURIComponent).join("/")}`;
}
