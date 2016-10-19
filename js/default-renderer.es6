/* jshint esversion: 6 */
"use strict";

import { SubTier } from "./feature-draw.js";

import { drawSeqTier } from "./sequence-draw.js";


import { Range, union } from "./spans.js";

import { shallowCopy, pusho } from "./utils.js";


import * as Glyphs from "./glyphs.js";

import { isDasBooleanTrue,
         isDasBooleanNotFalse,
         DASFeature } from "./das.js";

import { makeGradient } from "./color.js";

import { parseCigar } from "./cigar.js";

import { formatQuantLabel } from "./numformats";

import * as R from "ramda";

// The only functions that must be exported by a renderer are renderTier
// and drawTier, the rest are exported for use in other renderers.
export { renderTier,
         drawTier,
         prepareSubtiers,
         prepareViewport,
         paint,
         drawUnmapped,
         clearViewport,
         createQuantOverlay,
         paintQuant
       };

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

    if (tier.sequenceSource) {
        let sequence = tier.currentSequence;
        drawSeqTier(tier, sequence);
    } else if (tier.currentFeatures) {
        prepareSubtiers(tier, canvas);
    } else {
        console.log("No sequence or features in tier!");
    }

    if (tier.subtiers) {
        let vOffset = R.defaultTo(0, tier.dasSource.vOffset);

        prepareViewport(tier, canvas, retina, true, vOffset);
        paint(tier, canvas, vOffset);
    }

    tier.drawOverlay();
    tier.paintQuant();

    if (typeof(tier.dasSource.drawCallback) === "function") {
        tier.dasSource.drawCallback(canvas, tier);
    }

    tier.originHaxx = 0;
    tier.browser.arrangeTiers();
}

function glyphsForGroup(canvas, features, y, groupElement, tier) {
    let gstyle = tier.styleForFeature(groupElement);
    let label;
    let labelWanted = false;

    let glyphs = [];
    let strand = null;

    features.forEach(f => {
        if (f.orientation && strand === null) {
            strand = f.orientation;
        }

        if (!label && f.label) {
            label = f.label;
        }

        let style = tier.styleForFeature(f);
        if (style && !f.parts) {
            if (isDasBooleanTrue(style.LABEL))
                labelWanted = true;

            let glyph = glyphForFeature(canvas, f, y, style, tier, null, true);
            if (glyph)
                glyphs.push(glyph);
        }
    });

    if (glyphs.length === 0)
        return null;

    let connector = 'flat';
    if (gstyle && gstyle.glyph === 'LINE') {
        // Stick with flat...
    } else {
        if (tier.dasSource.collapseSuperGroups && !tier.bumped) {
            if (strand === '+' || strand === '-') {
                connector = 'collapsed' + strand;
            }
        } else {
            if (strand === '+' || strand === '-') {
                connector = 'hat' + strand;
            }
        }
    }

    let labelText = null;
    if ((label && labelWanted) ||
        (gstyle && (isDasBooleanTrue(gstyle.LABEL) ||
                    isDasBooleanTrue(gstyle.LABELS)))) {  // HACK, LABELS should work.
        labelText = groupElement.label || label;
    }

    let groupGlyph = new Glyphs.GroupGlyph(glyphs, connector);
    if (labelText) {
        if (strand === '+') {
            labelText = '>' + labelText;
        } else if (strand === '-') {
            labelText = '<' + labelText;
        }
        groupGlyph = new Glyphs.LabelledGlyph(canvas, groupGlyph, labelText, false);
    }
    groupGlyph.bump = true;
    return groupGlyph;
}

