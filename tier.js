// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// tier.js: (try) to encapsulate the functionality of a browser tier.
//

function refreshTier(tier)
{	    
    if (SeqRenderer.prototype.isPrototypeOf(tier.source.renderer)) { // FIXME: need a better way of IDing seq tiers!
        if (scale >= 1) {
            tier.source.dasSource.sequence(
                new DASSegment(chr, knownStart, knownEnd),
                function(seqs) {
                    drawSeqTier(tier, seqs[0]);  // FIXME: check array.
                }
            );
        } else {
            drawSeqTier(tier);
        }
    } else {
	var stylesheet = tier.source.styles(scale);
	var fetchTypes = [];
	if (stylesheet) {
	    for (tt in stylesheet) {
		fetchTypes.push(tt);
	    }
	}
	
        var scaledQuantRes = targetQuantRes / scale;
        var maxBins = 1 + (((knownEnd - knownStart) / scaledQuantRes) | 0);

	if (fetchTypes.length > 0) {
	    // alert(fetchTypes);
            tier.source.dasSource.features(
		new DASSegment(chr, knownStart, knownEnd),
		{type: fetchTypes, maxbins: maxBins},
		function(features) {
                    tier.currentFeatures = features;
                    dasRequestComplete(tier);
		}
            );
	} else {
	    tier.currentFeatures = [];
	    dasRequestComplete(tier);
	}
    }
}


function dasRequestComplete(tier)
{
    drawFeatureTier(tier);
    arrangeTiers();
    setLoadingStatus();
}
