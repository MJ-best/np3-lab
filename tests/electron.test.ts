import { describe, expect, it } from "vitest";
import { appBundleFromExecPath, launchAgentPlist, LOGIN_FLAG } from "../electron/loginItem.mjs";
import { CARD_FILESYSTEMS, isSafeNp3Name, looksLikeNikonCard, parseMacMounts, withTimeout } from "../electron/volumes.mjs";

describe("mounted volume detection", () => {
  const MOUNT = `/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)
/dev/disk3s5 on /System/Volumes/Data (apfs, local, journaled, nobrowse, protect, root data)
/dev/disk4s1 on /Volumes/NIKON Z 8 (exfat, local, nodev, nosuid, noowners, noatime, mounted by mj)
/dev/disk5s1 on /Volumes/My (Old) Card (msdos, local, nodev, nosuid, noowners)
//mj@nas._smb._tcp.local/photos on /Volumes/photos (smbfs, nodev, nosuid, mounted by mj)
/dev/disk6s2 on /Volumes/Backup (apfs, local, nodev, nosuid, journaled, noowners)`;

  it("parses paths (including parentheses) and file systems", () => {
    expect(parseMacMounts(MOUNT)).toEqual([
      { path: "/Volumes/NIKON Z 8", name: "NIKON Z 8", fsType: "exfat" },
      { path: "/Volumes/My (Old) Card", name: "My (Old) Card", fsType: "msdos" },
      { path: "/Volumes/photos", name: "photos", fsType: "smbfs" },
      { path: "/Volumes/Backup", name: "Backup", fsType: "apfs" },
    ]);
  });

  it("only considers FAT/exFAT volumes, never network shares or APFS drives", () => {
    const cards = parseMacMounts(MOUNT).filter((m) => CARD_FILESYSTEMS.has(m.fsType));
    expect(cards.map((c) => c.name)).toEqual(["NIKON Z 8", "My (Old) Card"]);
  });

  it("recognises Nikon cards and rejects other brands", () => {
    expect(looksLikeNikonCard(["DCIM", "NIKON"], ["100NZ8__"])).toBe(true);
    expect(looksLikeNikonCard(["DCIM"], ["100NCZ_F", "101NCZ_F"])).toBe(true);
    expect(looksLikeNikonCard(["DCIM", "NIKON001.DSC"], [])).toBe(true);
    expect(looksLikeNikonCard(["DCIM"], [])).toBe(true); // freshly formatted
    expect(looksLikeNikonCard(["DCIM", "PRIVATE"], ["100MSDCF"])).toBe(false); // Sony
    expect(looksLikeNikonCard(["DCIM", "MISC"], ["100CANON"])).toBe(false); // Canon
    expect(looksLikeNikonCard(["Photos", "Documents"], null)).toBe(false);
  });

  it("gives up on a volume that doesn't answer", async () => {
    const never = new Promise<string>(() => undefined);
    await expect(withTimeout(never, 20, "timeout")).resolves.toBe("timeout");
    await expect(withTimeout(Promise.resolve("ok"), 20, "timeout")).resolves.toBe("ok");
  });
});

describe("card file names", () => {
  it("accepts any plain NP3 name, including non-ASCII and parentheses", () => {
    for (const name of ["PICCON01.NP3", "Kodak Gold (Zf).NP3", "필름 레시피.np3", "a-b_c.d.NP3"]) {
      expect(isSafeNp3Name(name)).toBe(true);
    }
  });

  it("rejects paths, hidden files and other extensions", () => {
    for (const name of ["../x.NP3", "sub/x.NP3", "C:\\x.NP3", ".hidden.NP3", "._PICCON01.NP3", "x.jpg", "", 42]) {
      expect(isSafeNp3Name(name)).toBe(false);
    }
  });
});

describe("login agent", () => {
  it("launches the app bundle with the login flag", () => {
    const bundle = appBundleFromExecPath("/Applications/NP3 Lab.app/Contents/MacOS/NP3 Lab");
    expect(bundle).toBe("/Applications/NP3 Lab.app");
    const plist = launchAgentPlist(bundle);
    expect(plist).toContain("<string>/Applications/NP3 Lab.app</string>");
    expect(plist).toContain(`<string>${LOGIN_FLAG}</string>`);
    expect(plist).toContain("<key>RunAtLoad</key>");
  });

  it("escapes XML in the bundle path", () => {
    expect(launchAgentPlist("/Applications/A & B <x>.app")).toContain("/Applications/A &amp; B &lt;x&gt;.app");
  });
});
