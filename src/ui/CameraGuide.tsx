import { signal } from "@preact/signals";
import { CAMERA_GUIDES, DEFAULT_CAMERA, type CameraGuide as Guide } from "../cameraGuide";
import { lang, t } from "../i18n";
import { readStore, writeStore } from "../storage";

const selected = signal<string>(readStore<string>("cameraModel") ?? DEFAULT_CAMERA);

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
  const guide: Guide = CAMERA_GUIDES.find((g) => g.id === selected.value) ?? CAMERA_GUIDES[0];
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
            onClick={() => {
              selected.value = g.id;
              writeStore("cameraModel", g.id);
            }}
          >
            {g.label || t("otherZ")}
          </button>
        ))}
      </div>

      {guide.unsupported ? (
        <p class="guide-warning">{t("otherZNote")}</p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
