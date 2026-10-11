import { useEffect, useState } from "preact/hooks";
import { Hadir } from "../native/hadir";
import { APP_VERSION, checkGitHubUpdate, isNewerVersion, type UpdateInfo } from "../domain/updater";

const LAST_CHECK_KEY = "uni-ranked-last-update-check";
const CACHED_INFO_KEY = "uni-ranked-cached-update-info";
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function useUpdater() {
  const [info, setInfo] = useState<UpdateInfo | null>(() => {
    try {
      const raw = localStorage.getItem(CACHED_INFO_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.updateAvailable && isNewerVersion(parsed.latestVersion, APP_VERSION)) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);

  async function check(force = false) {
    if (checking) return;
    const now = Date.now();
    const last = parseInt(localStorage.getItem(LAST_CHECK_KEY) || "0", 10);
    if (!force && now - last < CHECK_INTERVAL_MS && info?.updateAvailable) return;

    setChecking(true);
    setError(null);
    try {
      const res = await checkGitHubUpdate();
      localStorage.setItem(LAST_CHECK_KEY, String(now));
      if (res?.updateAvailable) {
        setInfo(res);
        try {
          localStorage.setItem(CACHED_INFO_KEY, JSON.stringify(res));
        } catch {}
      } else {
        setInfo(res);
        try {
          localStorage.removeItem(CACHED_INFO_KEY);
        } catch {}
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function install() {
    if (!info?.apkUrl) {
      if (info?.htmlUrl) window.open(info.htmlUrl, "_blank");
      return;
    }

    // Check Android unknown sources permission
    try {
      const perm = await Hadir.canInstallApk();
      if (!perm.value) {
        setPermissionNeeded(true);
        await Hadir.openInstallPermissionSettings();
        return;
      }
    } catch {
      // Non-Android or older environment
    }

    setDownloading(true);
    setProgress(0);
    setError(null);

    const handle = await Hadir.addListener("downloadProgress", (d) => {
      setProgress(d.percent);
    });

    try {
      await Hadir.downloadAndInstall({ url: info.apkUrl });
      // If completed, Android installer is showing
    } catch (err) {
      setError((err as Error).message);
      // Fallback: open release page
      if (info.htmlUrl) window.open(info.htmlUrl, "_blank");
    } finally {
      setDownloading(false);
      void handle.remove();
    }
  }

  useEffect(() => {
    // Automatically check on mount
    void check(false);
  }, []);

  return {
    currentVersion: APP_VERSION,
    info,
    checking,
    downloading,
    progress,
    error,
    permissionNeeded,
    check: () => check(true),
    install,
    openSettings: () => Hadir.openInstallPermissionSettings(),
  };
}
