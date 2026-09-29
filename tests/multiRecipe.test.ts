import { describe, expect, it } from "vitest";
import { extractSourceMeta, parseRecipes } from "../src/np3/textFormat";

// Roughly what ⌘A / ⌘C on a Reddit thread produces: UI noise, Markdown, two recipes in the post
// and one more in a comment.
const THREAD = `r/NikonFlexibleColour
Posted by u/filmlover_zf
3 hr. ago
My two go-to recipes for the Zf
https://www.reddit.com/r/NikonFlexibleColour/comments/abc123/my_two_goto_recipes/

**Warm Portra-ish**

* **Contrast:** -15
* **Highlights:** -30
* **Shadows:** +20
* **Saturation:** -10
* Reds: Hue +5, Chroma -10, Brightness 0

**Cool Night Street**

* Contrast: +10
* Highlights: -40
* Blacks: -10
* Color Grading:
* Shadows: Hue 210, Chroma 15, Brightness -5

42
Upvote
Share

u/nightowl
• 1h ago
Here's mine, works great on the Z8

Faded Matte
Contrast -20
Shadows +25
Black level +30
Saturation -25

Reply
Share
`;

describe("multi-recipe parsing", () => {
  const blocks = parseRecipes(THREAD);

  it("finds each recipe in a pasted thread", () => {
    expect(blocks.map((b) => b.title)).toEqual(["Warm Portra-ish", "Cool Night Street", "Faded Matte"]);
  });

  it("parses values through Markdown bullets and bold", () => {
    const warm = blocks[0].params;
    expect(warm.contrast).toBe(-15);
    expect(warm.highlights).toBe(-30);
    expect(warm.shadows).toBe(20);
    expect(warm.saturation).toBe(-10);
    expect(warm.colorBlender?.red).toEqual({ hue: 5, chroma: -10, brightness: 0 });
  });

  it("keeps each recipe's values separate", () => {
    const night = blocks[1].params;
    expect(night.contrast).toBe(10);
    expect(night.blackLevel).toBe(-10);
    expect(night.saturation).toBe(0);
    expect(night.colorGrading?.shadows).toEqual({ hue: 210, chroma: 15, brightness: -5 });
  });

  it("credits the author closest to each recipe", () => {
    expect(blocks.map((b) => b.author)).toEqual(["filmlover_zf", "filmlover_zf", "nightowl"]);
  });

  it("splits on a repeated setting even without a title", () => {
    const b = parseRecipes("Contrast +10\nSaturation -5\nContrast -20\nSaturation +5");
    expect(b.map((x) => x.params.contrast)).toEqual([10, -20]);
  });

  it("starts a new recipe at a Name: line", () => {
    const b = parseRecipes("Name: ONE\nContrast 5\nShadows 5\nName: TWO\nHighlights -5\nClarity 1");
    expect(b.map((x) => x.title)).toEqual(["ONE", "TWO"]);
  });

  it("does not split a recipe at neutral section headings", () => {
    const b = parseRecipes("Tone:\nContrast -10\nHighlights -20\nShadows 10\n\nColor:\nSaturation -5\n\nColor Blender:\nGreen: -10 / -20 / 0");
    expect(b).toHaveLength(1);
    expect(b[0].params.saturation).toBe(-5);
    expect(b[0].params.colorBlender?.green).toEqual({ hue: -10, chroma: -20, brightness: 0 });
  });

  it("ignores incidental mentions with a single value", () => {
    expect(parseRecipes("I usually keep contrast 0 and shoot at f/2")).toEqual([]);
  });
});

describe("source detection", () => {
  it("finds the Reddit link and author", () => {
    expect(extractSourceMeta(THREAD)).toEqual({
      url: "https://www.reddit.com/r/NikonFlexibleColour/comments/abc123/my_two_goto_recipes/",
      author: "filmlover_zf",
      kind: "reddit",
    });
  });

  it("falls back to plain text", () => {
    expect(extractSourceMeta("Contrast +5")).toEqual({ author: undefined, kind: "text" });
  });
});
