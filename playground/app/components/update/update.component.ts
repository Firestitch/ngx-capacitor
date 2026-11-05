import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import {
  CAPACITOR_UPDATE_COLORS,
  CapacitorUpdateState,
  FsCapacitorUpdate,
  FsCapacitorUpdateComponent,
} from '@firestitch/capacitor';
import { CapacitorUpdateColors } from '@firestitch/capacitor/config';
import { FsColorPickerModule } from '@firestitch/colorpicker';

import { EMPTY, Observable, Subject, interval } from 'rxjs';
import { switchMap, take, tap } from 'rxjs/operators';

import { UpdatePreviewService } from './update-preview.service';


const APP_ICON = 'assets/app-icon.svg';

@Component({
  selector: 'app-update',
  templateUrl: './update.component.html',
  styleUrls: ['./update.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatInput,
    FsColorPickerModule,
    FsCapacitorUpdateComponent,
  ],
  providers: [{ provide: FsCapacitorUpdate, useClass: UpdatePreviewService }],
})
export class UpdateComponent {

  public readonly update = inject(FsCapacitorUpdate);

  /** The environment's update block for the look on screen, to copy into the app */
  public readonly snippet = computed(() => {
    const { colors, icon } = this.update.config();
    const update = { manifestUrl: '...', publicKey: '...', colors, ...(icon ? { icon } : {}) };

    return `update: ${JSON.stringify(update, null, 2)}`
      .replace(/"(\w+)":/g, '$1:')
      .replace(/"/g, '\'');
  });

  private _show$ = new Subject<CapacitorUpdateState>();

  constructor() {
    this._show$
      .pipe(
        tap((state: CapacitorUpdateState) => {
          this.update.progress.set(0);
          this.update.state.set(state);
        }),
        // Choosing another state mid-download cancels it
        switchMap((state: CapacitorUpdateState) => {
          return state === 'updating' ? this._download$() : EMPTY;
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  public show(state: CapacitorUpdateState): void {
    this._show$.next(state);
  }

  public setColor(name: keyof CapacitorUpdateColors, color: string): void {
    this.update.config.update((config) => ({ ...config, colors: { ...config.colors, [name]: color } }));
  }

  public showIcon(show: boolean): void {
    this.update.config.update((config) => ({ ...config, icon: show ? APP_ICON : undefined }));
  }

  public resetColors(): void {
    this.update.config.update((config) => ({ ...config, colors: { ...CAPACITOR_UPDATE_COLORS } }));
  }

  // A required download runs to 100%, then the app restarts on the new version
  private _download$(): Observable<number> {
    return interval(60)
      .pipe(
        take(100),
        tap({
          next: (tick: number) => this.update.progress.set(tick + 1),
          complete: () => this.update.state.set('idle'),
        }),
      );
  }

}
