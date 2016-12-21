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

	if (quant && quant.min < 0 && quant.max > 0 && this.dasSource.zeroLine) {
	    var ry = subtiers[0].height * (quant.max / (quant.max - quant.min))
	    gc.save();
	    gc.strokeStyle = this.dasSource.zeroLine;
	    gc.lineWidth = 0.5;
	    gc.beginPath();
	    gc.moveTo(-1000, ry);
	    gc.lineTo(fpw + 1000, ry);
	    gc.stroke();
	    gc.restore();
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
        SubTier: SubTier
    };
}
