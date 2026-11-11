import { useState } from "preact/hooks";
import { authErrorText, guest, resetPassword, signIn, signInEmail, signUpEmail } from "../account";
import { lang, LANGS, setLang, t, type Lang } from "../i18n";
import { Logo } from "./Logo";

/*
 * Hosted web version: the first page for visitors who aren't signed in. Sign up (email or Google),
 * or go on without an account; below, how the app works and what's new.
 */

const RELEASES = "https://github.com/MJ-best/np3-lab/releases";

const COPY: Record<Lang, { title: string; lead: string; points: string[]; how: string; steps: [string, string][]; updates: string; allReleases: string }> = {
  ko: {
    title: "니콘 Z 레시피를 고르고, 미리 보고, SD카드로",
    lead: "커뮤니티 레시피 260여 개를 받아 사진에 미리 적용해 보고, 직접 만들고, 카메라에 넣을 파일까지 한 번에 준비합니다. 설치 없이 브라우저에서 씁니다.",
    points: [
      "계정을 만들면 내 레시피, SD카드에 넣을 목록, 카메라 기종이 PC와 휴대폰에서 똑같이 보입니다.",
      "사진은 올리지 않고 이 기기에만 남습니다.",
      "무료이고 광고가 없습니다.",
    ],
    how: "이용 방법",
    steps: [
      ["레시피 받기", "레시피 탭에서 커뮤니티 레시피 받기를 누르면 Nikon 크리에이터, SerbanJPG 등 260여 개를 원본 저장소에서 받아 옵니다."],
      ["미리 보기", "레시피를 누르면 풍경·실내·야경 사진이나 내 사진 위에서 원본과 적용 결과를 슬라이더로 비교합니다."],
      ["만들기", "에디터에서 톤·채도·컬러 블렌더·컬러 그레이딩·톤 커브를 조절하거나 원하는 느낌 버튼을 눌러 나만의 레시피를 만들고 저장합니다."],
      ["SD카드에 넣기", "레시피를 담은 뒤 SD카드 탭에서 카드에 바로 저장하거나(Chrome·Edge) ZIP으로 받아 카드의 NIKON/CUSTOMPC 폴더에 넣습니다."],
      ["카메라에서 불러오기", "카드를 카메라에 넣고 MENU › 사진 촬영 메뉴 › Picture Control 관리에서 불러옵니다. Z5·Z6·Z7·Z50 같은 구형 기종은 설정에서 기종을 고르세요."],
    ],
    updates: "최신 업데이트",
    allReleases: "전체 업데이트 내역 · Mac·안드로이드 앱 받기",
  },
  en: {
    title: "Pick, preview and load Nikon Z recipes onto your SD card",
    lead: "Get 260+ community recipes, preview them on photos, make your own, and prepare the files for your camera in one place. It runs in the browser with nothing to install.",
    points: [
      "With an account, My recipes, the SD card list and your camera model are the same on your computer and phone.",
      "Photos are never uploaded; they stay on this device.",
      "Free, with no ads.",
    ],
    how: "How it works",
    steps: [
      ["Get recipes", "On the Recipes tab, press Get community recipes to download 260+ recipes from Nikon creators, SerbanJPG and more, straight from their sources."],
      ["Preview", "Open a recipe to compare the original and the result with a slider, on landscape, indoor and night photos or your own."],
      ["Make your own", "In the Editor, adjust tone, saturation, the color blender, color grading and the tone curve, or tap one of the Looks, then save it to My recipes."],
      ["Put them on the card", "Add recipes, then on the SD Card tab save them straight to the card (Chrome, Edge) or download a ZIP for the card's NIKON/CUSTOMPC folder."],
      ["Load them in the camera", "Put the card in the camera and load them from MENU › Photo shooting menu › Manage Picture Control. For older bodies like the Z5, Z6, Z7 and Z50, pick your camera in Settings."],
    ],
    updates: "What's new",
    allReleases: "All release notes · Mac and Android apps",
  },
  ja: {
    title: "ニコンZのレシピを選んで、プレビューして、SDカードへ",
    lead: "260以上のコミュニティレシピを写真でプレビューし、自分でも作って、カメラに入れるファイルまでまとめて用意します。インストール不要でブラウザで使えます。",
    points: [
      "アカウントを作ると、マイレシピ・SDカードに入れるリスト・カメラの機種がパソコンとスマホで同じになります。",
      "写真はアップロードせず、この端末にだけ残ります。",
      "無料で広告はありません。",
    ],
    how: "使い方",
    steps: [
      ["レシピを取得", "レシピタブで「コミュニティレシピを取得」を押すと、Nikonクリエイター・SerbanJPGなど260以上のレシピを元のリポジトリから取得します。"],
      ["プレビュー", "レシピを開くと、風景・室内・夜景の写真や自分の写真で、元の写真と適用後をスライダーで比べられます。"],
      ["作る", "エディターでトーン・彩度・カラーブレンダー・カラーグレーディング・トーンカーブを調整するか、「かんたんスタイル」のボタンを押して自分のレシピを作り、保存します。"],
      ["SDカードに入れる", "レシピを追加して、SDカードタブからカードに直接保存（Chrome・Edge）するか、ZIPをダウンロードしてカードのNIKON/CUSTOMPCフォルダに入れます。"],
      ["カメラで読み込む", "カードをカメラに入れ、MENU › 静止画撮影メニュー › ピクチャーコントロールの管理から読み込みます。Z5・Z6・Z7・Z50などの旧機種は設定で機種を選んでください。"],
    ],
    updates: "最新のアップデート",
    allReleases: "すべての更新履歴 · Mac・Android版",
  },
};

