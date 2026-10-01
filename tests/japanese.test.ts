import { describe, expect, it } from "vitest";
import { CAMERA_GUIDES } from "../src/cameraGuide";
import { noteFor } from "../src/data/recipeNotes";
import { pickText } from "../src/i18n";
import { analyzeLook } from "../src/look";
import { defaultParams } from "../src/np3/recipe";
import { parseRecipeText } from "../src/np3/textFormat";

describe("Japanese", () => {
  it("uses Nikon's Japanese menu names", () => {
    const zf = CAMERA_GUIDES.find((g) => g.id === "zf")!;
    expect(zf.path.ja).toEqual(["静止画撮影メニュー", "カスタムピクチャーコントロール", "編集と登録"]);
    expect(zf.altPath!.ja).toEqual(["静止画撮影メニュー", "カスタムピクチャーコントロール", "メモリーカードを使用", "カメラに登録"]);
    for (const g of CAMERA_GUIDES) expect(g.path.ja.length).toBe(g.path.en.length);
  });

  it("reads recipes written with NX Studio's Japanese labels", () => {
    const r = parseRecipeText(`輪郭強調：+2.5
ミドルレンジシャープ：+1
明瞭度：-0.5
コントラスト：-15
ハイライト：-30
シャドー：+20
白レベル：-5
黒レベル：+10
色の濃さ（彩度）：-20
カラーブレンダー
レッド 色相 +10 彩度 -15 明度 +5
グリーン 色相 -20 彩度 -30 明度 0
カラーグレーディング
シャドー 色相 200 彩度 15 明度 -5
中間調 色相 30 彩度 5 明度 0
ブレンド：70
バランス：+20`);
    const p = r.params;
    expect([p.sharpning, p.midRangeSharpning, p.clarity, p.contrast, p.highlights, p.shadows, p.whiteLevel, p.blackLevel, p.saturation]).toEqual([
      2.5, 1, -0.5, -15, -30, 20, -5, 10, -20,
    ]);
    expect(p.colorBlender?.red).toEqual({ hue: 10, chroma: -15, brightness: 5 });
    expect(p.colorBlender?.green).toEqual({ hue: -20, chroma: -30, brightness: 0 });
    expect(p.colorGrading?.shadows).toEqual({ hue: 200, chroma: 15, brightness: -5 });
    expect(p.colorGrading?.midTone).toEqual({ hue: 30, chroma: 5, brightness: 0 });
    expect([p.colorGrading?.blending, p.colorGrading?.balance]).toEqual([70, 20]);
  });

  it("falls back to English, then Korean", () => {
    expect(pickText({ ko: "웜톤", en: "Warm", ja: "暖色系" }, "ja")).toBe("暖色系");
    expect(pickText({ ko: "웜톤", en: "Warm" }, "ja")).toBe("Warm");
    expect(pickText({ ko: "웜톤" }, "ja")).toBe("웜톤");
    expect(pickText({ ko: "웜톤", en: "Warm" }, "ko")).toBe("웜톤");
  });

  it("has Japanese recipe notes and concepts", () => {
    expect(noteFor("shouryan01", "MOSS_Nagisa")?.style.ja).toBe("モスグリーン · 低彩度");
    expect(noteFor("shouryan01", "MOSS_Nagisa")?.use?.ja).toContain("植物");
    expect(noteFor("serbanjpg", "LUX-Brass")?.style.ja).toContain("ライカ");
    expect(analyzeLook({ ...defaultParams(), saturation: -100 }).summary.ja).toBe("モノクロ");
  });
});