function glyphForFeature(canvas, feature, y, style, tier, forceHeight, noLabel) {
    let scale = tier.browser.scale;
    let origin = tier.browser.viewStart;
    let glyphType = style.glyph || 'BOX';

    let min = feature.min;
    let max = feature.max;
    let strand = feature.orientation;
    let score = feature.score;
    let label = feature.label || feature.id;

    // Hide glyphs that are smaller than a pixel in width.
    if (tier.dasSource.hideSubpixelGlyphs && (max - min) * scale < 1) return null;

    let minPos = (min - origin) * scale;
    let rawMaxPos = ((max - origin + 1) * scale);
    let maxPos = Math.max(rawMaxPos, minPos + 1);

    forceHeight = forceHeight * 1.0;
    let height = (tier.forceHeight || style.HEIGHT || forceHeight || 12) * 1.0;
    height = height * 1.0;
    let bump = style.BUMP && isDasBooleanTrue(style.BUMP);

    let glyph;
    let quant;

    // Create the glyph
    if (glyphType === 'CROSS' ||
        glyphType === 'EX' ||
        glyphType === 'TRIANGLE' ||
        glyphType === 'DOT' ||
        glyphType === 'SQUARE' ||
        glyphType === 'STAR' ||
        glyphType === 'PLIMSOLL') {
        [glyph, quant] = featureToCrossLikeGlyph(canvas, tier, feature, y,
                                                 glyphType, style, forceHeight, noLabel);

    } else if (glyphType === 'HISTOGRAM' || glyphType === 'GRADIENT' && score !== 'undefined') {
        [glyph, quant] = featureToGradientLikeGlyph(canvas, tier, feature, y, glyphType, style, forceHeight);

    } else if (glyphType === 'HIDDEN') {
        glyph = new Glyphs.PaddedGlyph(null, minPos, maxPos);
        noLabel = true;

    } else if (glyphType === 'ARROW') {
        let color = style.FGCOLOR || 'purple';
        let parallel = isDasBooleanTrue(style.PARALLEL);
        let sw = isDasBooleanTrue(style.SOUTHWEST);
        let ne = isDasBooleanTrue(style.NORTHEAST);
        glyph = new Glyphs.ArrowGlyph(minPos, maxPos, height, color, parallel, sw, ne);

    } else if (glyphType === 'ANCHORED_ARROW') {
        let stroke = style.FGCOLOR || 'none';
        let fill = style.BGCOLOR || 'green';
        glyph = new Glyphs.AArrowGlyph(minPos, maxPos, height, fill, stroke, strand);
        glyph.bump = true;

    } else if (glyphType === 'SPAN') {
        let stroke = style.FGCOLOR || 'black';
        glyph = new Glyphs.SpanGlyph(minPos, maxPos, height, stroke);

    } else if (glyphType === 'LINE') {
        let stroke = style.FGCOLOR || 'black';
        let lineStyle = style.STYLE || 'solid';
        glyph = new Glyphs.LineGlyph(minPos, maxPos, height, lineStyle, strand, stroke);

    } else if (glyphType === 'PRIMERS') {
        let stroke = style.FGCOLOR || 'black';
        let fill = style.BGCOLOR || 'red';
        glyph = new Glyphs.PrimersGlyph(minPos, maxPos, height, fill, stroke);

    } else if (glyphType === 'TEXT') {
        let string = style.STRING || 'text';
        let fill = style.FGCOLOR || 'black';
        glyph = new Glyphs.TextGlyph(canvas, minPos, maxPos, height, fill, string);

    } else if (glyphType === 'TOOMANY') {
        let stroke = style.FGCOLOR || 'gray';
        let fill = style.BGCOLOR || 'orange';
        glyph = new Glyphs.TooManyGlyph(minPos, maxPos, height, fill, stroke);

    } else if (glyphType === 'POINT') {
        [glyph, quant] = featureToPointGlyph(tier, feature, style);

    } else if (glyphType === '__SEQUENCE') {
        glyph = sequenceGlyph(canvas, tier, feature, style, forceHeight);

    } else if (glyphType === '__INSERTION') {
        let ig = new Glyphs.TriangleGlyph(minPos, 5, 'S', 5, tier.browser.baseColors['I']);
        glyph = new Glyphs.LabelledGlyph(canvas, ig, feature.insertion || feature.altAlleles[0], false, 'center', 'above', '7px sans-serif');

        if ((maxPos - minPos) > 1) {
            let stroke = style.FGCOLOR || 'red';
            let fill = style.BGCOLOR || style.COLOR1 || 'green';
            let bg = new Glyphs.BoxGlyph(minPos, 5, (maxPos - minPos), height, fill, stroke);
            glyph = new Glyphs.GroupGlyph([bg, glyph]);
        }

    } else if (glyphType === '__NONE') {
        return null;

    } else if (glyphType === 'BOX') {
        let stroke = style.FGCOLOR || null;
        let fill = style.BGCOLOR || style.COLOR1 || 'green';
        if (style.BGITEM && feature.itemRgb)
            fill = feature.itemRgb;
        let scale = (maxPos - minPos) / (max - min);
        if (feature.type == 'translation' &&
            (feature.method == 'protein_coding' || feature.readframeExplicit) &&
            (!feature.tags || feature.tags.indexOf('cds_start_NF') < 0 || feature.readframeExplicit) &&
            (!tier.dasSource.collapseSuperGroups || tier.bumped) &&
            scale >= 0.5) {
            let refSeq = getRefSeq(tier, min, max);
            glyph = new Glyphs.AminoAcidGlyph(minPos,
                                           maxPos,
                                           height,
                                           fill,
                                           refSeq,
                                           feature.orientation,
                                           feature.readframe);
        } else {
            glyph = new Glyphs.BoxGlyph(minPos, 0, (maxPos - minPos),
                                     height, fill, stroke);
        }
    }

    if ((isDasBooleanTrue(style.LABEL) || feature.forceLabel) &&
        label && !noLabel) {
        glyph = new Glyphs.LabelledGlyph(canvas, glyph, label, false);
    }

    if (bump) {
        glyph.bump = true;
    }

    glyph.feature = feature;

    if (isDasBooleanTrue(style["HIDEAXISLABEL"]))
        quant = null;

    if (quant) {
        glyph.quant = quant;
    }

    if (style.ZINDEX) {
        glyph.zindex = style.ZINDEX | 0;
    }

    return glyph;
}


