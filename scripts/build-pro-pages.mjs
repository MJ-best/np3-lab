// Writes the NP3 Lab Pro sales pages (web/pro/index.html, en.html, ja.html) and the terms page
// (web/terms.html) from the copy below. Run `npm run pages` after editing, then commit the output.
// The pages have no scripts: their CSP allows none. "Get Pro" opens the web app with ?upgrade=1,
// which signs the visitor in and continues to the Lemon Squeezy checkout (src/pro.ts).
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

/**
 * Seller details shown on every page (Korean e-commerce law asks for them on the sales page).
 * Lemon Squeezy is the merchant of record and issues the receipts.
 */
const BUSINESS = {
  name: "은총",
  owner: "김경아",
  regNo: "684-96-01187",
  address: "경기도 의정부시 둔야로61번길 28-4, 1층 101호(가능동)",
  /** 통신판매업 신고번호 — fill in once registered; the line is left out while empty. */
  mailOrderNo: "",
  /** Contact email for customers — fill in; GitHub issues are listed until then. */
  email: "",
  issues: "https://github.com/MJ-best/np3-lab/issues",
};

const PRICE = { year: "$12" };
const UPDATED = "2026-11-05";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const COPY = {
  ko: {
    file: "pro/index.html",
    htmlLang: "ko",
    title: "NP3 Lab Pro · 내 레시피를 링크 하나로",
    description: "직접 만든 니콘 플렉시블 컬러 레시피를 링크 하나로 공유하세요. 받는 사람은 설치나 가입 없이 바로 가져갑니다. 연 $12.",
    openApp: "앱 열기",
    kicker: "NP3 Lab Pro",
    h1: "직접 만든 레시피를,<br />링크 하나로.",
    lead: "공들여 만든 플렉시블 컬러 레시피를 친구나 팔로워에게 보내 보세요. 받는 사람은 링크를 열기만 하면 레시피를 미리 보고 바로 가져갑니다.",
    cta: "Pro 시작하기",
    ctaNote: `연 ${PRICE.year} · 언제든 해지 · 7일 이내 전액 환불`,
    free: "무료로 쓰기",
    howTitle: "이렇게 공유합니다",
    steps: [
      ["레시피 만들기", "에디터에서 톤·컬러 블렌더·그레이딩을 조절하거나, NX Studio·카드에서 가져온 내 레시피를 고릅니다."],
      ["공유 링크 누르기", "레시피 화면의 🔗 공유 링크를 누르면 주소가 복사됩니다. 메신저, SNS 어디에나 붙여 넣으세요."],
      ["받는 사람은 열기만", "링크를 열면 레시피 미리보기와 함께 가져오기 화면이 뜹니다. 앱 설치도, 가입도 필요 없습니다."],
    ],
    linkDemo: { title: "Golden Hour Street", meta: "NP3 Lab 레시피 · 미리보기 후 가져가기" },
    compareTitle: "무료와 Pro",
    plans: [
      ["무료", "지금 쓰는 모든 기능", ["SD카드 레시피 관리 (Mac·Android·iOS·웹)", "커뮤니티 레시피 260여 개 미리보기", "에디터와 원터치 룩", "레시피별 사진 갤러리와 프레임", "계정 동기화"]],
      [`Pro · 연 ${PRICE.year}`, "무료 기능 전부 +", ["내 레시피 공유 링크 만들기", "받는 사람은 설치·가입 없이 가져가기", "앞으로 추가될 Pro 기능"]],
    ],
    shotsTitle: "NP3 Lab은 이런 앱입니다",
    shots: ["레시피 고르기", "실제 사진으로 미리보기", "SD카드에 바로 넣기"],
    faqTitle: "자주 묻는 질문",
    faq: [
      ["결제는 어떻게 하나요?", "웹 앱에 로그인한 뒤 Pro 시작하기를 누르면 Lemon Squeezy 결제 화면으로 이동합니다. 해외 결제 대행사로, 카드와 Apple Pay 등으로 결제하고 영수증을 이메일로 받습니다."],
      ["해지하거나 환불받을 수 있나요?", "설정 › 계정 › 구독 관리에서 언제든 해지할 수 있고, 남은 기간까지는 Pro가 유지됩니다. 결제 후 7일 이내에 요청하면 전액 환불해 드립니다."],
      ["Pro가 끝나면 공유한 링크는요?", "이미 만든 링크는 계속 열립니다. 새 링크는 Pro 기간에만 만들 수 있습니다."],
      ["커뮤니티 레시피도 공유할 수 있나요?", "아니요. Nikon 크리에이터 등 커뮤니티 레시피는 저작권이 각 크리에이터에게 있어서, 직접 만들었거나 가져온 내 레시피만 공유할 수 있습니다."],
      ["무료 기능이 줄어드나요?", "아니요. 지금까지의 기능은 계속 무료이고 광고도 없습니다. Pro는 새 기능을 위한 것입니다."],
    ],
    footerLinks: ["이용약관·환불 정책", "개인정보 처리방침"],
    unofficial: "NP3 Lab은 Nikon Corporation과 관련이 없는 비공식 도구입니다. Nikon은 Nikon Corporation의 상표입니다.",
    biz: ["상호", "대표자", "사업자등록번호", "주소", "통신판매업 신고번호", "문의"],
    mor: "결제 대행: Lemon Squeezy (판매 대행사·영수증 발행)",
  },
  en: {
    file: "pro/en.html",
    htmlLang: "en",
    title: "NP3 Lab Pro · Share your recipes with one link",
    description: "Share the Nikon Flexible Color recipes you make with a single link. Recipients add them without installing anything or signing up. $12 a year.",
    openApp: "Open the app",
    kicker: "NP3 Lab Pro",
    h1: "The recipes you make,<br />shared with one link.",
    lead: "Send the Flexible Color recipe you worked on to a friend or your followers. They open the link, preview the recipe and add it right away.",
    cta: "Get Pro",
    ctaNote: `${PRICE.year} a year · cancel anytime · full refund within 7 days`,
    free: "Use it free",
    howTitle: "How sharing works",
    steps: [
      ["Make a recipe", "Adjust tone, the color blender and grading in the editor, or pick one of your recipes from NX Studio or a card."],
      ["Tap Share link", "On the recipe, tap 🔗 Share link and the address is copied. Paste it into any chat or post."],
      ["They just open it", "The link opens a preview of the recipe with an Import button. No app to install, no account needed."],
    ],
    linkDemo: { title: "Golden Hour Street", meta: "NP3 Lab recipe · preview, then add it" },
    compareTitle: "Free and Pro",
    plans: [
      ["Free", "Everything you use today", ["SD card recipe manager (Mac, Android, iOS, web)", "Preview 260+ community recipes", "Editor and one-tap looks", "Photo gallery and frames per recipe", "Account sync"]],
      [`Pro · ${PRICE.year}/year`, "Everything in Free, plus", ["Share links for your own recipes", "Recipients add them with no app or account", "Pro features to come"]],
    ],
    shotsTitle: "What NP3 Lab does",
    shots: ["Pick recipes", "Preview on real photos", "Put them on the SD card"],
    faqTitle: "Questions",
    faq: [
      ["How do I pay?", "Sign in to the web app and press Get Pro to go to the Lemon Squeezy checkout. Pay by card, Apple Pay and more; the receipt comes by email."],
      ["Can I cancel or get a refund?", "Cancel anytime under Settings › Account › Manage subscription; Pro stays on until the end of the paid period. Ask within 7 days of paying for a full refund."],
      ["What happens to my links after Pro ends?", "Links you've made keep working. New links can be made while Pro is active."],
      ["Can I share community recipes?", "No. Community recipes such as those by Nikon creators belong to their creators, so you can share only recipes you made or imported yourself."],
      ["Will free features shrink?", "No. Everything so far stays free, with no ads. Pro is for new features."],
    ],
    footerLinks: ["Terms & refunds", "Privacy"],
    unofficial: "NP3 Lab is an unofficial tool, not affiliated with Nikon Corporation. Nikon is a trademark of Nikon Corporation.",
    biz: ["Business", "Owner", "Business reg. no.", "Address", "Mail-order reg. no.", "Contact"],
    mor: "Payments: Lemon Squeezy (merchant of record, issues receipts)",
  },
  ja: {
    file: "pro/ja.html",
    htmlLang: "ja",
    title: "NP3 Lab Pro・自作レシピをリンクひとつで",
    description: "自分で作ったニコンのフレキシブルカラーレシピを、リンクひとつで共有。受け取った人はインストールや登録なしで追加できます。年額 $12。",
    openApp: "アプリを開く",
    kicker: "NP3 Lab Pro",
    h1: "自分で作ったレシピを、<br />リンクひとつで。",
    lead: "こだわって作ったフレキシブルカラーのレシピを、友だちやフォロワーに送ってみましょう。受け取った人はリンクを開くだけで、プレビューしてすぐに追加できます。",
    cta: "Proを始める",
    ctaNote: `年額 ${PRICE.year}・いつでも解約・7日以内は全額返金`,
    free: "無料で使う",
    howTitle: "共有のしかた",
    steps: [
      ["レシピを作る", "エディターでトーン・カラーブレンダー・グレーディングを調整するか、NX Studioやカードから取り込んだマイレシピを選びます。"],
      ["共有リンクを押す", "レシピ画面の🔗共有リンクを押すとURLがコピーされます。メッセージやSNSに貼り付けてください。"],
      ["受け取った人は開くだけ", "リンクを開くとレシピのプレビューと取り込み画面が表示されます。アプリのインストールも登録も不要です。"],
    ],
    linkDemo: { title: "Golden Hour Street", meta: "NP3 Labのレシピ・プレビューして追加" },
    compareTitle: "無料とPro",
    plans: [
      ["無料", "今使っているすべての機能", ["SDカードのレシピ管理（Mac・Android・iOS・Web）", "260以上のコミュニティレシピをプレビュー", "エディターとワンタップのルック", "レシピごとの写真ギャラリーとフレーム", "アカウント同期"]],
      [`Pro・年額 ${PRICE.year}`, "無料の機能すべて +", ["マイレシピの共有リンクを作成", "受け取った人はインストール・登録なしで追加", "今後追加されるPro機能"]],
    ],
    shotsTitle: "NP3 Labでできること",
    shots: ["レシピを選ぶ", "実際の写真でプレビュー", "SDカードにそのまま入れる"],
    faqTitle: "よくある質問",
    faq: [
      ["支払い方法は？", "Webアプリにログインして「Proを始める」を押すと、Lemon Squeezyの決済画面に移動します。カードやApple Payなどで支払い、領収書はメールで届きます。"],
      ["解約や返金はできますか？", "設定 › アカウント › サブスクリプション管理からいつでも解約でき、残りの期間はProのままです。支払いから7日以内のご依頼は全額返金します。"],
      ["Proが終わったら共有したリンクは？", "作成済みのリンクは引き続き開けます。新しいリンクはProの期間中に作成できます。"],
      ["コミュニティレシピも共有できますか？", "いいえ。Nikonクリエイターなどのコミュニティレシピは各クリエイターに著作権があるため、自分で作ったか取り込んだマイレシピだけを共有できます。"],
      ["無料の機能は減りますか？", "いいえ。これまでの機能は引き続き無料で、広告もありません。Proは新しい機能のためのものです。"],
    ],
    footerLinks: ["利用規約・返金ポリシー", "プライバシーポリシー"],
    unofficial: "NP3 LabはNikon Corporationとは関係のない非公式ツールです。NikonはNikon Corporationの商標です。",
    biz: ["屋号", "代表者", "事業者登録番号", "所在地", "通信販売業届出番号", "お問い合わせ"],
    mor: "決済代行：Lemon Squeezy（販売代理・領収書発行）",
  },
};

