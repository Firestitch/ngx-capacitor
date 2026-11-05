import { FsCapacitorConfig } from '../interfaces';


/**
 * Runs in capacitor.config.ts, in plain Node during cap sync, so it imports
 * nothing: it hands the native plugins the settings only they can read.
 */
export class FsCapacitorConfigService {

  public static init<T extends { plugins?: object }>(config: T, capacitor: FsCapacitorConfig = {}): T {
    return {
      ...config,
      plugins: {
        ...config.plugins,
        // Manual mode: FsCapacitorUpdate reads the manifest itself, and the plugin
        // never calls Capgo's servers for updates or stats
        CapacitorUpdater: {
          autoUpdate: false,
          statsUrl: '',
          publicKey: capacitor.update?.publicKey ?? '',
        },
      },
    };
  }

}
