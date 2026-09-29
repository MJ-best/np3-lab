import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  activeCard,
  activeCardId,
  activeItems,
  addToActiveCard,
  cardLoading,
  cards,
  ejectActiveCard,
  formatBytes,
  onActiveCard,
  removeFromActiveCard,
  renameOnActiveCard,
  revealActiveCard,
  type CardItem,
} from "../cards";
import { lang, t, tagLabel, tx } from "../i18n";
import { NP_NAME_MAX, type Recipe } from "../np3/recipe";
import { MAX_PER_CARD } from "../pack/naming";
import { renderThumbnail, type PreparedSource } from "../render/renderer";
import { activeSample, allRecipes, detailId } from "../state";
import { CameraGuide } from "./CameraGuide";
import { usePreparedSample } from "./hooks";
import { Overlay } from "./RecipeDetail";

function Thumb({ source, recipe, width = 360 }: { source: PreparedSource | null; recipe: Recipe; width?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!source) return;
    let alive = true;
    renderThumbnail(source, recipe.params ?? null, width).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [source, recipe.params]);
  return url ? <img src={url} alt="" draggable={false} /> : <div class="thumb-placeholder" />;
}

function CardTile({ item, source }: { item: CardItem; source: PreparedSource | null }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.recipe.npName);
  const title = tx(item.recipe.title);
  // Enter unmounts the input, which then also fires blur: only the first one counts.
  const committed = useRef(false);
  const startEditing = () => {
    committed.current = false;
    setEditing(true);
  };
  // Read the input itself: Enter can arrive before the last keystroke's state update.
  const commit = (value: string) => {
    if (committed.current) return;
    committed.current = true;
    setEditing(false);
    if (value.trim() && value !== item.recipe.npName) void renameOnActiveCard(item, value);
    else setName(item.recipe.npName);
  };
  return (
    <article class="card card-file">
      <button class="card-thumb" onClick={() => (detailId.value = item.recipe.id)} aria-label={title}>
        <Thumb source={source} recipe={item.recipe} />
        {item.inLibrary && <span class="badge floating ok-badge">✓ {t("backedUp")}</span>}
        {!item.recipe.params && <span class="badge floating right warn">NP3</span>}
      </button>
      <div class="card-body">
        {editing ? (
          <input
            class="rename-input mono"
            value={name}
            maxLength={NP_NAME_MAX}
            spellcheck={false}
            autoFocus
            onInput={(e) => setName(e.currentTarget.value.replace(/[^A-Za-z0-9 _\-]/g, ""))}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(e.currentTarget.value);
              if (e.key === "Escape") {
                committed.current = true;
                setName(item.recipe.npName);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button class="card-npname mono" title={t("rename")} onClick={startEditing}>
            {item.recipe.npName} <span aria-hidden="true">✎</span>
          </button>
        )}
        <div class="card-file-row">
          <span class="muted small">
            {item.fileName}
            {title !== item.recipe.npName && ` · ${title}`}
          </span>
          <button class="icon-btn subtle" title={t("removeFromCard")} aria-label={t("removeFromCard")} onClick={() => removeFromActiveCard(item)}>
            🗑
          </button>
        </div>
      </div>
    </article>
  );
}