function groupFeatures(tier, canvas, y) {
    let glyphs = [];
    let gbsFeatures = {};
    let gbsStyles = {};

    R.map(features => {
        features.forEach(feature => {
            let style = tier.styleForFeature(feature);

            if (feature.parts || !style)
                return;

            if (style.glyph === 'LINEPLOT') {
                pusho(gbsFeatures, style.id, feature);
                gbsStyles[style.id] = style;
            } else {
                let glyph = glyphForFeature(canvas, feature, y, style, tier);
                if (glyph)
                    glyphs.push(glyph);
            }
        });
    }, tier.ungroupedFeatures);

    for (let gbs in gbsFeatures) {
        let gf = gbsFeatures[gbs];
        let style = gbsStyles[gbs];
        if (style.glyph === 'LINEPLOT') {
            let lineGraphGlyphs = makeLinePlot(gf, style, tier, y);
            lineGraphGlyphs.forEach(g => glyphs.push(g));
        }
    }

    return glyphs;
}

function glyphifyGroups(tier, canvas, glyphs, y) {
    let groupIds = Object.keys(tier.groupedFeatures);
    let groupGlyphs = {};

    groupIds.sort((g1, g2) =>
                  tier.groupedFeatures[g2][0].score - tier.groupedFeatures[g1][0].score);


    groupIds.forEach(gId => {
        let glyphs = glyphsForGroup(canvas, tier.groupedFeatures[gId], y, tier.groups[gId], tier,
                                    (tier.dasSource.collapseSuperGroups && !tier.bumped) ?
                                    'collapsed_gene' : 'tent');

        if (glyphs) {
            glyphs.group = tier.groups[gId];
            groupGlyphs[gId] = glyphs;
        }
    });

    return groupGlyphs;
}

function bumpSubtiers(tier, glyphs, grid, gridOffset, gridSpacing) {
    let subtierMax =
            tier.subtierMax ||
            tier.dasSource.subtierMax ||
            tier.browser.defaultSubtierMax;

    let subtiersExceeded = false;

    let unbumpedST = new SubTier();
    let bumpedSTs = [];

    // We want to add each glyph to either the subtier
    // containing unbumped subtiers, or to the first bumped subtier.
    glyphs.forEach(glyph => {
        // if the glyph is to be bumped...
        if (glyph.bump &&
            (tier.bumped ||
            tier.dasSource.collapseSuperGroups)) {

            let glyphTier = bumpedSTs.find(st => st.hasSpaceFor(glyph));

            if (glyphTier) {
                glyphTier.add(glyph);
            } else if (bumpedSTs.length >= subtierMax) {
                subtiersExceeded = true;
            } else {
                let subtier = new SubTier();
                subtier.add(glyph);
                bumpedSTs.push(subtier);
            }
        } else {
            unbumpedST.add(glyph);
        }
    });

    if (unbumpedST.glyphs.length > 0) {
        bumpedSTs = [unbumpedST].concat(bumpedSTs);
    }

    // Simple hack to make the horizontal grid in bumped subtiers (e.g. lineplots)
    // optional and configurable.
    if (grid) {
        bumpedSTs.forEach(subtier => {
            if (subtier.quant) {
                subtier.glyphs.unshift(new Glyphs.GridGlyph(subtier.height, gridOffset, gridSpacing));
            }
        });
    }

    bumpedSTs.forEach(subtier => {
        subtier.glyphs.sort((g1, g2) => (g1.zindex || 0) - (g2.zindex || 0));
    });

    return [bumpedSTs, subtiersExceeded];
}

