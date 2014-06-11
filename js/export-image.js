/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// export-image.js
//

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var g = require('./glyphs');
    var OverlayLabelCanvas = g.OverlayLabelCanvas;
}

Browser.prototype.exportImage = function() {
    var fpw = this.featurePanelWidth;
    var totHeight = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var tier = this.tiers[ti];
        if (tier.layoutHeight !== undefined)
            totHeight += tier.layoutHeight;
    }
    var mult = 1.0;
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
        if (tier.subtiers) {
            tier.paintToContext(g, oc, offset + 1000);
        }
        g.restore();
        oc.draw(g, offset, offset + fpw);
        g.restore();

        ypos += tier.layoutHeight;
    }

    return c.toDataURL('image/png');
}