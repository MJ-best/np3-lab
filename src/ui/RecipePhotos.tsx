import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import { deletePhoto, fullPhotoUrl, photosByRecipe, type PhotoThumb } from "../photos";
import { importPhotos } from "../photoImport";
import { PHOTO_ACCEPT } from "../raw";
import { FrameView } from "./FrameView";

export function Lightbox({ photos, index, onClose, onIndex }: { photos: PhotoThumb[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const photo = photos[index];
  const [url, setUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Set<number>());
  const swipe = useRef<{ id: number; startX: number; startY: number; axis: "x" | "y" | null; moved: boolean } | null>(null);
  const justSwiped = useRef(false);
  const hasMany = photos.length > 1;
  const goPrev = () => onIndex((index - 1 + photos.length) % photos.length);
  const goNext = () => onIndex((index + 1) % photos.length);

  useEffect(() => {
    setConfirmDelete(false);
    setDrag({ x: 0, y: 0 });
    setDragging(false);
    let alive = true;
    let current: string | null = null;
    void fullPhotoUrl(photo.id).then((u) => {
      current = u;
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
      setUrl(null);
    };
  }, [photo.id]);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3500);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
      if (hasMany && e.key === "ArrowRight") goNext();
      if (hasMany && e.key === "ArrowLeft") goPrev();
    };
    // Capture phase so Escape closes the photo before the recipe dialog underneath.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, photos.length]);

  const [framing, setFraming] = useState(false);
  if (framing) return <FrameView photo={photo} onBack={() => setFraming(false)} />;

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest("button")) return;
    pointers.current.add(e.pointerId);
    if (pointers.current.size !== 1) {
      swipe.current = null;
      setDragging(false);
      setDrag({ x: 0, y: 0 });
      return;
    }
    justSwiped.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    swipe.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, axis: null, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.axis && Math.hypot(dx, dy) > 10) {
      s.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      s.moved = true;
    }
    if (s.axis === "x") {
      setDrag({ x: hasMany ? dx : dx * 0.2, y: 0 });
    } else if (s.axis === "y") {
      setDrag({ x: 0, y: dy > 0 ? dy : dy * 0.15 });
    }
  };

  const finishSwipe = (e: PointerEvent, commit: boolean) => {
    pointers.current.delete(e.pointerId);
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const { axis, moved } = s;
    justSwiped.current = moved;
    swipe.current = null;
    setDragging(false);
    setDrag({ x: 0, y: 0 });
    if (!commit) return;
    if (axis === "x" && hasMany && Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    } else if (axis === "y" && dy > 90) {
      onClose();
    }
  };

  const dismissFade = drag.y > 0 ? Math.max(0.35, 1 - drag.y / 380) : 1;

  return (
    <div
      class="lightbox"
      style={{ background: `rgba(0, 0, 0, ${(0.94 * dismissFade).toFixed(2)})` }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div class="lightbox-top">
        <span class="lightbox-counter mono">
          {index + 1} / {photos.length}
        </span>
        <span class="lightbox-name">{photo.name}</span>
        <button class="icon-btn lightbox-close" aria-label={t("close")} onClick={onClose}>
          ✕
        </button>
      </div>
      <div
        class={`lightbox-stage${dragging ? " dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finishSwipe(e, true)}
        onPointerCancel={(e) => finishSwipe(e, false)}
        onClick={(e) => {
          if (e.target === e.currentTarget && !justSwiped.current) onClose();
          justSwiped.current = false;
        }}
      >
        {hasMany && (
          <button
            class="lightbox-nav prev"
            aria-label={t("prevPhoto")}
            title={t("prevPhoto")}
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        )}
        <img
          src={url ?? photo.thumbUrl}
          alt={photo.name}
          draggable={false}
          style={{
            transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`,
            opacity: dismissFade,
          }}
        />
        {hasMany && (
          <button
            class="lightbox-nav next"
            aria-label={t("nextPhoto")}
            title={t("nextPhoto")}
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <div class="lightbox-bar">
        {confirmDelete ? (
          <button
            class="danger confirm-active"
            onClick={async () => {
              setConfirmDelete(false);
              await deletePhoto(photo.id);
              if (photos.length <= 1) onClose();
              else onIndex(Math.min(index, photos.length - 2));
            }}
          >
            {t("confirmDeletePhoto")}
          </button>
        ) : (
          <button class="danger ghost" onClick={() => setConfirmDelete(true)}>
            {t("deletePhoto")}
          </button>
        )}
        <button class="primary" onClick={() => setFraming(true)}>
          {t("frameBtn")}
        </button>
      </div>
    </div>
  );
}

/**
 * "Photos taken with this recipe" — the user's own examples, added by hand or by drag & drop.
 * `wall` is the full gallery (photos keep their shape, portrait or landscape); `compact`
 * is the invitation shown under the preview while a recipe has no photos yet.
 */
export function RecipePhotos({ recipeId, layout = "compact" }: { recipeId: string; layout?: "wall" | "compact" }) {
  const photos = photosByRecipe.value[recipeId] ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    // Each photo goes to the recipe it was shot with; ones without that info stay here.
    await importPhotos(files, { into: recipeId });
    setBusy(false);
  };

  return (
    <section
      class={`recipe-photos ${layout}${over ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        // Handled here so the window-level drop doesn't also treat them as preview scenes.
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        void add(Array.from(e.dataTransfer?.files ?? []));
      }}
    >
      <div class="recipe-photos-head">
        <h3>
          {t("myPhotosTitle")} {photos.length > 0 && <span class="count">{photos.length}</span>}
        </h3>
        <button class="small-btn" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "…" : `＋ ${t("addPhotos")}`}
        </button>
        <input
          ref={input}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const el = e.currentTarget;
            void add(Array.from(el.files ?? []));
            el.value = "";
          }}
        />
      </div>
      {photos.length === 0 ? (
        <p class="hint">{t("myPhotosEmpty")}</p>
      ) : (
        <div class={layout === "wall" ? "photo-wall" : "photo-grid"}>
          {photos.map((p, i) => (
            <button key={p.id} class="photo-tile" onClick={() => setOpen(i)} aria-label={p.name}>
              <img src={p.thumbUrl} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
      {open !== null && photos[open] && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </section>
  );
}
