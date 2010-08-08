/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// tier.js: (try) to encapsulate the functionality of a browser tier.
//

function refreshTier_sequence()
{
    if (scale >= 1) {
	var tier = this;
        this.dasSource.sequence(
            new DASSegment(chr, knownStart, knownEnd),
            function(seqs) {
                drawSeqTier(tier, seqs[0]);  // FIXME: check array.
		tier.originHaxx = 0;
            }
        );
    } else {
        drawSeqTier(this);
	this.originHaxx = 0;
    }
}

function refreshTier_features()
{	    
    var stylesheet = this.styles(scale);
    var fetchTypes = [];
    var inclusive = false;
    if (stylesheet) {
	for (tt in stylesheet) {
	    if (tt == 'default') {
		inclusive = true;
	    } else {
		fetchTypes.push(tt);
	    }
	}
    } else {
	this.currentFeatures = [];
	dasRequestComplete(this); // FIXME isn't this daft?
	return;
    }
    
    var scaledQuantRes = targetQuantRes / scale;
    var maxBins = 1 + (((knownEnd - knownStart) / scaledQuantRes) | 0);

    if (inclusive || fetchTypes.length > 0) {
	var tier = this;
	this.status = 'Fetching features';

        if (this.source.opts.mapping) {
            var mapping = chains[this.source.opts.mapping];
            var mseg = mapping.sourceBlocksForRange(chr, knownStart, knownEnd);

            if (mseg.length == 0) {
                this.currentFeatures = [];
                this.status = "No mapping available for this regions";
                dasRequestComplete(this);
            } else {
                this.dasSource.features(
                    mseg[0],
                    {type: (inclusive ? null : fetchTypes), maxbins: maxBins},
	            function(features, status) {
		        if (status) {
		            tier.error = status;
		        } else {
		            tier.error = null; tier.status = null;
		        }

                        var mappedFeatures = [];
                        for (var fi = 0; fi < features.length; ++fi) {
                            var f = features[fi];
                            var mmin = mapping.mapPoint(f.segment, f.min);
                            var mmax = mapping.mapPoint(f.segment, f.max);
                            if (!mmin || !mmax || mmin.seq != mmax.seq || mmin.seq != chr) {
                                // Discard feature.
                            } else {
                                f.segment = mmin.seq;
                                f.min = mmin.pos;
                                f.max = mmax.pos;
                                if (f.min > f.max) {
                                    var tmp = f.max;
                                    f.max = f.min;
                                    f.min = tmp;
                                }
                                if (mmin.flipped) {
                                    if (f.orientation == '-') {
                                        f.orientation = '+';
                                    } else if (f.orientation == '+') {
                                        f.orientation = '-';
                                    }
                                }
                                mappedFeatures.push(f);
                            }
                        }
                        tier.currentFeatures = mappedFeatures;
                        dasRequestComplete(tier);
	            }
                );
            }
        } else {        
            this.dasSource.features(
	        new DASSegment(chr, knownStart, knownEnd),
	        {type: (inclusive ? null : fetchTypes), maxbins: maxBins},
	        function(features, status) {
		    if (status) {
		        tier.error = status;
		    } else {
		        tier.error = null; tier.status = null;
		    }
                    tier.currentFeatures = features;
                    dasRequestComplete(tier);
	        }
            );
        }
    } else {
	this.status = 'Nothing to show at this zoom level';
	this.currentFeatures = [];
	dasRequestComplete(this);
    }
}


function dasRequestComplete(tier)
{
    drawFeatureTier(tier);
    tier.originHaxx = 0;
    arrangeTiers();
    setLoadingStatus();
}
