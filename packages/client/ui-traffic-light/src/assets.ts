/**
 * Pet asset contract shared by both halves. The node half serves these files
 * on the wire path below; the browser half builds image URLs from the same
 * constants, so the path and file names live here only.
 */

/** Fixed route prefix owning every pet asset (wire protocol, not user tunable). */
export const ASSET_ROUTE_PREFIX = '/ui-traffic-light/assets'

/** Pet image per traffic-light state; blink images show while a failure is stuck. */
export const PET_IMAGES = {
  green: `${ASSET_ROUTE_PREFIX}/pet-green.png`,
  yellow: `${ASSET_ROUTE_PREFIX}/pet-yellow.png`,
  red: `${ASSET_ROUTE_PREFIX}/pet-red.png`,
  yellowBlink: `${ASSET_ROUTE_PREFIX}/pet-yellow-blink.png`,
  redBlink: `${ASSET_ROUTE_PREFIX}/pet-red-blink.png`,
} as const
