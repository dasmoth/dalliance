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
}

Browser.prototype.exportImage = function(opts) {
    opts = opts || {};

    var fpw = this.featurePanelWidth;
    var totHeight = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var tier = this.tiers[ti];
        if (tier.layoutHeight !== undefined)
            totHeight += tier.layoutHeight;
    }
    var mult = opts.resolutionMultiplier || 1.0;
    var margin = 200;

    var c = makeElement('canvas', null, {width: ((fpw + margin) * mult)|0, height: (totHeight * mult)|0});
    var g = c.getContext('2d');
    g.scale(mult, mult);
    
    var ypos = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var tier = this.tiers[ti];
        var offset = ((tier.glyphCacheOrigin - this.viewStart)*this.scale);

        var oc = new OverlayLabelCanvas();
        g.save();
        g.translate(0, ypos);

        var labelName;
        if (typeof tier.config.name === 'string')
            labelName = tier.config.name;
        else
            labelName = tier.dasSource.name;
        var labelWidth = g.measureText(labelName).width;
        g.fillText(labelName, margin - 12 - labelWidth, (tier.layoutHeight + 8) / 2);

        g.beginPath();
        g.moveTo(margin, 0);
        g.lineTo(margin + fpw, 0);
        g.lineTo(margin + fpw, tier.layoutHeight);
        g.lineTo(margin, tier.layoutHeight);
        g.closePath();
        g.clip();
        g.translate(margin, 0);

        g.save();
        g.translate(offset, 0);
        if (tier.subtiers) {
            tier.paintToContext(g, oc, offset + 1000);
        }
        g.restore();
        
        g.save()
        g.translate(offset, 0);
        oc.draw(g, -offset, fpw - offset);
        g.restore();

        g.restore();

        ypos += tier.layoutHeight;
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
        var origin = b.viewStart;
        var visStart = b.viewStart;
        var visEnd = b.viewEnd;

        for (var hi = 0; hi < this.highlights.length; ++hi) {
            var h = this.highlights[hi];
            if (((h.chr === this.chr) || (h.chr === ('chr' + b.chr))) && h.min < visEnd && h.max > visStart) {
                g.globalAlpha = b.defaultHighlightAlpha;
                g.fillStyle = b.defaultHighlightFill;
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