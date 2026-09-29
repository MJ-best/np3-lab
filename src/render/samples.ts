import { prepareSource, type PreparedSource } from "./renderer";
import { drawColorChart, drawLandscape, drawNight, drawSkinTones } from "./testChart";

export interface Sample {
  id: string;
  label: { ko: string; en: string };
  kind: "bundled" | "generated" | "user";
  /** URL for bundled/user photos; generated scenes are drawn on demand. */
  url?: string;
  draw?: () => HTMLCanvasElement;
}

// Photos dropped into /samples are bundled at build time (inlined in the single-file build).
const bundledFiles = import.meta.glob("../../samples/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const SCENE_LABELS: Record<string, { ko: string; en: string }> = {
  portrait: { ko: "인물", en: "Portrait" },
  people: { ko: "인물", en: "People" },
  outdoor: { ko: "야외", en: "Outdoor" },
  landscape: { ko: "풍경", en: "Landscape" },
  nature: { ko: "자연", en: "Nature" },
  indoor: { ko: "실내", en: "Indoor" },
  cafe: { ko: "카페", en: "Cafe" },
  night: { ko: "야경", en: "Night" },
  street: { ko: "거리", en: "Street" },
  food: { ko: "음식", en: "Food" },
  product: { ko: "제품", en: "Product" },
  sunset: { ko: "노을", en: "Sunset" },
  snow: { ko: "설경", en: "Snow" },
  studio: { ko: "스튜디오", en: "Studio" },
};

/** "03-night-seoul.jpg" → { ko: "야경 seoul", en: "Night seoul" } */
export function labelFromFileName(fileName: string): { ko: string; en: string } {
  const stem = fileName.replace(/^.*\//, "").replace(/\.[^.]+$/, "").replace(/^\d+[-_ ]*/, "");
  const parts = stem.split(/[-_ ]+/).filter(Boolean);
  const known = parts.length > 0 ? SCENE_LABELS[parts[0].toLowerCase()] : undefined;
  if (known) {
    const rest = parts.slice(1).join(" ");
    return { ko: rest ? `${known.ko} ${rest}` : known.ko, en: rest ? `${known.en} ${rest}` : known.en };
  }
  const plain = parts.join(" ") || fileName;
  return { ko: plain, en: plain };
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
  { id: "gen:landscape", label: { ko: "풍경 (테스트)", en: "Landscape (test)" }, kind: "generated", draw: drawLandscape },
  { id: "gen:skin", label: { ko: "피부톤 (테스트)", en: "Skin tones (test)" }, kind: "generated", draw: drawSkinTones },
  { id: "gen:night", label: { ko: "야경 (테스트)", en: "Night (test)" }, kind: "generated", draw: drawNight },
  { id: "gen:chart", label: { ko: "컬러 차트", en: "Color chart" }, kind: "generated", draw: drawColorChart },
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
      if (!sample.url) throw new Error(`Sample ${sample.id} has no source`);
      return prepareSource(sample.id, await loadImage(sample.url));
    })();
    p.catch(() => prepared.delete(sample.id));
    prepared.set(sample.id, p);
  }
  return p;
}

export async function sampleFromFile(file: File): Promise<Sample> {
  const url = URL.createObjectURL(file);
  const name = file.name.replace(/\.[^.]+$/, "");
  return {
    id: `user:${name}:${file.size}:${file.lastModified}`,
    label: { ko: name, en: name },
    kind: "user",
    url,
  };
}
