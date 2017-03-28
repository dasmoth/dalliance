/* jshint esversion: 6 */
"use strict";

import { drawSeqTier } from "./sequence-draw.js";

import { GridGlyph } from "./glyphs.js";

import * as DefaultRenderer from "./default-renderer";

import * as R from "ramda";

export { renderTier, drawTier };


/* Renders multiple tiers in a single track.
   Works by simply drawing several tiers to a single canvas.
   Actual rendering is done using default-renderer.es6.
   A multi-tier renderer is configured by adding the following to a tier's
   configuration:
   renderer: 'multi',
   multi: {
       multi_id: "multi_1",
   }

   All subtiers with the "multi_1" multi_id will be drawn to this tier's canvas.
 */

function renderTier(status, tier) {
    drawTier(tier);
    tier.updateStatus(status);
}

function drawTier(multiTier) {
    let multiConfig = multiTier.dasSource.multi;
    let getSubConfig = t => t.dasSource.sub;

    // Padding is used for finding the correct canvas size and must be set
    if (!multiTier.padding)
        multiTier.padding = 3;

    let canvas = multiTier.viewport.getContext("2d");
    let retina = multiTier.browser.retina && window.devicePixelRatio > 1;
    if (retina) {
        canvas.scale(2, 2);
    }

    // Filter out only tiers that are to be drawn in this multitier,
    // and also have fetched data.
    let tiers = multiTier.browser.tiers.
            filter(tier => typeof(getSubConfig(tier)) === "object" &&
                   getSubConfig(tier).multi_id === multiConfig.multi_id &&
                   (tier.currentFeatures || tier.currentSequence));

    // The shortest distance from the top of the canvas to a subtier
    let minOffset = R.pipe(
        R.map(tier => tier.dasSource.sub.offset),
        R.reduce((acc, offset) => offset < acc ? offset : acc, 0)
    )(tiers);

    tiers.forEach(tier => {
        if (tier.sequenceSource) {
            drawSeqTier(tier, tier.currentSequence);
        } else {
            // Shift subtiers up by the minimum offset,
            // so that there's no empty space at the top
            DefaultRenderer.prepareSubtiers(tier, canvas,
                                            getSubConfig(tier).offset - minOffset,
                                            false);
        }

        // Must be set for painting to work
        if (!multiTier.glyphCacheOrigin)
            multiTier.glyphCacheOrigin = tier.glyphCacheOrigin;
    });

    // The canvas should fit all subtiers, including offsets, but no more
    let canvasHeight = R.pipe(
        R.map(tier =>
              R.map(subtier => subtier.height + getSubConfig(tier).offset,
                    tier.subtiers)),
        R.flatten,
        R.reduce((acc, h) => h > acc ? h : acc, -Infinity),
        R.add(-minOffset)
    )(tiers);

    prepareViewport(multiTier, canvas, retina, canvasHeight, true);

    tiers.sort((t1, t2) => getSubConfig(t1).z > getSubConfig(t2).z);

    // TODO: make it add the glyph on to the first available tier;
    // crashes if last tier is empty...
    if (multiConfig.grid && tiers && tiers[tiers.length-1] && tiers[tiers.length-1].subtiers[0]) {
        let grid = new GridGlyph(canvasHeight,
                                 multiConfig.grid_offset,
                                 multiConfig.grid_spacing);
        // pretty hacky way of adding the grid, but it works (mostly)
        tiers[tiers.length-1].subtiers[0].glyphs.unshift(grid);
    }

    tiers.forEach(tier => {
        // Need to save and restore canvas to make sure that the subtiers are
        // drawn on top of one another, if not shifted...
        canvas.save();
        DefaultRenderer.paint(tier, canvas, retina, true);
        canvas.restore();
    });

    multiTier.drawOverlay();

    if (multiConfig.quant) {
        let quantCanvas = DefaultRenderer.createQuantOverlay(multiTier, canvasHeight+multiTier.padding*2, retina);
        DefaultRenderer.paintQuant(quantCanvas, multiTier, multiConfig.quant, 10);
    }

    if (typeof(multiTier.dasSource.drawCallback) === "function") {
        multiTier.dasSource.drawCallback(canvas, multiTier);
    }

    multiTier.originHaxx = 0;
    multiTier.browser.arrangeTiers();
}

function prepareViewport(tier, canvas, retina, canvasHeight, clear=true) {
    let desiredWidth = tier.browser.featurePanelWidth + 2000;
    if (retina) {
        desiredWidth *= 2;
    }

    let fpw = tier.viewport.width|0;
    if (fpw < desiredWidth - 50) {
        tier.viewport.width = fpw = desiredWidth;
    }

    canvasHeight += 2*tier.padding;
    canvasHeight = Math.max(canvasHeight, tier.browser.minTierHeight);

    if (canvasHeight != tier.viewport.height) {
        tier.viewport.height = canvasHeight;

        if (retina) {
            tier.viewport.height *= 2;
        }
    }

    tier.viewportHolder.style.left = '-1000px';
    tier.viewport.style.width = retina ? ('' + (fpw/2) + 'px') : ('' + fpw + 'px');
    tier.viewport.style.height = '' + canvasHeight + 'px';
    tier.layoutHeight =  Math.max(canvasHeight, tier.browser.minTierHeight);

    tier.updateHeight();
    tier.norigin = tier.browser.viewStart;

    if (clear) {
        DefaultRenderer.clearViewport(canvas, fpw, canvasHeight);
    }

    DefaultRenderer.drawUnmapped(tier, canvas, canvasHeight);

}
