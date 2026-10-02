import { describe, expect, it } from "vitest";
import { findNefPreview } from "../src/raw";

/** Minimal little-endian TIFF: IFD0 (orientation + 2 SubIFDs), each SubIFD holding a JPEG offset/length. */
function tiff({ orientation = 8, previews = [[400, 50], [500, 3000]] } = {}): Uint8Array {
  const b = new Uint8Array(4096);
  const v = new DataView(b.buffer);
  b.set([0x49, 0x49]);
  v.setUint16(2, 42, true);
  v.setUint32(4, 8, true);
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    v.setUint16(at, tag, true);
    v.setUint16(at + 2, type, true);
    v.setUint32(at + 4, count, true);
    if (type === 3 && count === 1) v.setUint16(at + 8, value, true);
    else v.setUint32(at + 8, value, true);
  };
  // IFD0 at 8: 2 entries
  v.setUint16(8, 2, true);
  entry(10, 0x0112, 3, 1, orientation);
  entry(22, 0x014a, 4, previews.length, 100); // list of SubIFD offsets at 100
  v.setUint32(34, 0, true);
  previews.forEach(([off, len], i) => {
    const ifd = 200 + i * 40;
    v.setUint32(100 + i * 4, ifd, true);
    v.setUint16(ifd, 2, true);
    entry(ifd + 2, 0x0201, 4, 1, off);
    entry(ifd + 14, 0x0202, 4, 1, len);
    v.setUint32(ifd + 26, 0, true);
  });
  return b;
}

describe("NEF previews", () => {
  it("picks the largest embedded JPEG and the shot's orientation", () => {
    expect(findNefPreview(tiff(), 10_000)).toEqual({ offset: 500, length: 3000, orientation: 8 });
    expect(findNefPreview(tiff({ orientation: 6 }), 10_000)?.orientation).toBe(6);
  });

  it("ignores previews that run past the end of the file and odd orientations", () => {
    expect(findNefPreview(tiff({ previews: [[400, 50], [500, 99_999]] }), 10_000)).toEqual({ offset: 400, length: 50, orientation: 8 });
    expect(findNefPreview(tiff({ orientation: 5 }), 10_000)?.orientation).toBe(1);
  });

  it("rejects things that aren't TIFF and survives loops and truncation", () => {
    expect(findNefPreview(new TextEncoder().encode("not a tiff at all, nope"), 100)).toBeNull();
    const looped = tiff();
    new DataView(looped.buffer).setUint32(34, 8, true); // IFD0 points back at itself
    expect(findNefPreview(looped, 10_000)?.length).toBe(3000);
    expect(findNefPreview(tiff().slice(0, 30), 10_000)).toBeNull();
  });
});
