/*
 * How to load a recipe from the memory card on each camera.
 * Menu names follow Nikon's Korean/English/Japanese reference guides
 * (onlinemanual.nikonimglib.com; Japanese checked on the Zf and Z8 manuals). The Zf path comes from a user's own camera.
 */

type Path = { ko: string[]; en: string[]; ja: string[] };

/** Photo shooting menu › Manage Picture Control › Load/save › Copy to camera (every Z-series guide). */
const LOAD_SAVE: Path = {
  ko: ["사진 촬영 메뉴", "Picture Control 관리", "로드/저장", "카메라에 복사"],
  en: ["Photo shooting menu", "Manage Picture Control", "Load/save", "Copy to camera"],
  ja: ["静止画撮影メニュー", "カスタムピクチャーコントロール", "メモリーカードを使用", "カメラに登録"],
};

const SAVE_EDIT: Path = {
  ko: ["사진 촬영 메뉴", "Picture Control 관리", "저장/편집"],
  en: ["Photo shooting menu", "Manage Picture Control", "Save/edit"],
  ja: ["静止画撮影メニュー", "カスタムピクチャーコントロール", "編集と登録"],
};

export interface CameraGuide {
  id: string;
  label: string;
  /** Minimum firmware for Flexible Color recipes, if the first release didn't have it. */
  firmware?: string;
  path: Path;
  /** Another path worth trying (e.g. the one in Nikon's manual when it differs). */
  altPath?: Path;
  /** Two card slots: the card must be in the primary slot. */
  twoSlots: boolean;
  /** No Flexible Color: recipes go to it as original Picture Controls (.NCP). */
  legacy?: boolean;
}

export const CAMERA_GUIDES: CameraGuide[] = [
  { id: "zf", label: "Zf", firmware: "2.00", path: SAVE_EDIT, altPath: LOAD_SAVE, twoSlots: true },
  { id: "z6iii", label: "Z6III", path: LOAD_SAVE, twoSlots: true },
  { id: "z5ii", label: "Z5II", path: LOAD_SAVE, twoSlots: true },
  { id: "z50ii", label: "Z50II", path: LOAD_SAVE, twoSlots: false },
  { id: "zr", label: "ZR", path: LOAD_SAVE, twoSlots: false },
  { id: "z8", label: "Z8", firmware: "3.00", path: LOAD_SAVE, twoSlots: true },
  { id: "z9", label: "Z9", firmware: "5.30", path: LOAD_SAVE, twoSlots: true },
  // Older bodies load original Picture Controls only (Nikon: NCP works on every camera with custom Picture Controls).
  { id: "z6ii", label: "Z6II", path: LOAD_SAVE, twoSlots: true, legacy: true },
  { id: "z7ii", label: "Z7II", path: LOAD_SAVE, twoSlots: true, legacy: true },
  { id: "z5", label: "Z5", path: LOAD_SAVE, twoSlots: true, legacy: true },
  { id: "z6", label: "Z6", path: LOAD_SAVE, twoSlots: false, legacy: true },
  { id: "z7", label: "Z7", path: LOAD_SAVE, twoSlots: false, legacy: true },
  { id: "z50", label: "Z50", path: LOAD_SAVE, twoSlots: false, legacy: true },
  { id: "zfc", label: "Z fc", path: LOAD_SAVE, twoSlots: false, legacy: true },
  { id: "z30", label: "Z30", path: LOAD_SAVE, twoSlots: false, legacy: true },
  { id: "other", label: "", path: LOAD_SAVE, twoSlots: false, legacy: true },
];

export const DEFAULT_CAMERA = "zf";
