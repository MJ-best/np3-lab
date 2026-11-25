import { activeCard, addToActiveCard, onActiveCard, removeFromActiveCard } from "../cards";
import { t } from "../i18n";
import { haptic, isDesktop } from "../native";
import type { Recipe } from "../np3/recipe";
import { cart, detailId, route, showToast, toggleCart } from "../state";

/**
 * "Add" toggle used on recipe cards and in the detail view.
 * Desktop/mobile app: writes to / removes from the inserted card right away, or guides to connect one.
 * Browser: adds to the basket that becomes a ZIP.
 */
export function CardButton({ recipe, className, big = false }: { recipe: Recipe; className: string; big?: boolean }) {
  if (!isDesktop) {
    const on = cart.value.includes(recipe.id);
    return (
      <button
        class={`${className}${on ? " on" : ""}`}
        onClick={() => {
          haptic("light");
          toggleCart(recipe.id);
        }}
        aria-pressed={on}
      >
        {on ? `✓ ${t("added")}` : big ? `＋ ${t("addToCard")}` : `＋ ${t("add")}`}
      </button>
    );
  }
  const card = activeCard.value;
  const item = onActiveCard.value.get(recipe.id);
  if (!card) {
    return (
      <button
        class={`${className} no-card-cta`}
        onClick={() => {
          haptic("light");
          detailId.value = null;
          route.value = "home";
          showToast(t("connectCardFirst"), "info", 4500);
        }}
      >
        {big ? `💾 ${t("connectCard")}` : t("addToThisCard")}
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
