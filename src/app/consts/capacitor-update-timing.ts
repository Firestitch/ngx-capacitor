/** How long the launch's splash waits for a new version to download behind it */
export const CAPACITOR_UPDATE_LAUNCH_WAIT = 3000;

/** Back after this long away, a version already downloaded goes in behind the splash, as at a launch */
export const CAPACITOR_UPDATE_AWAY_SWAP = 10 * 60 * 1000;

/** While the app stays in front, it checks again this long after the last check ended */
export const CAPACITOR_UPDATE_CHECK_EVERY = 15 * 60 * 1000;
