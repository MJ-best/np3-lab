import { COMMUNITY_SOURCES, communityInfo, communityProgress } from "../community";
import { lang, t } from "../i18n";
import { refreshCommunityRecipes } from "../state";

const SourceLinks = ({ sources }: { sources: { id: string; label: string; home: string; count?: number }[] }) => (
  <>
    {sources.map((s, i) => (
      <span key={s.id}>
        {i > 0 && ", "}
        <a href={s.home} target="_blank" rel="noopener noreferrer">
          {s.label}
        </a>
        {s.count !== undefined && ` (${s.count})`}
      </span>
    ))}
  </>
);

/** Invitation to download the community recipes, or a one-line credit once they're here. */
export function CommunityPanel() {
  const info = communityInfo.value;
  const progress = communityProgress.value;
  const busy = progress !== null;
  const progressText = busy ? t("communityDownloading", { done: progress.done, total: progress.total }) : "";

  if (info) {
    const date = new Date(info.fetchedAt).toLocaleDateString({ ko: "ko-KR", en: "en-US", ja: "ja-JP" }[lang.value]);
    const [before, after] = t("communitySource", { n: info.count, repo: "\u0000", date }).split("\u0000");
    return (
      <p class="community-credit">
        {before}
        <SourceLinks sources={info.sources} />
        {after}
        {" · "}
        <button class="link" disabled={busy} onClick={() => refreshCommunityRecipes()}>
          {busy ? progressText : t("communityUpdate")}
        </button>
      </p>
    );
  }

  const [before, after] = t("communityPitch", { repo: "\u0000" }).split("\u0000");
  return (
    <div class="panel community-panel">
      <div>
        <h3>{t("communityTitle")}</h3>
        <p>
          {before}
          <SourceLinks sources={COMMUNITY_SOURCES} />
          {after}
        </p>
        <p class="hint">{t("communityRights")}</p>
      </div>
      <button class="primary big" disabled={busy} onClick={() => refreshCommunityRecipes()}>
        {busy ? progressText : `⬇ ${t("communityDownload")}`}
      </button>
    </div>
  );
}
