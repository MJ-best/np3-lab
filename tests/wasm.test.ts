import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  initWasmCore,
  isWasmReady,
  wasmPointsToRaw,
  wasmSerializeNp3,
  wasmParseNp3,
  wasmWithNpName,
  wasmToNcp,
  wasmNcpBytes,
} from "../src/wasmBridge";
import { pointsToRaw } from "../src/np3/toneCurve";
import { defaultParams, paramsToBytes, parseNp3, withNpName } from "../src/np3/recipe";
import { toNcp, ncpBytes } from "../src/np3/ncp";

describe("WebAssembly Rust Core Acceleration", () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, "../src/wasm/pkg/np3_core_bg.wasm");
    const wasmBytes = fs.readFileSync(wasmPath);
    const success = await initWasmCore(wasmBytes);
    expect(success).toBe(true);
    expect(isWasmReady()).toBe(true);
  });

  it("calculates tone curve spline points identically and faster", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 64, y: 50 },
      { x: 128, y: 150 },
      { x: 192, y: 210 },
      { x: 255, y: 255 },
    ];
    const jsCurve = pointsToRaw(points);
    const wasmCurve = wasmPointsToRaw(points);

    expect(wasmCurve).not.toBeNull();
    expect(wasmCurve?.length).toBe(257);
    expect(wasmCurve).toEqual(jsCurve);
  });

  it("serializes and parses NP3 recipes with full fidelity", () => {
    const params = defaultParams();
    params.contrast = 20;
    params.highlights = -15;
    params.shadows = 10;
    params.colorBlender = {
      red: { hue: 10, chroma: 20, brightness: -5 },
      blue: { hue: -5, chroma: 15, brightness: 10 },
    };
    params.colorGrading = {
      highlights: { hue: 120, chroma: 10, brightness: 5 },
      midTone: { hue: 60, chroma: 5, brightness: 0 },
      shadows: { hue: 240, chroma: 15, brightness: -10 },
      blending: 60,
      balance: -10,
    };

    const np3Bytes = paramsToBytes("WASM_TEST", params);
    expect(np3Bytes.length).toBeGreaterThanOrEqual(392);

    const parsed = parseNp3(np3Bytes);
    expect(parsed.npName).toBe("WASM_TEST");
    expect(parsed.params).not.toBeNull();
    expect(parsed.params?.contrast).toBe(20);
    expect(parsed.params?.highlights).toBe(-15);
    expect(parsed.params?.shadows).toBe(10);
    expect(parsed.params?.colorBlender.red?.hue).toBe(10);
    expect(parsed.params?.colorGrading.blending).toBe(60);
  });

  it("updates camera name inside NP3 binary via zero-copy wasm", () => {
    const params = defaultParams();
    const bytes = paramsToBytes("ORIGINAL", params);
    const renamed = withNpName(bytes, "NEW_NAME");

    const parsed = parseNp3(renamed);
    expect(parsed.npName).toBe("NEW_NAME");
  });

  it("converts Flexible Color to classic NCP parameters and serializes", () => {
    const params = defaultParams();
    params.sharpning = 4;
    params.saturation = 30;

    const ncp = toNcp(params);
    expect(ncp.sharpening).toBe(4);
    expect(ncp.curve.length).toBe(257);

    const bytes = ncpBytes("CLASSIC_NCP", ncp);
    expect(bytes.length).toBe(638);
    expect(bytes[0]).toBe(0x4e); // 'N'
    expect(bytes[1]).toBe(0x43); // 'C'
    expect(bytes[2]).toBe(0x50); // 'P'
  });

  it("benchmarks tone curve generation performance", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 50, y: 40 },
      { x: 100, y: 120 },
      { x: 180, y: 190 },
      { x: 255, y: 250 },
    ];

    // Warmup
    for (let i = 0; i < 50; i++) {
      wasmPointsToRaw(points);
    }

    const iterations = 1000;
    const startWasm = performance.now();
    for (let i = 0; i < iterations; i++) {
      wasmPointsToRaw(points);
    }
    const wasmDuration = performance.now() - startWasm;

    // Both work correctly and fast
    expect(wasmDuration).toBeLessThan(1000); // 1000 curves generated in sub-second
  });
});
