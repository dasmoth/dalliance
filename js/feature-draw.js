// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-draw.js: new feature-tier renderer
//

"use strict";

if (typeof(require) !== 'undefined') {
    var utils = require('./utils');
    var shallowCopy = utils.shallowCopy;
    var pusho = utils.pusho;

    var tier = require('./tier');
    var DasTier = tier.DasTier;

    var g = require('./glyphs');
    var BoxGlyph = g.BoxGlyph;
    var GroupGlyph = g.GroupGlyph;
    var LineGraphGlyph = g.LineGraphGlyph;
    var LabelledGlyph = g.LabelledGlyph;
    var CrossGlyph = g.CrossGlyph;
    var ExGlyph = g.ExGlyph;
    var TriangleGlyph = g.TriangleGlyph;
    var DotGlyph = g.DotGlyph;
    var PaddedGlyph = g.PaddedGlyph;
    var AArrowGlyph = g.AArrowGlyph;
    var SpanGlyph = g.SpanGlyph;
    var LineGlyph = g.LineGlyph;
    var PrimersGlyph = g.PrimersGlyph;
    var ArrowGlyph = g.ArrowGlyph;
    var TooManyGlyph = g.TooManyGlyph;
    var TextGlyph = g.TextGlyph;
    var SequenceGlyph = g.SequenceGlyph;
    var AminoAcidGlyph = g.AminoAcidGlyph;
    var TranslatedGlyph = g.TranslatedGlyph;
    var PointGlyph = g.PointGlyph;
    var GridGlyph = g.GridGlyph;
    var StarGlyph = g.StarGlyph;
    var PlimsollGlyph = g.PlimsollGlyph;
    var OverlayLabelCanvas = g.OverlayLabelCanvas;

    var color = require('./color');
    var makeGradient = color.makeGradient;

    var spans = require('./spans');
    var Range = spans.Range;
    var union = spans.union;

    var das = require('./das');
    var DASFeature = das.DASFeature;
    var isDasBooleanTrue = das.isDasBooleanTrue;
    var isDasBooleanNotFalse = das.isDasBooleanNotFalse;

    var parseCigar = require('./cigar').parseCigar;

    var nf = require('./numformats');
    var formatQuantLabel = nf.formatQuantLabel;
}

var MIN_PADDING = 3;

function SubTier() {
    this.glyphs = [];
    this.height = 0;
    this.quant = null;
}

SubTier.prototype.indexFor = function(glyph) {
    var gmin = glyph.min();
    var lb = 0, ub = this.glyphs.length;
    while (ub > lb) {
        var mid = ((lb + ub)/2)|0;
        if (mid >= this.glyphs.length)
            return this.glyphs.length;
        var mg = this.glyphs[mid];
        if (gmin < mg.min()) {
            ub = mid;
        } else {
            lb = mid + 1;
        }
    }
    return ub;
}

SubTier.prototype.add = function(glyph) {
    var ind = this.indexFor(glyph);
    this.glyphs.splice(ind, 0, glyph);
    this.height = Math.max(this.height, glyph.height());
    if (glyph.quant && this.quant == null) {
        this.quant = glyph.quant;
    }
}

SubTier.prototype.hasSpaceFor = function(glyph) {
    var ind = this.indexFor(glyph);
    if (ind > 0 && this.glyphs[ind-1].max() >= glyph.min())
        return false;
    if (ind < this.glyphs.length && this.glyphs[ind].min() <= glyph.max())
        return false;

    return true;
}

var GLOBAL_GC;

