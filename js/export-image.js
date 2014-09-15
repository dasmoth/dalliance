/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// export-image.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var g = require('./glyphs');
    var OverlayLabelCanvas = g.OverlayLabelCanvas;

    var nf = require('./numformats');
    var formatQuantLabel = nf.formatQuantLabel;

    var drawSeqTierGC = require('./sequence-draw').drawSeqTierGC;
}

function fillTextRightJustified(g, text, x, y) {
    g.fillText(text, x - g.measureText(text).width, y);
}

Browser.prototype.exportImage = function(opts) {
    opts = opts || {};

    var fpw = this.featurePanelWidth;
    var padding = 3;
    var totHeight = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        if (ti > 0)
            totHeight += padding;
        var tier = this.tiers[ti];
        if (tier.layoutHeight !== undefined)
            totHeight += tier.layoutHeight;
    }
    var mult = opts.resolutionMultiplier || 1.0;
    var margin = 200;


    var cw = ((fpw + margin) * mult)|0;
    var ch = (totHeight * mult)|0;
    var c = makeElement('canvas', null, {width: cw, height: ch});
    var g = c.getContext('2d');
    g.fillStyle = 'white';
    g.fillRect(0, 0, cw, ch);

    g.scale(mult, mult);
    
    var ypos = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var tier = this.tiers[ti];
        var offset = ((tier.glyphCacheOrigin - this.viewStart)*this.scale);

        var oc = new OverlayLabelCanvas();
        g.save();       // 1
        g.translate(0, ypos);

        g.save();       // 2
        g.beginPath();
        g.moveTo(margin, 0);
        g.lineTo(margin + fpw, 0);
        g.lineTo(margin + fpw, tier.layoutHeight);
        g.lineTo(margin, tier.layoutHeight);
        g.closePath();
        g.clip();
        g.translate(margin, 0);

        g.save();      // 3
        g.translate(offset, 0);
        if (tier.subtiers) {
            tier.paintToContext(g, oc, offset + 1000);
        } else {
            drawSeqTierGC(tier, tier.currentSequence, g);
        }
        g.restore();   // 2
        
        g.save()       // 3
        g.translate(offset, 0);
        oc.draw(g, -offset, fpw - offset);
        g.restore();   // 2
        g.restore();   // 1

        var hasQuant = false;
        var pos = 0;
        var subtiers = tier.subtiers || [];
        for (var sti = 0; sti < subtiers.length; ++sti) {
            var subtier = subtiers[sti];
                    
            if (subtier.quant) {
                hasQuant = true;
                var q = subtier.quant;
                var h = subtier.height;

                var numTics = 2;
                if (h > 40) {
                    numTics = 1 + ((h/20) | 0);
                }
                var ticSpacing = h / (numTics - 1);
                var ticInterval = (q.max - q.min) / (numTics - 1);

                g.beginPath();
                g.moveTo(margin + 5, pos);
                g.lineTo(margin, pos);
                g.lineTo(margin, pos + subtier.height);
                g.lineTo(margin + 5, pos + subtier.height);
                for (var t = 1; t < numTics-1; ++t) {
                    var ty = t*ticSpacing;
                    g.moveTo(margin, pos + ty);
                    g.lineTo(margin+3, pos + ty);
                }
                g.strokeStyle = 'black';
                g.strokeWidth = 2;
                g.stroke();

                g.fillStyle = 'black';
                fillTextRightJustified(g, formatQuantLabel(q.max), margin - 3, pos + 7);
                fillTextRightJustified(g, formatQuantLabel(q.min), margin - 3, pos + subtier.height);
                for (var t = 1; t < numTics-1; ++t) {
                    var ty = t*ticSpacing;
                    fillTextRightJustified(g, formatQuantLabel((1.0*q.max) - (t*ticInterval)), margin - 3, pos + ty + 3);
                }
            }

            pos += subtier.height + padding;
        }

        var labelName;
        if (typeof tier.config.name === 'string')
            labelName = tier.config.name;
        else
            labelName = tier.dasSource.name;
        var labelWidth = g.measureText(labelName).width;
        g.fillStyle = 'black';
        g.fillText(labelName, margin - (hasQuant ? 22 : 12) - labelWidth, (tier.layoutHeight + 6) / 2);

        g.restore(); // 0

        ypos += tier.layoutHeight + padding;
    }

    if (opts.highlights) {
        g.save();

        g.beginPath();
        g.moveTo(margin, 0);
        g.lineTo(margin + fpw, 0);
        g.lineTo(margin + fpw, ypos);
        g.lineTo(margin, ypos);
        g.closePath();
        g.clip();

        g.translate(margin + offset, 0);
        var origin = this.viewStart;
        var visStart = this.viewStart;
        var visEnd = this.viewEnd;

        for (var hi = 0; hi < this.highlights.length; ++hi) {
            var h = this.highlights[hi];
            if (((h.chr === this.chr) || (h.chr === ('chr' + this.chr))) && h.min < visEnd && h.max > visStart) {
                g.globalAlpha = this.defaultHighlightAlpha;
                g.fillStyle = this.defaultHighlightFill;
                g.fillRect((h.min - origin) * this.scale,
                           0,
                           (h.max - h.min) * this.scale,
                           ypos);
            }
        } 
        g.restore();
    }

    var rulerPos = -1; 
    if (opts.ruler == 'center') {
        rulerPos = margin + ((this.viewEnd - this.viewStart + 1)*this.scale) / 2;
    } else if (opts.ruler == 'left') {
        rulerPos = margin;
    } else if (opts.ruler == 'right') {
        rulerPos = margin + ((this.viewEnd - this.viewStart + 1)*this.scale);
    }
    if (rulerPos >= 0) {
        g.strokeStyle = 'blue';
        g.beginPath();
        g.moveTo(rulerPos, 0);
        g.lineTo(rulerPos, ypos);
        g.stroke();
    }

    return c.toDataURL('image/png');
}