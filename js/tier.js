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

/*
    if (this.dasSource.tier_type == 'sequence') {
	this.refreshTier = refreshTier_sequence;
    } else {
	this.refreshTier = refreshTier_features;
    } */

    this.layoutWasDone = false;

    var fs;
    if (this.dasSource.bwgURI) {
        fs = new BWGFeatureSource(this.dasSource.bwgURI);

        if (!this.dasSource.uri && !this.dasSource.stylesheet_uri) {
            fs.bwgHolder.await(function(bwg) {
                if (bwg.type == 'bigbed') {
                    thisTier.stylesheet = new DASStylesheet();
                    
                    var wigStyle = new DASStyle();
                    wigStyle.glyph = 'BOX';
                    wigStyle.FGCOLOR = 'black';
                    wigStyle.BGCOLOR = 'red'
                    wigStyle.HEIGHT = 12;
                    wigStyle.BUMP = true;
                    wigStyle.LABEL = true;
                    wigStyle.ZINDEX = 20;
                    thisTier.stylesheet.pushStyle({type: 'default'}, null, wigStyle);
                    
                    var tsStyle = new DASStyle();
                    tsStyle.glyph = 'BOX';
                    tsStyle.FGCOLOR = 'black';
                    tsStyle.BGCOLOR = 'white';
                    tsStyle.ZINDEX = 10;
                    tsStyle.BUMP = true;
                    thisTier.stylesheet.pushStyle({type: 'bb-transcript'}, null, tsStyle);
                } else {
                    thisTier.stylesheet = new DASStylesheet();
                    var wigStyle = new DASStyle();
                    wigStyle.glyph = 'HISTOGRAM';
                    wigStyle.COLOR1 = 'white';
                    wigStyle.COLOR2 = 'black';
                    thisTier.stylesheet.pushStyle('default', null, wigStyle);
                }
            });
        }
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

 

    if (tier.dasSource.uri || tier.dasSource.stylesheet_uri) {
        tier.status = 'Fetching stylesheet';
        this.dasSource.stylesheet(function(stylesheet) {
	    tier.stylesheet = stylesheet;
        }, function() {
	    // tier.error = 'No stylesheet';
            tier.stylesheet = new DASStylesheet();
            var defStyle = new DASStyle();
            defStyle.glyph = 'BOX';
            defStyle.BGCOLOR = 'blue';
            defStyle.FGCOLOR = 'black';
            tier.stylesheet.pushStyle('default', null, defStyle);
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