function drawFeatureTier(tier)
{
    var start = Date.now()|0;
    GLOBAL_GC = tier.viewport.getContext('2d'); // Should only be used for metrics.
    if (typeof(tier.dasSource.padding) === 'number')
        tier.padding = tier.dasSource.padding;
    else
        tier.padding = MIN_PADDING;
    
    if (typeof(tier.dasSource.scaleVertical) === 'boolean')
        tier.scaleVertical = tier.dasSource.scaleVertical;
    else
        tier.scaleVertical = false;

    var glyphs = [];
    var specials = false;

    // group by style
    var gbsFeatures = {};
    var gbsStyles = {};

    for (var uft in tier.ungroupedFeatures) {
        var ufl = tier.ungroupedFeatures[uft];
        
        for (var pgid = 0; pgid < ufl.length; ++pgid) {
            var f = ufl[pgid];
            if (f.parts) {  // FIXME shouldn't really be needed
                continue;
            }

            var style = tier.styleForFeature(f);
            if (!style)
                continue;

            if (style.glyph == 'LINEPLOT') {
                pusho(gbsFeatures, style.id, f);
                gbsStyles[style.id] = style;
            } else {
                var g = glyphForFeature(f, 0, style, tier);
                if (g)
                    glyphs.push(g);
            }
        }
    }

    for (var gbs in gbsFeatures) {
        var gf = gbsFeatures[gbs];
        var style = gbsStyles[gbs];
        if (style.glyph == 'LINEPLOT') {
            glyphs.push(makeLineGlyph(gf, style, tier));
            specials = true;
        }
    }

    // Merge supergroups    

    if (tier.dasSource.collapseSuperGroups && !tier.bumped) {
        for (var sg in tier.superGroups) {
            var sgg = tier.superGroups[sg];
            tier.groups[sg] = shallowCopy(tier.groups[sg]);
            tier.groups[sg].isSuperGroup = true;
            var featsByType = {};

            var sgMin = 10000000000, sgMax = -10000000000;
            var sgSeg = null;
            for (var g = 0; g < sgg.length; ++g) {
                var gf = tier.groupedFeatures[sgg[g]];
                if (!gf)
                    continue;

                for (var fi = 0; fi < gf.length; ++fi) {
                    var f = gf[fi];
                    pusho(featsByType, f.type, f);
                    sgMin = Math.min(f.min, sgMin);
                    sgMax = Math.max(f.max, sgMax);
                    if (f.segment && !sgSeg)
                        sgSeg = f.segment;
                }

                if (tier.groups[sg] && !tier.groups[sg].links || tier.groups[sg].links.length == 0) {
                   tier.groups[sg].links = tier.groups[sgg[0]].links;
                }

                delete tier.groupedFeatures[sgg[g]];  // 'cos we don't want to render the unmerged version.
            }

            tier.groups[sg].max = sgMax;
            tier.groups[sg].min = sgMin;
            tier.groups[sg].segment = sgSeg;

            for (var t in featsByType) {
                var feats = featsByType[t];
                var template = feats[0];
                var loc = null;
                for (var fi = 0; fi < feats.length; ++fi) {
                    var f = feats[fi];
                    var fl = new Range(f.min, f.max);
                    if (!loc) {
                        loc = fl;
                    } else {
                        loc = union(loc, fl);
                    }
                }
                var mergedRanges = loc.ranges();
                for (var si = 0; si < mergedRanges.length; ++si) {
                    var r = mergedRanges[si];

                    // begin coverage-counting
                    var posCoverage = ((r.max()|0) - (r.min()|0) + 1) * sgg.length;
                    var actCoverage = 0;
                    for (var fi = 0; fi < feats.length; ++fi) {
                        var f = feats[fi];
                        if ((f.min|0) <= r.max() && (f.max|0) >= r.min()) {
                            var umin = Math.max(f.min|0, r.min());
                            var umax = Math.min(f.max|0, r.max());
                            actCoverage += (umax - umin + 1);
                        }
                    }
                    var visualWeight = ((1.0 * actCoverage) / posCoverage);
                    // end coverage-counting

                    var newf = new DASFeature();
                    for (var k in template) {
                        newf[k] = template[k];
                    }
                    newf.min = r.min();
                    newf.max = r.max();
                    if (newf.label && sgg.length > 1) {
                        newf.label += ' (' + sgg.length + ' vars)';
                    }
                    newf.visualWeight = ((1.0 * actCoverage) / posCoverage);
                    pusho(tier.groupedFeatures, sg, newf);
                    // supergroups are already in tier.groups.
                }
            }

            delete tier.superGroups[sg]; // Do we want this?
        }       
    }

    // Glyphify groups.

    var gl = new Array();
    for (var gid in tier.groupedFeatures) {
        gl.push(gid);
    }
    gl.sort(function(g1, g2) {
        var d = tier.groupedFeatures[g1][0].score - tier.groupedFeatures[g2][0].score;
        if (d > 0) {
            return -1;
        } else if (d == 0) {
            return 0;
        } else {
            return 1;
        }
    });

    var groupGlyphs = {};
    for (var gx = 0; gx < gl.length; ++gx) {
        var gid = gl[gx];
        var g = glyphsForGroup(tier.groupedFeatures[gid], 0, tier.groups[gid], tier,
                               (tier.dasSource.collapseSuperGroups && !tier.bumped) ? 'collapsed_gene' : 'tent');
        if (g) {
            g.group = tier.groups[gid];
            groupGlyphs[gid] = g;
        }
    }

    for (var sg in tier.superGroups) {
        var sgg = tier.superGroups[sg];
        var sgGlyphs = [];
        var sgMin = 10000000000;
        var sgMax = -10000000000;
        for (var sgi = 0; sgi < sgg.length; ++sgi) {
            var gg = groupGlyphs[sgg[sgi]];
            groupGlyphs[sgg[sgi]] = null;
            if (gg) {
                sgGlyphs.push(gg);
                sgMin = Math.min(sgMin, gg.min());
                sgMax = Math.max(sgMax, gg.max());
            }
        }
        for (var sgi = 0; sgi < sgGlyphs.length; ++sgi) {
            var gg = sgGlyphs[sgi];
            glyphs.push(new PaddedGlyph(gg, sgMin, sgMax));
        }
    }
    for (var g in groupGlyphs) {
        var gg = groupGlyphs[g];
        if (gg) {
            glyphs.push(gg);
        }
    }

    // Bumping

    var unbumpedST = new SubTier();
    var bumpedSTs = [];
    var hasBumpedFeatures = false;
    var subtierMax = tier.subtierMax || tier.dasSource.subtierMax || tier.browser.defaultSubtierMax;
    var subtiersExceeded = false;

  GLYPH_LOOP:
    for (var i = 0; i < glyphs.length; ++i) {
        var g = glyphs[i];
        if (g.bump) {
            hasBumpedFeatures = true;
        }
        if (g.bump && (tier.bumped || tier.dasSource.collapseSuperGroups)) {       // kind-of nasty.  supergroup collapsing is different from "normal" unbumping
            for (var sti = 0; sti < bumpedSTs.length;  ++sti) {
                var st = bumpedSTs[sti];
                if (st.hasSpaceFor(g)) {
                    st.add(g);
                    continue GLYPH_LOOP;
                }
            }
            if (bumpedSTs.length >= subtierMax) {
                subtiersExceeded = true;
            } else {
                var st = new SubTier();
                st.add(g);
                bumpedSTs.push(st);
            }
        } else {
            unbumpedST.add(g);
        }
    }

    if (unbumpedST.glyphs.length > 0) {
        bumpedSTs = [unbumpedST].concat(bumpedSTs);
    }

    for (var sti = 0; sti < bumpedSTs.length; ++sti) {
        var st = bumpedSTs[sti];
        if (st.quant) {
            st.glyphs.unshift(new GridGlyph(st.height));
        }
    }

    for (var sti = 0; sti < bumpedSTs.length; ++sti) {
        var st = bumpedSTs[sti];
        st.glyphs.sort(function (g1, g2) {
            var z1 = g1.zindex || 0;
            var z2 = g2.zindex || 0;
            return z1 - z2;
        });
    }

    tier.subtiers = bumpedSTs;
    tier.glyphCacheOrigin = tier.browser.viewStart;

    if (subtiersExceeded)
        tier.updateStatus('Bumping limit exceeded, use the track editor to see more features');
    else
        tier.updateStatus();
}

