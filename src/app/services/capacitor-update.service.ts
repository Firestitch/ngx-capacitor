import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import { CapacitorUpdateConfig } from '@firestitch/capacitor/config';

import { EMPTY, Observable, ReplaySubject, Subject, forkJoin, from, merge, of, race, timer } from 'rxjs';
import { catchError, defaultIfEmpty, exhaustMap, filter, finalize, map, share, switchMap, take, tap } from 'rxjs/operators';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { BundleId, BundleInfo, CapacitorUpdater } from '@capgo/capacitor-updater';


import {
  CAPACITOR_UPDATE_AWAY_SWAP,
  CAPACITOR_UPDATE_CHECK_EVERY,
  CAPACITOR_UPDATE_LAUNCH_WAIT,
} from '../consts/capacitor-update-timing';
import { capacitorUpdateBundleName, capacitorUpdateVersion } from '../helpers/capacitor-update-bundle-name';
import {
  CapacitorUpdateAppData,
  CapacitorUpdateBuiltin,
  CapacitorUpdateBundle,
  CapacitorUpdateCheck,
  CapacitorUpdateEvent,
  CapacitorUpdateEventKind,
  CapacitorUpdateManifest,
  CapacitorUpdateMoment,
  CapacitorUpdateState,
} from '../interfaces';


const MANIFEST_FORMAT = 1;
// The plugin's id for the bundle the store build shipped with
const BUILTIN_ID = 'builtin';
const BUILTIN_KEY = 'fs-capacitor-update-builtin';
const FAILED_KEY = 'fs-capacitor-update-failed';
const CHECK_KEY = 'fs-capacitor-update-check';
const EVENTS_KEY = 'fs-capacitor-update-events';
// The downloaded version waiting to go in, so the next launch installs it without the network
const WAITING_KEY = 'fs-capacitor-update-waiting';
// The history keeps this many of the newest events
const EVENT_LIMIT = 20;
const MANIFEST_TIMEOUT = 10000;