function RecipePicker({ onClose, source }: { onClose: () => void; source: PreparedSource | null }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const onCard = onActiveCard.value;
  const card = activeCard.value;
  const slots = Math.max(0, MAX_PER_CARD - (card?.np3Count ?? 0));
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRecipes.value.filter(
      (r) => !q || [tx(r.title), r.npName, ...r.tags.map(tagLabel)].join(" ").toLowerCase().includes(q),
    );
  }, [query, allRecipes.value, lang.value]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Overlay onClose={onClose}>
      <div class="dialog wide picker" role="dialog" aria-modal="true" aria-label={t("pickerTitle")}>
        <div class="detail-head">
          <h2>{t("pickerTitle")}</h2>
          <button class="icon-btn" aria-label={t("close")} onClick={onClose}>
            ✕
          </button>
        </div>
        <div class="picker-bar">
          <input type="search" placeholder={t("search")} value={query} onInput={(e) => setQuery(e.currentTarget.value)} autoFocus />
          <span class="muted small">{t("slotsLeft", { n: slots - picked.length })}</span>
        </div>
        {allRecipes.value.length === 0 && <p class="empty small-empty">{t("pickerEmpty")}</p>}
        <div class="picker-grid">
          {list.map((r) => {
            const already = onCard.has(r.id);
            const checked = picked.includes(r.id);
            return (
              <button
                key={r.id}
                class={`pick${checked ? " checked" : ""}${already ? " already" : ""}`}
                disabled={already || (!checked && picked.length >= slots)}
                onClick={() => toggle(r.id)}
              >
                <div class="pick-thumb">
                  <Thumb source={source} recipe={r} width={260} />
                  <span class="pick-check">{already ? "✓" : checked ? "✓" : ""}</span>
                </div>
                <span class="pick-title">{tx(r.title)}</span>
                <span class="pick-sub mono">{already ? t("onCard") : r.npName}</span>
              </button>
            );
          })}
        </div>
        <div class="button-row end">
          <button class="ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            class="primary"
            disabled={picked.length === 0}
            onClick={() => {
              const byId = new Map(allRecipes.value.map((r) => [r.id, r]));
              void addToActiveCard(picked.map((id) => byId.get(id)!).filter(Boolean));
              onClose();
            }}
          >
            {t("putSelected", { n: picked.length })}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function CardView() {
  const [picking, setPicking] = useState(false);
  const source = usePreparedSample(activeSample.value);
  const card = activeCard.value;

  if (!card) {
    return (
      <div class="no-card">
        <div class="no-card-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="72" height="72">
            <path d="M18 6h22l12 12v38a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="3" />
            <path d="M26 6v10M32 6v10M38 6v10" stroke="currentColor" stroke-width="3" />
          </svg>
        </div>
        <h2>{t("noCardTitle")}</h2>
        <p>{t("noCardBody")}</p>
        <p class="hint">{t("noCardTray")}</p>
        <div class="panel no-card-guide">
          <CameraGuide />
        </div>
      </div>
    );
  }

  const items = activeItems.value;
  const count = card.np3Count;
  return (
    <div class="card-view">
      {cards.value.length > 1 && (
        <div class="chips">
          {cards.value.map((c) => (
            <button key={c.id} class={`chip${c.id === card.id ? " active" : ""}`} onClick={() => (activeCardId.value = c.id)}>
              💾 {c.name}
            </button>
          ))}
        </div>
      )}
      <div class="card-head panel">
        <div class="card-head-main">
          <h2>💾 {card.name}</h2>
          <div class="capacity">
            <div class="capacity-bar">
              <span style={{ width: `${Math.min(100, (count / MAX_PER_CARD) * 100)}%` }} />
            </div>
            <span class="muted small">
              {t("cardRecipes", { n: count })}
              {card.freeBytes !== null && ` · ${t("freeSpace", { size: formatBytes(card.freeBytes) })}`}
            </span>
          </div>
        </div>
        <div class="card-head-actions">
          <button class="primary" onClick={() => setPicking(true)} disabled={count >= MAX_PER_CARD}>
            {t("addRecipesBtn")}
          </button>
          <button onClick={() => revealActiveCard()}>{t("revealInFinder")}</button>
          <button onClick={() => ejectActiveCard()}>⏏ {t("eject")}</button>
        </div>
      </div>

      {items.length === 0 && !cardLoading.value ? (
        <p class="empty">{t("cardEmptyHere")}</p>
      ) : (
        <div class="grid">
          {items.map((it) => (
            <CardTile key={`${it.fileName}:${it.recipe.npName}`} item={it} source={source} />
          ))}
        </div>
      )}

      <details class="panel guide-details">
        <summary>{t("cameraGuideTitle")}</summary>
        <CameraGuide title={false} />
      </details>

      {picking && <RecipePicker source={source} onClose={() => setPicking(false)} />}
    </div>
  );
}