DasTier.prototype.paint = function() {
    var retina = this.browser.retina && window.devicePixelRatio > 1;

    var subtiers = this.subtiers;
    if (!subtiers) {
	   return;
    }

    var desiredWidth = this.browser.featurePanelWidth + 2000;
    if (retina) {
        desiredWidth *= 2;
    }
    var fpw = this.viewport.width|0;
    if (fpw < desiredWidth - 50) {
        this.viewport.width = fpw = desiredWidth;
    }

    var lh = this.padding;
    for (var s = 0; s < subtiers.length; ++s) {
        lh = lh + subtiers[s].height + this.padding;
    }
    lh += 6
    lh = Math.max(lh, this.browser.minTierHeight);

    var canvasHeight = lh;
    if (retina) {
        canvasHeight *= 2;
    }

    if (canvasHeight != this.viewport.height) {
        this.viewport.height = canvasHeight;
    }
    
    var tierHeight = Math.max(lh, this.browser.minTierHeight);
    this.viewportHolder.style.left = '-1000px';
    this.viewport.style.width = retina ? ('' + (fpw/2) + 'px') : ('' + fpw + 'px');
    this.viewport.style.height = '' + lh + 'px';
    this.layoutHeight =  Math.max(lh, this.browser.minTierHeight);

    this.updateHeight();
    this.norigin = this.browser.viewStart;

    var gc = this.viewport.getContext('2d');
    gc.clearRect(0, 0, fpw, canvasHeight);

    gc.save();
    if (retina) {
        gc.scale(2, 2);
    }

    /*
    if (this.background) {
        gc.fillStyle = this.background;

        if (this.knownCoverage) {
            var knownRanges = this.knownCoverage.ranges();
            for (var ri = 0; ri < knownRanges.length; ++ri) {
                var r = knownRanges[ri];
                var knownMin = (r.min() - this.browser.viewStart) * this.browser.scale + 1000;
                var knownMax = (r.max() - this.browser.viewStart) * this.browser.scale + 1000;
                gc.fillRect(knownMin, 0, knownMax - knownMin, lh);
            }
        }
    }*/

    var drawStart =  this.browser.viewStart - 1000.0/this.browser.scale;
    var drawEnd = this.browser.viewEnd + 1000.0/this.browser.scale;
    var unmappedBlocks = [];
    if (this.knownCoverage) {
        var knownRanges = this.knownCoverage.ranges();
        for (var ri = 0; ri < knownRanges.length; ++ri) {
            var r = knownRanges[ri];
            if (ri == 0) {
                if (r.min() > drawStart) 
                   unmappedBlocks.push({min: drawStart, max: r.min() - 1});
            } else {
                unmappedBlocks.push({min: knownRanges[ri-1].max() + 1, max: r.min() - 1});
            }

            if (ri == knownRanges.length - 1 && r.max() < drawEnd) {
                unmappedBlocks.push({min: r.max() + 1, max: drawEnd});
            } 
        }
    }
    if (unmappedBlocks.length > 0) {
        gc.fillStyle = 'gray';
        for (var i = 0; i < unmappedBlocks.length; ++i) {
            var b = unmappedBlocks[i];
            var min = (b.min - this.browser.viewStart) * this.browser.scale + 1000;
            var max = (b.max - this.browser.viewStart) * this.browser.scale + 1000;
            gc.fillRect(min, 0, max - min, lh);
        }
    }

    var oc = new OverlayLabelCanvas();
    var offset = ((this.glyphCacheOrigin - this.browser.viewStart)*this.browser.scale)+1000;
    gc.translate(offset, this.padding);
    oc.translate(0, this.padding);

    this.paintToContext(gc, oc, offset);

    if (oc.glyphs.length > 0)
        this.overlayLabelCanvas = oc;
    else
        this.overlayLabelCanvas = null;

    gc.restore();
    this.drawOverlay();
    this.paintQuant();
}