// The whole tier is translated downward on its canvas by y pixels
function prepareSubtiers(tier, canvas, y=0, grid=true) {

    let MIN_PADDING = 3;
    tier.padding = typeof(tier.dasSource.padding) === 'number' ?
        tier.dasSource.padding : MIN_PADDING;

    tier.scaleVertical = typeof(tier.dasSource.scaleVertical) === 'boolean' ?
        tier.dasSource.scaleVertical : false;

    let glyphs = groupFeatures(tier, canvas, y);

    // Merge supergroups
    if (tier.dasSource.collapseSuperGroups && !tier.bumped) {
        for (let sgId in tier.superGroups) {
            let sgGroup = tier.superGroups[sgId];
            tier.groups[sgId] = shallowCopy(tier.groups[sgId]);
            let group = tier.groups[sgId];
            group.isSuperGroup = true;
            let featuresByType = {};

            let sgMin = 10000000000, sgMax = -10000000000;
            let sgSeg = null;

            sgGroup.forEach((g, i) => {
                let groupedFeature = tier.groupedFeatures[sgGroup[i]];
                if (!groupedFeature)
                    return;

                groupedFeature.forEach(feature => {
                    pusho(featuresByType, feature.type, feature);
                    sgMin = Math.min(feature.min, sgMin);
                    sgMax = Math.max(feature.max, sgMax);
                    if (feature.segment && !sgSeg)
                        sgSeg = feature.segment;
                });

                if (group && !group.links || group.links.length === 0) {
                    group.links = tier.groups[sgGroup[0]].links;
                }

                delete tier.groupedFeatures[sgGroup[i]];

            });

            tier.groups[sgId].max = sgMax;
            tier.groups[sgId].min = sgMin;
            tier.groups[sgId].segment = sgSeg;

            R.map(features => {

                let template = features[0];
                let loc = null;

                features.forEach(feature => {
                    let fl = new Range(feature.min, feature.max);
                    loc = loc ? union(loc, fl) : fl;
                });

                let mergedRanges = loc.ranges();

                mergedRanges.forEach(range => {
                    let posCoverage = ((range.max() | 0) - (range.min() | 0) + 1) * sgGroup.length;
                    let actCoverage = 0;

                    features.forEach(feature => {
                        let fmin = feature.min || 0;
                        let fmax = feature.max || 0;
                        if (fmin <= range.max() && fmax >= range.min()) {

                            actCoverage += (Math.min(fmax, range.max()) -
                                            Math.max(fmin, range.min()) + 1);
                        }
                    });

                    let newFeature = new DASFeature();
                    for (let key in template) {
                        newFeature[key] = template[key];
                    }

                    newFeature.min = range.min();
                    newFeature.max = range.max();
                    if (newFeature.label && sgGroup.length > 1) {
                        newFeature.label += ' (' + sgGroup.length + ' vars)';
                    }

                    newFeature.visualWeight = ((1.0 * actCoverage) / posCoverage);

                    pusho(tier.groupedFeatures, sgId, newFeature);
                });
            }, featuresByType);

            delete tier.superGroups[sgId]; // Do we want this?
        }
    }

    // Glyphify groups.
    let groupGlyphs = glyphifyGroups(tier, canvas, glyphs, y);

    R.map(superGroup => {
        let sgGlyphs = [];
        let sgMin = 10000000000;
        let sgMax = -10000000000;

        superGroup.forEach(glyphs => {
            let gGlyphs = groupGlyphs[glyphs];
            if (gGlyphs) {
                sgGlyphs.push(gGlyphs);
                sgMin = Math.min(sgMin, gGlyphs.min());
                sgMax = Math.max(sgMax, gGlyphs.max());
            }
        });

        sgGlyphs.forEach(glyph => {
            glyphs.push(new Glyphs.PaddedGlyph(glyph, sgMin, sgMax));
        });
    }, tier.superGroups);

    R.map(glyph => glyphs.push(glyph), groupGlyphs);

    let [subtiers, subtiersExceeded] = bumpSubtiers(tier, glyphs, grid, y);

    tier.glyphCacheOrigin = tier.browser.viewStart;

    if (subtiersExceeded)
        tier.updateStatus('Bumping limit exceeded, use the track editor to see more features');
    else
        tier.updateStatus();

    tier.subtiers = subtiers;
}

// Fills out areas that haven't been fetched as gray blocks
function drawUnmapped(tier, canvas, padding) {
    let drawStart =  tier.browser.viewStart - 1000.0/tier.browser.scale;
    let drawEnd = tier.browser.viewEnd + 1000.0/tier.browser.scale;
    let unmappedBlocks = [];
    if (tier.knownCoverage) {
        let knownRanges = tier.knownCoverage.ranges();
        knownRanges.forEach((range, index) => {
            if (index === 0) {
                if (range.min() > drawStart)
                    unmappedBlocks.push({min: drawStart, max: range.min() - 1});
            } else {
                unmappedBlocks.push({min: knownRanges[index-1].max() + 1, max: range.min() - 1});
            }

            if (index == knownRanges.length - 1 && range.max() < drawEnd) {
                unmappedBlocks.push({min: range.max() + 1, max: drawEnd});
            }
        });
    }
    if (unmappedBlocks.length > 0) {
        canvas.fillStyle = 'gray';
        unmappedBlocks.forEach(block => {
            let min = (block.min - tier.browser.viewStart) * tier.browser.scale + 1000;
            let max = (block.max - tier.browser.viewStart) * tier.browser.scale + 1000;
            canvas.fillRect(min, 0, max - min, padding);
        });
    }
}

function clearViewport(canvas, width, height, retina = false) {
    canvas.clearRect(0, 0, width, height);
    canvas.save();
    if (retina) {
        canvas.scale(2, 2);
    }
}

// Make the viewport & canvas the correct size for the tier
function prepareViewport(tier, canvas, retina, clear=true, vOffset=0) {
    let desiredWidth = tier.browser.featurePanelWidth + 2000;
    if (retina) {
        desiredWidth *= 2;
    }

    let fpw = tier.viewport.width|0;
    if (fpw < desiredWidth - 50) {
        tier.viewport.width = fpw = desiredWidth;
    }

    let lh = tier.padding + vOffset;

    tier.subtiers.forEach(s => lh += s.height + tier.padding);

    lh += 6;
    lh = Math.max(lh, tier.browser.minTierHeight);

    let canvasHeight = lh;
    if (retina) {
        canvasHeight *= 2;
    }

    if (canvasHeight != tier.viewport.height) {
        tier.viewport.height = canvasHeight;
    }

    tier.viewportHolder.style.left = '-1000px';
    tier.viewport.style.width = retina ? ('' + (fpw/2) + 'px') : ('' + fpw + 'px');
    tier.viewport.style.height = '' + lh + 'px';
    tier.layoutHeight =  Math.max(lh, tier.browser.minTierHeight);

    tier.updateHeight();
    tier.norigin = tier.browser.viewStart;

    if (clear) {
        clearViewport(canvas, fpw, canvasHeight);
    }

    drawUnmapped(tier, canvas, lh);

}