/**
 * Over-the-air updates of the app's web code. The app reads its manifest from
 * {manifestUrl}{bundleId}/manifest.json at launch, on each return to the front, and every
 * CHECK_EVERY while the app stays in front; Capgo's plugin
 * downloads, verifies (capacitor.config's CapacitorUpdater.publicKey) and swaps the bundle.
 *
 * - A new version downloads in the background and goes in only behind the splash, where
 *   the reload goes unseen: at a launch (init() holds the splash up to LAUNCH_WAIT for its
 *   download), or on a return after AWAY_SWAP away. A quick switch to another app never
 *   reloads it. One left waiting goes in at the next launch before the manifest is read, so
 *   a slow network cannot keep it out. Meanwhile its dialog's Restart puts it in now; Later
 *   closes the dialog until a newer one.
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

  /** The last manifest read on this phone and what it found; kept across launches */
  public readonly lastCheck = signal<CapacitorUpdateCheck | null>(this._stored(CHECK_KEY));

  /** What the updater did on this phone, newest first; kept across launches */
  public readonly events = signal<CapacitorUpdateEvent[]>(this._stored(EVENTS_KEY) || []);

  /** When the timer checks next (ISO 8601); null while a check runs or the app is in the background */
  public readonly nextCheck = signal<string | null>(null);

  public appData: CapacitorUpdateAppData = {};

  private _destroyRef = inject(DestroyRef);
  private _enabled = false;
  private _readyId = signal<string | null>(null);
  private _laterId = signal<string | null>(null);
  private _storeUrl: string | null = null;
  // The launch's splash is still up: a version on the phone by now goes in unseen
  private _launching = true;
  private _launchChecked$ = new ReplaySubject<void>(1);
  private _checkEnded$ = new Subject<void>();
  // In front the timer runs; in the background it waits for the return
  private _front = true;
  // The waiting version's name, for the history
  private _readyName: string | null = null;

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

  /** Updates run here: a phone, a manifestUrl, and the plugin to apply what it names */
  public get enabled(): boolean {
    return this._enabled;
  }

  /** {manifestUrl}{bundleId}/manifest.json; null while updates are off */
  public get manifestUrl(): string | null {
    return this._enabled ? `${this.config().manifestUrl}${this.bundleIdentifier}/manifest.json` : null;
  }

  /** The store build's stamp and native level, as recorded the last time it ran */
  public get builtin(): CapacitorUpdateBuiltin | null {
    return this._stored(BUILTIN_KEY);
  }

  /** The last bundle that failed to start here, which every later check skips */
  public get failedVersion(): string | null {
    return localStorage.getItem(FAILED_KEY);
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
    this._enabled = enabled;

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
        switchMap(() => this._start$()),
        // The plugin could not answer: no updates this session, and the splash need not wait
        catchError(() => {
          this._launchChecked$.next();

          return EMPTY;
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();

    return enabled ? this._launch$() : of(null);
  }

  /** The dialog's Restart: the downloaded version, now */
  public refresh(): void {
    this._event('apply', `Installed ${this._readyName} with Restart`);
    this._set$({ id: this._readyId() })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe();
  }

  /** The dialog's Later: closes it; the version still goes in at the next launch, or a return after AWAY_SWAP away */
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

  /**
   * The manifest as the server publishes it now, read natively (S3 sends no CORS headers),
   * past any cache, and timed out so a dead network ends the read
   */
  public manifest$(): Observable<HttpResponse> {
    return from(CapacitorHttp.get({
      url: this.manifestUrl,
      params: { t: String(Date.now()) },
      connectTimeout: MANIFEST_TIMEOUT,
      readTimeout: MANIFEST_TIMEOUT,
    }));
  }

  private _launch$(): Observable<void> {
    return race(this._launchChecked$, timer(CAPACITOR_UPDATE_LAUNCH_WAIT))
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
            this._event('fail', `${capacitorUpdateBundleName(failed.bundle.version)} failed to start, so the phone went back to the code before it`);
          }
        }),
        switchMap(([current]) => (current.bundle.id === BUILTIN_ID ? this._recordBuiltin$() : of(null))
          .pipe(
            switchMap(() => this._launchWaiting$(current.bundle)),
          )),
        switchMap(() => this._moments$()),
        // A check runs to its end: a return mid-download never strands the full screen
        exhaustMap((moment) => this._check$(moment)
          .pipe(
            // The launch's check is through however it ends: the splash need not wait longer
            finalize(() => {
              if (moment === 'launch') {
                this._launchChecked$.next();
              }

              this._checkEnded$.next();
            }),
          )),
      );
  }

  private _check$(moment: CapacitorUpdateMoment): Observable<unknown> {
    this._checked(moment);

    return forkJoin([this.manifest$(), from(CapacitorUpdater.current())])
      .pipe(
        switchMap(([response, current]) => this._apply$(response, current.bundle, moment)),
        // Offline or a refused download: nothing changes, the next check tries again
        catchError((error) => {
          this._result(`Could not reach the update server: ${error?.message || 'unknown error'}`);

          return EMPTY;
        }),
      );
  }

  private _apply$(response: HttpResponse, current: BundleInfo, moment: CapacitorUpdateMoment): Observable<unknown> {
    // S3 answers 403 for a manifest that is not there: nothing is published
    if (response.status === 403 || response.status === 404) {
      this._result('Nothing is published for this app');

      return this._toBuiltin$(current);
    }

    if (response.status !== 200) {
      this._result(`The update server answered ${response.status}`);

      return EMPTY;
    }

    // S3 serves it as text/json, which can arrive unparsed
    const manifest: CapacitorUpdateManifest = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (manifest?.format !== MANIFEST_FORMAT || manifest.bundleId !== this.bundleIdentifier) {
      this._result('The manifest is for another app or format');

      return EMPTY;
    }

    // An App Store lookup by bundle id never finds a TestFlight build: the manager says where to go
    this._storeUrl = manifest.storeUrl?.[this.platform] ?? null;

    const minVersion = manifest.minVersion?.[this.platform];
    if (this._isBelow(minVersion)) {
      this._required(`Store version ${minVersion} or later required`);

      return EMPTY;
    }

    if (this.state() === 'required') {
      this.state.set('idle');
    }

    return this._applyBundle$(manifest.bundle, current, moment);
  }

  private _applyBundle$(
    bundle: CapacitorUpdateBundle | null,
    current: BundleInfo,
    moment: CapacitorUpdateMoment,
  ): Observable<unknown> {
    const builtin = this.builtin;
    if (!builtin || !bundle || !(Date.parse(bundle.build) > (Date.parse(builtin.build) || 0))) {
      this._result(bundle
        ? `The published update, ${this._name(bundle)}, is not newer than this store build`
        : 'Updates are stopped in the manager');

      return this._toBuiltin$(current);
    }

    if (bundle.nativeLevel > builtin.nativeLevel) {
      if (bundle.required) {
        this._required(`${this._name(bundle)} needs a newer store build`);
      } else {
        this._result(`${this._name(bundle)} needs a newer store build, so it is skipped`);
      }

      return EMPTY;
    }

    const version = capacitorUpdateVersion(bundle);
    if (current.version === version) {
      // The published version is the one running: one left waiting was withdrawn
      this._clearWaiting();
      if (this.state() === 'ready') {
        this.state.set('idle');
      }

      this._result(`Up to date: running ${this._name(bundle)}, the published update`);

      return EMPTY;
    }

    if (this.failedVersion === version) {
      this._result(`${this._name(bundle)} failed to start here before, so it is skipped`);

      return EMPTY;
    }

    return this._install$(bundle, version, moment);
  }

  // One already on the phone goes in at a launch or a return from away; a fresh download
  // only while the launch's splash is still up. A required one goes in either way
  private _install$(bundle: CapacitorUpdateBundle, version: string, moment: CapacitorUpdateMoment): Observable<unknown> {
    return this._downloaded$(version)
      .pipe(
        switchMap((info) => info
          ? this._place$(bundle, info, moment === 'away' || this._launching)
          : this._download$(bundle, version)
            .pipe(
              tap(() => this._event('download', `Downloaded ${this._name(bundle)}`)),
              switchMap((downloaded) => this._place$(bundle, downloaded, this._launching)),
            )),
        // A required download that fails lets the person back in
        catchError((error) => {
          this.state.set('idle');
          this._event('error', `${this._name(bundle)} did not download: ${error?.message || 'unknown error'}`);
          this._result(`${this._name(bundle)} did not download`);

          return EMPTY;
        }),
      );
  }

  // In now, or waiting for the next unseen moment with its dialog offering it meanwhile
  private _place$(bundle: CapacitorUpdateBundle, info: BundleInfo, swap: boolean): Observable<unknown> {
    if (bundle.required || swap) {
      // Recorded first: the reload that puts it in ends this web view
      this._event('apply', `Installed ${this._name(bundle)}`);
      this._result(`Installed ${this._name(bundle)}`);

      return this._set$(info);
    }

    // Each check finds it waiting again: the history records it once
    if (this._readyId() !== info.id) {
      this._event('ready', `${this._name(bundle)} downloaded, waiting to go in`);
    }

    this._result(`${this._name(bundle)} downloaded, waiting to go in`);
    localStorage.setItem(WAITING_KEY, info.id);
    this._readyId.set(info.id);
    this._readyName = this._name(bundle);
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
    // Whatever goes in now, nothing is left waiting for the next launch
    localStorage.removeItem(WAITING_KEY);

    const splash = !this._launching && Capacitor.isPluginAvailable('SplashScreen');
    const splash$: Observable<unknown> = splash ? from(SplashScreen.show({ autoHide: false })) : of(null);

    return splash$
      .pipe(
        switchMap(() => from(CapacitorUpdater.set(bundle))),
        // The reload refused: the version still running carries on, out from behind the
        // splash and the full screen
        catchError((error) => {
          this._event('error', `The plugin did not install it: ${error?.message || 'unknown error'}`);

          if (this.state() === 'updating') {
            this.state.set('idle');
          }

          return splash ? from(SplashScreen.hide()) : EMPTY;
        }),
      );
  }

  // Back to the store build: behind the launch's splash, else at the next background
  private _toBuiltin$(current: BundleInfo): Observable<unknown> {
    this._clearWaiting();
    this.state.set('idle');

    if (current.id === BUILTIN_ID) {
      return EMPTY;
    }

    this._event('store', this._launching ? 'Back to the store build' : 'Back to the store build at the next launch');

    return this._launching
      ? from(CapacitorUpdater.set({ id: BUILTIN_ID }))
      : from(CapacitorUpdater.next({ id: BUILTIN_ID }));
  }

  private _recordBuiltin$(): Observable<unknown> {
    return forkJoin([this._asset$('assets/build.json'), this._asset$('assets/native.json')])
      .pipe(
        tap(([build, native]) => {
          const builtin: CapacitorUpdateBuiltin = { build: build?.date ?? null, nativeLevel: Number(native?.level) || 0 };
          // A new store build: a version left waiting was checked against the one before it
          if (builtin.build !== this.builtin?.build) {
            localStorage.removeItem(WAITING_KEY);
          }

          localStorage.setItem(BUILTIN_KEY, JSON.stringify(builtin));
        }),
      );
  }

  // A version left waiting (Later, or a launch whose check outlasted LAUNCH_WAIT) goes in
  // behind this launch's splash before any manifest read, which a slow network could carry
  // past LAUNCH_WAIT and leave it waiting again. The check after the reload still corrects
  // it if the manager has moved on since
  private _launchWaiting$(current: BundleInfo): Observable<unknown> {
    const id = localStorage.getItem(WAITING_KEY);
    if (!id || id === current.id) {
      localStorage.removeItem(WAITING_KEY);

      return of(null);
    }

    return from(CapacitorUpdater.list())
      .pipe(
        map(({ bundles }) => bundles
          .find((info) => info.id === id && (info.status === 'success' || info.status === 'pending'))),
        switchMap((info) => {
          // Gone from the phone, or failed to start here: nothing waits any more
          if (!info || info.version === this.failedVersion) {
            localStorage.removeItem(WAITING_KEY);

            return of(null);
          }

          // The splash is already down: the launch's check offers it in the dialog instead
          if (!this._launching) {
            return of(null);
          }

          // Recorded first: the reload that puts it in ends this web view
          this._event('apply', `Installed ${capacitorUpdateBundleName(info.version)}, left waiting, at the launch`);

          // A refused reload carries on into the launch's check
          return this._set$(info)
            .pipe(
              defaultIfEmpty(null),
            );
        }),
        catchError(() => of(null)),
      );
  }

  // Nothing waits any more: the dialog closes and the next launch installs nothing
  private _clearWaiting(): void {
    this._readyId.set(null);
    this.readyVersion.set(null);
    localStorage.removeItem(WAITING_KEY);
  }

  private _asset$(path: string): Observable<any> {
    return from(fetch(path).then((response) => response.ok ? response.json() : null))
      .pipe(
        catchError(() => of(null)),
      );
  }

  // The launch, each return to the front, and the timer while the app stays in front
  private _moments$(): Observable<CapacitorUpdateMoment> {
    const lifecycle$ = this._lifecycle$()
      .pipe(
        tap((away: number | null) => this._front = away !== null),
        share(),
      );

    return merge(
      of<CapacitorUpdateMoment>('launch'),
      lifecycle$
        .pipe(
          filter((away: number | null) => away !== null),
          map((away: number): CapacitorUpdateMoment => away >= CAPACITOR_UPDATE_AWAY_SWAP ? 'away' : 'back'),
        ),
      this._timer$(lifecycle$),
    );
  }

  // In front, the next check comes CHECK_EVERY after the last one ends. In the background
  // none: the return checks at once
  private _timer$(lifecycle$: Observable<number | null>): Observable<CapacitorUpdateMoment> {
    return merge(
      this._checkEnded$.pipe(map(() => this._front)),
      lifecycle$
        .pipe(
          filter((away: number | null) => away === null),
          map(() => false),
        ),
    )
      .pipe(
        switchMap((front: boolean) => {
          this.nextCheck.set(front ? new Date(Date.now() + CAPACITOR_UPDATE_CHECK_EVERY).toISOString() : null);

          return front
            ? timer(CAPACITOR_UPDATE_CHECK_EVERY).pipe(map((): CapacitorUpdateMoment => 'timer'))
            : EMPTY;
        }),
      );
  }

  // Each move to the background (null), and each return to the front with how long it was away
  private _lifecycle$(): Observable<number | null> {
    return new Observable<number | null>((subscriber) => {
      let pausedAt = Date.now();
      const pause = App.addListener('pause', () => {
        pausedAt = Date.now();
        subscriber.next(null);
      });
      const resume = App.addListener('resume', () => subscriber.next(Date.now() - pausedAt));

      return () => {
        pause.then((listener) => listener.remove());
        resume.then((listener) => listener.remove());
      };
    });
  }

  // Store update required: the history records it once, not at every check that finds it
  private _required(result: string): void {
    if (this.state() !== 'required') {
      this._event('required', result);
    }

    this.state.set('required');
    this._result(result);
  }

  // A check starts: its moment now, its result once it has one
  private _checked(moment: CapacitorUpdateMoment): void {
    this.lastCheck.set({ date: new Date().toISOString(), moment, result: 'Checking' });
    this.nextCheck.set(null);
    this._store(CHECK_KEY, this.lastCheck());
  }

  // A published bundle as the managers list it: "4.0.2 (checksum 3fa9c1e0b2d4)"
  private _name(bundle: CapacitorUpdateBundle): string {
    return capacitorUpdateBundleName(capacitorUpdateVersion(bundle));
  }

  private _result(result: string): void {
    this.lastCheck.update((check) => check ? { ...check, result } : check);
    this._store(CHECK_KEY, this.lastCheck());
  }

  // Stored at once: anything that reloads the web view next would lose it otherwise
  private _event(kind: CapacitorUpdateEventKind, message: string): void {
    const event: CapacitorUpdateEvent = { date: new Date().toISOString(), kind, message };

    this.events.update((events) => [event, ...events].slice(0, EVENT_LIMIT));
    this._store(EVENTS_KEY, this.events());
  }

  private _stored<T>(key: string): T | null {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  private _store(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
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
