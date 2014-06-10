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
    var c = makeElement('canvas', '', {width: 1000, height: 1000});

    var g = c.getContext('2d');
    
    var ypos = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var tier = this.tiers[ti];

        var oc = new OverlayLabelCanvas();
        g.save();
        g.translate(0, ypos);
        g.save();
        if (tier.subtiers)
            tier.paintToContext(g, oc, 1000);
        g.restore();
        oc.draw(g, 1000, 2000);
        g.restore();

        ypos += tier.layoutHeight;
    }

    return c.toDataURL('image/png');
}