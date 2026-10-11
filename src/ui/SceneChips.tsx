import { useRef } from "preact/hooks";
import { renamePhoto } from "../photos";
import { PHOTO_ACCEPT } from "../raw";
import { lang, t } from "../i18n";
import { hasBundledPhotos } from "../render/samples";
import { activeSample, activeSampleId, addUserPhoto, allSamples, deleteScene, setActiveSample } from "../state";

/**
 * Row of preview scenes. "My photo" comes first, so it never scrolls out of reach, followed by
 * your own photos (newest first; the chosen one can be renamed and deleted) and the built-in scenes.
 */
export function SceneChips({ showHint = false }: { showHint?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const own = activeSample.value?.kind === "user" ? activeSample.value : null;
  return (
    <div class="scenes">
      <div class="chips" role="tablist" aria-label={t("scene")}>
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
            // Picked here to preview on, so they stay preview photos even when shot with a recipe.
            for (const file of Array.from(input.files ?? [])) await addUserPhoto(file);
            input.value = "";
          }}
        />
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
      </div>
      {own && (
        <div class="scene-edit">
          <input
            key={own.id}
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
          <button class="danger ghost" onClick={() => void deleteScene(own.id)}>
            {t("deletePhoto")}
          </button>
        </div>
      )}
      {showHint && import.meta.env.DEV && !hasBundledPhotos && <p class="hint">{t("samplesHint")}</p>}
    </div>
  );
}
