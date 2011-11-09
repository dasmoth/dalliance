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
    this.layoutHeight = 25;
    this.bumped = true; 
    if (this.dasSource.collapseSuperGroups) {
        this.bumped = false;
    }
    this.y = 0;
    this.layoutWasDone = false;

    var fs, ss;
    if (this.dasSource.bwgURI || this.dasSource.bwgBlob) {
        fs = new BWGFeatureSource(this.dasSource, {
            credentials: this.dasSource.credentials,
            preflight: this.dasSource.preflight,
            clientBin: this.dasSource.clientBin,
            forceReduction: this.dasSource.forceReduction,
            link: this.dasSource.link
        });
        this.sourceFindNextFeature = function(chr, pos, dir, callback) {
            fs.bwgHolder.res.getUnzoomedView().getFirstAdjacent(chr, pos, dir, function(res) {
                    // dlog('got a result');
                    if (res.length > 0 && res[0] != null) {
                        callback(res[0]);
                    }
                });
        };

        if (!this.dasSource.uri && !this.dasSource.stylesheet_uri) {
            fs.bwgHolder.await(function(bwg) {
                if (!bwg) {
                    // Dummy version so that an error placard gets shown.
                    thisTier.stylesheet = new DASStylesheet();
                    return  thisTier.browser.refreshTier(thisTier);
                }

                if (thisTier.dasSource.collapseSuperGroups === undefined) {
                    if (bwg.definedFieldCount == 12 && bwg.fieldCount >= 14) {
                        thisTier.dasSource.collapseSuperGroups = true;
                        thisTier.bumped = false;
                        thisTier.isLabelValid = false;
                    }
                }

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
                    wigStyle.ZINDEX = 20;
                    thisTier.stylesheet.pushStyle({type: 'bb-translation'}, null, wigStyle);
                    
                    var tsStyle = new DASStyle();
                    tsStyle.glyph = 'BOX';
                    tsStyle.FGCOLOR = 'black';
                    tsStyle.BGCOLOR = 'white';
                    tsStyle.HEIGHT = 10;
                    tsStyle.ZINDEX = 10;
                    tsStyle.BUMP = true;
                    tsStyle.LABEL = true;
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
    } else if (this.dasSource.bamURI || this.dasSource.bamBlob) {
        fs = new BAMFeatureSource(this.dasSource, {
            credentials: this.dasSource.credentials,
            preflight: this.dasSource.preflight
        });

        if (!this.dasSource.uri && !this.dasSource.stylesheet_uri) {
            fs.bamHolder.await(function(bam) {
                thisTier.stylesheet = new DASStylesheet();
                
                var densStyle = new DASStyle();
                densStyle.glyph = 'HISTOGRAM';
                densStyle.COLOR1 = 'black';
                densStyle.COLOR2 = 'red';
                densStyle.HEIGHT=30;
                thisTier.stylesheet.pushStyle({type: 'density'}, 'low', densStyle);
                thisTier.stylesheet.pushStyle({type: 'density'}, 'medium', densStyle);

                var wigStyle = new DASStyle();
                wigStyle.glyph = 'BOX';
                wigStyle.FGCOLOR = 'black';
                wigStyle.BGCOLOR = 'blue'
                wigStyle.HEIGHT = 8;
                wigStyle.BUMP = true;
                wigStyle.LABEL = false;
                wigStyle.ZINDEX = 20;
                thisTier.stylesheet.pushStyle({type: 'bam'}, 'high', wigStyle);
//                thisTier.stylesheet.pushStyle({type: 'bam'}, 'medium', wigStyle);

                thisTier.browser.refreshTier(thisTier);
            });
        }
    } else if (this.dasSource.tier_type == 'sequence') {
        if (this.dasSource.twoBitURI) {
            ss = new TwoBitSequenceSource(this.dasSource);
        } else {
            ss = new DASSequenceSource(this.dasSource);
        }
    } else {
        fs = new DASFeatureSource(this.dasSource);
        var dasAdjLock = false;
        if (this.dasSource.capabilities && arrayIndexOf(this.dasSource.capabilities, 'das1:adjacent-feature') >= 0) {
            this.sourceFindNextFeature = function(chr, pos, dir, callback) {
                if (dasAdjLock) {
                    return dlog('Already looking for a next feature, be patient!');
                }
                dasAdjLock = true;
                var fops = {
                    adjacent: chr + ':' + (pos|0) + ':' + (dir > 0 ? 'F' : 'B')
                }
                var types = thisTier.getDesiredTypes(thisTier.browser.scale);
                if (types) {
                    fops.types = types;
                }
                thisTier.dasSource.features(null, fops, function(res) {
                    dasAdjLock = false;
                    if (res.length > 0 && res[0] != null) {
                        dlog('DAS adjacent seems to be working...');
                        callback(res[0]);
                    }
                });
            };
        }
    }
    
    if (this.dasSource.mapping) {
        fs = new MappedFeatureSource(fs, this.browser.chains[this.dasSource.mapping]);
    }

    this.featureSource = fs;
    this.sequenceSource = ss;
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
    } else if (tier.dasSource.twoBitURI) {
        tier.stylesheet = new DASStylesheet();
        var defStyle = new DASStyle();
        defStyle.glyph = 'BOX';
        defStyle.BGCOLOR = 'blue';
        defStyle.FGCOLOR = 'black';
        tier.stylesheet.pushStyle({type: 'default'}, null, defStyle);
        tier.browser.refreshTier(tier);
    };
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

DasTier.prototype.needsSequence = function(scale ) {
    if (this.dasSource.tier_type === 'sequence' && scale < 5) {
        return true;
    } else if ((this.dasSource.bamURI || this.dasSource.bamBlob) && scale < 20) {
        return true
    }
    return false;
}

DasTier.prototype.setStatus = function(status) {
    dlog(status);
}

DasTier.prototype.viewFeatures = function(chr, min, max, scale, features, sequence) {
    this.currentFeatures = features;
    this.currentSequence = sequence;
    
    this.knownChr = chr;
    this.knownStart = min; this.knownEnd = max;
    this.status = null; this.error = null;

    this.setBackground();
    this.draw();
}

DasTier.prototype.updateStatus = function(status) {
    if (status) {
        this.currentFeatures = [];
        this.currentSequence = null;
        this.error = status;
    }
    this.setBackground();
    this.draw();
}

DasTier.prototype.draw = function() {
    var features = this.currentFeatures;
    var seq = this.currentSequence;
    if (this.dasSource.tier_type === 'sequence') {
        drawSeqTier(this, seq); 
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

DasTier.prototype.sourceFindNextFeature = function(chr, pos, dir, callback) {
    callback(null);
}

DasTier.prototype.findNextFeature = function(chr, pos, dir, fedge, callback) {
    if (this.knownStart && pos >= this.knownStart && pos <= this.knownEnd) {
        if (this.currentFeatures) {
            var bestFeature = null;
            for (var fi = 0; fi < this.currentFeatures.length; ++fi) {
                var f = this.currentFeatures[fi];
                if (!f.min || !f.max) {
                    continue;
                }
                if (f.parents && f.parents.length > 0) {
                    continue;
                }
                if (dir < 0) {
                    if (fedge == 1 && f.max >= pos && f.min < pos) {
                        if (!bestFeature || f.min > bestFeature.min ||
                            (f.min == bestFeature.min && f.max < bestFeature.max)) {
                            bestFeature = f;
                        }
                    } else if (f.max < pos) {
                        if (!bestFeature || f.max > bestFeature.max || 
                            (f.max == bestFeature.max && f.min < bestFeature.min) ||
                            (f.min == bestFeature.mmin && bestFeature.max >= pos)) {
                            bestFeature = f;
                        } 
                    }
                } else {
                    if (fedge == 1 && f.min <= pos && f.max > pos) {
                        if (!bestFeature || f.max < bestFeature.max ||
                            (f.max == bestFeature.max && f.min > bestFeature.min)) {
                            bestFeature = f;
                        }
                    } else if (f.min > pos) {
                        if (!bestFeature || f.min < bestFeature.min ||
                            (f.min == bestFeature.min && f.max > bestFeature.max) ||
                            (f.max == bestFeature.max && bestFeature.min <= pos)) {
                            bestFeature = f;
                        }
                    }
                }
            }
            if (bestFeature) {
//                dlog('bestFeature = ' + miniJSONify(bestFeature));
                return callback(bestFeature);
            }
            if (dir < 0) {
                pos = this.knownStart;
            } else {
                pos = this.knownEnd;
            }
        }
    }
//    dlog('delegating to source: ' + pos);
    this.sourceFindNextFeature(chr, pos, dir, callback);
}
