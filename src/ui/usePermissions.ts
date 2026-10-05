import { App as CapApp } from "@capacitor/app";
import { useEffect, useState } from "preact/hooks";
import { getPermissions } from "../native/device";
import type { PermissionStatus } from "../native/device";

export function usePermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const refresh = () => void getPermissions().then(setStatus);
  useEffect(() => {
    refresh();
    const handle = CapApp.addListener("resume", refresh);
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
  return { status, refresh };
}
