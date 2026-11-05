import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EMPTY, Observable, forkJoin, from, merge, of } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';

import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { BundleInfo, CapacitorUpdater } from '@capgo/capacitor-updater';

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

/** The store build's own bundle, recorded while it runs: the floor every manifest is measured against */
interface Builtin {
  build: string | null;
  nativeLevel: number;
}

/**
 * Over-the-air updates of the app's web code. The app reads its manifest from
 * {manifestUrl}{bundleId}/manifest.json on launch and on resume; Capgo's plugin
 * downloads, verifies (capacitor.config's CapacitorUpdater.publicKey) and swaps the bundle.
 *
 * - The store build is the floor: a bundle no newer than it, nothing published, or
 *   updates stopped all go back to it at the next background. So a newer store build
 *   always wins, and pointing the manifest at an older bundle rolls phones back.
 * - A store version below the manifest's minVersion, or a required bundle needing a
 *   native level above the store build's (assets/native.json), shows "Update required".
 *   Its Update opens the manifest's storeUrl for the platform, else the store listing.
 * - A bundle needing a higher native level, or one that failed to start here, is skipped.
 * - A new version applies at the next background; its dialog's Restart applies it now,
 *   its Later closes the dialog until a newer one. A required one downloads behind a
 *   full screen and applies at once.
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

  public init(config: CapacitorUpdateConfig = {}): void {
    this.config.set(config);

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (Capacitor.isPluginAvailable('CapacitorUpdater')) {
      // First: a bundle that got this far has started, so the plugin keeps it
      CapacitorUpdater.notifyAppReady();
    }

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
        filter(() => !!config.manifestUrl && Capacitor.isPluginAvailable('CapacitorUpdater')),
        tap(() => this._manifestUrl = config.manifestUrl),
        switchMap(() => this._start$()),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();
  }

  /** The dialog's Restart: the downloaded version, now */
  public refresh(): void {
    CapacitorUpdater.set({ id: this._readyId() });
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
        switchMap(() => merge(of(null), this._resume$())),
        switchMap(() => this._check$()),
      );
  }

  private _check$(): Observable<unknown> {
    return forkJoin([this._manifest$(), from(CapacitorUpdater.current())])
      .pipe(
        switchMap(([response, current]) => this._apply$(response, current.bundle)),
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

  private _apply$(response: HttpResponse, current: BundleInfo): Observable<unknown> {
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

    return this._applyBundle$(manifest.bundle, current);
  }

  private _applyBundle$(bundle: CapacitorUpdateBundle | null, current: BundleInfo): Observable<unknown> {
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

    return this._install$(bundle, version);
  }

  private _install$(bundle: CapacitorUpdateBundle, version: string): Observable<unknown> {
    if (bundle.required) {
      this.progress.set(0);
      this.state.set('updating');
    }

    return this._download$(bundle, version)
      .pipe(
        switchMap((info) => bundle.required
          ? from(CapacitorUpdater.set(info))
          : from(CapacitorUpdater.next(info))
            .pipe(
              tap(() => {
                this._readyId.set(info.id);
                this.readyVersion.set(bundle.version);
                this.state.set('ready');
              }),
            )),
        // A required download that fails lets the person back in
        catchError(() => {
          this.state.set('idle');

          return EMPTY;
        }),
      );
  }

  // One already downloaded is reused rather than fetched again
  private _download$(bundle: CapacitorUpdateBundle, version: string): Observable<BundleInfo> {
    return from(CapacitorUpdater.list())
      .pipe(
        map(({ bundles }) => bundles
          .find((info) => info.version === version && (info.status === 'success' || info.status === 'pending'))),
        switchMap((info) => info ? of(info) : from(CapacitorUpdater.download({
          url: bundle.url,
          version,
          checksum: bundle.checksum,
          sessionKey: bundle.sessionKey,
        }))),
      );
  }

  // Back to the store build at the next background, never under the person
  private _toBuiltin$(current: BundleInfo): Observable<unknown> {
    const queued = this.state() === 'ready';
    this.state.set('idle');

    return current.id === BUILTIN_ID && !queued ? EMPTY : from(CapacitorUpdater.next({ id: BUILTIN_ID }));
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

  private _resume$(): Observable<void> {
    return new Observable<void>((subscriber) => {
      const handle = App.addListener('resume', () => subscriber.next());

      return () => {
        handle.then((listener) => listener.remove());
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
