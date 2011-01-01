/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// tier.js: (try) to encapsulate the functionality of a browser tier.
//

var __tier_idSeed = 0;

function DasTier(browser, source, viewport, background)
{
    var thisTier = this;

    this.id = 'tier' + (++__tier_idSeed);
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

    var fs;
    if (this.dasSource.bwgURI) {
        fs = new BWGFeatureSource(this.dasSource.bwgURI);
    } else {
        fs = new DASFeatureSource(this.dasSource);
    }
    
    if (this.dasSource.mapping) {
        fs = new MappedFeatureSource(fs, this.browser.chains[this.dasSource.mapping]);
    }

    this.featureSource = fs;
}

DasTier.prototype.toString = function() {
    return this.id;
}

DasTier.prototype.init = function() {
    var tier = this;

    if (tier.dasSource.bwgURI) {
        makeBwgFromURL(tier.dasSource.bwgURI, function(bwg) {
            tier.bwg = bwg;

            if (tier.dasSource.uri || tier.dasSource.stylesheet_uri) {
                tier.status = 'Fetching stylesheet';
                tier.dasSource.stylesheet(function(stylesheet) {
	            tier.stylesheet = stylesheet;
	            // tier.refreshTier();
                }, function() {
	            // tier.error = 'No stylesheet';
                    tier.stylesheet = new DASStylesheet();
                    var defStyle = new DASStyle();
                    defStyle.glyph = 'BOX';
                    defStyle.BGCOLOR = 'blue';
                    defStyle.FGCOLOR = 'black';
                    tier.stylesheet.pushStyle('default', null, defStyle);


	            // tier.refreshTier();
                });
            } else  if (tier.bwg.type == 'bigbed') {
                tier.stylesheet = new DASStylesheet();

                var wigStyle = new DASStyle();
                wigStyle.glyph = 'BOX';
                wigStyle.FGCOLOR = 'black';
                wigStyle.BGCOLOR = 'red'
                wigStyle.HEIGHT = 12;
                wigStyle.BUMP = true;
                wigStyle.LABEL = true;
                wigStyle.ZINDEX = 20;
                tier.stylesheet.pushStyle({type: 'default'}, null, wigStyle);

                var tsStyle = new DASStyle();
                tsStyle.glyph = 'BOX';
                tsStyle.FGCOLOR = 'black';
                tsStyle.BGCOLOR = 'white';
                tsStyle.ZINDEX = 10;
                tsStyle.BUMP = true;
                tier.stylesheet.pushStyle({type: 'bb-transcript'}, null, tsStyle);

                // tier.refreshTier();
            } else {
                tier.stylesheet = new DASStylesheet();
                var wigStyle = new DASStyle();
                wigStyle.glyph = 'HISTOGRAM';
                wigStyle.COLOR1 = 'white';
                wigStyle.COLOR2 = 'black';
                tier.stylesheet.pushStyle('default', null, wigStyle);

                // tier.refreshTier();
            }
        });
    } else {
        tier.status = 'Fetching stylesheet';
        this.dasSource.stylesheet(function(stylesheet) {
	    tier.stylesheet = stylesheet;
	    // tier.refreshTier();
        }, function() {
	    // tier.error = 'No stylesheet';
            tier.stylesheet = new DASStylesheet();
            var defStyle = new DASStyle();
            defStyle.glyph = 'BOX';
            defStyle.BGCOLOR = 'blue';
            defStyle.FGCOLOR = 'black';
            tier.stylesheet.pushStyle('default', null, defStyle);
	    // tier.refreshTier();
        });
    }
}

DasTier.prototype.styles = function(scale) {
    // alert('Old SS code called');
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

DasTier.prototype.getSource = function() {
    return this.featureSource;
}

DasTier.prototype.getDesiredTypes = function(scale) {
    return null;
}

DasTier.prototype.setStatus = function(status) {
    dlog(status);
}

DasTier.prototype.viewFeatures = function(chr, min, max, scale, features) {
    this.currentFeatures = features;
    this.knownStart = min; this.knownEnd = max;
    this.status = null; this.error = null;
    dasRequestComplete(this);
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

function zoomForScale(scale) {
    var ssScale;
    if (scale > 0.2) {
        ssScale = 'high';
    } else if (scale > 0.01) {
        ssScale = 'medium';
    } else  {
        ssScale = 'low';
    }
    return ssScale;
}

function refreshTier_features()
{
    throw "refreshTier_features called"

    // var stylesheet = this.styles(this.browser.scale);
    var fetchTypes = [];
    var inclusive = false;
    var ssScale = zoomForScale(this.browser.scale);

    if (this.stylesheet) {
        var ss = this.stylesheet.styles;
        for (var si = 0; si < ss.length; ++si) {
            var sh = ss[si];
            if (!sh.zoom || sh.zoom == ssScale) {
                if (!sh.type || sh.type == 'default') {
                    inclusive = true;
                    break;
                } else {
                    pushnew(fetchTypes, sh.type);
                }
            }
        }
    }
    
    var scaledQuantRes = this.browser.targetQuantRes / this.browser.scale;
    var maxBins = 1 + (((this.browser.knownEnd - this.browser.knownStart) / scaledQuantRes) | 0);
    var fetchStart = this.browser.knownStart;
    var fetchEnd = this.browser.knownEnd;

    if (inclusive || fetchTypes.length > 0) {
	var tier = this;
	this.status = 'Fetching features';

        if (this.dasSource.bwgURI) {
            if (this.bwg) {
                this.bwg.readWigData(this.browser.chr, fetchStart, fetchEnd, function(features) {
                    dlog('got ' + features.length + ' features');
                    if (tier.bwg.type == 'bigwig' && features.length > maxBins) {
                        features = downsample(features, scaledQuantRes);
                        dlog('downsampled to ' + features.length);
                    }

                    tier.currentFeatures = features;
                    tier.error = null; tier.status = null;
                    tier.knownStart = fetchStart; tier.knownEnd = fetchEnd;
                    dasRequestComplete(tier);
                });
            }
        } else if (this.dasSource.mapping) {
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
