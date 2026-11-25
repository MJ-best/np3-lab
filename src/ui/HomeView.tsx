import { useMemo } from "preact/hooks";
import { currentCamera } from "../camera";
import { activeCard, pickAndroidCard } from "../cards";
import { t } from "../i18n";
import { haptic, isAndroid, isDesktop } from "../native";
import {
  activeSample,
  allRecipes,
  cartRecipes,
  guideCollapsed,
  myRecipes,
  openNewEditor,
  reopenOnboarding,
  route,
  setGuideCollapsed,
} from "../state";
import { CameraGuide } from "./CameraGuide";
import { CardView } from "./CardView";
import { Cart } from "./Cart";
import { usePreparedSample } from "./hooks";
import { RecipeCard } from "./RecipeCard";

export function HomeView() {
  const source = usePreparedSample(activeSample.value);
  const card = activeCard.value;
  const camera = currentCamera.value;
  const collapsed = guideCollapsed.value;
  const readyCount = isDesktop ? (card?.np3Count ?? 0) : cartRecipes.value.length;

  // Lead with the user's own recipes, then fill up to 6 slots with built-ins.
  const featured = useMemo(() => {
    const mine = myRecipes.value.slice(0, 6);
    if (mine.length >= 6) return mine;
    const seen = new Set(mine.map((r) => r.id));
    const rest = allRecipes.value.filter((r) => !seen.has(r.id)).slice(0, 6 - mine.length);
    return [...mine, ...rest];
  }, [myRecipes.value, allRecipes.value]);

  const step2Done = isDesktop ? !!card : cartRecipes.value.length > 0;
  const step3Done = readyCount > 0;

  return (
    <div class="home-view">
      {/* Primary hub: SD card on native apps, card pack on web */}
      <section class="home-card-section">{isDesktop ? <CardView embedded /> : <Cart />}</section>

      {/* Collapsible 3-step Quick-Start Guide */}
      <section class="panel home-guide">
        <div class="home-guide-head">
          <h3>{t("homeGuideTitle")}</h3>
          <div class="home-guide-actions">
            <button
              class="ghost small-btn"
              onClick={() => {
                haptic("light");
                reopenOnboarding();
              }}
            >
              {t("homeReplayTutorial")}
            </button>
            <button
              class="ghost small-btn"
              aria-expanded={!collapsed}
              onClick={() => setGuideCollapsed(!collapsed)}
            >
              {collapsed ? t("homeExpand") : t("homeCollapse")}
            </button>
          </div>
        </div>
        {!collapsed && (
          <ol class="home-guide-steps">
            <li class="home-step done" onClick={reopenOnboarding}>
              <span class="home-step-num" aria-hidden="true">
                ✓
              </span>
              <div class="home-step-body">
                <strong>{t("homeGuideStep1Title")}</strong>
                <span>{camera.label || t("otherZ")}</span>
              </div>
            </li>
            <li
              class={`home-step${step2Done ? " done" : ""}${isAndroid && !card ? " actionable" : ""}`}
              onClick={() => {
                if (isAndroid && !card) {
                  haptic("light");
                  void pickAndroidCard();
                }
              }}
            >
              <span class="home-step-num" aria-hidden="true">
                {step2Done ? "✓" : "2"}
              </span>
              <div class="home-step-body">
                <strong>{t("homeGuideStep2Title")}</strong>
                <span>
                  {isDesktop ? (card ? card.name : t("homeGuideStep2Idle")) : t("homeGuideStep2Web")}
                </span>
              </div>
            </li>
            <li
              class={`home-step${step3Done ? " done" : " actionable"}`}
              onClick={() => {
                haptic("light");
                route.value = "gallery";
              }}
            >
              <span class="home-step-num" aria-hidden="true">
                {step3Done ? "✓" : "3"}
              </span>
              <div class="home-step-body">
                <strong>{t("homeGuideStep3Title")}</strong>
                <span>{step3Done ? t("homeGuideStep3Count", { n: readyCount }) : t("homeGuideStep3Idle")}</span>
              </div>
            </li>
          </ol>
        )}
      </section>

      {/* Featured & recent recipes */}
      <section class="home-section">
        <div class="home-section-head">
          <h3>{t("homeFeaturedTitle")}</h3>
          <div class="home-section-actions">
            <button class="small-btn" onClick={openNewEditor}>
              ＋ {t("newRecipe")}
            </button>
            <button
              class="ghost small-btn"
              onClick={() => {
                haptic("selection");
                route.value = "gallery";
              }}
            >
              {t("homeSeeAll")} →
            </button>
          </div>
        </div>
        <div class="grid">
          {featured.map((r) => (
            <RecipeCard key={r.id} recipe={r} source={source} />
          ))}
        </div>
      </section>

      {/* Camera loading guide */}
      <details class="panel guide-details">
        <summary>{t("cameraGuideTitle")}</summary>
        <CameraGuide title={false} />
      </details>
    </div>
  );
}
