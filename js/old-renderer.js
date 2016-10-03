"use strict";

if (typeof(require) !== "undefined") {
    var fd = require("./feature-draw.js");
    var drawFeatureTier = fd.drawFeatureTier;
    var sd = require("./sequence-draw.js");
    var drawSeqTier = sd.drawSeqTier;
}

function renderTier(status, tier) {
    drawTier(tier);
    tier.updateStatus(status);
}

function drawTier(tier) {
    var features = tier.currentFeatures;
    var sequence = tier.currentSequence;
    if (tier.sequenceSource) {
        drawSeqTier(tier, sequence);
    } else {
        drawFeatureTier(tier);
    }

    tier.paint();

    tier.originHaxx = 0;
    tier.browser.arrangeTiers();
}

if (typeof(module) !== "undefined") {
    module.exports = {
        renderTier: renderTier,
        drawTier: drawTier
    };
}
