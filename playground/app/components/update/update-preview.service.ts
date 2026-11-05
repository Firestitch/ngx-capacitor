import { Injectable, signal } from '@angular/core';

import { CAPACITOR_UPDATE_COLORS, FsCapacitorUpdate } from '@firestitch/capacitor';
import { CapacitorUpdateConfig } from '@firestitch/capacitor/config';


/**
 * Stands in for FsCapacitorUpdate inside the example only, so its states can be
 * shown in a browser without touching the app's real updater. Restart, Later and
 * Update end the preview instead of calling the native plugin. Its config is the example's
 * own, so the color pickers restyle the preview without touching the app's.
 */
@Injectable()
export class UpdatePreviewService extends FsCapacitorUpdate {

  public override readonly config = signal<CapacitorUpdateConfig>({
    colors: { ...CAPACITOR_UPDATE_COLORS },
  });

  // What Capacitor's App.getInfo gives on a phone, for a sample app
  public override appData = { name: 'Acme', version: '1.0.0' };

  public override readonly readyVersion = signal<string | null>('1.1.0');

  public override refresh(): void {
    this.state.set('idle');
  }

  public override later(): void {
    this.state.set('idle');
  }

  public override openStore(): void {
    this.state.set('idle');
  }

}
