import { useState } from "preact/hooks";
import { currentCamera, setCameraModel } from "../camera";
import { CAMERA_GUIDES } from "../cameraGuide";
import { lang, t } from "../i18n";
import { haptic } from "../native";
import { IconCamera, IconCheck, IconChevronDown } from "./Icons";
import { Overlay } from "./RecipeDetail";

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
            onClick={() => {
              haptic("selection");
              setCameraModel(g.id);
            }}
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

/** The camera the recipes are for, as a native-style picker trigger + sheet (settings, recipes tab). */
export function CameraSelect() {
  const [open, setOpen] = useState(false);
  const current = currentCamera.value;
  const label = (current.label || t("otherZ")) + (current.legacy ? ` · ${t("legacyShort")}` : "");

  return (
    <>
      <button
        type="button"
        class="camera-select-btn"
        aria-label={t("cameraModel")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          haptic("light");
          setOpen(true);
        }}
      >
        <IconCamera size={15} />
        <span class="camera-select-label">{label}</span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <Overlay onClose={() => setOpen(false)}>
          <div class="dialog camera-picker-dialog" role="dialog" aria-modal="true" aria-label={t("cameraModel")}>
            <div class="detail-head">
              <h2>{t("cameraModel")}</h2>
              <button class="icon-btn" aria-label={t("close")} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div class="sheet-list" role="listbox" aria-label={t("cameraModel")}>
              {CAMERA_GUIDES.map((g) => {
                const selected = g.id === current.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    class={`sheet-item${selected ? " active" : ""}`}
                    onClick={() => {
                      haptic("selection");
                      setCameraModel(g.id);
                      setOpen(false);
                    }}
                  >
                    <span class="sheet-item-main">
                      <strong>{g.label || t("otherZ")}</strong>
                      <span class={`badge${g.legacy ? "" : " accent"}`}>{g.legacy ? "NCP" : "NP3"}</span>
                    </span>
                    {selected && (
                      <span class="sheet-item-check">
                        <IconCheck size={16} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}
