export const APP_VERSION = "1.2.8";
export const GITHUB_REPO = "Awk-coder/bombodule-app";
export const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

export interface GitHubReleaseResponse {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: GitHubAsset[];
}

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  title: string;
  notes: string;
  apkUrl: string | null;
  htmlUrl: string;
  publishedAt: string;
}

/** Parses semver-like strings ("v1.2.3", "1.2.0") into numeric tuple [major, minor, patch]. */
export function parseVersion(v: string): number[] {
  const clean = v.replace(/^[^0-9]*/, "");
  return clean.split(".").map((n) => parseInt(n, 10) || 0);
}

/** Returns true if remote is strictly newer than current. */
export function isNewerVersion(remote: string, current: string = APP_VERSION): boolean {
  const r = parseVersion(remote);
  const c = parseVersion(current);
  const len = Math.max(r.length, c.length);
  for (let i = 0; i < len; i++) {
    const rNum = r[i] ?? 0;
    const cNum = c[i] ?? 0;
    if (rNum > cNum) return true;
    if (rNum < cNum) return false;
  }
  return false;
}

/** Finds the best APK asset from release assets list, preferring Uni-Ranked.apk */
export function findApkAsset(assets: GitHubAsset[] = []): string | null {
  if (!assets.length) return null;
  const apkAssets = assets.filter((a) => a.name.toLowerCase().endsWith(".apk"));
  if (!apkAssets.length) return null;

  // Prefer "Uni-Ranked.apk" or "Uni.Ranked.apk"
  const preferred = apkAssets.find(
    (a) => a.name.includes("Uni-Ranked") || a.name.includes("Uni.Ranked") || a.name.includes("app-release"),
  );
  return (preferred ?? apkAssets[0]).browser_download_url;
}

/** Checks GitHub for the latest release. */
export async function checkGitHubUpdate(
  url = GITHUB_RELEASES_URL,
  currentVer = APP_VERSION,
  fetchFn = fetch,
): Promise<UpdateInfo | null> {
  try {
    const res = await fetchFn(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubReleaseResponse;
    const latestVersion = data.tag_name || "";
    const updateAvailable = isNewerVersion(latestVersion, currentVer);
    const apkUrl = findApkAsset(data.assets);

    return {
      updateAvailable,
      currentVersion: currentVer,
      latestVersion,
      title: data.name || latestVersion,
      notes: data.body || "",
      apkUrl,
      htmlUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      publishedAt: data.published_at || "",
    };
  } catch {
    return null;
  }
}
