import { Injectable, LOCALE_ID, VERSION, inject, isDevMode } from '@angular/core';
import { formatDate } from '@angular/common';

import { Observable, defer, forkJoin, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { Capacitor, HttpResponse } from '@capacitor/core';
import { Device, DeviceId, DeviceInfo, GetLanguageCodeResult } from '@capacitor/device';
import { BundleInfo, BundleListResult, BundleStatus, CapacitorUpdater, PluginVersion } from '@capgo/capacitor-updater';

import { CAPACITOR_UPDATE_AWAY_SWAP, CAPACITOR_UPDATE_CHECK_EVERY } from '../consts/capacitor-update-timing';
import { capacitorUpdateBundleName, capacitorUpdateVersion } from '../helpers/capacitor-update-bundle-name';
import {
  CapacitorInfoRow,
  CapacitorInfoSection,
  CapacitorUpdateBuiltin,
  CapacitorUpdateEvent,
  CapacitorUpdateManifest,
  CapacitorUpdateMoment,
} from '../interfaces';

import { FsCapacitorUpdate } from './capacitor-update.service';


// The update plugin's id for the code the store build shipped with
const BUILTIN_ID = 'builtin';
const PUBLISHED = 'Published update';
const DATE_TIME = 'EEE, MMM d, y, h:mm a';
const TIME = 'h:mm a';
// The dialog redraws this often, so the countdown and the "ago" times run
const TICK = 1000;

const SYSTEM_NAMES: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
  mac: 'macOS',
  windows: 'Windows',
};

const MOMENT_NAMES: Record<CapacitorUpdateMoment, string> = {
  launch: 'at launch',
  back: 'on a return to the app',
  away: 'on a return after time away',
  timer: `on the ${CAPACITOR_UPDATE_CHECK_EVERY / 60000}-minute check while open`,
};

// The plugin's word for a downloaded bundle, as people read it
const BUNDLE_STATUS_NAMES: Partial<Record<BundleStatus, string>> = {
  success: 'started fine',
  pending: 'downloaded, not started yet',
  error: 'failed to start',
  downloading: 'downloading',
};

/** A JSON file the running bundle carries */
interface AssetFile {
  version?: string;
  date?: string;
  level?: number;
}

/** What the update plugin says of the bundles on this phone */
interface UpdaterRead {
  current: { bundle: BundleInfo; native: string } | null;
  next: BundleInfo | null;
  bundles: BundleInfo[] | null;
  pluginVersion: string | null;
}

/** What reading the manifest got: its status and, on a 200, the manifest; or why there was no answer */
interface ManifestRead {
  status?: number;
  manifest?: CapacitorUpdateManifest;
  error?: string;
}

/** Everything read once when the dialog opens */
interface InfoRead {
  build: AssetFile | null;
  native: AssetFile | null;
  device: DeviceInfo | null;
  deviceId: DeviceId | null;
  language: GetLanguageCodeResult | null;
  updater: UpdaterRead | null;
  manifest: ManifestRead | null;
}

/**
 * Everything the app can say about itself for the App info dialog
 * (FsCapacitorInfoComponent): the store build, the web code running in it, the
 * over-the-air updater with its checks and history, the bundles on the phone, the
 * manifest as it is published now, and the device.
 *
 * READ ONCE ON EACH OPEN, DRAWN EVERY SECOND. The phone and the server are read when the
 * dialog opens, each read on its own: a call this phone cannot answer leaves out its own
 * rows, never the dialog. The updater's own state (its checks, countdown and history) is
 * drawn again every second, so a check that runs while the dialog is open shows.
 */
@Injectable({
  providedIn: 'root',
})
export class FsCapacitorInfo {

  private _update = inject(FsCapacitorUpdate);
  private _locale = inject(LOCALE_ID);

  public sections$(): Observable<CapacitorInfoSection[]> {
    return forkJoin({
      build: this._asset$('assets/build.json'),
      native: this._asset$('assets/native.json'),
      device: this._read$(() => Device.getInfo()),
      deviceId: this._read$(() => Device.getId()),
      language: this._read$(() => Device.getLanguageTag()),
      updater: this._updater$(),
      manifest: this._manifest$(),
    })
      .pipe(
        switchMap((read: InfoRead) => timer(0, TICK)
          .pipe(map(() => this._sections(read)))),
      );
  }

