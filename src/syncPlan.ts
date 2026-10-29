/**
 * Account sync, the part that decides. Every synced item (a recipe, the card list, the camera)
 * has a path like "recipes/<id>" and an entry with the time it last changed; deletions stay as
 * entries too, so they reach the other devices. The newer side wins.
 */

export interface Entry {
  /** When it last changed (ms). */
  t: number;
  deleted?: boolean;
  /** JSON of the item; absent when deleted. */
  data?: string;
}

/** What to take from the account and what to send to it. */
export function plan(local: Map<string, Entry>, remote: Map<string, Entry>) {
  const pull: [string, Entry][] = [];
  const push: [string, Entry][] = [];
  for (const path of new Set([...local.keys(), ...remote.keys()])) {
    const l = local.get(path);
    const r = remote.get(path);
    const lt = l?.t ?? -1;
    const rt = r?.t ?? -1;
    if (rt > lt) pull.push([path, r!]);
    else if (lt > rt) push.push([path, l!]);
  }
  return { pull, push };
}

/** Paths whose JSON changed or appeared, and paths that went away. */
export function changes(before: Map<string, string>, after: Map<string, string>) {
  const changed = [...after].filter(([path, data]) => before.get(path) !== data).map(([path]) => path);
  const removed = [...before.keys()].filter((path) => !after.has(path));
  return { changed, removed };
}
