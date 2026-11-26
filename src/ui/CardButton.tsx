import { activeCard, addToActiveCard, onActiveCard, removeFromActiveCard } from "../cards";
import { t } from "../i18n";
import { haptic, isDesktop } from "../native";
import type { Recipe } from "../np3/recipe";
import { cart, detailId, route, showToast, toggleCart } from "../state";
import { IconCard, IconCheck, IconPlus } from "./Icons";

/**
 * "Add" toggle used on recipe cards and in the detail view.
 * Desktop/mobile app: writes to / removes from the inserted card right away, or guides to connect one.
 * Browser: adds to the basket that becomes a ZIP.
 */
export function CardButton({
  recipe,
  className,
  big = false,
  compact = false,
}: {
  recipe: Recipe;
  className: string;
  big?: boolean;
  compact?: boolean;
}) {
  if (!isDesktop) {
    const on = cart.value.includes(recipe.id);
    return (
      <button
        type="button"
        class={`${className}${on ? " on" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          haptic("light");
          toggleCart(recipe.id);
        }}
        aria-pressed={on}
        aria-label={on ? t("added") : t("addToCard")}
      >
        {compact ? (on ? <IconCheck size={15} /> : <IconPlus size={15} />) : on ? `✓ ${t("added")}` : big ? `＋ ${t("addToCard")}` : `＋ ${t("add")}`}
      </button>
    );
  }
  const card = activeCard.value;
  const item = onActiveCard.value.get(recipe.id);
  if (!card) {
    return (
      <button
        type="button"
        class={`${className} no-card-cta`}
        aria-label={t("connectCard")}
        onClick={(e) => {
          e.stopPropagation();
          haptic("light");
          detailId.value = null;
          route.value = "home";
          showToast(t("connectCardFirst"), "info", 4500);
        }}
      >
        {compact ? (
          <IconPlus size={15} />
        ) : big ? (
          <span class="btn-inline">
            <IconCard size={16} />
            {t("connectCard")}
          </span>
        ) : (
          t("addToThisCard")
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      class={`${className}${item ? " on" : ""}`}
      aria-pressed={!!item}
      aria-label={item ? t("removeFromCard") : t("addToThisCard")}
      title={item ? t("removeFromCard") : card.name}
      onClick={(e) => {
        e.stopPropagation();
        if (item) void removeFromActiveCard(item);
        else void addToActiveCard([recipe]);
      }}
    >
      {compact ? (item ? <IconCheck size={15} /> : <IconPlus size={15} />) : item ? `✓ ${t("onCard")}` : big ? `＋ ${card.name}` : t("addToThisCard")}
    </button>
  );
}