function paint(tier, canvas, vOffset=0) {
    let overlayLabelCanvas = new Glyphs.OverlayLabelCanvas();
    let offset = ((tier.glyphCacheOrigin - tier.browser.viewStart)*tier.browser.scale)+1000;
    canvas.translate(offset, vOffset + tier.padding);
    overlayLabelCanvas.translate(0, tier.padding);

    tier.paintToContext(canvas, overlayLabelCanvas, offset);

    if (overlayLabelCanvas.glyphs.length > 0)
        tier.overlayLabelCanvas = overlayLabelCanvas;
    else
        tier.overlayLabelCanvas = null;

    canvas.restore();
}

function getScoreMinMax(tier, style) {
    let smin = tier.quantMin(style);
    let smax = tier.quantMax(style);

    if (!smax) {
        if (smin < 0) {
            smax = 0;
        } else {
            smax = 10;
        }
    }
    if (!smin) {
        smin = 0;
    }
    return [smin, smax];
}

function relScoreOrigin(score, smin, smax) {
    let relScore = ((1.0 * score) - smin) / (smax-smin);
    let relOrigin = (-1.0 * smin) / (smax - smin);

    return [relScore, relOrigin];
}

function getRefSeq(tier, min, max) {
    let refSeq = null;
    if (tier.currentSequence) {
        let csStart = tier.currentSequence.start|0;
        let csEnd = tier.currentSequence.end|0;
        if (csStart <= max && csEnd >= min) {
            let sfMin = Math.max(min, csStart);
            let sfMax = Math.min(max, csEnd);

            refSeq = tier.currentSequence.seq.substr(sfMin - csStart, sfMax - sfMin + 1);
            while (min < sfMin) {
                refSeq = 'N' + refSeq;
                sfMin--;
            }
            while (max > sfMax) {
                refSeq = refSeq + 'N';
                sfMax++;
            }
        }
    }
    return refSeq;
}

function featureToCrossLikeGlyph(canvas, tier, feature, y, glyphType, style, forceHeight, noLabel) {
    let scale = tier.browser.scale;
    let origin = tier.browser.viewStart;

    let score = feature.score;
    let label = feature.label || feature.id;

    let minPos = (feature.min - origin) * scale;
    let maxPos = Math.max((feature.max - origin + 1) * scale, minPos + 1);

    let height = (tier.forceHeight || style.HEIGHT || forceHeight || 12) * 1.0;
    let requiredHeight = height;

    let glyph = null;
    let quant = null;

    let stroke = style.FGCOLOR || 'black';
    let fill = style.BGCOLOR || 'none';
    let outline = style.STROKECOLOR;

    if (style.BGITEM && feature.itemRgb) {
        stroke = feature.itemRgb;

    } else if (isDasBooleanTrue(style.COLOR_BY_SCORE2)) {
        let grad = style.BGGRAD || style._gradient;
        if (!grad) {
            grad = makeGradient(50, style.COLOR1, style.COLOR2, style.COLOR3);
            style._gradient = grad;
        }

        let score2 = feature.score2;
        if (score2 !== undefined || !stroke) {
            score2 = score2 || 0;

            let smin2 = style.MIN2 ? (1.0 * style.MIN2) : 0.0;
            let smax2 = style.MAX2 ? (1.0 * style.MAX2) : 1.0;
            let relScore2 = ((1.0 * score2) - smin2) / (smax2-smin2);

            let step = (relScore2*grad.length) | 0;
            R.clamp(0, step, grad.length - 1);
            stroke = grad[step];
        }
    }

    let size = style.SIZE || height;
    if (style.RSIZE) {
        size = (1.0 * style.RSIZE) * height;
    }

    if (style.STROKETHRESHOLD) {
        if (size < (1.0 * style.STROKETHRESHOLD))
            outline = null;
    }

    let mid = (minPos + maxPos)/2;

    if (glyphType === 'EX') {
        glyph = new Glyphs.ExGlyph(mid, size, stroke);

    } else if (glyphType === 'TRIANGLE') {
        let dir = style.DIRECTION || 'N';
        let width = style.LINEWIDTH || size;
        glyph = new Glyphs.TriangleGlyph(mid, size, dir, width, stroke, outline);

    } else if (glyphType === 'DOT') {
        glyph = new Glyphs.DotGlyph(mid, size, stroke, outline);

    } else if (glyphType === 'PLIMSOLL') {
        glyph = new Glyphs.PlimsollGlyph(mid, size, 0.2 * size, stroke, outline);

    } else if (glyphType === 'SQUARE') {
        glyph = new Glyphs.BoxGlyph(mid - size/2, 0, size, size, stroke, outline);

    } else if (glyphType === 'STAR') {
        let points = style.POINTS || 5;
        glyph = new Glyphs.StarGlyph(mid, size/2, points, stroke, outline);

    } else {
        glyph = new Glyphs.CrossGlyph(mid, size, stroke);

    }

    if (fill && fill !== 'none' && (maxPos - minPos) > 5) {
        let boxGlyph = new Glyphs.BoxGlyph(minPos, 0, (maxPos - minPos), size, fill);
        glyph = new Glyphs.GroupGlyph([boxGlyph, glyph]);
    }

    if (isDasBooleanTrue(style.SCATTER)) {
        let [smin, smax] = getScoreMinMax(tier, style);

        let [relScore, relOrigin] = relScoreOrigin(score, smin, smax);

        if (relScore < 0.0 || relScore > 1.0) {
            // Glyph is out of bounds.
            // Should we allow for "partially showing" glyphs?

            return null;
        } else {
            let originShift = x => (x - relOrigin) * requiredHeight;
            height = Math.max(1, originShift(relScore));
            y = y + originShift(1);

            if (relScore >= relOrigin)
                y = y - height;

            quant = {min: smin, max: smax};

            let heightFudge = 0;
            let featureLabel = R.defaultTo(style.LABEL, feature.forceLabel);

            if (isDasBooleanNotFalse(featureLabel) && label && !noLabel) {
                glyph = new Glyphs.LabelledGlyph(canvas, glyph, label, true, null,
                                                 featureLabel == 'above' ? 'above' : 'below');
                if (featureLabel === 'above') {
                    heightFudge = glyph.textHeight + 2;
                }
                noLabel = true;
            }
            glyph = new Glyphs.TranslatedGlyph(glyph, 0, y - (size / 2) - heightFudge, requiredHeight);
        }
    }

    return [glyph, quant];
}