// Newest first; add a line with each release.
const UPDATES: { date: string; version?: string; text: Record<Lang, string> }[] = [
  {
    date: "2026-10-29",
    text: {
      ko: "웹판 공개: 설치 없이 쓰고, 이메일이나 Google 계정으로 가입하면 기기 사이에 동기화됩니다.",
      en: "The web version: nothing to install, and an email or Google account keeps your devices in sync.",
      ja: "ウェブ版を公開：インストール不要。メールかGoogleアカウントで登録すると端末間で同期します。",
    },
  },
  {
    date: "2026-10-29",
    version: "0.6.9",
    text: {
      ko: "구형 Z 기종(Z5·Z6·Z7·Z50 등) 지원: 레시피를 일반 Picture Control로 바꿔 넣습니다.",
      en: "Older Z bodies (Z5, Z6, Z7, Z50 …): recipes are converted to original Picture Controls.",
      ja: "旧機種（Z5・Z6・Z7・Z50など）に対応：レシピを通常のピクチャーコントロールに変換します。",
    },
  },
  {
    date: "2026-10-11",
    version: "0.6.7",
    text: {
      ko: "미리보기에 쓰는 내 사진의 이름을 바꾸고 지울 수 있습니다.",
      en: "Rename and delete your own preview photos.",
      ja: "プレビュー用の自分の写真の名前を変えたり削除したりできます。",
    },
  },
  {
    date: "2026-10-10",
    version: "0.6.6",
    text: {
      ko: "원하는 느낌: 에디터에서 버튼 한 번으로 분위기·피부톤·색 강조를 더합니다.",
      en: "Looks: add a mood, skin tone or color accent in the Editor with one tap.",
      ja: "かんたんスタイル：エディターでワンタップで雰囲気・肌の色・色の強調を加えます。",
    },
  },
  {
    date: "2026-10-09",
    version: "0.6.4",
    text: {
      ko: "갤러리 탭: 레시피로 찍은 사진을 레시피별로 모아 보고, 프레임을 자르고 돌립니다.",
      en: "Gallery tab: photos grouped by recipe, and frames you can crop and rotate.",
      ja: "ギャラリータブ：写真をレシピごとにまとめて表示。フレームの切り抜きと回転も。",
    },
  },
];

function AuthCard() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const attempt = async (job: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await job();
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: Event) => {
    e.preventDefault();
    void attempt(() => (mode === "signup" ? signUpEmail : signInEmail)(email.trim(), password));
  };
  const forgot = () => {
    if (!email.trim()) return setError(t("authEnterEmail"));
    void attempt(async () => {
      await resetPassword(email.trim());
      setNotice(t("authResetSent", { email: email.trim() }));
    });
  };

  return (
    <div class="auth-card">
      <div class="segmented" role="radiogroup" aria-label={t("account")}>
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            class={mode === m ? "active" : ""}
            onClick={() => {
              setMode(m);
              setError("");
              setNotice("");
            }}
          >
            {m === "signup" ? t("authSignUp") : t("signIn")}
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        <label class="field">
          <span>{t("authEmail")}</span>
          <input type="email" autocomplete="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>
            {t("authPassword")}
            {mode === "signup" && ` · ${t("authPasswordHint")}`}
          </span>
          <input
            type="password"
            autocomplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>
        {error && (
          <p class="error small" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p class="ok-text small" role="status">
            {notice}
          </p>
        )}
        <button class="primary big" type="submit" disabled={busy}>
          {mode === "signup" ? t("authSignUp") : t("signIn")}
        </button>
        {mode === "signin" && (
          <button type="button" class="link small" disabled={busy} onClick={forgot}>
            {t("authForgot")}
          </button>
        )}
      </form>
      <div class="auth-or">{t("authOr")}</div>
      <button class="big" disabled={busy} onClick={() => void signIn()}>
        {t("signInGoogle")}
      </button>
      <button class="big ghost" onClick={() => (guest.value = true)}>
        {t("authGuest")}
      </button>
      <p class="hint">
        {t("syncHint")}{" "}
        <a href="privacy.html" target="_blank" rel="noopener">
          {t("privacyPolicy")}
        </a>
      </p>
    </div>
  );
}

export function Landing() {
  const c = COPY[lang.value];
  return (
    <div class="landing">
      <header class="landing-top">
        <div class="brand">
          <Logo />
          <strong>NP3 Lab</strong>
        </div>
        <div class="segmented" role="radiogroup" aria-label={t("language")}>
          {LANGS.map((l) => (
            <button key={l.id} role="radio" aria-checked={lang.value === l.id} class={lang.value === l.id ? "active" : ""} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <section class="landing-hero">
        <div>
          <h1>{c.title}</h1>
          <p class="lead">{c.lead}</p>
          <ul class="landing-points">
            {c.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <AuthCard />
      </section>

      <section class="landing-section">
        <h2>{c.how}</h2>
        <ol class="landing-steps">
          {c.steps.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section class="landing-section">
        <h2>{c.updates}</h2>
        <ul class="landing-updates">
          {UPDATES.map((u) => (
            <li key={u.date + (u.version ?? "")}>
              <time dateTime={u.date}>
                {u.date}
                {u.version && ` · ${u.version}`}
              </time>
              <span>{u.text[lang.value]}</span>
            </li>
          ))}
        </ul>
        <a href={RELEASES} target="_blank" rel="noopener">
          {c.allReleases}
        </a>
      </section>

      <footer class="footer">
        <span>{t("unofficial")}</span>
        <span>
          <a href="privacy.html" target="_blank" rel="noopener">
            {t("privacyPolicy")}
          </a>
          {" · "}
          <a href="https://github.com/MJ-best/np3-lab" target="_blank" rel="noopener">
            GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}
