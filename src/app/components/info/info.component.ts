import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';

import { MatButton } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';

import { FsClipboardModule } from '@firestitch/clipboard';
import { FsDialogModule } from '@firestitch/dialog';
import { FsLabelModule } from '@firestitch/label';
import { FsSkeletonModule } from '@firestitch/skeleton';

import { tap } from 'rxjs/operators';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CapacitorInfoRow, CapacitorInfoSection } from '../../interfaces';
import { FsCapacitorInfo } from '../../services/capacitor-info.service';


/**
 * App info: what the app knows about itself and the infrastructure under it, one part
 * per heading (FsCapacitorInfo). fs-capacitor-version opens it on a double tap.
 *
 * Read only. Copy details copies every part as text, label: value per line, for a
 * support thread or a ticket.
 */
@Component({
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FsDialogModule,
    FsLabelModule,
    FsSkeletonModule,
    FsClipboardModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
  ],
})
export class FsCapacitorInfoComponent {

  public readonly sections = signal<CapacitorInfoSection[] | null>(null);

  /** Every part as plain text, for Copy details */
  public readonly text = computed<string>(() => (this.sections() || [])
    .map((section: CapacitorInfoSection) => [
      section.name,
      ...(section.note ? [section.note] : []),
      ...section.rows.map((row: CapacitorInfoRow) => `${row.label}: ${row.value}`),
    ].join('\n'))
    .join('\n\n'));

  private _info = inject(FsCapacitorInfo);
  private _destroyRef = inject(DestroyRef);

  constructor() {
    this._init();
  }

  private _init(): void {
    this._info.sections$()
      .pipe(
        tap((sections: CapacitorInfoSection[]) => this.sections.set(sections)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();
  }

}
