/**
 * This phone's install of the app: the store build and the code running in it, as the
 * app reports it to its own backend (FsCapacitorUpdate.install). Every value is what the
 * phone could read; one it could not is null
 */
export interface CapacitorAppInstall {
  /** Capacitor's Device.getId(): one per phone, shared by a vendor's apps on it */
  deviceIdentifier: string;
  /** The app's bundle id, com.example.app: with deviceIdentifier, names the install */
  bundleId: string;
  platform: 'ios' | 'android';
  /** The phone's model, iPhone15,2 */
  model: string | null;
  osVersion: string | null;
  /** The store build's version, 4.0.1 */
  storeVersion: string | null;
  /** The store build's number, 11290 */
  storeBuild: string | null;
  /** When the store build's web code was built (its assets/build.json), ISO 8601 */
  storeBuildDate: string | null;
  /** The store build's native level (its assets/native.json) */
  nativeLevel: number | null;
  /** store: the store build's own code runs. update: a downloaded over-the-air bundle runs */
  codeSource: 'store' | 'update';
  /** The running code's version */
  codeVersion: string | null;
  /** The running update's checksum, as the managers list it; null while the store build's own code runs */
  codeChecksum: string | null;
  /** When the running code was built, ISO 8601 */
  codeBuildDate: string | null;
  /** What the updater's last finished check found, "Up to date: running 4.0.3 (checksum 3b90b85e702e)" */
  lastCheckResult: string | null;
}
