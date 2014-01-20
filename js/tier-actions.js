/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tier-actions.js
//

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
            nsh.method = tier.dasSource.name;
            nsh._methodRE = null;
            nsh.style = shallowCopy(sh.style);

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
