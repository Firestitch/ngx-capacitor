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
import { FsSkeletonModule } from '@firestitch/skeleton';

import { tap } from 'rxjs/operators';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CAPACITOR_UPDATE_CHECKSUM_LENGTH } from '../../consts/capacitor-update-checksum';
import { CapacitorInfoRow, CapacitorInfoSection } from '../../interfaces';
import { FsCapacitorInfo } from '../../services/capacitor-info.service';


/**
 * App info: what the app knows about itself and the infrastructure under it, one boxed
 * part each (FsCapacitorInfo), led by the code running now. fs-capacitor-version opens it
 * on a double tap.
 *
 * Read only. A checksum shows its first 12 characters, as the managers list it, and a tap
 * shows all of it (every place it appears, since it names one bundle). Copy details copies
 * every part as text, label: value per line, whole checksums included, for a support
 * thread or a ticket.
 */
@Component({
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FsDialogModule,
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

  /** The checksums shown whole; the rest show their start */
  public readonly expanded = signal<string[]>([]);

  public readonly checksumLength = CAPACITOR_UPDATE_CHECKSUM_LENGTH;

  /** Every part as plain text, for Copy details */
  public readonly text = computed<string>(() => (this.sections() || [])
    .map((section: CapacitorInfoSection) => [
      section.name,
      ...(section.title ? [section.title] : []),
      ...(section.note ? [section.note] : []),
      ...section.rows.map((row: CapacitorInfoRow) => `${row.label}: ${[row.checksum, row.value].filter((part) => !!part).join(', ')}`),
    ].join('\n'))
    .join('\n\n'));

  private _info = inject(FsCapacitorInfo);
  private _destroyRef = inject(DestroyRef);

  constructor() {
    this._init();
  }

  /** A checksum's tap: all of it, or back to its start */
  public toggle(checksum: string): void {
    this.expanded.update((expanded: string[]) => expanded.includes(checksum)
      ? expanded.filter((value: string) => value !== checksum)
      : [...expanded, checksum]);
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
