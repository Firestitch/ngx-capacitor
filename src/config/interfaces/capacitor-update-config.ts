import { CapacitorUpdateColors } from './capacitor-update-colors';


export interface CapacitorUpdateConfig {
  /**
   * Where the app's manifest is published, without {bundleId}/manifest.json.
   * Empty leaves over-the-air updates off.
   */
  manifestUrl?: string;
  /** The app's own key: Environment Manager or Deployment Manager → the app → Settings → Public key */
  publicKey?: string;
  /** The update screen's colors, to match the app's brand */
  colors?: CapacitorUpdateColors;
  /**
   * The app's icon on the update screen: a path in the web bundle such as
   * 'assets/icon.png', or a URL. No plugin reads the native icon. Empty shows a glyph.
   */
  icon?: string;
}
