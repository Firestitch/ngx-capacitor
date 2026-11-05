import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { FsCapacitorUpdate } from '../../services/capacitor-update.service';
import { FsCapacitorInfoComponent } from '../info';


/** Two taps closer than this, in ms, are a double tap; further apart, two single ones */
const DOUBLE_TAP = 400;

/**
 * "App version 3.0.3 (42)": the store build's version and build number, as plain text
 * the app styles. A double tap opens App info (FsCapacitorInfoComponent). Counted from
 * clicks rather than (dblclick), which a phone's web view does not reliably send for
 * two taps. Nothing hints at it: it is for whoever is looking into the app.
 *
 * Hidden on the web, where there is no native shell to version.
 */
@Component({
  selector: 'fs-capacitor-version',
  template: 'App version {{ update.version }} ({{ update.buildNumber }})',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[hidden]': '!update.version',
    '(click)': 'tap()',
  },
})
export class FsCapacitorVersionComponent {

  public readonly update = inject(FsCapacitorUpdate);

  private _dialog = inject(MatDialog);
  // When the last single tap landed; 0 when the next tap starts a new pair
  private _tappedAt = 0;

  public tap(): void {
    const now = Date.now();

    if (now - this._tappedAt > DOUBLE_TAP) {
      this._tappedAt = now;

      return;
    }

    this._tappedAt = 0;
    this._dialog.open(FsCapacitorInfoComponent, { autoFocus: false });
  }

}
