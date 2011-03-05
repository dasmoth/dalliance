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
    this.layoutWasDone = false;

    var fs;
    if (this.dasSource.bwgURI || this.dasSource.bwgBlob) {
        fs = new BWGFeatureSource(this.dasSource, {
            credentials: this.dasSource.credentials,
            preflight: this.dasSource.preflight,
            clientBin: this.dasSource.clientBin,
            forceReduction: this.dasSource.forceReduction
        });

        if (!this.dasSource.uri && !this.dasSource.stylesheet_uri) {
            fs.bwgHolder.await(function(bwg) {
                if (bwg.type == 'bigbed') {
                    thisTier.stylesheet = new DASStylesheet();
                    
                    var wigStyle = new DASStyle();
                    wigStyle.glyph = 'BOX';
                    wigStyle.FGCOLOR = 'black';
                    wigStyle.BGCOLOR = 'blue'
                    wigStyle.HEIGHT = 8;
                    wigStyle.BUMP = true;
                    wigStyle.LABEL = true;
                    wigStyle.ZINDEX = 20;
                    thisTier.stylesheet.pushStyle({type: 'bigwig'}, null, wigStyle);

                    wigStyle.glyph = 'BOX';
                    wigStyle.FGCOLOR = 'black';
                    wigStyle.BGCOLOR = 'red'
                    wigStyle.HEIGHT = 10;
                    wigStyle.BUMP = true;
                    wigStyle.LABEL = true;
                    wigStyle.ZINDEX = 20;
                    thisTier.stylesheet.pushStyle({type: 'bb-translation'}, null, wigStyle);
                    
                    var tsStyle = new DASStyle();
                    tsStyle.glyph = 'BOX';
                    tsStyle.FGCOLOR = 'black';
                    tsStyle.BGCOLOR = 'white';
                    wigStyle.HEIGHT = 10;
                    tsStyle.ZINDEX = 10;
                    tsStyle.BUMP = true;
                    thisTier.stylesheet.pushStyle({type: 'bb-transcript'}, null, tsStyle);

                    var densStyle = new DASStyle();
                    densStyle.glyph = 'HISTOGRAM';
                    densStyle.COLOR1 = 'white';
                    densStyle.COLOR2 = 'black';
                    densStyle.HEIGHT=30;
                    thisTier.stylesheet.pushStyle({type: 'density'}, null, densStyle);
                } else {
                    thisTier.stylesheet = new DASStylesheet();
                    var wigStyle = new DASStyle();
                    wigStyle.glyph = 'HISTOGRAM';
                    wigStyle.COLOR1 = 'white';
                    wigStyle.COLOR2 = 'black';
                    wigStyle.HEIGHT=30;
                    thisTier.stylesheet.pushStyle({type: 'default'}, null, wigStyle);
                }
                thisTier.browser.refreshTier(thisTier);
            });
        }
    } else if (this.dasSource.tier_type == 'sequence') {
        fs = new DASSequenceSource(this.dasSource);
    } else {
        fs = new DASFeatureSource(this.dasSource);
    }
    
    if (this.dasSource.mapping) {
        fs = new MappedFeatureSource(fs, this.browser.chains[this.dasSource.mapping]);
    }

    this.featureSource = fs;
    this.setBackground();
}

DasTier.prototype.toString = function() {
    return this.id;
}

DasTier.prototype.init = function() {
    var tier = this;

    if (tier.dasSource.uri || tier.dasSource.stylesheet_uri) {
        tier.status = 'Fetching stylesheet';
        this.dasSource.stylesheet(function(stylesheet) {
	    tier.stylesheet = stylesheet;
//            dlog('got a stylesheet');
            tier.browser.refreshTier(tier);
        }, function() {
	    // tier.error = 'No stylesheet';
            tier.stylesheet = new DASStylesheet();
            var defStyle = new DASStyle();
            defStyle.glyph = 'BOX';
            defStyle.BGCOLOR = 'blue';
            defStyle.FGCOLOR = 'black';
            tier.stylesheet.pushStyle({type: 'default'}, null, defStyle);
            tier.browser.refreshTier(tier);
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
    var fetchTypes = [];
    var inclusive = false;
    var ssScale = zoomForScale(this.browser.scale);

    if (this.stylesheet) {
        // dlog('ss = ' + miniJSONify(this.stylesheet));
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
    } else {
        // inclusive = true;
        return undefined;
    }

    if (inclusive) {
        return null;
    } else {
        return fetchTypes;
    }
}

DasTier.prototype.setStatus = function(status) {
    dlog(status);
}

DasTier.prototype.viewFeatures = function(chr, min, max, scale, features) {
//    dlog('viewFeatures(' + chr + ',' + min + ',' + max + ')');

    this.currentFeatures = features;
    this.knownStart = min; this.knownEnd = max;
    this.status = null; this.error = null;

    this.setBackground();
    this.draw();
}

DasTier.prototype.updateStatus = function(status) {
    if (status) {
        this.currentFeatures = [];
        this.error = status;
    }
    this.setBackground();
    this.draw();
}

DasTier.prototype.draw = function() {
    var features = this.currentFeatures;
    if (features && features.length > 0 && features[0].sequence) {
        drawSeqTier(this, features[0].sequence); 
    } else {
        drawFeatureTier(this);
    }
    this.originHaxx = 0;
    this.browser.arrangeTiers();
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


DasTier.prototype.setBackground = function() {            
//    if (this.knownStart) {

    var ks = this.knownStart || -100000000;
    var ke = this.knownEnd || -100000001;
        this.background.setAttribute('x', (ks - this.browser.origin) * this.browser.scale);
        this.background.setAttribute('width', (ke - this.knownStart + 1) * this.browser.scale);
//    }    
}