function featureToGradientLikeGlyph(canvas, tier, feature, y, glyphType, style, forceHeight) {
    let scale = tier.browser.scale;
    let origin = tier.browser.viewStart;

    let score = feature.score;

    let minPos = (feature.min - origin) * scale;
    let maxPos = Math.max((feature.max - origin + 1) * scale, minPos + 1);

    let height = (tier.forceHeight || style.HEIGHT || forceHeight || 12) * 1.0;
    let requiredHeight = height * 1.0;

    let glyph = null;
    let quant = null;

    let centerOnAxis = isDasBooleanTrue(style["AXISCENTER"]);


    let [smin, smax] = getScoreMinMax(tier, style);

    // AUTOMIN & AUTOMAX respectively set the lower and upper bounds
    if (isDasBooleanTrue(style.AUTOMIN)) {
        smin = tier.currentFeaturesMinScore*0.95;
        console.log("smin:\t" + smin);
    }
    if (isDasBooleanTrue(style.AUTOMAX)) {
        smax = tier.currentFeaturesMaxScore*1.05;
        console.log("smax:\t" + smax);
    }

    if ((1.0 * score) < (1.0 * smin)) {
        score = smin;
    }
    if ((1.0 * score) > (1.0 * smax)) {
        score = smax;
    }

    // Shift smin/smax in case we want to center the histogram
    // on the horizontal axis
    if (centerOnAxis) {
        let tmin = tier.quantMin(style);
        let tmax = tier.quantMax(style);

        if (isDasBooleanTrue(style.AUTOMIN)) {
            tmin = tier.currentFeaturesMinScore*0.95;
        }
        if (isDasBooleanTrue(style.AUTOMAX)) {
            tmax = tier.currentFeaturesMaxScore*1.05;
        }

        smin = tmin - ((tmax - tmin) / 2);
        smax = tmax - ((tmax - tmin) / 2);
    }

    let [relScore, relOrigin] = relScoreOrigin(score, smin, smax);

    if (glyphType === 'HISTOGRAM') {
        let originShift = x => x - Math.max(0, relOrigin);
        height = Math.abs(originShift(relScore)) * requiredHeight;
        y = y + originShift(1.0) * requiredHeight;

        if (relScore >= relOrigin)
            y -= height;

        if (centerOnAxis)
            y += height / 2;

        if (isDasBooleanTrue(style["HIDEAXISLABEL"]))
            quant = null;
        else
            quant = {min: smin, max: smax};
    }

    let stroke = style.FGCOLOR || null;
    let fill = style.BGCOLOR || style.COLOR1 || 'green';
    if (style.BGITEM && feature.itemRgb)
        fill = feature.itemRgb;
    let alpha = style.ALPHA ? (1.0 * style.ALPHA) : null;

    if (style.BGGRAD) {
        let grad = style.BGGRAD;
        let step = (relScore*grad.length)|0;
        step = R.clamp(0, step, grad.length - 1);
        fill = grad[step];
    }

    if (style.COLOR2) {
        let grad = style._gradient;
        if (!grad) {
            grad = makeGradient(50, style.COLOR1, style.COLOR2, style.COLOR3);
            style._gradient = grad;
        }

        let step = (relScore*grad.length) | 0;
        step = R.clamp(0, step, grad.length - 1);
        fill = grad[step];
    }

    let tempGlyph = new Glyphs.BoxGlyph(minPos, y, (maxPos - minPos), height, fill, stroke, alpha);
    glyph = new Glyphs.TranslatedGlyph(tempGlyph, 0, 0, requiredHeight);

    return [glyph, quant];
}