  private _sections(read: InfoRead): CapacitorInfoSection[] {
    const published = read.manifest?.manifest?.bundle;

    return [
      this._appSection(this._builtin(read.updater, read.build, read.native)),
      this._codeSection(read.build, read.native, read.updater),
      this._updatesSection(read.updater),
      this._bundlesSection(read.updater, published ? capacitorUpdateVersion(published) : null),
      this._historySection(),
      this._publishedSection(read.manifest, read.updater),
      this._deviceSection(read.device, read.deviceId?.identifier, read.language?.value),
    ]
      .filter((section: CapacitorInfoSection) => section.rows.length > 0);
  }

  /** The store build: what the App Store or Google Play installed */
  private _appSection(builtin: CapacitorUpdateBuiltin | null): CapacitorInfoSection {
    const app = this._update.appData;

    return this._section('App', [
      this._row('Name', app.name),
      this._row('Bundle ID', app.bundleIdentifier),
      this._row('Platform', this._systemName(app.platform)),
      this._row('Version', app.version),
      this._row('Build', app.buildNumber),
      this._row('Built', this._dateTime(builtin?.build)),
      this._row('Native level', builtin?.nativeLevel),
    ]);
  }

  /** The web code in the web view now: the store build's own, or a downloaded update */
  private _codeSection(build: AssetFile, native: AssetFile, updater: UpdaterRead): CapacitorInfoSection {
    const bundle = this._downloaded(updater?.current?.bundle);

    return this._section('Running code', [
      this._row('Source', bundle ? 'Downloaded update' : 'Store build'),
      this._row('Version', build?.version),
      this._row('Checksum', bundle ? this._checksum(bundle) : null),
      this._row('Built', this._dateTime(build?.date)),
      this._row('Downloaded', this._dateTime(bundle?.downloaded)),
      this._row('Native level', native?.level),
      this._row('Production build', this._yesNo(!isDevMode())),
      this._row('Angular', VERSION.full),
    ]);
  }

  /** The over-the-air updater: when it checks, what the last check found, what comes next */
  private _updatesSection(updater: UpdaterRead): CapacitorInfoSection {
    const enabled = this._update.enabled;
    const check = this._update.lastCheck();
    const applied = this._update.events()
      .find((event: CapacitorUpdateEvent) => event.kind === 'apply');

    return this._section('Updates', [
      this._row('Updates', enabled ? 'On' : 'Off'),
      this._row('Checks', enabled ? this._checks() : null),
      this._row('Last check', check ? `${this._dateTime(check.date)} (${this._ago(check.date)}), ${MOMENT_NAMES[check.moment]}` : null),
      this._row('Next check', enabled ? this._nextCheck() : null),
      this._row('Result', check?.result),
      this._row('Status', enabled ? this._status() : null),
      this._row('Goes in', this._update.state() === 'ready' ? this._goesIn() : null),
      this._row('Last install', applied ? `${this._dateTime(applied.date)} (${this._ago(applied.date)}), ${applied.message}` : null),
      this._row('Next launch', this._nextLaunch(updater)),
      this._row('Last failed', this._update.failedVersion ? capacitorUpdateBundleName(this._update.failedVersion) : null),
      this._row('Manifest', this._update.manifestUrl),
      this._row('Updater plugin', updater?.pluginVersion),
    ]);
  }

  /** The updates the plugin downloaded and keeps on this phone, one row each */
  private _bundlesSection(updater: UpdaterRead | null, published: string | null): CapacitorInfoSection {
    if (!updater?.bundles) {
      return this._section('On this phone', []);
    }

    const bundles = updater.bundles.filter((bundle: BundleInfo) => bundle.id !== BUILTIN_ID);
    const rows = bundles.length
      ? bundles.map((bundle: BundleInfo) => this._row(
        bundle.version.split('+')[0],
        this._bundleFacts(bundle, updater, published),
      ))
      : [this._row('Downloaded updates', 'None, so the store build\'s own code runs')];

    return {
      ...this._section('On this phone', rows),
      note: bundles.length
        ? 'Each update by its version and checksum, the SHA-256 of its zip. Environment Manager and '
          + 'Deployment Manager list the start of the checksum; hover there for all of it'
        : null,
    };
  }

  /** What the updater did on this phone, newest first */
  private _historySection(): CapacitorInfoSection {
    return this._section('Update history', this._update.events()
      .map((event: CapacitorUpdateEvent) => this._row(this._dateTime(event.date), event.message)));
  }

