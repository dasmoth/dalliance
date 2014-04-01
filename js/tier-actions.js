/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tier-actions.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var utils = require('./utils');
    var shallowCopy = utils.shallowCopy;
}

Browser.prototype.mergeSelectedTiers = function() {
    var sources = [];
    var styles = [];

    for (var sti = 0; sti < this.selectedTiers.length; ++sti) {
        var tier = this.tiers[this.selectedTiers[sti]];
	    sources.push(shallowCopy(tier.dasSource));
        var ss = tier.stylesheet.styles;
        for (var si = 0; si < ss.length; ++si) {
            var sh = ss[si];
            var nsh = shallowCopy(sh);
            nsh.method = tier.dasSource.name.replace(/[()+*?]/g, '\\$&');
            nsh._methodRE = null;
            nsh.style = shallowCopy(sh.style);
            if (nsh.style.ZINDEX === undefined)
                nsh.style.ZINDEX = sti;

            if (tier.forceMin) {
                nsh.style.MIN = tier.forceMin;
            }
            if (tier.forceMax) {
                nsh.style.MAX = tier.forceMax;
            }

            styles.push(nsh);
        }
    }
    
    this.addTier(
	{name: 'Merged',
	 merge: 'concat',
	 overlay: sources,
	 noDownsample: true,
     style: styles});

    this.setSelectedTier(this.tiers.length - 1);
}
