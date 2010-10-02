/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// tier.js: (try) to encapsulate the functionality of a browser tier.
//

function DasTier(browser, source, viewport, background)
{
    this.browser = browser;
    this.dasSource = new DASSource(source);
    this.viewport = viewport;
    this.background = background;
    this.req = null;
    this.layoutHeight = 50;
    this.bumped = true; 
    if (this.dasSource.collapseSuperGroups) {
        this.bumped = false;
    }
    this.y = 0;

    if (this.dasSource.tier_type == 'sequence') {
	this.refreshTier = refreshTier_sequence;
    } else {
	this.refreshTier = refreshTier_features;
    }

    this.layoutWasDone = false;
}

DasTier.prototype.init = function() {
    var tier = this;
    tier.status = 'Fetching stylesheet';
    this.dasSource.stylesheet(function(stylesheet) {
	tier.stylesheet = stylesheet;
	tier.refreshTier();
    }, function() {
	// tier.error = 'No stylesheet';
        tier.stylesheet = new DASStylesheet();
        var defStyle = new DASStyle();
        defStyle.glyph = 'BOX';
        defStyle.BGCOLOR = 'blue';
        defStyle.FGCOLOR = 'black';
        tier.stylesheet.pushStyle('default', null, defStyle);
	tier.refreshTier();
    });
}

DasTier.prototype.styles = function(scale) {
    if (this.stylesheet == null) {
	return null;
    } else if (this.browser.scale > 0.2) {
	return this.stylesheet.highZoomStyles;
    } else if (this.browser.scale > 0.01) {
	return this.stylesheet.mediumZoomStyles;
    } else {
	return this.stylesheet.lowZoomStyles;
    }
}

function refreshTier_sequence()
{
    var fetchStart = this.browser.knownStart;
    var fetchEnd = this.browser.knownEnd;
    if (this.browser.scale >= 1) {
	var tier = this;
        this.dasSource.sequence(
            new DASSegment(this.browser.chr, fetchStart, fetchEnd),
            function(seqs) {
                tier.knownStart = fetchStart; tier.knownEnd = fetchEnd;
                drawSeqTier(tier, seqs[0]);  // FIXME: check array.
                tier.setBackground();
		tier.originHaxx = 0;
            }
        );
    } else {
        this.knownStart = fetchStart; this.knownEnd = fetchEnd;
        drawSeqTier(this);
        this.setBackground();
	this.originHaxx = 0;
    }
}

function refreshTier_features()
{
    var stylesheet = this.styles(this.browser.scale);
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
    
    var scaledQuantRes = this.browser.targetQuantRes / this.browser.scale;
    var maxBins = 1 + (((this.browser.knownEnd - this.browser.knownStart) / scaledQuantRes) | 0);
    var fetchStart = this.browser.knownStart;
    var fetchEnd = this.browser.knownEnd;

    if (inclusive || fetchTypes.length > 0) {
	var tier = this;
	this.status = 'Fetching features';

        if (this.dasSource.mapping) {
            var mapping = this.browser.chains[this.dasSource.mapping];
            mapping.sourceBlocksForRange(this.browser.chr, fetchStart, fetchEnd, function(mseg) {
                if (mseg.length == 0) {
                    tier.currentFeatures = [];
                    tier.status = "No mapping available for this regions";
                    dasRequestComplete(tier);
                } else {
                    tier.dasSource.features(
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
                                if (!mmin || !mmax || mmin.seq != mmax.seq || mmin.seq != tier.browser.chr) {
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
                                            alert(miniJSONify(f));
                                        } else if (f.orientation == '+') {
                                            f.orientation = '-';
                                        }
                                    }
                                    mappedFeatures.push(f);
                                }
                            }
                            tier.currentFeatures = mappedFeatures;
                            tier.knownStart = fetchStart; tier.knownEnd = fetchEnd;
                            dasRequestComplete(tier);
	                }
                    );
                }
            });
        } else {        
            this.dasSource.features(
	        new DASSegment(this.browser.chr, fetchStart, fetchEnd),
	        {type: (inclusive ? null : fetchTypes), maxbins: maxBins},
	        function(features, status) {
		    if (status) {
		        tier.error = status;
		    } else {
		        tier.error = null; tier.status = null;
		    }
                    tier.currentFeatures = features;
                    tier.knownStart = fetchStart; tier.knownEnd = fetchEnd;
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

DasTier.prototype.setBackground = function() {            
    if (this.knownStart) {
        this.background.setAttribute('x', (this.knownStart - this.browser.origin) * this.browser.scale);
        this.background.setAttribute('width', (this.knownEnd - this.knownStart + 1) * this.browser.scale);
    }    
}

function dasRequestComplete(tier)
{
    drawFeatureTier(tier);
    tier.originHaxx = 0;
    tier.setBackground();
    tier.browser.arrangeTiers();
}