/* tslint:disable */
/* eslint-disable */

export function wasm_find_nef_preview(head: Uint8Array | number[], file_size: number): any;

export function wasm_ncp_bytes(name: string, ncp_json: string): Uint8Array;

export function wasm_parse_np3(bytes: Uint8Array | number[]): any;

export function wasm_points_to_raw(points_json: string): Uint16Array;

export function wasm_read_exif(bytes: Uint8Array | number[]): any;

export function wasm_serialize_np3(name: string, params_json: string): Uint8Array;

export function wasm_to_ncp(params_json: string): any;

export function wasm_with_np_name(bytes: Uint8Array | number[], name: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly wasm_find_nef_preview: (a: number, b: number, c: number, d: number) => void;
    readonly wasm_ncp_bytes: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasm_parse_np3: (a: number, b: number, c: number) => void;
    readonly wasm_points_to_raw: (a: number, b: number, c: number) => void;
    readonly wasm_read_exif: (a: number, b: number, c: number) => void;
    readonly wasm_serialize_np3: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasm_to_ncp: (a: number, b: number, c: number) => void;
    readonly wasm_with_np_name: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export4: (a: number) => void;
    readonly __wbindgen_export5: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export6: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