  /**
   * The update file as the server publishes it now: the manifest the phone checks,
   * and the bundle it names. Left out while updates are off
   */
  private _publishedSection(read: ManifestRead | null, updater: UpdaterRead | null): CapacitorInfoSection {
    if (!read) {
      return this._section(PUBLISHED, []);
    }

    if (read.error) {
      return this._section(PUBLISHED, [this._row('Manifest', `Could not reach the update server: ${read.error}`)]);
    }

    const status = read.status;

    // S3 answers 403 for a manifest that is not there, as the updater reads it
    if (status === 403 || status === 404) {
      return this._section(PUBLISHED, [this._row('Bundle', 'Nothing is published for this app')]);
    }

    if (status !== 200) {
      return this._section(PUBLISHED, [this._row('Manifest', `The update server answered ${status}`)]);
    }

    return this._section(PUBLISHED, this._manifestRows(read.manifest, updater));
  }

  /** The published bundle, whether this phone has it, and the store rules the manifest sets for this platform */
  private _manifestRows(manifest: CapacitorUpdateManifest, updater: UpdaterRead | null): CapacitorInfoRow[] {
    const bundle = manifest.bundle;
    const platform = this._update.platform as 'ios' | 'android';
    const version = bundle ? capacitorUpdateVersion(bundle) : null;

    return [
      this._row('Version', bundle ? bundle.version : 'None: updates are stopped'),
      this._row('Checksum', bundle?.checksum),
      this._row('This phone', version ? this._publishedHere(version, updater) : null),
      this._row('Built', this._dateTime(bundle?.build)),
      this._row('Native level', bundle?.nativeLevel),
      this._row('Required', bundle ? this._yesNo(bundle.required) : null),
      this._row('File', bundle?.url),
      this._row('Minimum store version', manifest.minVersion?.[platform] || 'None'),
      this._row('Store link', manifest.storeUrl?.[platform]),
      this._row('Format', manifest.format),
    ];
  }

  private _deviceSection(device: DeviceInfo | null, id: string, language: string): CapacitorInfoSection {
    return this._section('Device', [
      this._row('Model', device ? `${device.manufacturer} ${device.model}` : null),
      this._row('System', device ? `${this._systemName(device.operatingSystem)} ${device.osVersion}` : null),
      this._row('Web view', device?.webViewVersion),
      this._row('Virtual device', device ? this._yesNo(device.isVirtual) : null),
      this._row('Language', language),
      this._row('Device ID', id),
    ]);
  }

  private _checks(): string {
    return `At launch, every ${CAPACITOR_UPDATE_CHECK_EVERY / 60000} minutes while the app is open, and each time it comes back to the front`;
  }

  /** The timer's next check with its countdown; none runs while a check does or the app is away */
  private _nextCheck(): string {
    const next = this._update.nextCheck();

    if (next) {
      return `${formatDate(next, TIME, this._locale)} (in ${this._countdown(Date.parse(next) - Date.now())})`;
    }

    return this._update.lastCheck()?.result === 'Checking'
      ? 'Checking now'
      : 'When the app comes back to the front';
  }

  /** What the updater is doing, in the words of its own dialog and screens */
  private _status(): string {
    switch (this._update.state()) {
      case 'ready':
        return this._update.postponed()
          ? `${this._update.readyVersion()} downloaded, put off with Later`
          : `${this._update.readyVersion()} downloaded, waiting to go in`;
      case 'updating':
        return `Downloading a required version, ${this._update.progress()}%`;
      case 'required':
        return 'Store update required';
      default:
        return 'Nothing waiting';
    }
  }

  /**
   * When a waiting version goes in: behind the splash, where the reload goes unseen.
   * The time away starts when the app leaves the front
   */
  private _goesIn(): string {
    const minutes = CAPACITOR_UPDATE_AWAY_SWAP / 60000;

    return `At the next launch, or a return after ${minutes} minutes away. Restart puts it in now`;
  }

  /** The bundle set for the next launch, when it is not the one running */
  private _nextLaunch(updater: UpdaterRead): string | null {
    const next = updater?.next;

    if (!next || next.id === updater.current?.bundle?.id) {
      return null;
    }

    return next.id === BUILTIN_ID ? 'Store build' : capacitorUpdateBundleName(next.version);
  }

  /** One downloaded bundle: its checksum, how it went, and where it stands */
  private _bundleFacts(bundle: BundleInfo, updater: UpdaterRead, published: string | null): string {
    return [
      `Checksum ${this._checksum(bundle)}`,
      BUNDLE_STATUS_NAMES[bundle.status] || bundle.status,
      bundle.downloaded ? `downloaded ${this._dateTime(bundle.downloaded)}` : null,
      bundle.id === updater.current?.bundle?.id ? 'running now' : null,
      bundle.id === updater.next?.id && bundle.id !== updater.current?.bundle?.id ? 'set for the next launch' : null,
      bundle.version === published ? 'the published update' : null,
    ]
      .filter((fact: string | null) => !!fact)
      .join(', ');
  }

