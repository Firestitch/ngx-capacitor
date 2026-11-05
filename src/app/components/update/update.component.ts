import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import { MatDialog, MatDialogState } from '@angular/material/dialog';

import { EMPTY, Observable, forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, distinctUntilChanged, finalize, switchMap, tap } from 'rxjs/operators';

import { Capacitor } from '@capacitor/core';
import { StatusBar, StatusBarInfo, Style } from '@capacitor/status-bar';

import { CapacitorUpdateColors } from '@firestitch/capacitor/config';

import { CAPACITOR_UPDATE_COLORS } from '../../consts';
import { FsCapacitorUpdate } from '../../services/capacitor-update.service';
import { FsCapacitorUpdateReadyComponent } from '../update-ready';


/**
 * What the app shows of an over-the-air update: a dialog in the app's own look when a
 * new version is waiting, and a full screen while a required one downloads or the store
 * build must be updated. Place it once in the app's root template. The screen takes its
 * colors and icon from the environment's update config (FsCapacitorConfig.update).
 */
@Component({
  selector: 'fs-capacitor-update',
  templateUrl: './update.component.html',
  styleUrls: ['./update.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[style.--fs-capacitor-update-primary]': 'colors().primary',
    '[style.--fs-capacitor-update-accent]': 'colors().accent',
    '[style.--fs-capacitor-update-background]': 'colors().background',
  },
})
export class FsCapacitorUpdateComponent {

  public readonly update = inject(FsCapacitorUpdate);

  /** The new version's dialog: open while one waits, until Later puts it off */
  public readonly prompt = computed(() => this.update.state() === 'ready' && !this.update.postponed());

  /** The full screen: a required version downloading, or the store build too old */
  public readonly screen = computed(() => this.update.state() === 'updating' || this.update.state() === 'required');

  public readonly colors = computed<Required<CapacitorUpdateColors>>(() => {
    const colors = this.update.config().colors;

    return {
      primary: colors?.primary || CAPACITOR_UPDATE_COLORS.primary,
      accent: colors?.accent || CAPACITOR_UPDATE_COLORS.accent,
      background: colors?.background || CAPACITOR_UPDATE_COLORS.background,
    };
  });

  /** The configured icon, until it fails to load; then the glyph shows instead */
  public readonly icon = computed(() => {
    const icon = this.update.config().icon;

    return icon && icon !== this._failedIcon() ? icon : null;
  });

  private _destroyRef = inject(DestroyRef);
  private _dialog = inject(MatDialog);
  private _injector = inject(Injector);
  private _failedIcon = signal<string | null>(null);
  private _statusBar: StatusBarInfo | null = null;

  constructor() {
    this._init();
  }

  public iconFailed(): void {
    this._failedIcon.set(this.icon());
  }

  private _init(): void {
    this._initPrompt();

    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('StatusBar')) {
      this._initStatusBar();
    }
  }

  // The dialog follows the prompt: open while a new version waits, closed when it no longer does
  private _initPrompt(): void {
    toObservable(this.prompt)
      .pipe(
        distinctUntilChanged(),
        switchMap((prompt) => prompt ? this._openPrompt$() : EMPTY),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();
  }

  // Closed by the person (Later, the backdrop, Escape), the version is put off; when the
  // prompt ends some other way (Restart, the update withdrawn), the dialog just closes
  private _openPrompt$(): Observable<unknown> {
    // This host's injector, so the dialog talks to the same updater the host does
    const dialogRef = this._dialog.open(FsCapacitorUpdateReadyComponent, { injector: this._injector });

    return dialogRef.afterClosed()
      .pipe(
        tap(() => this.update.later()),
        finalize(() => {
          if (dialogRef.getState() === MatDialogState.OPEN) {
            dialogRef.close();
          }
        }),
      );
  }

  // Android draws the status bar outside the web view in the app's own color, a band
  // over the screen: while the screen shows, the bar takes its background, then gets its own back
  private _initStatusBar(): void {
    toObservable(this.screen)
      .pipe(
        distinctUntilChanged(),
        concatMap((screen) => screen ? this._coverStatusBar$() : this._restoreStatusBar$()),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();
  }

  private _coverStatusBar$(): Observable<unknown> {
    return from(StatusBar.getInfo())
      .pipe(
        tap((info) => this._statusBar = info),
        // Light icons over the dark screen
        switchMap(() => this._setStatusBar$(Style.Dark, this.colors().background)),
        catchError(() => EMPTY),
      );
  }

  private _restoreStatusBar$(): Observable<unknown> {
    const info = this._statusBar;
    this._statusBar = null;

    return info
      ? this._setStatusBar$(info.style, info.color).pipe(catchError(() => EMPTY))
      : EMPTY;
  }

  // The color is Android's alone: on iOS the web view, and so the screen, runs under the status bar
  private _setStatusBar$(style: Style, color: string | undefined): Observable<unknown> {
    return forkJoin([
      from(StatusBar.setStyle({ style })),
      this.update.platform === 'android' && color
        ? from(StatusBar.setBackgroundColor({ color }))
        : of(null),
    ]);
  }

}
