import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MatButton } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';

import { FsDialogModule } from '@firestitch/dialog';

import { FsCapacitorUpdate } from '../../services/capacitor-update.service';


/**
 * A new version waiting, as one of the app's own dialogs, pinned to the bottom on a
 * phone. Restart applies it now; Later, the backdrop or Escape leave it for the next
 * background. fs-capacitor-update opens and closes it.
 */
@Component({
  templateUrl: './update-ready.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FsDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
  ],
})
export class FsCapacitorUpdateReadyComponent {

  public readonly update = inject(FsCapacitorUpdate);

  /** The app by the name under its icon (Capacitor's App.getInfo), else just "this app" */
  public readonly title = this.update.appData.name
    ? `${this.update.appData.name} has an update`
    : 'This app has an update';

  public readonly version = this.update.readyVersion;

}
