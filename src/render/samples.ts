import { forgetSource, prepareSource, type PreparedSource } from "./renderer";
import { drawColorChart, drawLandscape, drawNight, drawSkinTones } from "./testChart";

export interface Sample {
  id: string;
  label: { ko: string; en: string; ja: string };
  kind: "bundled" | "generated" | "user";
  /** URL for bundled photos; generated scenes are drawn on demand. */
  url?: string;
  draw?: () => HTMLCanvasElement;
  /** Your own photos: read from the photo library when first shown, with a small copy for the chip. */
  blob?: () => Promise<Blob | null>;
  thumb?: string;
}

// Photos dropped into /samples are bundled at build time (inlined in the single-file build).
const bundledFiles = import.meta.glob("../../samples/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const SCENE_LABELS: Record<string, { ko: string; en: string; ja: string }> = {
  portrait: { ko: "인물", en: "Portrait", ja: "人物" },
  people: { ko: "인물", en: "People", ja: "人物" },
  outdoor: { ko: "야외", en: "Outdoor", ja: "屋外" },
  landscape: { ko: "풍경", en: "Landscape", ja: "風景" },
  nature: { ko: "자연", en: "Nature", ja: "自然" },
  indoor: { ko: "실내", en: "Indoor", ja: "室内" },
  cafe: { ko: "카페", en: "Cafe", ja: "カフェ" },
  night: { ko: "야경", en: "Night", ja: "夜景" },
  street: { ko: "거리", en: "Street", ja: "ストリート" },
  city: { ko: "도시", en: "City", ja: "都市" },
  food: { ko: "음식", en: "Food", ja: "料理" },
  product: { ko: "제품", en: "Product", ja: "商品" },
  sunset: { ko: "노을", en: "Sunset", ja: "夕景" },
  snow: { ko: "설경", en: "Snow", ja: "雪景色" },
  studio: { ko: "스튜디오", en: "Studio", ja: "スタジオ" },
};

/** "03-night-seoul.jpg" → { ko: "야경 seoul", en: "Night seoul", ja: "夜景 seoul" } */
export function labelFromFileName(fileName: string): { ko: string; en: string; ja: string } {
  const stem = fileName.replace(/^.*\//, "").replace(/\.[^.]+$/, "").replace(/^\d+[-_ ]*/, "");
  const parts = stem.split(/[-_ ]+/).filter(Boolean);
  const known = parts.length > 0 ? SCENE_LABELS[parts[0].toLowerCase()] : undefined;
  if (known) {
    const rest = parts.slice(1).join(" ");
    const add = (base: string) => (rest ? `${base} ${rest}` : base);
    return { ko: add(known.ko), en: add(known.en), ja: add(known.ja) };
  }
  const plain = parts.join(" ") || fileName;
  return { ko: plain, en: plain, ja: plain };
}

const bundled: Sample[] = Object.keys(bundledFiles)
  .sort()
  .map((path) => ({
    id: `bundled:${path.replace(/^.*\//, "")}`,
    label: labelFromFileName(path),
    kind: "bundled",
    url: bundledFiles[path],
  }));

const generated: Sample[] = [
  { id: "gen:landscape", label: { ko: "풍경 (테스트)", en: "Landscape (test)", ja: "風景（テスト）" }, kind: "generated", draw: drawLandscape },
  { id: "gen:skin", label: { ko: "피부톤 (테스트)", en: "Skin tones (test)", ja: "肌色（テスト）" }, kind: "generated", draw: drawSkinTones },
  { id: "gen:night", label: { ko: "야경 (테스트)", en: "Night (test)", ja: "夜景（テスト）" }, kind: "generated", draw: drawNight },
  { id: "gen:chart", label: { ko: "컬러 차트", en: "Color chart", ja: "カラーチャート" }, kind: "generated", draw: drawColorChart },
];

/** Real photos first; the colour chart is always available for checking hues. */
export const BUILTIN_SAMPLES: Sample[] =
  bundled.length > 0 ? [...bundled, generated[generated.length - 1]] : generated;

export const hasBundledPhotos = bundled.length > 0;

const prepared = new Map<string, Promise<PreparedSource>>();

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

export function loadSample(sample: Sample): Promise<PreparedSource> {
  let p = prepared.get(sample.id);
  if (!p) {
    p = (async () => {
      if (sample.draw) return prepareSource(sample.id, sample.draw());
      if (sample.blob) {
        const blob = await sample.blob();
        if (!blob) throw new Error(`Sample ${sample.id} is gone`);
        const bmp = await createImageBitmap(blob);
        try {
          return prepareSource(sample.id, bmp);
        } finally {
          bmp.close();
        }
      }
      if (!sample.url) throw new Error(`Sample ${sample.id} has no source`);
      return prepareSource(sample.id, await loadImage(sample.url));
    })();
    p.catch(() => prepared.delete(sample.id));
    prepared.set(sample.id, p);
  }
  return p;
}

/** Drop a deleted scene from every cache. */
export function forgetSample(id: string) {
  prepared.delete(id);
  forgetSource(id);
}
