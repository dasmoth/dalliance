/* jshint esversion: 6 */
"use strict";

export { renderTier, drawTier };

/* To be used by tiers which are to be drawn in a multitier
   using the multi-renderer.

   Subtiers are configured by adding the following to a tier's source configuration:
       renderer: 'sub',
       sub: {
           multi_id: "multi_1",
           offset: 130,
           z: 2,
       }
   This would define a subtier that's to be rendered in the multi-tier with
   id "multi_1", with the top of the subtier at 130 pixels and at z-index 2.
 */

function renderTier(status, tier) {
    drawTier(tier);
    tier.updateStatus(status);
}

// drawTier is called when this tier's data has been fetched,
// so by refreshing the multiTier from here, we can be sure that
// there's something new worth drawing in it
function drawTier(tier) {
    let browser = tier.browser;

    let multiTier = browser.tiers.
            filter(t => t.dasSource.renderer === 'multi' &&
                   t.dasSource.multi.multi_id === tier.dasSource.sub.multi_id);

    multiTier.forEach(t => browser.refreshTier(t));
}
