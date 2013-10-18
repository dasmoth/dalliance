/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tier-actions.js
//

Browser.prototype.mergeSelectedTiers = function() {
    var sources = [];
    for (var sti = 0; sti < this.selectedTiers.length; ++sti) {
	   sources.push(shallowCopy(this.tiers[this.selectedTiers[sti]].dasSource));
    }
    
    this.addTier(
	{name: 'Merged',
	 merge: 'concat',
	 overlay: sources,
	 noDownsample: true});

/*
    for (var sti = 0; sti < this.selectedTiers.length; ++sti) {
	this.removeTier({index: this.selectedTiers[sti]});
    }*/

    this.setSelectedTier(this.tiers.length - 1);
}