DasTier.prototype.paintToContext = function(gc, oc, offset) {
    var subtiers = this.subtiers;
    var fpw = this.viewport.width|0;

    gc.save();
    for (var s = 0; s < subtiers.length; ++s) {
        var quant = null;
        var glyphs = subtiers[s].glyphs;
        for (var i = 0; i < glyphs.length; ++i) {
            var glyph = glyphs[i];
            if (glyph.min() < fpw-offset && glyph.max() > -offset) { 
                var glyph = glyphs[i];
                glyph.draw(gc, oc);
                if (glyph.quant) {
                    quant = glyph.quant;
                }
            }
        }
        if (this.scaleVertical) {
            var scale = this.browser.scale;
            gc.translate(0, scale + this.padding);
            oc.translate(0, scale + this.padding);
        } else {
            gc.translate(0, subtiers[s].height + this.padding);
            oc.translate(0, subtiers[s].height + this.padding);
        }
    }
    gc.restore();

    if (quant && this.quantLeapThreshold && this.featureSource && this.browser.sourceAdapterIsCapable(this.featureSource, 'quantLeap')) {
        var ry = subtiers[0].height * (1.0 - ((this.quantLeapThreshold - quant.min) / (quant.max - quant.min)));

        gc.save();
        gc.strokeStyle = 'red';
        gc.lineWidth = 0.3;
        gc.beginPath();
        gc.moveTo(-1000, ry);
        gc.lineTo(fpw + 1000, ry);
        gc.stroke();
        gc.restore();
    }    
}

DasTier.prototype.paintQuant = function() {
    if (!this.quantOverlay)
        return;

    var retina = this.browser.retina && window.devicePixelRatio > 1;

    var quant;
    if (this.subtiers && this.subtiers.length > 0)
        quant = this.subtiers[0].quant;

    if (quant) {
        var h = this.subtiers[0].height;
        var w = 50;
        this.quantOverlay.height = this.viewport.height;
        this.quantOverlay.width = retina ? w*2 : w;
        this.quantOverlay.style.height = '' + (retina ? this.quantOverlay.height/2 : this.quantOverlay.height) + 'px';
        this.quantOverlay.style.width = '' + w + 'px';
        this.quantOverlay.style.display = 'block';
        var ctx = this.quantOverlay.getContext('2d');
        if (retina)
            ctx.scale(2, 2);

        var numTics = 2;
        if (h > 40) {
            numTics = 1 + ((h/20) | 0);
        }
        var ticSpacing = (h + this.padding*2) / (numTics - 1);
        var ticInterval = (quant.max - quant.min) / (numTics - 1);

        ctx.fillStyle = 'white'
        ctx.globalAlpha = 0.6;
        if (this.browser.rulerLocation == 'right') {
            ctx.fillRect(w-30, 0, 30, h + this.padding*2);
        } else {
            ctx.fillRect(0, 0, 30, h + this.padding*2);
        }
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();

        if (this.browser.rulerLocation == 'right') {
            ctx.moveTo(w - 8, this.padding);
            ctx.lineTo(w, this.padding);
            ctx.lineTo(w, h + this.padding);
            ctx.lineTo(w - 8, h + this.padding);
            for (var t = 1; t < numTics-1; ++t) {
                var ty = t*ticSpacing;
                ctx.moveTo(w, ty);
                ctx.lineTo(w - 5, ty);
            }
        } else {
            ctx.moveTo(8, this.padding);
            ctx.lineTo(0, this.padding);
            ctx.lineTo(0, h + this.padding);
            ctx.lineTo(8, h + this.padding);
            for (var t = 1; t < numTics-1; ++t) {
                var ty = t*ticSpacing;
                ctx.moveTo(0, ty);
                ctx.lineTo(5, ty);
            }
        }
        ctx.stroke();

        ctx.fillStyle = 'black';

        if (this.browser.rulerLocation == 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(formatQuantLabel(quant.max), w-9, 8);
            ctx.fillText(formatQuantLabel(quant.min), w-9, h + this.padding);
            for (var t = 1; t < numTics-1; ++t) {
                var ty = t*ticSpacing;
                ctx.fillText(formatQuantLabel((1.0*quant.max) - (t*ticInterval)), w - 9, ty + 3);
            }
        } else {
            ctx.textAlign = 'left';
            ctx.fillText(formatQuantLabel(quant.max), 9, 8);
            ctx.fillText(formatQuantLabel(quant.min), 9, h + this.padding);
            for (var t = 1; t < numTics-1; ++t) {
                var ty = t*ticSpacing;
                ctx.fillText(formatQuantLabel((1.0*quant.max) - (t*ticInterval)), 9, ty + 3);
            }
        }
    } else {
        this.quantOverlay.style.display = 'none';
    }
}

