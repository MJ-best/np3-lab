import { useEffect, useState } from "preact/hooks";
import { currentCamera, setCameraModel } from "../camera";
import { CAMERA_GUIDES } from "../cameraGuide";
import { pickAndroidCard } from "../cards";
import { t } from "../i18n";
import { haptic, isAndroid, isDesktop } from "../native";
import { completeOnboarding, onboardingOpen, route } from "../state";
import { Overlay } from "./RecipeDetail";

export function Onboarding() {
  const open = onboardingOpen.value;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const guide = currentCamera.value;

  const finish = (target: "home" | "gallery", connectCard = false) => {
    haptic("light");
    completeOnboarding();
    route.value = target;
    if (connectCard) void pickAndroidCard();
  };

  return (
    <Overlay onClose={completeOnboarding} sheet={false}>
      <div class="dialog onboarding" role="dialog" aria-modal="true" aria-label={t("homeGuideTitle")}>
        <div class="onboarding-top">
          <div class="onboarding-dots" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} class={`onboarding-dot${step === i ? " active" : step > i ? " done" : ""}`} />
            ))}
          </div>
          <button class="ghost small-btn" onClick={() => finish("home")}>
            {t("onboardSkip")}
          </button>
        </div>

        {step === 0 && (
          <div class="onboarding-body">
            <div class="onboarding-hero-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path
                  d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.4-2h4.2l1.4 2h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7" />
              </svg>
            </div>
            <h2>{t("onboardStep1Title")}</h2>
            <p class="onboarding-desc">{t("onboardStep1Desc")}</p>
            <div class="chips onboarding-chips" role="radiogroup" aria-label={t("cameraModel")}>
              {CAMERA_GUIDES.map((g) => (
                <button
                  key={g.id}
                  role="radio"
                  aria-checked={g.id === guide.id}
                  class={`chip${g.id === guide.id ? " active" : ""}`}
                  onClick={() => {
                    haptic("selection");
                    setCameraModel(g.id);
                  }}
                >
                  {g.label || t("otherZ")}
                </button>
              ))}
            </div>
            <p class={`onboarding-support${guide.legacy ? " warn" : " ok"}`}>
              {guide.legacy ? t("onboardLegacySupport") : t("onboardFlexSupport")}
            </p>
          </div>
        )}

        {step === 1 && (
          <div class="onboarding-body">
            <h2>{t("onboardStep2Title")}</h2>
            <p class="onboarding-desc">{t("onboardStep2Desc")}</p>
            <ol class="onboarding-steps">
              <li>
                <span class="onboarding-step-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8" />
                    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8" />
                    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8" />
                    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8" />
                  </svg>
                </span>
                <div>
                  <strong>{t("onboardFlow1Title")}</strong>
                  <p>{t("onboardFlow1Desc")}</p>
                </div>
              </li>
              <li>
                <span class="onboarding-step-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M7 3h7l5 5v12a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V4.5A1.5 1.5 0 0 1 7 3z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linejoin="round"
                    />
                    <path d="M9.5 3v4M12.5 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </span>
                <div>
                  <strong>{t("onboardFlow2Title")}</strong>
                  <p>{t("onboardFlow2Desc")}</p>
                </div>
              </li>
              <li>
                <span class="onboarding-step-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.4-2h4.2l1.4 2h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linejoin="round"
                    />
                    <circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8" />
                  </svg>
                </span>
                <div>
                  <strong>{t("onboardFlow3Title")}</strong>
                  <p>{t("onboardFlow3Desc")}</p>
                </div>
              </li>
            </ol>
          </div>
        )}

        {step === 2 && (
          <div class="onboarding-body">
            <div class="onboarding-hero-icon accent" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path
                  d="M7 3h7l5 5v12a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V4.5A1.5 1.5 0 0 1 7 3z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <path d="M9.5 3v4M12.5 3v4M9 14l2 2 4.2-4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <h2>{t("onboardStep3Title")}</h2>
            <p class="onboarding-desc">{t("onboardStep3Desc")}</p>
            <div class="onboarding-cta-stack">
              {isAndroid ? (
                <>
                  <button class="primary big" onClick={() => finish("home", true)}>
                    {t("onboardStartCard")}
                  </button>
                  <button class="big" onClick={() => finish("gallery")}>
                    {t("onboardStartBrowse")}
                  </button>
                </>
              ) : isDesktop ? (
                <>
                  <button class="primary big" onClick={() => finish("home")}>
                    {t("onboardStartHome")}
                  </button>
                  <button class="big" onClick={() => finish("gallery")}>
                    {t("onboardStartBrowse")}
                  </button>
                </>
              ) : (
                <>
                  <button class="primary big" onClick={() => finish("gallery")}>
                    {t("onboardStartBrowse")}
                  </button>
                  <button class="big" onClick={() => finish("home")}>
                    {t("onboardStartHome")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {step < 2 && (
          <div class="onboarding-foot">
            {step > 0 ? (
              <button
                class="ghost"
                onClick={() => {
                  haptic("light");
                  setStep(step - 1);
                }}
              >
                {t("onboardPrev")}
              </button>
            ) : (
              <span />
            )}
            <button
              class="primary"
              onClick={() => {
                haptic("light");
                setStep(step + 1);
              }}
            >
              {t("onboardNext")}
            </button>
          </div>
        )}
      </div>
    </Overlay>
  );
}
