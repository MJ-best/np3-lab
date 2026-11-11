import { currentCamera, setCameraModel } from "../camera";
import { CAMERA_GUIDES } from "../cameraGuide";
import { lang, t } from "../i18n";

function MenuPath({ items }: { items: string[] }) {
  return (
    <span class="menu-path">
      <kbd>MENU</kbd>
      {items.map((item) => (
        <>
          <span class="menu-sep" aria-hidden="true">
            ›
          </span>
          <kbd>{item}</kbd>
        </>
      ))}
    </span>
  );
}

/** Step-by-step instructions for loading recipes on the chosen camera model. */
export function CameraGuide({ title = true }: { title?: boolean }) {
  const guide = currentCamera.value;
  const l = lang.value;
  return (
    <div class="camera-guide">
      {title && <h3>{t("cameraGuideTitle")}</h3>}
      <div class="chips" role="radiogroup" aria-label={t("cameraModel")}>
        {CAMERA_GUIDES.map((g) => (
          <button
            key={g.id}
            role="radio"
            aria-checked={g.id === guide.id}
            class={`chip${g.id === guide.id ? " active" : ""}`}
            onClick={() => setCameraModel(g.id)}
          >
            {g.label || t("otherZ")}
          </button>
        ))}
      </div>

      {guide.legacy && <p class="guide-warning">{t("legacyNote", { model: guide.label || t("otherZ") })}</p>}
      {guide.firmware && <p class="guide-firmware">{t("firmwareNeeded", { model: guide.label, fw: guide.firmware })}</p>}
      <ol class="guide-steps">
        <li>{guide.twoSlots ? t("stepInsertPrimary") : t("stepInsert")}</li>
        <li>
          <MenuPath items={guide.path[l]} />
          {guide.altPath && (
            <div class="guide-alt">
              {t("altPathNote")} <MenuPath items={guide.altPath[l]} />
            </div>
          )}
        </li>
        <li>{t("stepPick")}</li>
        <li>{t("stepUse")}</li>
      </ol>
      <p class="hint">{t("slotNote")}</p>
    </div>
  );
}

/** The camera the recipes are for, as a compact menu (settings, the recipes tab). */
export function CameraSelect() {
  return (
    <select class="camera-select" aria-label={t("cameraModel")} value={currentCamera.value.id} onChange={(e) => setCameraModel(e.currentTarget.value)}>
      {CAMERA_GUIDES.map((g) => (
        <option key={g.id} value={g.id}>
          {(g.label || t("otherZ")) + (g.legacy ? ` · ${t("legacyShort")}` : "")}
        </option>
      ))}
    </select>
  );
}
