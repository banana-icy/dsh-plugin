/**
 * Pet asset contract shared by both halves. The node half serves these files
 * on the wire path below; the browser half builds image URLs from the same
 * constants, so the path and file names live here only.
 */
/** Fixed route prefix owning every pet asset (wire protocol, not user tunable). */
export declare const ASSET_ROUTE_PREFIX = "/ui-traffic-light/assets";
/** Pet image per traffic-light state; blink images show while a failure is stuck. */
export declare const PET_IMAGES: {
    readonly green: "/ui-traffic-light/assets/pet-green.png";
    readonly yellow: "/ui-traffic-light/assets/pet-yellow.png";
    readonly red: "/ui-traffic-light/assets/pet-red.png";
    readonly yellowBlink: "/ui-traffic-light/assets/pet-yellow-blink.png";
    readonly redBlink: "/ui-traffic-light/assets/pet-red-blink.png";
};
//# sourceMappingURL=assets.d.ts.map