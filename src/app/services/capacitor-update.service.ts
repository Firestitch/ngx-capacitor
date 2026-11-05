import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EMPTY, Observable, ReplaySubject, forkJoin, from, merge, of, race, timer } from 'rxjs';
import { catchError, filter, finalize, map, switchMap, take, tap } from 'rxjs/operators';

import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { BundleId, BundleInfo, CapacitorUpdater } from '@capgo/capacitor-updater';

import { CapacitorUpdateConfig } from '@firestitch/capacitor/config';

import {
  CapacitorUpdateAppData,
  CapacitorUpdateBundle,
  CapacitorUpdateManifest,
  CapacitorUpdateState,
} from '../interfaces';


const MANIFEST_FORMAT = 1;
// The plugin's id for the bundle the store build shipped with
const BUILTIN_ID = 'builtin';
const BUILTIN_KEY = 'fs-capacitor-update-builtin';
const FAILED_KEY = 'fs-capacitor-update-failed';
// How long the launch's splash waits for a new version to download behind it
const LAUNCH_WAIT = 3000;
// Back after this long away, a version already downloaded goes in behind the splash, as at a launch
const AWAY_SWAP = 10 * 60 * 1000;

/** The store build's own bundle, recorded while it runs: the floor every manifest is measured against */
interface Builtin {
  build: string | null;
  nativeLevel: number;
}

/** When the manifest is read: the launch, a return after AWAY_SWAP or more, or a quick return */
type CheckMoment = 'launch' | 'away' | 'back';

/**
 * Over-the-air updates of the app's web code. The app reads its manifest from
 * {manifestUrl}{bundleId}/manifest.json on launch and on resume; Capgo's plugin
 * downloads, verifies (capacitor.config's CapacitorUpdater.publicKey) and swaps the bundle.
 *
 * - A new version downloads in the background and goes in only behind the splash, where
 *   the reload goes unseen: at a launch (init() holds the splash up to LAUNCH_WAIT for its
 *   download), or on a return after AWAY_SWAP away. A quick switch to another app never
 *   reloads it. Meanwhile its dialog's Restart puts it in now; Later closes the dialog until a newer one.
 * - A required version goes in as soon as it is on the phone. Only a download that outlasts
 *   the launch's splash, or starts after it, shows the full screen.
 * - The store build is the floor: a bundle no newer than it, nothing published, or
 *   updates stopped all go back to it. So a newer store build always wins, and pointing
 *   the manifest at an older bundle rolls phones back.
 * - A store version below the manifest's minVersion, or a required bundle needing a
 *   native level above the store build's (assets/native.json), shows "Update required".
 *   Its Update opens the manifest's storeUrl for the platform, else the store listing.
 * - A bundle needing a higher native level, or one that failed to start here, is skipped.
 */
@Injectable({
  providedIn: 'root',
})
export class FsCapacitorUpdate {

  public readonly state = signal<CapacitorUpdateState>('idle');

  /** The required version's download, 0 to 100 */
  public readonly progress = signal(0);

  /** The environment's update settings; the screen reads its colors and icon from here */
  public readonly config = signal<CapacitorUpdateConfig>({});

  /** The waiting version's number from the manifest (4.2.1), for its dialog */
  public readonly readyVersion = signal<string | null>(null);

  /** The waiting version was put off with Later: its dialog stays closed, and opens for a newer one */
  public readonly postponed = computed(() => this._laterId() !== null && this._laterId() === this._readyId());

  public appData: CapacitorUpdateAppData = {};

  private _destroyRef = inject(DestroyRef);
  private _manifestUrl: string;
  private _readyId = signal<string | null>(null);
  private _laterId = signal<string | null>(null);
  private _storeUrl: string | null = null;
  // The launch's splash is still up: a version on the phone by now goes in unseen
  private _launching = true;
  private _launchChecked$ = new ReplaySubject<void>(1);

  public get version(): string {
    return this.appData.version;
  }

  public get buildNumber(): number {
    return this.appData.buildNumber;
  }

  public get bundleIdentifier(): string {
    return this.appData.bundleIdentifier;
  }

  public get platform(): 'android' | 'ios' | 'web' {
    return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
  }

