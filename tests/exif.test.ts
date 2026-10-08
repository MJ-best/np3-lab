import { describe, expect, it } from "vitest";
import { cameraName, dateText, readExif, settingsParts } from "../src/exif";
import { fitRatio } from "../src/frame";

/** A little-endian TIFF block with IFD0 (make, model, EXIF pointer) and an EXIF IFD. */
function tiff(): Uint8Array {
  const strings = { make: "NIKON CORPORATION\0", model: "NIKON Z f\0", lens: "NIKKOR Z 40mm f/2\0", date: "2025:11:29 15:23:04\0" };
  const buf = new Uint8Array(512);
  const v = new DataView(buf.buffer);
  buf.set([0x49, 0x49]);
  v.setUint16(2, 42, true);
  v.setUint32(4, 8, true);
  let data = 300; // strings and rationals go here
  const put = (s: string) => {
    const at = data;
    for (let i = 0; i < s.length; i++) buf[at + i] = s.charCodeAt(i);
    data += s.length + (s.length % 2);
    return at;
  };
  const rational = (n: number, d: number) => {
    const at = data;
    v.setUint32(at, n, true);
    v.setUint32(at + 4, d, true);
    data += 8;
    return at;
  };
  const entry = (ifd: number, i: number, tag: number, type: number, count: number, value: number) => {
    const e = ifd + 2 + i * 12;
    v.setUint16(e, tag, true);
    v.setUint16(e + 2, type, true);
    v.setUint32(e + 4, count, true);
    if (type === 3 && count === 1) v.setUint16(e + 8, value, true);
    else v.setUint32(e + 8, value, true);
  };
  const ifd0 = 8;
  const exif = 60;
  v.setUint16(ifd0, 3, true);
  entry(ifd0, 0, 0x010f, 2, strings.make.length, put(strings.make));
  entry(ifd0, 1, 0x0110, 2, strings.model.length, put(strings.model));
  entry(ifd0, 2, 0x8769, 4, 1, exif);
  v.setUint16(exif, 6, true);
  entry(exif, 0, 0x829a, 5, 1, rational(1, 100));
  entry(exif, 1, 0x829d, 5, 1, rational(56, 10));
  entry(exif, 2, 0x8827, 3, 1, 400);
  entry(exif, 3, 0x9003, 2, strings.date.length, put(strings.date));
  entry(exif, 4, 0x920a, 5, 1, rational(40, 1));
  entry(exif, 5, 0xa434, 2, strings.lens.length, put(strings.lens));
  return buf;
}

function jpeg(t: Uint8Array): Uint8Array {
  const app1 = new Uint8Array(2 + 6 + t.length);
  app1[0] = (app1.length >> 8) & 0xff;
  app1[1] = app1.length & 0xff;
  app1.set([0x45, 0x78, 0x69, 0x66, 0, 0], 2);
  app1.set(t, 8);
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, ...app1, 0xff, 0xd9]);
}

describe("readExif", () => {
  it("reads a JPEG's EXIF block", () => {
    const e = readExif(jpeg(tiff()))!;
    expect(e).toMatchObject({ make: "NIKON CORPORATION", model: "NIKON Z f", lens: "NIKKOR Z 40mm f/2", iso: 400, focal: 40 });
    expect(cameraName(e)).toBe("Nikon Z f");
    expect(settingsParts(e)).toEqual(["40mm", "f/5.6", "1/100s", "ISO 400"]);
    expect(dateText(e)).toBe("2025.11.29");
  });

  it("reads a NEF (bare TIFF)", () => {
    expect(readExif(tiff())?.model).toBe("NIKON Z f");
  });

  it("returns null for files without EXIF and survives broken offsets", () => {
    expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    const broken = tiff();
    new DataView(broken.buffer).setUint32(4, 0xfffffff0, true);
    expect(readExif(broken)).toBeNull();
  });
});

describe("fitRatio", () => {
  it("keeps the frame as is for the original ratio", () => {
    expect(fitRatio(1000, 1500, "auto")).toEqual({ W: 1000, H: 1500, x: 0, y: 0 });
  });

  it("pads a frame out to the chosen ratio, centred", () => {
    for (const [ratio, r] of [["1:1", 1], ["4:5", 0.8], ["9:16", 9 / 16]] as const) {
      for (const [w, h] of [[1000, 1500], [1500, 1000]]) {
        const f = fitRatio(w, h, ratio);
        expect(Math.abs(f.W / f.H - r)).toBeLessThan(0.01);
        expect(f.W).toBeGreaterThanOrEqual(w);
        expect(f.H).toBeGreaterThanOrEqual(h);
        expect(Math.abs(f.x - (f.W - w) / 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(f.y - (f.H - h) / 2)).toBeLessThanOrEqual(1);
      }
    }
  });
});