const LANG_LINKS = [
  ["ko", "한국어", "index.html"],
  ["en", "English", "en.html"],
  ["ja", "日本語", "ja.html"],
];

function businessRows(c) {
  const contact = BUSINESS.email
    ? `<a href="mailto:${esc(BUSINESS.email)}">${esc(BUSINESS.email)}</a>`
    : `<a href="${BUSINESS.issues}">GitHub Issues</a>`;
  const rows = [
    [c.biz[0], esc(BUSINESS.name)],
    [c.biz[1], esc(BUSINESS.owner)],
    [c.biz[2], esc(BUSINESS.regNo)],
    [c.biz[3], esc(BUSINESS.address)],
    ...(BUSINESS.mailOrderNo ? [[c.biz[4], esc(BUSINESS.mailOrderNo)]] : []),
    [c.biz[5], contact],
  ];
  return rows.map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join("\n        ");
}

const STYLE = `
  :root { --bg: #000; --panel: #111; --panel-2: #1a1a1a; --line: #2a2a2a; --text: #f3f3f3; --muted: #a3a3a3; --accent: #ffe100; --ink: #111; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Hiragino Sans", "Malgun Gothic", "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
  header { display: flex; align-items: center; gap: 12px; padding: 18px 0; }
  header .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; }
  header img { width: 32px; height: 32px; border-radius: 8px; }
  header nav { margin-left: auto; display: flex; gap: 14px; align-items: center; font-size: 14px; color: var(--muted); }
  header nav a { text-decoration: none; }
  header nav a[aria-current] { color: var(--text); }
  header .open { border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; color: var(--text); }
  .hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 48px; align-items: center; padding: 56px 0 72px; }
  .kicker { color: var(--accent); font-weight: 700; letter-spacing: 0.02em; margin: 0 0 12px; }
  h1 { font-size: clamp(34px, 5vw, 56px); line-height: 1.12; margin: 0 0 20px; letter-spacing: -0.02em; }
  .lead { color: var(--muted); font-size: 18px; margin: 0 0 28px; max-width: 34em; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .btn { display: inline-block; padding: 14px 26px; border-radius: 999px; font-weight: 700; text-decoration: none; }
  .btn.primary { background: var(--accent); color: var(--ink); }
  .btn.ghost { border: 1px solid var(--line); }
  .note { color: var(--muted); font-size: 14px; margin: 14px 0 0; }
  .link-card { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 18px; box-shadow: 0 30px 80px rgba(255, 225, 0, 0.08); }
  .bubble { background: var(--panel-2); border-radius: 16px; padding: 12px 14px; font-size: 14px; color: var(--muted); margin-bottom: 12px; }
  .preview { display: grid; grid-template-columns: 96px 1fr; gap: 14px; align-items: center; background: #0b0b0b; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .preview img { width: 96px; height: 120px; object-fit: cover; object-position: center 35%; display: block; }
  .preview b { display: block; font-size: 16px; }
  .preview small { color: var(--muted); font-size: 13px; }
  .preview .url { color: var(--accent); font-size: 12px; margin-top: 6px; display: block; }
  section { padding: 64px 0; border-top: 1px solid var(--line); }
  h2 { font-size: clamp(24px, 3vw, 32px); margin: 0 0 28px; letter-spacing: -0.01em; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .step { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 22px; }
  .step .n { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: var(--ink); font-weight: 800; font-size: 14px; }
  .step h3 { margin: 14px 0 6px; font-size: 18px; }
  .step p { margin: 0; color: var(--muted); font-size: 15px; }
  .plans { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .plan { border: 1px solid var(--line); border-radius: 18px; padding: 26px; background: var(--panel); }
  .plan.pro { border-color: var(--accent); }
  .plan h3 { margin: 0 0 4px; font-size: 22px; }
  .plan .sub { color: var(--muted); margin: 0 0 14px; font-size: 14px; }
  .plan ul { margin: 0; padding-left: 20px; }
  .plan li { margin: 6px 0; }
  .plan.pro .btn { margin-top: 18px; }
  .shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .shots figure { margin: 0; }
  .shots img { width: 100%; border-radius: 22px; border: 1px solid var(--line); display: block; }
  .shots figcaption { color: var(--muted); text-align: center; margin-top: 10px; font-size: 14px; }
  details { border-bottom: 1px solid var(--line); padding: 16px 0; }
  summary { cursor: pointer; font-weight: 600; font-size: 17px; }
  details p { color: var(--muted); margin: 10px 0 0; }
  footer { border-top: 1px solid var(--line); padding: 32px 0 48px; color: var(--muted); font-size: 13px; }
  footer .links { display: flex; gap: 16px; margin-bottom: 14px; }
  footer .biz { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-bottom: 10px; }
  footer b { color: var(--text); font-weight: 600; }
  @media (max-width: 820px) {
    .hero { grid-template-columns: 1fr; padding: 32px 0 48px; gap: 32px; }
    .steps, .plans { grid-template-columns: 1fr; }
    .shots { grid-template-columns: 1fr 1fr; }
    .shots figure:last-child { display: none; }
    header { gap: 8px; }
    header nav { gap: 10px; font-size: 13px; }
    header .brand span { display: none; }
    header .open { padding: 5px 10px; }
  }
`;

