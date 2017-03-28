/* jshint esversion: 6 */
"use strict";

import * as DefaultRenderer from "./default-renderer";

export { renderTier, drawTier };

function renderTier(status, tier) {
    drawTier(tier);
    tier.updateStatus(status);
}

function drawTier(tier) {
    let canvas = tier.viewport.getContext("2d");
    let retina = tier.browser.retina && window.devicePixelRatio > 1;
    if (retina) {
        canvas.scale(2, 2);
    }

    let features = tier.currentFeatures;
    let sequence = tier.currentSequence;
    if (tier.sequenceSource) {
        DefaultRenderer.drawSeqTier(tier, sequence);
    } else if (features) {
        DefaultRenderer.prepareSubtiers(tier, canvas);
    } else {
        console.log("No sequence or features in tier!");
    }

    if (tier.subtiers) {
        DefaultRenderer.prepareViewport(tier, canvas, retina, true);
    }

    tier.drawOverlay();
    tier.paintQuant();

    if (typeof(tier.dasSource.drawCallback) === "function") {
        tier.dasSource.drawCallback(canvas, tier);
    }

    tier.originHaxx = 0;
    tier.browser.arrangeTiers();
}