function glyphsForGroup(features, y, groupElement, tier, connectorType) {
    var gstyle = tier.styleForFeature(groupElement);
    var label;
    var labelWanted = false;

    var glyphs = [];
    var strand = null;
    for (var i = 0; i < features.length; ++i) {
        var f = features[i];
        if (f.orientation && strand==null) {
            strand = f.orientation;
        }
         if (!label && f.label) {
            label = f.label;
        }

        var style = tier.styleForFeature(f);
        if (!style) {
            continue;
        }
        if (f.parts) {  // FIXME shouldn't really be needed
            continue;
        }
        if (isDasBooleanTrue(style.LABEL))
            labelWanted = true;

        var g = glyphForFeature(f, 0, style, tier, null, true);
        if (g) {
            glyphs.push(g);
        }
    }

    if (glyphs.length == 0)
        return null;
    
    var connector = 'flat';
    if (gstyle && gstyle.glyph === 'LINE') {
        // Stick with flat...
    } else {
        if (tier.dasSource.collapseSuperGroups && !tier.bumped) {
            if (strand === '+') {
                connector = 'collapsed+';
            } else if (strand === '-') {
                connector = 'collapsed-';
            }
        } else {
            if (strand === '+') {
                connector = 'hat+';
            } else if (strand === '-') {
                connector = 'hat-';
            }
        }
    }   

    var labelText = null;
    if ((label && labelWanted) || (gstyle && (isDasBooleanTrue(gstyle.LABEL) || isDasBooleanTrue(gstyle.LABELS)))) {  // HACK, LABELS should work.
        labelText = groupElement.label || label;
    }

    var gg = new GroupGlyph(glyphs, connector);
    if (labelText) {
        if (strand === '+') {
            labelText = '>' + labelText;
        } else if (strand === '-') {
            labelText = '<' + labelText;
        }
        gg = new LabelledGlyph(GLOBAL_GC, gg, labelText, false);
    }
    gg.bump = true;
    return gg;
}

