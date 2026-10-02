import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isNp3Bytes, isSafeNp3Name } from "../electron/cardRules.mjs";
import { withCsp } from "../scripts/csp.mjs";
import { recipeFromBackup } from "../src/backup";
import { defaultParams, paramsToBytes } from "../src/np3/recipe";
import { bytesToBase64 } from "../src/storage";

const np3 = paramsToBytes("Test", defaultParams());

describe("card file checks", () => {
  it("only writes bytes that look like an NP3", () => {
    expect(isNp3Bytes(np3)).toBe(true);
    expect(isNp3Bytes(new TextEncoder().encode("#!/bin/sh\necho hi\n".padEnd(64, " ")))).toBe(false);
    expect(isNp3Bytes(new Uint8Array(70 * 1024).fill(0x4e))).toBe(false);
    expect(isNp3Bytes("NCP" as unknown as Uint8Array)).toBe(false);
  });

  it("only accepts plain NP3 names inside CUSTOMPC", () => {
    expect(isSafeNp3Name("PICCON01.NP3")).toBe(true);
    for (const bad of ["../x.NP3", "a/b.NP3", ".hidden.NP3", "x.txt", "x\0.NP3"]) expect(isSafeNp3Name(bad)).toBe(false);
  });
});

describe("backup restore", () => {
  it("rebuilds entries instead of trusting them", () => {
    const r = recipeFromBackup({
      id: "community:Nikon Creators/MOSS_Nagisa.NP3",
      source: "builtin",
      title: { ko: "모스", en: "Moss" },
      npName: "../../evil name that is far too long",
      params: { contrast: 9999 },
      origin: { kind: "reddit", url: "javascript:alert(1)", author: "x" },
      tags: ["a", 1, { b: 2 }],
      raw: bytesToBase64(new TextEncoder().encode("not an np3 file at all, just text....")),
    })!;
    expect(r.id).toMatch(/^imp/);
    expect(r.source).toBe("imported");
    expect(r.npName).toMatch(/^[A-Za-z0-9 _-]{1,19}$/);
    expect(r.params?.contrast).toBe(100);
    expect(r.origin).toEqual({ kind: "reddit", url: undefined, author: "x" });
    expect(r.tags).toEqual(["a"]);
    expect(r.raw).toBeUndefined();
  });

  it("keeps real NP3 bytes and drops entries that aren't recipes", () => {
    expect(recipeFromBackup({ id: "x", title: "T", npName: "T", params: null, raw: bytesToBase64(np3) })?.raw).toEqual(np3);
    for (const junk of [null, 42, "text", { title: "no params or bytes" }]) expect(recipeFromBackup(junk)).toBeNull();
  });
});

describe("content security policy", () => {
  it("allows exactly the bundled script and the recipe hosts", () => {
    const script = "console.log('app')";
    const html = withCsp(`<!doctype html><html><head><title>x</title></head><body><script type="module">${script}</script></body></html>`);
    const csp = /<head>\s*<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)![1];
    expect(csp).toContain(`script-src 'sha256-${createHash("sha256").update(script).digest("base64")}'`);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/connect-src https:\/\/api\.github\.com https:\/\/data\.jsdelivr\.com https:\/\/cdn\.jsdelivr\.net https:\/\/raw\.githubusercontent\.com data:/);
    expect(csp).not.toContain("unsafe-eval");
  });
});
