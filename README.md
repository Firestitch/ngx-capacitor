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

5. `src/assets/native.json`: `{"level": 1}`. Bump it only when a native plugin or permission
   changes. A bundle whose level is above the store build's is never installed on it, and
   Environment/Deployment Manager refuse a zip without this file.

6. Optional: `<fs-capacitor-version></fs-capacitor-version>` wherever the app shows its version.
   It prints "App version 3.0.3 (42)" as plain text for the app to style, and hides itself on
   the web. A double tap opens App info (`FsCapacitorInfoComponent`): the store build, the web
   code running, the updater's last check with its result and the countdown to the next, the
   updates on the phone by version and checksum (the first 12 characters, as Environment and
   Deployment Manager list them), the history, the manifest as published now, and the device,
   with Copy details. The updater keeps its last check (`lastCheck`) and its history (`events`,
   newest 20) in local storage, so both survive a reload into a new bundle; `nextCheck` is the
   timer's next check while the app is in front.
