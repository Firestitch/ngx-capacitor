import { CAPACITOR_UPDATE_CHECKSUM_LENGTH } from '../consts/capacitor-update-checksum';
import { CapacitorUpdateBundle } from '../interfaces/capacitor-update-manifest';


/**
 * The plugin's version string for a published bundle: its version and the start of its
 * checksum (capacitorUpdateChecksum(), as the managers list it), "4.0.2+3fa9c1e0b2d4"
 */
export function capacitorUpdateVersion(bundle: CapacitorUpdateBundle, checksum: string): string {
  return `${bundle.version}+${checksum.slice(0, CAPACITOR_UPDATE_CHECKSUM_LENGTH)}`;
}

/** The plugin's version string as people read it, "4.0.2 (checksum 3fa9c1e0b2d4)"; one without a checksum as it is */
export function capacitorUpdateBundleName(version: string): string {
  const [number, checksum] = version.split('+');

  return checksum ? `${number} (checksum ${checksum})` : version;
}