  /** Where the published bundle stands on this phone */
  private _publishedHere(version: string, updater: UpdaterRead | null): string | null {
    if (!updater) {
      return null;
    }

    if (updater.current?.bundle?.version === version) {
      return 'Running it';
    }

    if (this._update.failedVersion === version) {
      return 'It failed to start here, so it is skipped';
    }

    return (updater.bundles || []).some((bundle: BundleInfo) => bundle.version === version)
      ? 'Downloaded, not running yet'
      : 'Not downloaded';
  }

  /**
   * A downloaded bundle's whole checksum, as the plugin verified it; else the start of it
   * its version string ends with ("4.0.2+3fa9c1e0b2d4")
   */
  private _checksum(bundle: BundleInfo): string | null {
    return bundle.checksum || bundle.version.split('+')[1] || null;
  }

  /**
   * The store build's own stamp and native level: from its files while it is the
   * code running, else from what the updater recorded of it the last time it was
   */
  private _builtin(updater: UpdaterRead, build: AssetFile, native: AssetFile): CapacitorUpdateBuiltin | null {
    if (!this._downloaded(updater?.current?.bundle)) {
      return { build: build?.date, nativeLevel: native?.level };
    }

    return this._update.builtin;
  }

  /** A bundle the updater downloaded; null for the store build's own code */
  private _downloaded(bundle: BundleInfo | null | undefined): BundleInfo | null {
    return bundle && bundle.id !== BUILTIN_ID ? bundle : null;
  }

  private _updater$(): Observable<UpdaterRead | null> {
    if (!Capacitor.isPluginAvailable('CapacitorUpdater')) {
      return of(null);
    }

    return forkJoin({
      current: this._read$(() => CapacitorUpdater.current()),
      next: this._read$(() => CapacitorUpdater.getNextBundle()),
      bundles: this._read$(() => CapacitorUpdater.list())
        .pipe(map((list: BundleListResult) => list?.bundles)),
      pluginVersion: this._read$(() => CapacitorUpdater.getPluginVersion())
        .pipe(map((plugin: PluginVersion) => plugin?.version)),
    });
  }

  /** The manifest as published now, read as the updater reads it. Nothing while updates are off */
  private _manifest$(): Observable<ManifestRead | null> {
    if (!this._update.enabled) {
      return of(null);
    }

    return this._update.manifest$()
      .pipe(
        map((response: HttpResponse): ManifestRead => ({
          status: response.status,
          manifest: response.status === 200 ? this._parse(response) : null,
        })),
        // A body that is not JSON lands here too
        catchError((error) => of({ error: error?.message || 'unknown error' })),
      );
  }

  /** S3 serves the manifest as text/json, which can arrive unparsed */
  private _parse(response: HttpResponse): CapacitorUpdateManifest {
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  }

  /** A JSON file the running bundle carries, fetched as the updater does; null without one */
  private _asset$(path: string): Observable<AssetFile | null> {
    return defer(() => fetch(path)
      .then((response: Response) => response.ok ? response.json() : null))
      .pipe(catchError(() => of(null)));
  }

  /** A native call; null when this phone cannot answer it */
  private _read$<T>(call: () => Promise<T>): Observable<T | null> {
    return defer(call)
      .pipe(catchError(() => of(null)));
  }

  /** A part of the dialog, without the facts this phone has no value for */
  private _section(name: string, rows: CapacitorInfoRow[]): CapacitorInfoSection {
    return {
      name,
      rows: rows.filter((row: CapacitorInfoRow) => !!row),
    };
  }

  private _row(label: string, value: string | number | null | undefined): CapacitorInfoRow | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return { label, value: String(value) };
  }

  private _dateTime(value: string | null | undefined): string | null {
    const date = value ? new Date(value) : null;

    return date && !isNaN(date.getTime()) ? formatDate(date, DATE_TIME, this._locale) : null;
  }

  /** "40 seconds ago", "12 minutes ago", "3 hours ago", "2 days ago" */
  private _ago(value: string): string {
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
    const [count, unit] = seconds < 60
      ? [seconds, 'second']
      : seconds < 3600
        ? [Math.floor(seconds / 60), 'minute']
        : seconds < 86400
          ? [Math.floor(seconds / 3600), 'hour']
          : [Math.floor(seconds / 86400), 'day'];

    return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
  }

  /** A countdown as minutes and seconds, 14:05 */
  private _countdown(milliseconds: number): string {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));

    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  private _systemName(system: string): string {
    return SYSTEM_NAMES[system] || system;
  }

  private _yesNo(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

}
