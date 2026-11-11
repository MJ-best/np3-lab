import init, {
  initSync,
  wasm_find_nef_preview,
  wasm_ncp_bytes,
  wasm_parse_np3,
  wasm_points_to_raw,
  wasm_read_exif,
  wasm_serialize_np3,
  wasm_to_ncp,
  wasm_with_np_name,
} from "./wasm/pkg/np3_core.js";

import type { PhotoExif } from "./exif";
import type { NcpParams } from "./np3/ncp";
import type { ParsedNp3, RecipeParams } from "./np3/recipe";
import type { CurvePoint } from "./np3/toneCurve";
import type { NefPreview } from "./raw";

let wasmLoaded = false;
let wasmInitPromise: Promise<boolean> | null = null;

export async function initWasmCore(customInput?: BufferSource | string | URL): Promise<boolean> {
  if (wasmLoaded) return true;
  if (wasmInitPromise && !customInput) return wasmInitPromise;

  wasmInitPromise = (async () => {
    try {
      if (customInput) {
        if (customInput instanceof Uint8Array || customInput instanceof ArrayBuffer) {
          initSync({ module: customInput });
          wasmLoaded = true;
          return true;
        }
        await init({ module_or_path: customInput as any });
        wasmLoaded = true;
        return true;
      }
      // In Vite, dynamic import with ?url fetches the wasm binary path
      const wasmUrl = new URL("./wasm/pkg/np3_core_bg.wasm", import.meta.url).href;
      await init({ module_or_path: wasmUrl });
      wasmLoaded = true;
      return true;
    } catch (err) {
      console.warn("[np3-wasm] Could not initialize WebAssembly core, falling back to JS:", err);
      return false;
    }
  })();

  return wasmInitPromise;
}

export function isWasmReady(): boolean {
  return wasmLoaded;
}

/** Accelerated NEF preview finder via Rust WASM */
export function wasmFindNefPreview(head: Uint8Array, fileSize: number): NefPreview | null {
  if (!wasmLoaded) return null;
  try {
    return wasm_find_nef_preview(head, fileSize) as NefPreview | null;
  } catch {
    return null;
  }
}

/** Accelerated EXIF parser via Rust WASM */
export function wasmReadExif(bytes: Uint8Array): PhotoExif | null {
  if (!wasmLoaded) return null;
  try {
    return wasm_read_exif(bytes) as PhotoExif | null;
  } catch {
    return null;
  }
}

/** Accelerated NP3 parser via Rust WASM */
export function wasmParseNp3(bytes: Uint8Array): ParsedNp3 | null {
  if (!wasmLoaded) return null;
  try {
    return wasm_parse_np3(bytes) as ParsedNp3;
  } catch (err) {
    if (typeof err === "string" && err.includes("not-np3")) {
      throw new Error("not-np3");
    }
    return null;
  }
}

/** Accelerated NP3 serializer via Rust WASM */
export function wasmSerializeNp3(name: string, params: RecipeParams): Uint8Array | null {
  if (!wasmLoaded) return null;
  try {
    return wasm_serialize_np3(name, JSON.stringify(params));
  } catch {
    return null;
  }
}

/** Accelerated withNpName via Rust WASM */
export function wasmWithNpName(bytes: Uint8Array, name: string): Uint8Array | null {
  if (!wasmLoaded) return null;
  try {
    return wasm_with_np_name(bytes, name);
  } catch {
    return null;
  }
}

/** Accelerated tone curve LUT generator via Rust WASM */
export function wasmPointsToRaw(points: readonly CurvePoint[]): number[] | null {
  if (!wasmLoaded) return null;
  try {
    const rawU16 = wasm_points_to_raw(JSON.stringify(points));
    return Array.from(rawU16);
  } catch {
    return null;
  }
}

/** Accelerated toNcp converter via Rust WASM */
export function wasmToNcp(params: RecipeParams): NcpParams | null {
  if (!wasmLoaded) return null;
  try {
    return wasm_to_ncp(JSON.stringify(params)) as NcpParams;
  } catch {
    return null;
  }
}

/** Accelerated ncpBytes serializer via Rust WASM */
export function wasmNcpBytes(name: string, p: NcpParams): Uint8Array | null {
  if (!wasmLoaded) return null;
  try {
    return wasm_ncp_bytes(name, JSON.stringify(p));
  } catch {
    return null;
  }
}