function featureToPointGlyph(tier, feature, style) {
    let scale = tier.browser.scale;
    let origin = tier.browser.viewStart;

    let score = feature.score;

    let minPos = (feature.min - origin) * scale;
    let maxPos = Math.max((feature.max - origin + 1) * scale, minPos + 1);

    let height = tier.forceHeight || style.HEIGHT || 30;

    let glyph = null;
    let quant = null;

    let [smin, smax] = getScoreMinMax(tier, style);
    let yscale = ((1.0 * height) / (smax - smin));
    let relScore = ((1.0 * score) - smin) / (smax-smin);
    let sc = ((score - (1.0*smin)) * yscale)|0;
    quant = {min: smin, max: smax};

    let fill = style.FGCOLOR || style.COLOR1 || 'black';
    if (style.COLOR2) {
        let grad = style._gradient;
        if (!grad) {
            grad = makeGradient(50, style.COLOR1, style.COLOR2, style.COLOR3);
            style._gradient = grad;
        }

        let step = (relScore*grad.length)|0;
        step = R.clamp(0, step, grad.length - 1);
        fill = grad[step];
    }

    glyph = new Glyphs.PointGlyph((minPos + maxPos)/2, height-sc, height, fill);

    return [glyph, quant];
}

function sequenceGlyph(canvas, tier, feature, style, forceHeight) {
    let scale = tier.browser.scale;
    let origin = tier.browser.viewStart;

    let min = feature.min;
    let max = feature.max;
    let minPos = (feature.min - origin) * scale;
    let maxPos = Math.max((feature.max - origin + 1) * scale, minPos + 1);

    let height = (tier.forceHeight || style.HEIGHT || forceHeight || 12) * 1.0;

    let glyph = null;

    let rawseq = feature.seq;
    let seq = rawseq;
    let rawquals = feature.quals;
    let quals = rawquals;
    let insertionLabels = isDasBooleanTrue(style.__INSERTIONS);

    let indels = [];
    if (feature.cigar) {
        let ops = parseCigar(feature.cigar);
        seq = '';
        quals = '';
        let cursor = 0;

        ops.forEach(co => {
            if (co.op === 'M') {
                seq += rawseq.substr(cursor, co.cnt);
                quals += rawquals.substr(cursor, co.cnt);
                cursor += co.cnt;
            } else if (co.op === 'D') {
                seq += "-".repeat(co.cnt);
                quals += "Z".repeat(co.cnt);
            } else if (co.op === 'I') {

                let inseq = rawseq.substr(cursor, co.cnt);
                let ig = new Glyphs.TranslatedGlyph(
                    new Glyphs.TriangleGlyph(minPos + (seq.length*scale), 6, 'S', 5, tier.browser.baseColors['I']),
                    0, -2, 0
                );
                if (insertionLabels)
                    ig = new Glyphs.LabelledGlyph(canvas, ig, inseq, false, 'center', 'above', '7px sans-serif');
                ig.feature = {label: 'Insertion: ' + inseq, type: 'insertion', method: 'insertion'};
                indels.push(ig);

                cursor += co.cnt;
            } else if (co.op === 'S') {
                cursor += co.cnt;
            } else {
                console.log('unknown cigop' + co.op);
            }
        });
    }

    let refSeq = getRefSeq(tier, min, max);
    if (seq && refSeq &&
        (style.__SEQCOLOR === 'mismatch' ||
         style.__SEQCOLOR === 'mismatch-all')) {
        let mismatchSeq = [];
        let match = feature.orientation === '-' ? ',' : '.';
        seq.forEach((_, i) => mismatchSeq.push(seq[i] == refSeq[i] ? match : seq[i]));
        seq = mismatchSeq.join('');
    }

    let strandColor = feature.orientation === '-' ?
              style._minusColor || 'lightskyblue'
            : style._plusColor || 'lightsalmon';

    if (style.__disableQuals)
        quals = false;

    glyph = new Glyphs.SequenceGlyph(
        tier.browser.baseColors,
        strandColor,
        minPos,
        maxPos,
        height,
        seq,
        refSeq,
        style.__SEQCOLOR,
        quals,
        !isDasBooleanTrue(style.__CLEARBG),
        tier.scaleVertical
    );

    if (insertionLabels)
        glyph = new Glyphs.TranslatedGlyph(glyph, 0, 7);

    if (indels.length > 0) {
        indels.splice(0, 0, glyph);
        glyph = new Glyphs.GroupGlyph(indels);
    }

    return glyph;
}

