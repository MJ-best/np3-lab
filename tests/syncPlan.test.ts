import { describe, expect, it } from "vitest";
import { changes, plan, type Entry } from "../src/syncPlan";

const m = (o: Record<string, Entry>) => new Map(Object.entries(o));

describe("account sync", () => {
  it("takes the newer side of each item and leaves equal ones alone", () => {
    const { pull, push } = plan(
      m({ "recipes/a": { t: 5, data: "A5" }, "recipes/b": { t: 9, data: "B9" }, "recipes/c": { t: 3, data: "C" } }),
      m({ "recipes/a": { t: 7, data: "A7" }, "recipes/b": { t: 2, data: "B2" }, "recipes/c": { t: 3, data: "C" } }),
    );
    expect(pull).toEqual([["recipes/a", { t: 7, data: "A7" }]]);
    expect(push).toEqual([["recipes/b", { t: 9, data: "B9" }]]);
  });

  it("sends what only this device has, even if never edited, and takes what only the account has", () => {
    const { pull, push } = plan(m({ "recipes/old": { t: 0, data: "X" } }), m({ "prefs/cart": { t: 4, data: "[]" } }));
    expect(push.map(([p]) => p)).toEqual(["recipes/old"]);
    expect(pull.map(([p]) => p)).toEqual(["prefs/cart"]);
  });

  it("carries a deletion across unless the recipe changed later elsewhere", () => {
    const local = m({ "recipes/a": { t: 8, deleted: true }, "recipes/b": { t: 8, deleted: true } });
    const { pull, push } = plan(local, m({ "recipes/a": { t: 6, data: "A" }, "recipes/b": { t: 9, data: "B" } }));
    expect(push).toEqual([["recipes/a", { t: 8, deleted: true }]]);
    expect(pull).toEqual([["recipes/b", { t: 9, data: "B" }]]);
  });

  it("finds changed, new and removed items", () => {
    const before = new Map([["recipes/a", "1"], ["recipes/b", "2"], ["prefs/cart", "[]"]]);
    const after = new Map([["recipes/a", "1"], ["recipes/b", "3"], ["recipes/c", "4"], ["prefs/cart", "[]"]]);
    expect(changes(before, after)).toEqual({ changed: ["recipes/b", "recipes/c"], removed: [] });
    expect(changes(after, before)).toEqual({ changed: ["recipes/b"], removed: ["recipes/c"] });
  });
});
