import { Capacitor } from "@capacitor/core";
import type { useUpdater } from "../useUpdater";
import { PixelIcon, WARN_ART } from "./pixelIcons";

export function UpdateBanner({ updater }: { updater: ReturnType<typeof useUpdater> }) {
  const { info, downloading, progress, install, reload, liveUpdated, permissionNeeded, openSettings } = updater;

  if (!Capacitor.isNativePlatform() || !info?.updateAvailable) return null;

  // Silent live cloud update ready
  if (info.bundleUrl && liveUpdated) {
    return (
      <div class="update-card card">
        <div class="update-header">
          <span class="update-pill">LIVE UPDATE READY</span>
          <span class="update-ver-label">{info.latestVersion}</span>
        </div>
        <div class="update-body">
          <b>Uni Ranked {info.latestVersion} is ready!</b>
          <small>The latest version was downloaded silently. Reload now to apply, or it will apply automatically next time you open the app.</small>
        </div>
        <div class="update-actions">
          <button class="btn primary sm" onClick={() => reload()}>Reload Now</button>
        </div>
      </div>
    );
  }

  // Silent live cloud update in progress
  if (info.bundleUrl && !liveUpdated) {
    return (
      <div class="update-card card" style={{ padding: "12px 14px" }}>
        <div class="update-header" style={{ marginBottom: "4px" }}>
          <span class="update-pill">UPDATING</span>
          <span class="update-ver-label">{info.latestVersion}</span>
        </div>
        <small style={{ color: "var(--text-muted)" }}>
          Applying live cloud update in the background…
        </small>
      </div>
    );
  }

  return (
    <div class="update-card card">
      <div class="update-header">
        <span class="update-pill">UPDATE AVAILABLE</span>
        <span class="update-ver-label">{info.latestVersion}</span>
      </div>
      <div class="update-body">
        <b>Uni Ranked {info.latestVersion} is available!</b>
        <small>Update now to get the latest features and fixes without losing your existing data.</small>
      </div>

      {permissionNeeded && (
        <div class="update-perm">
          <small><PixelIcon art={WARN_ART} /> Permission required: toggle <b>Allow from this source</b> to install updates.</small>
          <button class="btn ghost sm" onClick={() => void openSettings()}>Grant Permission</button>
        </div>
      )}

      {downloading ? (
        <div class="update-progress-box">
          <div class="update-progress-label">
            <span>Downloading update…</span>
            <b>{progress}%</b>
          </div>
          <div class="adv-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <div class="update-actions">
          <button class="btn primary sm" onClick={() => void install()}>Update Now</button>
        </div>
      )}
    </div>
  );
}
