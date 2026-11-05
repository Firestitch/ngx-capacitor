import { CapacitorUpdateConfig } from './capacitor-update-config';


/**
 * An environment's Capacitor settings. The same object goes to
 * FsCapacitorModule.forRoot() for the app and to FsCapacitorConfigService.init()
 * in capacitor.config.ts for the native plugins.
 */
export interface FsCapacitorConfig {
  update?: CapacitorUpdateConfig;
}
