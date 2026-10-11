import { useRef } from "preact/hooks";
import { importPhotos } from "../photoImport";
import { renamePhoto } from "../photos";
import { PHOTO_ACCEPT } from "../raw";
import { lang, t } from "../i18n";
import { hasBundledPhotos } from "../render/samples";
import { activeSample, activeSampleId, allSamples, deleteScene, setActiveSample } from "../state";

/** Row of preview-scene chips plus a button to add your own photo; your own can be renamed and deleted. */
export function SceneChips({ showHint = false }: { showHint?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const own = activeSample.value?.kind === "user" ? activeSample.value : null;
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
            {s.thumb && <img class="chip-thumb" src={s.thumb} alt="" draggable={false} />}
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
      {own && (
        <div class="scene-edit">
          <input
            key={own.id}
            class="rename-input"
            defaultValue={own.label[lang.value]}
            maxLength={60}
            aria-label={t("sceneName")}
            placeholder={t("sceneName")}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onChange={(e) => {
              const name = e.currentTarget.value.trim();
              if (name) void renamePhoto(own.id, name);
              else e.currentTarget.value = own.label[lang.value];
            }}
          />
          <button class="small-btn danger ghost" onClick={() => void deleteScene(own.id)}>
            {t("deletePhoto")}
          </button>
        </div>
      )}
      {showHint && import.meta.env.DEV && !hasBundledPhotos && <p class="hint">{t("samplesHint")}</p>}
    </div>
  );
}
