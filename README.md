# Installation

1. Call initCapacitor() in main.ts. This has to be revisited
```
import { initCapacitor } from '@firestitch/capacitor';

initCapacitor();
```

2. Provide the HTTP_INTERCEPTORS in the main module 
```
{
  provide: HTTP_INTERCEPTORS,
  useClass: CordovaHttpInterceptor,
  multi: true,
  deps: [Platform, FsCapacitorHttp],
},
```

3. Call FsCapacitor.init() 
```
{
  provide: APP_INITIALIZER,
  useFactory: (cordova: FsCapacitor) => () => {
    return of(null)
      .pipe(
        switchMap(() => cordova.init()),
      )
      .toPromise();
  },
  multi: true,
  deps: [FsCapacitor],
}, 
```

# Over-the-air updates

The app reads `{manifestUrl}{bundleId}/manifest.json` (published by Environment Manager or
Deployment Manager) at launch, on each return to the front, and every 15 minutes while the app
stays in front. Capgo's plugin downloads, verifies and swaps
the bundle. A new version downloads in the background and goes in only behind the splash,
where the reload goes unseen: at a launch, which holds the splash up to 3 seconds for the
download, or on a return after 10 minutes or more away. A quick switch to another app never
reloads it. Meanwhile its dialog's Restart puts it in now (Later closes the dialog until a
newer version). One left waiting goes in at the next launch before the manifest is read, so a
slow network cannot keep it out. A required one goes in as soon as it is on the phone; its full screen shows
only while a download outlasts the launch's splash or starts after it. A download fails once the
phone goes offline or it makes no progress for 30 seconds: the full screen closes, the app carries
on with the version it runs, and the next check tries again. The dialog is an
`fs-dialog`, so it takes the app's own theme. Off on the web and while `manifestUrl` is empty.
"Update required" sends the phone to the manifest's `storeUrl` for its platform (Deployment
Manager's builds: the app in TestFlight, by its Apple ID), else to the store listing Capgo's
plugin finds by the bundle ID.

1. Add the native plugin to the Capacitor app's `package.json`: `"@capgo/capacitor-updater": "6.53.0"`.

2. Each environment file carries the app's Capacitor settings:
```
import type { FsCapacitorConfig } from '@firestitch/capacitor/config';

export const environment = {
  ...
  capacitor: {
    update: { manifestUrl: 'https://...s3.amazonaws.com/pub/app/', publicKey: '-----BEGIN RSA PUBLIC KEY-----...' },
  } satisfies FsCapacitorConfig,
};
```
   `capacitor.config.ts` loads that file in plain Node during `cap sync`, so it may only use
   relative imports (no tsconfig path aliases).

3. The same object goes to the app and to the native plugins:
```
// main.ts
FsCapacitorModule.forRoot(environment.capacitor),

// capacitor.config.ts: wrap the whole config
import { FsCapacitorConfigService } from '@firestitch/capacitor/config';
export default FsCapacitorConfigService.init(config, environment.capacitor);
```
   `init()` adds the `CapacitorUpdater` block: manual mode, no Capgo stats, and the public key,
   which the plugin reads natively. The app reads the same key to turn the manifest's encrypted
   checksum back into the SHA-256 the managers list, so App info and the history match them. It also sets `SplashScreen.launchAutoHide: false`:
   `FsCapacitorModule` takes the splash down once the launch's update check is through, so
   the app must not call `SplashScreen.hide()` itself.

4. Once, in the root component's template: `<fs-capacitor-update></fs-capacitor-update>`.
   Its full screen takes the app's colors and icon from the same `update` block; a color
   left out or blank keeps its default (`CAPACITOR_UPDATE_COLORS`):
```
update: {
  manifestUrl: '...',
  publicKey: '...',
  colors: { primary: '#2F5BEA', accent: '#16A3B8', background: '#0A0F1F' },
  icon: 'assets/icon.png', // a path in the web bundle or a URL; no plugin reads the native icon
},
```
   The background fills behind the status bar and home indicator, so the app's `index.html`
   viewport needs `viewport-fit=cover`. On Android the status bar takes the background color
   while the screen shows.

