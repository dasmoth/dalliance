// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// tier.js: (try) to encapsulate the functionality of a browser tier.
//

DasTier.prototype.refreshTier = function()
{	    
    if (SeqRenderer.prototype.isPrototypeOf(this.source.renderer)) { // FIXME: need a better way of IDing seq tiers!
        if (scale >= 1) {
            this.source.dasSource.sequence(
                new DASSegment(chr, knownStart, knownEnd),
                function(seqs) {
                    drawSeqTier(this, seqs[0]);  // FIXME: check array.
                }
            );
        } else {
            drawSeqTier(this);
        }
    } else {
	var stylesheet = this.styles(scale);
	var fetchTypes = [];
	if (stylesheet) {
	    for (tt in stylesheet) {
		fetchTypes.push(tt);
	    }
	}
	
        var scaledQuantRes = targetQuantRes / scale;
        var maxBins = 1 + (((knownEnd - knownStart) / scaledQuantRes) | 0);

	if (fetchTypes.length > 0) {
	    var tier = this;
            this.dasSource.features(
		new DASSegment(chr, knownStart, knownEnd),
		{type: fetchTypes, maxbins: maxBins},
		function(features) {
                    tier.currentFeatures = features;
                    dasRequestComplete(tier);
		}
            );
	} else {
	    this.currentFeatures = [];
	    dasRequestComplete(this);
	}
    }
}


function dasRequestComplete(tier)
{
    drawFeatureTier(tier);
    arrangeTiers();
    setLoadingStatus();
}
