import { useMemo, useState } from "preact/hooks";
import { activeCard, pickAndroidCard } from "../cards";
import { t } from "../i18n";
import { haptic, isAndroid, isDesktop } from "../native";
import {
  activeSample,
  allRecipes,
  myRecipes,
  openNewEditor,
  reopenOnboarding,
  route,
} from "../state";
import { CameraGuide } from "./CameraGuide";
import { CardView } from "./CardView";
import { Cart } from "./Cart";
import { usePreparedSample } from "./hooks";
import { IconCard, IconChevronDown, IconChevronRight, IconPlus } from "./Icons";
import { RecipeCard } from "./RecipeCard";

export function HomeView() {
  const source = usePreparedSample(activeSample.value);
  const card = activeCard.value;
  const [guideOpen, setGuideOpen] = useState(false);

  // Lead with the user's own recipes, then fill up to 6 slots with built-ins.
  const featured = useMemo(() => {
    const mine = myRecipes.value.slice(0, 6);
    if (mine.length >= 6) return mine;
    const seen = new Set(mine.map((r) => r.id));
    const rest = allRecipes.value.filter((r) => !seen.has(r.id)).slice(0, 6 - mine.length);
    return [...mine, ...rest];
  }, [myRecipes.value, allRecipes.value]);

  return (
    <div class="home-view">
      {/* Compact 1-row SD card status banner when idle, full CardView when connected */}
      <section class="home-card-section">
        {isDesktop ? (
          card ? (
            <CardView embedded />
          ) : (
            <div class="sd-strip">
              <div class="sd-strip-icon" aria-hidden="true">
                <IconCard size={20} />
              </div>
              <div class="sd-strip-text">
                <strong>{t("homeCardStripTitle")}</strong>
                <span>{t("homeCardStripSub")}</span>
              </div>
              {isAndroid && (
                <button
                  class="primary sd-strip-cta"
                  onClick={() => {
                    haptic("light");
                    void pickAndroidCard();
                  }}
                >
                  {t("connectCard")}
                </button>
              )}
            </div>
          )
        ) : (
          <Cart />
        )}
      </section>

      {/* Apple Photos-style Memories / Featured poster carousel */}
      <section class="home-section">
        <div class="home-section-head">
          <h3>{t("homeFeaturedTitle")}</h3>
          <div class="home-section-actions">
            <button
              class="ghost small-btn"
              onClick={() => {
                haptic("light");
                openNewEditor();
              }}
            >
              <span class="btn-inline">
                <IconPlus size={14} />
                {t("newRecipe")}
              </span>
            </button>
            <button
              class="ghost small-btn home-see-all"
              onClick={() => {
                haptic("selection");
                route.value = "gallery";
              }}
            >
              <span class="btn-inline">
                {t("homeSeeAll")}
                <IconChevronRight size={14} />
              </span>
            </button>
          </div>
        </div>
        <div class="grid home-carousel">
          {featured.map((r) => (
            <RecipeCard key={r.id} recipe={r} source={source} poster />
          ))}
        </div>
      </section>

      {/* Clean Apple Photos Collections-style utility rows */}
      <section class="grouped-list">
        <div class="grouped-item">
          <button
            type="button"
            class={`grouped-row${guideOpen ? " open" : ""}`}
            aria-expanded={guideOpen}
            onClick={() => {
              haptic("selection");
              setGuideOpen(!guideOpen);
            }}
          >
            <span class="grouped-row-title">{t("cameraGuideTitle")}</span>
            <span class="grouped-chevron">
              <IconChevronDown size={16} />
            </span>
          </button>
          {guideOpen && (
            <div class="grouped-collapse">
              <CameraGuide title={false} />
            </div>
          )}
        </div>
        <div class="grouped-item">
          <button
            type="button"
            class="grouped-row"
            onClick={() => {
              haptic("light");
              reopenOnboarding();
            }}
          >
            <span class="grouped-row-title">{t("homeReplayTutorial")}</span>
            <span class="grouped-chevron">
              <IconChevronRight size={16} />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
