import { render } from "preact";
import { useState } from "preact/hooks";
import { CapacitorHttp } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Hadir } from "./native/hadir";

function Spike() {
  const [log, setLog] = useState("Tap the button and log in with your IIUM account.");
  async function run() {
    try {
      const { cookie } = await Hadir.casLogin();
      setLog(`Got cookie (${cookie.length} chars). Fetching schedule…`);
      const res = await CapacitorHttp.get({
        url: "https://imaluum.iium.edu.my/MyAcademic/schedule",
        headers: { Cookie: cookie },
        responseType: "text",
      });
      const html = String(res.data);
      await Filesystem.writeFile({ path: "schedule.html", data: html, directory: Directory.Data, encoding: Encoding.UTF8 });
      setLog(`HTTP ${res.status}, ${html.length} chars, table found: ${html.includes("table-hover")}. Saved schedule.html`);
    } catch (e) {
      setLog(`Failed: ${(e as Error).message}`);
    } finally {
      await Hadir.clearCookies();
    }
  }
  return (
    <div style="padding:48px 20px;color:#fff;background:#0B0C0E;min-height:100vh;font-family:sans-serif">
      <h1>Hadir spike</h1>
      <button style="padding:14px;font-size:16px" onClick={run}>Test IIUM login</button>
      <p>{log}</p>
    </div>
  );
}

render(<Spike />, document.getElementById("app")!);
