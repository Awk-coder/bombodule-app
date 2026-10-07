# Building Hadir for iPhone

Hadir is a web app in a Capacitor shell, so the iPhone build comes from the
`ios/` Xcode project in this repo. It needs a Mac.

## What you need

- A Mac with Xcode (free from the App Store), opened once so it finishes installing
- Node.js 22 or newer (`brew install node`, or the installer from nodejs.org)
- The iPhone and a USB cable
- Any Apple ID. A free one works, but the app then stops opening after
  7 days and has to be run from Xcode again. A paid Apple Developer account
  lifts that limit.

## Steps

1. Unzip the project and open Terminal in that folder.
2. Install and build, which also opens Xcode:

   ```sh
   npm ci
   npm run ios
   ```

3. In Xcode, click **App** in the left sidebar, then the **Signing & Capabilities** tab:
   - Tick **Automatically manage signing**.
   - **Team**: pick your Apple ID (Add an Account… if it's not listed).
   - If Xcode says the bundle identifier is taken, change `com.awk.hadir`
     to something unique, e.g. `com.yourname.hadir`.
4. Plug in the iPhone, unlock it and tap **Trust** if asked. Pick it in the
   device menu at the top of Xcode.
5. Press **Run** (the ▶ button).
6. First time only, on the iPhone:
   - Turn on **Settings → Privacy & Security → Developer Mode** and restart when asked.
   - Then go to **Settings → General → VPN & Device Management**, tap your
     Apple ID and tap **Trust**.
   - Open Hadir.

To update the app later: pull or unzip the new code, run `npm ci && npm run ios`,
and press Run again. App data stays on the phone between updates.