function page(lang) {
  const c = COPY[lang];
  const app = lang === "ko" ? "../" : `../?lang=${lang}`;
  const upgrade = `../?upgrade=1&lang=${lang}`;
  const langs = LANG_LINKS.map(([l, label, href]) => `<a class="lang" href="${href}"${l === lang ? ' aria-current="page"' : ""}>${label}</a>`).join("\n        ");
  const alternates = LANG_LINKS.map(([l, , href]) => `<link rel="alternate" hreflang="${l}" href="https://np3-lab.web.app/pro/${href === "index.html" ? "" : href}" />`).join("\n");
  return `<!doctype html>
<html lang="${c.htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'" />
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}" />
<meta property="og:title" content="${esc(c.title)}" />
<meta property="og:description" content="${esc(c.description)}" />
<meta property="og:image" content="https://np3-lab.web.app/pro/img/02-recipe-detail.jpg" />
<link rel="icon" href="img/icon.png" />
${alternates}
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${app}"><img src="img/icon.png" alt="NP3 Lab" /><span>NP3 Lab</span></a>
    <nav>
        ${langs}
        <a class="open" href="${app}">${esc(c.openApp)}</a>
    </nav>
  </header>

  <div class="hero">
    <div>
      <p class="kicker">${esc(c.kicker)}</p>
      <h1>${c.h1}</h1>
      <p class="lead">${esc(c.lead)}</p>
      <div class="ctas">
        <a class="btn primary" href="${upgrade}">${esc(c.cta)}</a>
        <a class="btn ghost" href="${app}">${esc(c.free)}</a>
      </div>
      <p class="note">${esc(c.ctaNote)}</p>
    </div>
    <div class="link-card" aria-hidden="true">
      <div class="bubble">🔗 np3-lab.web.app/?share=…</div>
      <div class="preview">
        <img src="img/02-recipe-detail.jpg" alt="" />
        <div><b>${esc(c.linkDemo.title)}</b><small>${esc(c.linkDemo.meta)}</small><span class="url">np3-lab.web.app</span></div>
      </div>
    </div>
  </div>

  <section>
    <h2>${esc(c.howTitle)}</h2>
    <div class="steps">
      ${c.steps.map(([h, p], i) => `<div class="step"><span class="n">${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("\n      ")}
    </div>
  </section>

  <section>
    <h2>${esc(c.compareTitle)}</h2>
    <div class="plans">
      ${c.plans
        .map(
          ([name, sub, items], i) => `<div class="plan${i === 1 ? " pro" : ""}">
        <h3>${esc(name)}</h3>
        <p class="sub">${esc(sub)}</p>
        <ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        ${i === 1 ? `<a class="btn primary" href="${upgrade}">${esc(c.cta)}</a>` : ""}
      </div>`,
        )
        .join("\n      ")}
    </div>
  </section>

  <section>
    <h2>${esc(c.shotsTitle)}</h2>
    <div class="shots">
      ${["01-recipes", "02-recipe-detail", "03-sd-card"].map((f, i) => `<figure><img src="img/${f}.jpg" alt="${esc(c.shots[i])}" loading="lazy" /><figcaption>${esc(c.shots[i])}</figcaption></figure>`).join("\n      ")}
    </div>
  </section>

  <section>
    <h2>${esc(c.faqTitle)}</h2>
    ${c.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n    ")}
  </section>

  <footer>
    <div class="links"><a href="../terms.html${lang === "ko" ? "" : `#${lang}`}">${esc(c.footerLinks[0])}</a><a href="../privacy.html${lang === "ko" ? "" : `#${lang}`}">${esc(c.footerLinks[1])}</a></div>
    <div class="biz">
        ${businessRows(c)}
    </div>
    <p>${esc(c.mor)}</p>
    <p>${esc(c.unofficial)}</p>
  </footer>
</div>
</body>
</html>
`;
}

/** Terms of service, refund policy and seller details, in the three languages. */
function terms() {
  const b = BUSINESS;
  const contact = b.email ? b.email : b.issues;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
<title>NP3 Lab · 이용약관·환불 정책 / Terms</title>
<style>
  :root { color-scheme: light dark; --fg: #1d1d1f; --muted: #6e6e73; --bg: #fff; --line: #e5e5ea; }
  @media (prefers-color-scheme: dark) { :root { --fg: #f5f5f7; --muted: #a1a1a6; --bg: #111; --line: #2c2c2e; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Hiragino Sans", "Malgun Gothic", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 40px 0 8px; padding-top: 24px; border-top: 1px solid var(--line); }
  h3 { font-size: 16px; margin: 24px 0 6px; }
  .date, small { color: var(--muted); }
  a { color: inherit; }
</style>
</head>
<body>
<main>
<h1>NP3 Lab 이용약관·환불 정책</h1>
<p class="date">${UPDATED} 시행 · <a href="#en">English</a> · <a href="#ja">日本語</a></p>

<h3>1. 서비스</h3>
<p>NP3 Lab(이하 "서비스")은 니콘 Z 카메라의 Picture Control 레시피를 관리하는 앱과 웹 서비스입니다. 기본 기능은 무료이며, NP3 Lab Pro(이하 "Pro")는 내 레시피 공유 링크 등 추가 기능을 제공하는 유료 구독입니다.</p>
<h3>2. 결제와 자동 갱신</h3>
<p>Pro는 연 ${PRICE.year} 구독이며, 결제는 판매 대행사인 Lemon Squeezy가 처리하고 영수증을 발행합니다. 구독은 해지하지 않으면 1년마다 같은 금액으로 자동 갱신되며, 가격이 바뀌는 경우 갱신 전에 미리 알립니다.</p>
<h3>3. 해지</h3>
<p>설정 › 계정 › 구독 관리에서 언제든 해지할 수 있습니다. 해지해도 이미 결제한 기간이 끝날 때까지 Pro를 쓸 수 있고, 그 뒤에는 무료 플랜으로 바뀝니다. 이미 만든 공유 링크는 계속 열립니다.</p>
<h3>4. 환불</h3>
<p>결제일로부터 7일 이내에 요청하면 사용 여부와 관계없이 전액 환불합니다. 7일이 지난 뒤에는 남은 기간에 대한 환불은 하지 않지만, 서비스 장애로 Pro를 쓸 수 없었던 경우에는 그 기간만큼 환불하거나 연장합니다. 환불 요청: ${esc(contact)}</p>
<h3>5. 이용자의 의무</h3>
<p>공유 링크로는 본인이 만들었거나 공유할 권리가 있는 레시피만 공유해야 합니다. 커뮤니티 레시피는 공유할 수 없습니다. 다른 사람의 권리를 침해하는 링크는 알림 없이 삭제할 수 있습니다.</p>
<h3>6. 면책</h3>
<p>미리보기는 레시피 수치로 계산한 근사치이며 카메라 결과와 다를 수 있습니다. 메모리 카드의 중요한 데이터는 따로 백업해 주세요. 서비스는 Nikon Corporation과 관련이 없는 비공식 도구입니다.</p>
<h3>7. 판매자 정보</h3>
<p>상호 ${esc(b.name)} · 대표자 ${esc(b.owner)} · 사업자등록번호 ${esc(b.regNo)}<br />주소 ${esc(b.address)}${b.mailOrderNo ? `<br />통신판매업 신고번호 ${esc(b.mailOrderNo)}` : ""}<br />문의 ${esc(contact)}</p>

<h2 id="en">Terms and refund policy (English)</h2>
<p><strong>Service.</strong> NP3 Lab manages Picture Control recipes for Nikon Z cameras. The core app is free; NP3 Lab Pro is a paid subscription with extra features such as share links for your own recipes.</p>
<p><strong>Payment and renewal.</strong> Pro costs ${PRICE.year} a year. Lemon Squeezy, the merchant of record, processes payments and issues receipts. The subscription renews automatically each year at the same price unless cancelled; any price change is announced before renewal.</p>
<p><strong>Cancellation.</strong> Cancel anytime under Settings › Account › Manage subscription. Pro stays on until the end of the paid period, then the account moves to the free plan. Share links you've made keep working.</p>
<p><strong>Refunds.</strong> Full refund on request within 7 days of payment, whether or not Pro was used. After that, no refund for the remaining period, except a refund or extension for time Pro was unavailable because of a service outage. Contact: ${esc(contact)}</p>
<p><strong>Your content.</strong> Share only recipes you made or have the right to share; community recipes can't be shared. Links that infringe others' rights may be removed.</p>
<p><strong>Disclaimer.</strong> Previews are approximations and may differ from the camera. Back up important data on your memory cards. NP3 Lab is not affiliated with Nikon Corporation.</p>
<p><strong>Seller.</strong> ${esc(b.name)} (owner ${esc(b.owner)}), business registration no. ${esc(b.regNo)}, ${esc(b.address)}, Republic of Korea.</p>

<h2 id="ja">利用規約・返金ポリシー（日本語）</h2>
<p><strong>サービス：</strong>NP3 Labはニコン Zカメラのピクチャーコントロールのレシピを管理するアプリとWebサービスです。基本機能は無料で、NP3 Lab Proはマイレシピの共有リンクなどの追加機能を提供する有料サブスクリプションです。</p>
<p><strong>支払いと自動更新：</strong>Proは年額 ${PRICE.year}です。決済は販売代理店のLemon Squeezyが行い、領収書を発行します。解約しない限り毎年同じ金額で自動更新され、価格を変更する場合は更新前にお知らせします。</p>
<p><strong>解約：</strong>設定 › アカウント › サブスクリプション管理からいつでも解約できます。支払済みの期間が終わるまではProを利用でき、その後は無料プランになります。作成済みの共有リンクは引き続き開けます。</p>
<p><strong>返金：</strong>支払日から7日以内のご依頼は、利用の有無にかかわらず全額返金します。それ以降は残り期間の返金は行いませんが、障害でProを利用できなかった期間は返金または延長します。お問い合わせ：${esc(contact)}</p>
<p><strong>利用者の義務：</strong>共有リンクでは自分で作ったか共有する権利のあるレシピのみを共有してください。コミュニティレシピは共有できません。</p>
<p><strong>免責：</strong>プレビューは近似で、カメラの仕上がりとは異なる場合があります。NP3 LabはNikon Corporationとは関係のない非公式ツールです。</p>
<p><strong>販売者：</strong>${esc(b.name)}（代表 ${esc(b.owner)}）、事業者登録番号 ${esc(b.regNo)}、${esc(b.address)}（大韓民国）</p>
<p><small><a href="pro/">NP3 Lab Pro</a> · <a href="privacy.html">개인정보 처리방침 / Privacy</a></small></p>
</main>
</body>
</html>
`;
}

for (const lang of Object.keys(COPY)) writeFileSync(resolve(root, "web", COPY[lang].file), page(lang));
writeFileSync(resolve(root, "web", "terms.html"), terms());
console.log("wrote web/pro/{index,en,ja}.html and web/terms.html");
