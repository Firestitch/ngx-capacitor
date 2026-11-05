/** What the app shows of an update: nothing, a version waiting, a required one downloading, or a store update required */
export type CapacitorUpdateState = 'idle' | 'ready' | 'updating' | 'required';

/** The manifest published at {manifestUrl}{bundleId}/manifest.json, format 1 */
export interface CapacitorUpdateManifest {
  format: number;
  bundleId: string;
  /** Store builds below this version (4.0.2) must update from the store; null for none */
  minVersion: { ios: string | null; android: string | null };
  /** Where "Update required" sends the phone (the app in TestFlight or the App Store); null, the store listing the plugin finds by the bundle id */
  storeUrl: { ios: string | null; android: string | null };
  /** The live bundle; null when updates are stopped */
  bundle: CapacitorUpdateBundle | null;
}

export interface CapacitorUpdateBundle {
  version: string;
  /** The bundle's own assets/build.json date */
  build: string;
  url: string;
  checksum: string;
  sessionKey: string;
  /** The bundle's own assets/native.json level */
  nativeLevel: number;
  required: boolean;
}
