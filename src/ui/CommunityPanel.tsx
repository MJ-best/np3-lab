import { COMMUNITY_REPO, communityInfo, communityProgress } from "../community";
import { lang, t } from "../i18n";
import { refreshCommunityRecipes } from "../state";

const repoLink = (
  <a href={`https://github.com/${COMMUNITY_REPO}`} target="_blank" rel="noopener noreferrer">
    {COMMUNITY_REPO}
  </a>
);

/** Invitation to download the community recipes, or a one-line credit once they're here. */
export function CommunityPanel() {
  const info = communityInfo.value;
  const progress = communityProgress.value;
  const busy = progress !== null;

  if (info) {
    const date = new Date(info.fetchedAt).toLocaleDateString(lang.value === "ko" ? "ko-KR" : "en-US");
    const [before, after] = t("communitySource", { n: info.count, repo: "\u0000", commit: info.commit.slice(0, 7), date }).split("\u0000");
    return (
      <p class="community-credit">
        {before}
        {repoLink}
        {after}
        {" · "}
        <button class="link" disabled={busy} onClick={() => refreshCommunityRecipes()}>
          {busy ? t("communityDownloading", { done: progress.done, total: progress.total }) : t("communityUpdate")}
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
          {repoLink}
          {after}
        </p>
        <p class="hint">{t("communityRights")}</p>
      </div>
      <button class="primary big" disabled={busy} onClick={() => refreshCommunityRecipes()}>
        {busy ? t("communityDownloading", { done: progress.done, total: progress.total }) : `⬇ ${t("communityDownload")}`}
      </button>
    </div>
  );
}
