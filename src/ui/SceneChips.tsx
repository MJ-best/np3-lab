import { useRef } from "preact/hooks";
import { importPhotos } from "../photoImport";
import { PHOTO_ACCEPT } from "../raw";
import { lang, t } from "../i18n";
import { hasBundledPhotos } from "../render/samples";
import { activeSampleId, allSamples, setActiveSample } from "../state";

/** Row of preview-scene chips plus a button to add your own photo. */
export function SceneChips({ showHint = false }: { showHint?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div class="scenes">
      <div class="chips" role="tablist" aria-label={t("scene")}>
        {allSamples.value.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === activeSampleId.value}
            class={`chip${s.id === activeSampleId.value ? " active" : ""}`}
            onClick={() => setActiveSample(s.id)}
          >
            {s.kind === "user" ? "📷 " : ""}
            {s.label[lang.value]}
          </button>
        ))}
        <button class="chip ghost" onClick={() => fileRef.current?.click()}>
          ＋ {t("addPhoto")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          hidden
          onChange={async (e) => {
            const input = e.currentTarget;
            // Recipe photos are filed under their recipe; the rest become preview scenes.
            await importPhotos(Array.from(input.files ?? []));
            input.value = "";
          }}
        />
      </div>
      {showHint && import.meta.env.DEV && !hasBundledPhotos && <p class="hint">{t("samplesHint")}</p>}
    </div>
  );
}
