import { openBatterySettings, openExactAlarmSettings, requestNotifications } from "../../native/device";
import { usePermissions } from "../usePermissions";

export function PermissionRows() {
  const { status, refresh } = usePermissions();
  if (!status) return <div class="skeleton" />;
  const rows = [
    { ok: status.notifications, label: "Notifications", hint: "Needed for class prompts", fix: requestNotifications },
    { ok: status.exactAlarms, label: "Alarms & reminders", hint: "Prompts arrive right when class ends", fix: openExactAlarmSettings },
    { ok: status.battery, label: "Battery: unrestricted", hint: "Stops Nothing OS from delaying prompts", fix: openBatterySettings },
  ];
  return (
    <>
      {rows.map((r) => (
        <button key={r.label} class="row" onClick={() => !r.ok && void r.fix().finally(refresh)}>
          <div class="grow"><b>{r.label}</b><small>{r.hint}</small></div>
          <span class={r.ok ? "status-ok" : "status-bad"}>{r.ok ? "On" : "Fix"}</span>
        </button>
      ))}
    </>
  );
}