function makeLinePlot(features, style, tier, yshift) {
    yshift = yshift || 0;

    let origin = tier.browser.viewStart, scale = tier.browser.scale;
    let height = tier.forceHeight || style.HEIGHT || 30;
    let min = tier.quantMin(style);
    let max = tier.quantMax(style);

    // AUTOMIN & AUTOMAX respectively set the lower and upper bounds
    if (isDasBooleanTrue(style.AUTOMIN)) {
        // add some basically arbitrary padding
        min = tier.currentFeaturesMinScore*0.95;
    }
    if (isDasBooleanTrue(style.AUTOMAX)) {
        max = tier.currentFeaturesMaxScore*1.05;
    }

    let yscale = ((1.0 * height) / (max - min));
    let color = style.FGCOLOR || style.COLOR1 || 'black';

    let prevSign = 1;
    let curSign = null;

    let curGlyphPoints = [];
    let glyphSequences = [];

    let prevPoint = null;

    features.forEach(f => {
        let px = ((((f.min|0) + (f.max|0)) / 2) - origin) * scale;
        let sc = ((f.score - (1.0*min)) * yscale)|0;

        // Additive tracks are always above the x-axis, and are colored
        // depending on whether the score is positive or negative.
        if (isDasBooleanTrue(style.ADDITIVE)) {
            curSign = f.score < 0 ? -1 : 1;

            if (curSign !== prevSign) {
                glyphSequences.push({
                    points: curGlyphPoints,
                    color: prevSign === 1 ?
                        style.POSCOLOR
                        : style.NEGCOLOR
                });
                curGlyphPoints = [];
                // Need to add the previous point to this sequence,
                // otherwise there is a gap in the resulting plot
                curGlyphPoints.push(prevPoint);
            }
            prevSign = curSign;
        } else {
            curSign = 1;
        }

        let py = (height - (sc * curSign)) + yshift;
        prevPoint = {x: px, y: py};
        curGlyphPoints.push(prevPoint);
    });


    // Need to add the final sequence of points as well.
    if (isDasBooleanTrue(style.ADDITIVE)) {
        color = curSign === 1 ? style.POSCOLOR : style.NEGCOLOR;
    }
    glyphSequences.push({
        points: curGlyphPoints,
        color: color
    });


    let lggs = glyphSequences.map(gs => {
        let lgg = new Glyphs.LineGraphGlyph(gs.points, gs.color, height);
        lgg.quant = {min, max};

        if (style.ZINDEX)
            lgg.zindex = style.ZINDEX|0;

        return lgg;
    });

    return lggs;
}

// height is subtier height
function createQuantOverlay(tier, height, retina=false) {
    let width = 50;

    tier.quantOverlay.height = height;
    tier.quantOverlay.width = retina ? width*2 : width;
    tier.quantOverlay.style.height = '' + (retina ? height/2 : height) + 'px';
    tier.quantOverlay.style.width = '' + width + 'px';
    tier.quantOverlay.style.display = 'block';

    let canvas = tier.quantOverlay.getContext('2d');

    if (retina) {
        canvas.scale(2, 2);
    }

    return canvas;
}

function paintQuant(canvas, tier, quant, tics) {
    canvas.save();

    let h = tier.quantOverlay.height;
    let w = 100;

    let ticSpacing = (h + tier.padding*2) / tics;
    let ticInterval = (quant.max - quant.min) / tics;

    canvas.fillStyle = 'white';
    canvas.globalAlpha = 0.6;
    if (tier.browser.rulerLocation == 'right') {
        canvas.fillRect(w-30, 0, 30, h + tier.padding*2);
    } else {
        canvas.fillRect(0, 0, 30, h + tier.padding*2);
    }
    canvas.globalAlpha = 1.0;

    canvas.strokeStyle = 'black';
    canvas.lineWidth = 1;
    canvas.beginPath();
    if (tier.browser.rulerLocation == 'right') {
        canvas.moveTo(w - 8, tier.padding);
        canvas.lineTo(w, tier.padding);
        canvas.lineTo(w, h + tier.padding);
        canvas.lineTo(w - 8, h + tier.padding);

        for (let t = 1; t < tics-1; t++) {
            let ty = t*ticSpacing;
            canvas.moveTo(w, ty);
            canvas.lineTo(w - 5, ty);
        }
    } else {
        canvas.moveTo(8, tier.padding);
        canvas.lineTo(0, tier.padding);
        canvas.lineTo(0, h + tier.padding);
        canvas.lineTo(8, h + tier.padding);

        for (let t = 1; t < tics-1; t++) {
            let ty = t*ticSpacing;
            canvas.moveTo(0, ty);
            canvas.lineTo(5, ty);
        }
    }
    canvas.stroke();

    canvas.fillStyle = 'black';

    if (tier.browser.rulerLocation == 'right') {
        canvas.textAlign = 'right';
        canvas.fillText(formatQuantLabel(quant.max), w-9, 8);
        canvas.fillText(formatQuantLabel(quant.min), w-9, h + tier.padding);

        for (let t = 1; t < tics-1; t++) {
            let ty = t*ticSpacing;
            canvas.fillText(formatQuantLabel((1.0*quant.max) - (t*ticInterval)), w - 9, ty + 3);
        }
    } else {
        canvas.textAlign = 'left';
        canvas.fillText(formatQuantLabel(quant.max), 9, 8);
        canvas.fillText(formatQuantLabel(quant.min), 9, h + tier.padding);

        for (let t = 1; t < tics-1; t++) {
            let ty = t*ticSpacing;
            canvas.fillText(formatQuantLabel((1.0*quant.max) - (t*ticInterval)), 9, ty + 3);
        }
    }

    canvas.restore();
}
