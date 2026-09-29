import { activeCard, addToActiveCard, onActiveCard, removeFromActiveCard } from "../cards";
import { t } from "../i18n";
import { isDesktop } from "../native";
import type { Recipe } from "../np3/recipe";
import { cart, toggleCart } from "../state";

/**
 * "Add" toggle used on recipe cards and in the detail view.
 * Desktop: writes to / removes from the inserted card right away.
 * Browser: adds to the basket that becomes a ZIP.
 */
export function CardButton({ recipe, className, big = false }: { recipe: Recipe; className: string; big?: boolean }) {
  if (!isDesktop) {
    const on = cart.value.includes(recipe.id);
    return (
      <button class={`${className}${on ? " on" : ""}`} onClick={() => toggleCart(recipe.id)} aria-pressed={on}>
        {on ? `✓ ${t("added")}` : big ? `＋ ${t("addToCard")}` : `＋ ${t("add")}`}
      </button>
    );
  }
  const card = activeCard.value;
  const item = onActiveCard.value.get(recipe.id);
  if (!card) {
    return (
      <button class={className} disabled title={t("noCardTitle")}>
        {t("noCardShort")}
      </button>
    );
  }
  return (
    <button
      class={`${className}${item ? " on" : ""}`}
      aria-pressed={!!item}
      title={item ? t("removeFromCard") : card.name}
      onClick={() => (item ? removeFromActiveCard(item) : addToActiveCard([recipe]))}
    >
      {item ? `✓ ${t("onCard")}` : big ? `＋ ${card.name}` : t("addToThisCard")}
    </button>
  );
}