  /**
   * Starts the updates and returns the launch's wait: it completes once the launch's
   * check is through, or after LAUNCH_WAIT with the download carrying on. Until then
   * the splash stays up (FsCapacitorModule hides it), so a version that arrives goes in unseen.
   */
  public init(config: CapacitorUpdateConfig = {}): Observable<void> {
    this.config.set(config);

    if (!Capacitor.isNativePlatform()) {
      return of(null);
    }

    if (Capacitor.isPluginAvailable('CapacitorUpdater')) {
      // First: a bundle that got this far has started, so the plugin keeps it
      CapacitorUpdater.notifyAppReady();
    }

    const enabled = !!config.manifestUrl && Capacitor.isPluginAvailable('CapacitorUpdater');

    from(App.getInfo())
      .pipe(
        tap((appInfo) => {
          this.appData = {
            version: appInfo.version,
            bundleIdentifier: appInfo.id,
            buildNumber: Number(appInfo.build),
            name: appInfo.name,
            platform: this.platform,
          };
        }),
        filter(() => enabled),
        tap(() => this._manifestUrl = config.manifestUrl),
        switchMap(() => this._start$()),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();

    return enabled ? this._launch$() : of(null);
  }

  /** The dialog's Restart: the downloaded version, now */
  public refresh(): void {
    this._set$({ id: this._readyId() })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe();
  }

  /** The dialog's Later: closes it; the version still applies at the next background */
  public later(): void {
    this._laterId.set(this._readyId());
  }

  /** "Update required": where the manifest sends this platform, else this app's store listing */
  public openStore(): void {
    if (this._storeUrl) {
      // Capacitor hands a link outside the app to the system, which opens TestFlight or the App Store
      window.open(this._storeUrl, '_blank');

      return;
    }

    CapacitorUpdater.openAppStore({});
  }

  private _launch$(): Observable<void> {
    return race(this._launchChecked$, timer(LAUNCH_WAIT))
      .pipe(
        take(1),
        map(() => null),
        finalize(() => this._launching = false),
      );
  }

  private _start$(): Observable<unknown> {
    CapacitorUpdater.addListener('download', (event) => this.progress.set(Math.round(event.percent)));

    return forkJoin([from(CapacitorUpdater.current()), from(CapacitorUpdater.getFailedUpdate())])
      .pipe(
        tap(([, failed]) => {
          if (failed?.bundle?.version) {
            localStorage.setItem(FAILED_KEY, failed.bundle.version);
          }
        }),
        switchMap(([current]) => current.bundle.id === BUILTIN_ID ? this._recordBuiltin$() : of(null)),
        switchMap(() => merge(
          of<CheckMoment>('launch'),
          this._resume$().pipe(map((away): CheckMoment => away >= AWAY_SWAP ? 'away' : 'back')),
        )),
        switchMap((moment) => this._check$(moment)
          .pipe(
            // The launch's check is through however it ends: the splash need not wait longer
            finalize(() => {
              if (moment === 'launch') {
                this._launchChecked$.next();
              }
            }),
          )),
      );
  }

  private _check$(moment: CheckMoment): Observable<unknown> {
    return forkJoin([this._manifest$(), from(CapacitorUpdater.current())])
      .pipe(
        switchMap(([response, current]) => this._apply$(response, current.bundle, moment)),
        // Offline or a refused download: nothing changes, the next check tries again
        catchError(() => EMPTY),
      );
  }

  // A native request: S3 sends no CORS headers
  private _manifest$(): Observable<HttpResponse> {
    return from(CapacitorHttp.get({
      url: `${this._manifestUrl}${this.bundleIdentifier}/manifest.json`,
      params: { t: String(Date.now()) },
    }));
  }

  private _apply$(response: HttpResponse, current: BundleInfo, moment: CheckMoment): Observable<unknown> {
    // S3 answers 403 for a manifest that is not there: nothing is published
    if (response.status === 403 || response.status === 404) {
      return this._toBuiltin$(current);
    }

    // S3 serves it as text/json, which can arrive unparsed
    const manifest: CapacitorUpdateManifest = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (response.status !== 200 || manifest?.format !== MANIFEST_FORMAT || manifest.bundleId !== this.bundleIdentifier) {
      return EMPTY;
    }

    // An App Store lookup by bundle id never finds a TestFlight build: the manager says where to go
    this._storeUrl = manifest.storeUrl?.[this.platform] ?? null;

    if (this._isBelow(manifest.minVersion?.[this.platform])) {
      this.state.set('required');

      return EMPTY;
    }

    if (this.state() === 'required') {
      this.state.set('idle');
    }

    return this._applyBundle$(manifest.bundle, current, moment);
  }

  private _applyBundle$(bundle: CapacitorUpdateBundle | null, current: BundleInfo, moment: CheckMoment): Observable<unknown> {
    const builtin: Builtin | null = JSON.parse(localStorage.getItem(BUILTIN_KEY));
    if (!builtin || !bundle || !(Date.parse(bundle.build) > (Date.parse(builtin.build) || 0))) {
      return this._toBuiltin$(current);
    }

    if (bundle.nativeLevel > builtin.nativeLevel) {
      if (bundle.required) {
        this.state.set('required');
      }

      return EMPTY;
    }

    const version = `${bundle.version}+${bundle.checksum.slice(0, 12)}`;
    if (current.version === version || localStorage.getItem(FAILED_KEY) === version) {
      return EMPTY;
    }

    return this._install$(bundle, version, moment);
  }

  // One already on the phone goes in at a launch or a return from away; a fresh download
  // only while the launch's splash is still up. A required one goes in either way
  private _install$(bundle: CapacitorUpdateBundle, version: string, moment: CheckMoment): Observable<unknown> {
    return this._downloaded$(version)
      .pipe(
        switchMap((info) => info
          ? this._place$(bundle, info, moment === 'away' || this._launching)
          : this._download$(bundle, version)
            .pipe(
              switchMap((downloaded) => this._place$(bundle, downloaded, this._launching)),
            )),
        // A required download that fails lets the person back in
        catchError(() => {
          this.state.set('idle');

          return EMPTY;
        }),
      );
  }

  // In now, or waiting for the next unseen moment with its dialog offering it meanwhile
  private _place$(bundle: CapacitorUpdateBundle, info: BundleInfo, swap: boolean): Observable<unknown> {
    if (bundle.required || swap) {
      return this._set$(info);
    }

    this._readyId.set(info.id);
    this.readyVersion.set(bundle.version);
    this.state.set('ready');

    return EMPTY;
  }

  private _downloaded$(version: string): Observable<BundleInfo | undefined> {
    return from(CapacitorUpdater.list())
      .pipe(
        map(({ bundles }) => bundles
          .find((info) => info.version === version && (info.status === 'success' || info.status === 'pending'))),
      );
  }

  private _download$(bundle: CapacitorUpdateBundle, version: string): Observable<BundleInfo> {
    // Only a required version, which the person must wait for, shows its download
    if (bundle.required) {
      this.progress.set(0);
      this.state.set('updating');
    }

    return from(CapacitorUpdater.download({
      url: bundle.url,
      version,
      checksum: bundle.checksum,
      sessionKey: bundle.sessionKey,
    }));
  }

  // The plugin reloads the web view into the bundle. Past the launch the splash comes
  // back up first, so the reload reads as a launch; the new bundle's launch takes it down
  private _set$(bundle: BundleId): Observable<unknown> {
    const splash = !this._launching && Capacitor.isPluginAvailable('SplashScreen');
    const splash$: Observable<unknown> = splash ? from(SplashScreen.show({ autoHide: false })) : of(null);

    return splash$
      .pipe(
        switchMap(() => from(CapacitorUpdater.set(bundle))),
        // The reload refused: the splash comes down over the version still running
        catchError(() => splash ? from(SplashScreen.hide()) : EMPTY),
      );
  }

  // Back to the store build: behind the launch's splash, else at the next background
  private _toBuiltin$(current: BundleInfo): Observable<unknown> {
    this._readyId.set(null);
    this.readyVersion.set(null);
    this.state.set('idle');

    if (current.id === BUILTIN_ID) {
      return EMPTY;
    }

    return this._launching
      ? from(CapacitorUpdater.set({ id: BUILTIN_ID }))
      : from(CapacitorUpdater.next({ id: BUILTIN_ID }));
  }

  private _recordBuiltin$(): Observable<unknown> {
    return forkJoin([this._asset$('assets/build.json'), this._asset$('assets/native.json')])
      .pipe(
        tap(([build, native]) => {
          const builtin: Builtin = { build: build?.date ?? null, nativeLevel: Number(native?.level) || 0 };
          localStorage.setItem(BUILTIN_KEY, JSON.stringify(builtin));
        }),
      );
  }

  private _asset$(path: string): Observable<any> {
    return from(fetch(path).then((response) => response.ok ? response.json() : null))
      .pipe(
        catchError(() => of(null)),
      );
  }

  // Each return to the app, with how long it was away
  private _resume$(): Observable<number> {
    return new Observable<number>((subscriber) => {
      let pausedAt = Date.now();
      const pause = App.addListener('pause', () => pausedAt = Date.now());
      const resume = App.addListener('resume', () => subscriber.next(Date.now() - pausedAt));

      return () => {
        pause.then((listener) => listener.remove());
        resume.then((listener) => listener.remove());
      };
    });
  }

  // This store build's version against a minimum like 4.0.2, number by number
  private _isBelow(minVersion: string | null | undefined): boolean {
    if (!minVersion) {
      return false;
    }

    const own = this.version.split('.').map(Number);
    const min = minVersion.split('.').map(Number);
    const index = min.findIndex((part, i) => part !== (own[i] || 0));

    return index !== -1 && (own[index] || 0) < min[index];
  }

}
