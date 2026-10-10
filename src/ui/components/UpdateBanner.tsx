import type { useUpdater } from "../useUpdater";

export function UpdateBanner({ updater }: { updater: ReturnType<typeof useUpdater> }) {
  const { info, downloading, progress, install, permissionNeeded, openSettings } = updater;

  if (!info?.updateAvailable) return null;

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
          <small>⚠️ Permission required: toggle <b>Allow from this source</b> to install updates.</small>
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