function glyphForFeature(feature, y, style, tier, forceHeight, noLabel)
{
    function getRefSeq(tier, min, max) {
        var refSeq = null;
        if (tier.currentSequence) {
            var csStart = tier.currentSequence.start|0;
            var csEnd = tier.currentSequence.end|0;
            if (csStart <= max && csEnd >= min) {
                var sfMin = Math.max(min, csStart);
                var sfMax = Math.min(max, csEnd);

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

    var scale = tier.browser.scale, origin = tier.browser.viewStart;
    var gtype = style.glyph || 'BOX';
    var glyph;

    var min = feature.min;
    var max = feature.max;
    var type = feature.type;
    var strand = feature.orientation;
    var score = feature.score;
    var label = feature.label || feature.id;

    var minPos = (min - origin) * scale;
    var rawMaxPos = ((max - origin + 1) * scale);
    var maxPos = Math.max(rawMaxPos, minPos + 1);

    var height = tier.forceHeight || style.HEIGHT || forceHeight || 12;
    var requiredHeight = height = 1.0 * height;
    var bump = style.BUMP && isDasBooleanTrue(style.BUMP);

    var gg, quant;

    if (gtype === 'CROSS' || gtype === 'EX' || gtype === 'TRIANGLE' || gtype === 'DOT' || gtype === 'SQUARE' || gtype === 'STAR' || gtype === 'PLIMSOLL') {
        var stroke = style.FGCOLOR || 'black';
        var fill = style.BGCOLOR || 'none';
        var outline = style.STROKECOLOR;

        if (style.BGITEM && feature.itemRgb) {
            stroke = feature.itemRgb;
        } else if (isDasBooleanTrue(style.COLOR_BY_SCORE2)) {
            var grad = style.BGGRAD || style._gradient;
            if (!grad) {
                grad = makeGradient(50, style.COLOR1, style.COLOR2, style.COLOR3);
                style._gradient = grad;
            }

            var sc2 = feature.score2;
            if (sc2 != undefined || !stroke) {
                sc2 = sc2 || 0;

                var smin2 = style.MIN2 ? (1.0 * style.MIN2) : 0.0;
                var smax2 = style.MAX2 ? (1.0 * style.MAX2) : 1.0;
                var relScore2 = ((1.0 * sc2) - smin2) / (smax2-smin2);

                var step = (relScore2*grad.length)|0;
                if (step < 0) step = 0;
                if (step >= grad.length) step = grad.length - 1;
                stroke = grad[step];
            }
        }



        var height = tier.forceHeight || style.HEIGHT || forceHeight || 12;
        requiredHeight = height = 1.0 * height;

        var size = style.SIZE || height;
        if (style.RSIZE) {
            size = (1.0 * style.RSIZE) * height;
        }

        if (style.STROKETHRESHOLD) {
            if (size < (1.0 * style.STROKETHRESHOLD))
                outline = null;
        }
        
        size = 1.0 * size;

        var mid = (minPos + maxPos)/2;
        var hh = size/2;

        var mark;
        var bMinPos = minPos, bMaxPos = maxPos;

        if (gtype === 'EX') {
            gg = new ExGlyph(mid, size, stroke);
        } else if (gtype === 'TRIANGLE') {
            var dir = style.DIRECTION || 'N';
            var width = style.LINEWIDTH || size;
            gg = new TriangleGlyph(mid, size, dir, width, stroke, outline);
        } else if (gtype === 'DOT') {
            gg = new DotGlyph(mid, size, stroke, outline);
        } else if (gtype === 'PLIMSOLL') {
            gg = new PlimsollGlyph(mid, size, 0.2 * size, stroke, outline);
        } else if (gtype === 'SQUARE') {
            gg = new BoxGlyph(mid - hh, 0, size, size, stroke, outline);
        } else if (gtype === 'STAR') {
            var points = 5;
            if (style.POINTS) 
                points = style.POINTS | 0;
            gg = new StarGlyph(mid, hh, points, stroke, outline);
        } else {
            gg = new CrossGlyph(mid, size, stroke);
        }

        if (fill && fill != 'none' && (maxPos - minPos) > 5) {
            var bgg = new BoxGlyph(minPos, 0, (maxPos - minPos), size, fill);
            gg = new GroupGlyph([bgg, gg]);
        }

        if (isDasBooleanTrue(style.SCATTER)) {
            var smin = tier.quantMin(style);
            var smax = tier.quantMax(style);

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

            var relScore = ((1.0 * score) - smin) / (smax-smin);
            var relOrigin = (-1.0 * smin) / (smax - smin);

            if (relScore < 0.0 || relScore > 1.0) {
                // Glyph is out of bounds.
                // Should we allow for "partially showing" glyphs?

                return null;
            } else {
                if (relScore >= relOrigin) {
                    height = Math.max(1, (relScore - relOrigin) * requiredHeight);
                    y = y + ((1.0 - relOrigin) * requiredHeight) - height;
                } else {
                    height = Math.max(1, (relScore - relOrigin) * requiredHeight);
                    y = y + ((1.0 - relOrigin) * requiredHeight);
                }
                
                quant = {min: smin, max: smax};

                var heightFudge = 0;
                var featureLabel;
                if (typeof(feature.forceLabel) !== 'undefined')
                    featureLabel = feature.forceLabel;
                else
                    featureLabel = style.LABEL;

                if (isDasBooleanNotFalse(featureLabel) && label && !noLabel) {
                    gg = new LabelledGlyph(GLOBAL_GC, gg, label, true, null, featureLabel == 'above' ? 'above' : 'below');
                    if (featureLabel == 'above') {
                        heightFudge = gg.textHeight + 2;
                    }
                    noLabel = true;
                }
                gg = new TranslatedGlyph(gg, 0, y - hh - heightFudge, requiredHeight);
            }
        }
    } else if (gtype === 'HISTOGRAM' || gtype === 'GRADIENT' && score !== 'undefined') {
        var smin = tier.quantMin(style);
        var smax = tier.quantMax(style);

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

        if ((1.0 * score) < (1.0 *smin)) {
            score = smin;
        }
        if ((1.0 * score) > (1.0 * smax)) {
            score = smax;
        }
        var relScore = ((1.0 * score) - smin) / (smax-smin);
        var relOrigin = (-1.0 * smin) / (smax - smin);

        if (gtype === 'HISTOGRAM') {
            if (relScore >= relOrigin) {
                height = (relScore - Math.max(0, relOrigin)) * requiredHeight;
                y = y + ((1.0 - Math.max(0, relOrigin)) * requiredHeight) - height;
            } else {
                height = (Math.max(0, relOrigin) - relScore) * requiredHeight;
                y = y + ((1.0 - Math.max(0, relOrigin)) * requiredHeight);
            }
            quant = {min: smin, max: smax};
        }

        var stroke = style.FGCOLOR || null;
        var fill = style.BGCOLOR || style.COLOR1 || 'green';
        if (style.BGITEM && feature.itemRgb)
            fill = feature.itemRgb;
        var alpha = style.ALPHA ? (1.0 * style.ALPHA) : null;

        if (style.BGGRAD) {
            var grad = style.BGGRAD;
            var step = (relScore*grad.length)|0;
            if (step < 0) step = 0;
            if (step >= grad.length) step = grad.length - 1;
            fill = grad[step];
        }
        if (style.COLOR2) {
            var grad = style._gradient;
            if (!grad) {
                grad = makeGradient(50, style.COLOR1, style.COLOR2, style.COLOR3);
                style._gradient = grad;
            }

            var step = (relScore*grad.length)|0;
            if (step < 0) step = 0;
            if (step >= grad.length) step = grad.length - 1;
            fill = grad[step];
        }

        gg = new BoxGlyph(minPos, y, (maxPos - minPos), height, fill, stroke, alpha);
        gg = new TranslatedGlyph(gg, 0, 0, requiredHeight);
    } else if (gtype === 'HIDDEN') {
        gg = new PaddedGlyph(null, minPos, maxPos);
        noLabel = true;
    } else if (gtype === 'ARROW') {
        var color = style.FGCOLOR || 'purple';
        var parallel = isDasBooleanTrue(style.PARALLEL);
        var sw = isDasBooleanTrue(style.SOUTHWEST);
        var ne = isDasBooleanTrue(style.NORTHEAST);
        gg = new ArrowGlyph(minPos, maxPos, height, color, parallel, sw, ne);
    } else if (gtype === 'ANCHORED_ARROW') {
        var stroke = style.FGCOLOR || 'none';
        var fill = style.BGCOLOR || 'green';
        gg = new AArrowGlyph(minPos, maxPos, height, fill, stroke, strand);
        gg.bump = true;
    } else if (gtype === 'SPAN') {
        var stroke = style.FGCOLOR || 'black';
        gg = new SpanGlyph(minPos, maxPos, height, stroke);
    } else if (gtype === 'LINE') {
        var stroke = style.FGCOLOR || 'black';
        var lineStyle = style.STYLE || 'solid';
        gg = new LineGlyph(minPos, maxPos, height, lineStyle, strand, stroke);
    } else if (gtype === 'PRIMERS') {
        var stroke = style.FGCOLOR || 'black';
        var fill = style.BGCOLOR || 'red';
        gg = new PrimersGlyph(minPos, maxPos, height, fill, stroke);
    } else if (gtype === 'TEXT') {
        var string = style.STRING || 'text';
        var fill = style.FGCOLOR || 'black';
        gg = new TextGlyph(GLOBAL_GC, minPos, maxPos, height, fill, string);
    } else if (gtype === 'TOOMANY') {
        var stroke = style.FGCOLOR || 'gray';
        var fill = style.BGCOLOR || 'orange';
        gg = new TooManyGlyph(minPos, maxPos, height, fill, stroke);
    } else if (gtype === 'POINT') {
        var height = tier.forceHeight || style.HEIGHT || 30;
        var smin = tier.quantMin(style);
        var smax = tier.quantMax(style);
        var yscale = ((1.0 * height) / (smax - smin));
        var relScore = ((1.0 * score) - smin) / (smax-smin);
        var sc = ((score - (1.0*smin)) * yscale)|0;
        quant = {min: smin, max: smax};

        var fill = style.FGCOLOR || style.COLOR1 || 'black';
        if (style.COLOR2) {
            var grad = style._gradient;
            if (!grad) {
                grad = makeGradient(50, style.COLOR1, style.COLOR2, style.COLOR3);
                style._gradient = grad;
            }

            var step = (relScore*grad.length)|0;
            if (step < 0) step = 0;
            if (step >= grad.length) step = grad.length - 1;
            fill = grad[step];
        } 

        gg = new PointGlyph((minPos + maxPos)/2, height-sc, height, fill);
    } else if (gtype === '__SEQUENCE') {
        var rawseq = feature.seq;
        var seq = rawseq;
        var rawquals = feature.quals;
        var quals = rawquals;
        var insertionLabels = isDasBooleanTrue(style.__INSERTIONS);

        var indels = [];
        if (feature.cigar) {
            var ops = parseCigar(feature.cigar);
            seq = ''
            quals = '';
            var cursor = 0;
            for (var ci = 0; ci < ops.length; ++ci) {
                var co = ops[ci];
                if (co.op == 'M') {
                    seq += rawseq.substr(cursor, co.cnt);
                    quals += rawquals.substr(cursor, co.cnt);
                    cursor += co.cnt;
                } else if (co.op == 'D') {
                    for (var oi = 0; oi < co.cnt; ++oi) {
                        seq += '-';
                        quals += 'Z';
                    }
                } else if (co.op == 'I') {
                    var inseq =  rawseq.substr(cursor, co.cnt);
                    var ig = new TriangleGlyph(minPos + (seq.length*scale), 5, 'S', 5, tier.browser.baseColors['I']);
                    if (insertionLabels)
                        ig = new LabelledGlyph(GLOBAL_GC, ig, inseq, false, 'center', 'above', '7px sans-serif');
                    ig.feature = {label: 'Insertion: ' + inseq, type: 'insertion', method: 'insertion'};
                    indels.push(ig);

                    cursor += co.cnt;
                } else if (co.op == 'S') {
                    cursor += co.cnt;
                } else {
                    console.log('unknown cigop' + co.op);
                }
            }
        }

        var refSeq = getRefSeq(tier, min, max);
        if (seq && refSeq && (style.__SEQCOLOR === 'mismatch' || style.__SEQCOLOR === 'mismatch-all')) {
            var mismatchSeq = [];
            var match = feature.orientation === '-' ? ',' : '.';
            for (var i = 0; i < seq.length; ++i)
                mismatchSeq.push(seq[i] == refSeq[i] ? match : seq[i]);
            seq = mismatchSeq.join('');
        }

        var strandColor;
        if (feature.orientation === '-')
            strandColor = style._minusColor || 'lightskyblue';
        else
            strandColor = style._plusColor || 'lightsalmon';

        if (style.__disableQuals)
            quals = false;
        
        gg = new SequenceGlyph(
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
            gg = new TranslatedGlyph(gg, 0, 7);
        if (indels.length > 0) {
            indels.splice(0, 0, gg);
            gg = new GroupGlyph(indels);
        }
    } else if (gtype === '__INSERTION') {
        var ig = new TriangleGlyph(minPos, 5, 'S', 5, tier.browser.baseColors['I']);
        gg = new LabelledGlyph(GLOBAL_GC, ig, feature.insertion || feature.altAlleles[0], false, 'center', 'above', '7px sans-serif');
        if ((maxPos - minPos) > 1) {
            var fill = style.BGCOLOR || style.COLOR1 || 'green';
            var bg = new BoxGlyph(minPos, 5, (maxPos - minPos), height, fill, stroke);
            gg = new GroupGlyph([bg, gg]);
        }
    } else if (gtype === '__NONE') {
        return null;
    } else /* default to BOX */ {
        var stroke = style.FGCOLOR || null;
        var fill = style.BGCOLOR || style.COLOR1 || 'green';
        if (style.BGITEM && feature.itemRgb)
            fill = feature.itemRgb;
        var scale = (maxPos - minPos) / (max - min);
        if (feature.type == 'translation' &&
            (feature.method == 'protein_coding' || feature.readframeExplicit) &&
            (!feature.tags || feature.tags.indexOf('cds_start_NF') < 0 || feature.readframeExplicit) &&
            (!tier.dasSource.collapseSuperGroups || tier.bumped)
            && scale >= 0.5) {
            var refSeq = getRefSeq(tier, min, max);
            gg = new AminoAcidGlyph(minPos, maxPos, height, fill, refSeq, feature.orientation, feature.readframe);    
        } else {
            gg = new BoxGlyph(minPos, 0, (maxPos - minPos), height, fill, stroke);
        }
        // gg.bump = true;
    }

    if ((isDasBooleanTrue(style.LABEL) || feature.forceLabel) && label && !noLabel) {
        gg = new LabelledGlyph(GLOBAL_GC, gg, label, false);
    }

    if (bump) {
        gg.bump = true;
    }

    gg.feature = feature;
    if (quant) {
        gg.quant = quant;
    }

    if (style.ZINDEX) {
        gg.zindex = style.ZINDEX | 0;
    }

    return gg;
}

DasTier.prototype.styleForFeature = function(f) {
    var ssScale = this.browser.zoomForCurrentScale();

    if (!this.stylesheet) {
        return null;
    }

    var maybe = null;
    var ss = this.stylesheet.styles;
    for (var si = 0; si < ss.length; ++si) {
        var sh = ss[si];
        if (sh.zoom && sh.zoom != ssScale) {
            continue;
        }

        if (sh.orientation) {
            if (sh.orientation != f.orientation) {
                continue;
            }
        }

        var labelRE = sh._labelRE;
        if (!labelRE || !labelRE.test) {
            labelRE = new RegExp('^' + sh.label + '$');
            sh._labelRE = labelRE;
        }
        if (sh.label && !(labelRE.test(f.label))) {
            continue;
        }
        var methodRE = sh._methodRE;
        if (!methodRE || !methodRE.test) {
            methodRE = new RegExp('^' + sh.method + '$');
            sh._methodRE = methodRE;
        }
        if (sh.method && !(methodRE.test(f.method))) {
            continue;
        }
        if (sh.type) {
            if (sh.type == 'default') {
                if (!maybe) {
                    maybe = sh.style;
                }
                continue;
            } else {
                var typeRE = sh._typeRE;
                if (!typeRE || !typeRE.test) {
                    typeRE = new RegExp('^' + sh.type + '$');
                    sh._typeRE = typeRE;
                }
                if (!typeRE.test(f.type)) 
                    continue;
            }
        }
        return sh.style;
    }
    return maybe;
}

function makeLineGlyph(features, style, tier) {
    var origin = tier.browser.viewStart, scale = tier.browser.scale;
    var height = tier.forceHeight || style.HEIGHT || 30;
    var min = tier.quantMin(style);
    var max = tier.quantMax(style);
    var yscale = ((1.0 * height) / (max - min));
    var width = style.LINEWIDTH || 1;
    var color = style.FGCOLOR || style.COLOR1 || 'black';

    var points = [];
    for (var fi = 0; fi < features.length; ++fi) {
        var f = features[fi];

        var px = ((((f.min|0) + (f.max|0)) / 2) - origin) * scale;
        var sc = ((f.score - (1.0*min)) * yscale)|0;
        var py = (height - sc);  // FIXME y???
        points.push(px);
        points.push(py);
    }
    var lgg = new LineGraphGlyph(points, color, height);
    lgg.quant = {min: min, max: max};

    if (style.ZINDEX) 
        lgg.zindex = style.ZINDEX|0;

    return lgg;
}

DasTier.prototype.quantMin = function(style) {
    if (this.forceMinDynamic) {
        return this.currentFeaturesMinScore || 0;
    } else if (typeof(this.forceMin) === 'number') {
        return this.forceMin;
    } else {
        return style.MIN || this.currentFeaturesMinScore || 0;
    }
}

DasTier.prototype.quantMax = function(style) {
    if (this.forceMaxDynamic) {
        return this.currentFeaturesMaxScore || 0;
    } else if (typeof(this.forceMax) === 'number') {
        return this.forceMax;
    } else {
        return style.MAX || this.currentFeaturesMaxScore || 0;
    }
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        drawFeatureTier: drawFeatureTier
    };
}