5. `src/assets/native.json`: `{"level": 1}`. Raise it with `npx native-level` whenever a native
   plugin, or a permission the new web code relies on, changes. A bundle whose level is above
   the store build's is never installed on it, and Environment/Deployment Manager refuse a zip
   without this file. `npx build` and `npx package` (`@firestitch/app-tools`) record the app's
   native plugins in it and fail when they change without a raise, so a forgotten plugin
   never reaches an old store build. A permission has no such check: raise it by hand.

6. Optional: `<fs-capacitor-version></fs-capacitor-version>` wherever the app shows its version.
   It prints "App version 3.0.3 (42)" as plain text for the app to style, and hides itself on
   the web. A double tap opens App info (`FsCapacitorInfoComponent`): the store build, the web
   code running, the updater's last check with its result and the countdown to the next, the
   updates on the phone by version and checksum (the first 12 characters, as Environment and
   Deployment Manager list them), the history, the manifest as published now, and the device,
   with Copy details. The updater keeps its last check (`lastCheck`) and its history (`events`,
   newest 20) in local storage, so both survive a reload into a new bundle; `nextCheck` is the
   timer's next check while the app is in front.

7. Optional: report each phone's install to the app's backend. `FsCapacitorUpdate.install` (and
   `install$`) holds a `CapacitorAppInstall`: the device identifier, bundle id, platform, model
   and maker, OS and web view version, the store build (version, build number, build date,
   native level), the code running in it (`codeSource` store or update, its version, checksum
   and build date), an update downloaded and waiting for the next launch (its version and
   checksum), plus the last check's result. It is read once the launch's check ends, again whenever a later check
   changes it, and once at the start while updates are off. Each phone read is caught on its
   own, so a value the phone cannot give is null and nothing throws. Post it while someone is
   signed in, quietly, and drop any failure: the next launch sends it again.
```ts
combineLatest([accountId$, this._update.install$])
  .pipe(
    filter(([accountId, install]) => !!accountId && !!install),
    switchMap(([, install]) => this._data.post(install, quiet).pipe(catchError(() => EMPTY))),
  )
  .subscribe();
```

# Running updates

What to do in Deployment Manager (or Environment Manager) for each situation. Phones only ever
take the **live** bundle, and only when it was built after their store build.

| Situation | Do this | What phones do |
|---|---|---|
| Ship web changes | Upload the zip `npx package` makes, with Make live on | Download it in the background; it goes in at the next launch, or after 10+ minutes away |
| Must reach everyone now (it goes with a server change old code can't handle) | Upload it with Required on | Install it as soon as it is downloaded, behind a full screen if the person is using the app |
| A bundle is broken | Make live on the bundle before it | Go back to it at their next check |
| Everything is broken | Stop updates | Go back to their store build at their next check |
| A bundle breaks the updater itself | Nothing: the phone never confirms it, so about 10 seconds into its first launch the code before it goes back, and that bundle is skipped for good | Run the code before it |
| New native code (a plugin or a permission) | `npx native-level`, then ship a store build | Phones on older store builds skip bundles built after it until they update from the store |
| Old store builds must update | Set the minimum iOS / Android version on the app | Show "Update required", which opens the store |
| Upload without sending it | Upload with Make live off | Nothing until you make it live |

Deleting a bundle never changes what phones run: the live bundle cannot be deleted, and a deleted
one was not being offered. Making an older bundle live reaches only phones whose store build is
older than it; the rest run their store build.

**Before anything goes live**
- Build the zip from the code the server runs now, never from an older branch: phones take any
  live bundle built after their store build, whatever code is in it.
- The server ships first and only adds. A field or route the app uses is renamed or removed only
  once no phone still runs code that needs it (raise the minimum store version to force that).
- A live bundle reaches every phone at once: there is no staged rollout yet.
