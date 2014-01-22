/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// tier.js: (try) to encapsulate the functionality of a browser tier.
//

var __tier_idSeed = 0;

function DasTier(browser, source, viewport, holder, overlay, placard, placardContent, notifier, config)
{
    this.config = config || {};
    this.id = 'tier' + (++__tier_idSeed);
    this.browser = browser;
    this.dasSource = new DASSource(source);
    this.viewport = viewport;
    this.holder = holder;
    this.overlay = overlay;
    this.placard = placard;
    this.placardContent = placardContent;
    this.req = null;
    this.layoutHeight = 25;
    this.bumped = true;
    this.notifier = notifier;
    this.styleIdSeed = 0;
    if (source.quantLeapThreshold) {
        this.quantLeapThreshold = source.quantLeapThreshold;
    }
    if (this.dasSource.collapseSuperGroups) {
        this.bumped = false;
    }
    this.y = 0;
    this.layoutWasDone = false;

    if (source.featureInfoPlugin) {
        this.addFeatureInfoPlugin(source.featureInfoPlugin);
    }

    this.initSources();

    var thisB = this;
    if (this.featureSource && this.featureSource.getDefaultFIPs) {
        this.featureSource.getDefaultFIPs(function(fip) {
            if (fip)
                thisB.addFeatureInfoPlugin(fip);
        });
    }

    if (this.featureSource && this.featureSource.addReadinessListener) {
        this.featureSource.addReadinessListener(function(ready) {
            thisB.notify(ready, -1);
        });
    }

    this.listeners = [];
}

DasTier.prototype.toString = function() {
    return this.id;
}

DasTier.prototype.addFeatureInfoPlugin = function(p) {
    if (!this.featureInfoPlugins) 
        this.featureInfoPlugins = [];
    this.featureInfoPlugins.push(p);
}

DasTier.prototype.init = function() {
    var tier = this;

    if (tier.dasSource.style) {
        this.setStylesheet({styles: tier.dasSource.style});
        this.browser.refreshTier(this);
    } else {
        var ssSource;
        if (tier.dasSource.stylesheet_uri) {
            ssSource = new DASFeatureSource(tier.dasSource);
        } else {
            ssSource = tier.getSource();
        }
        tier.status = 'Fetching stylesheet';
        
        ssSource.getStyleSheet(function(ss, err) {
            if (err) {
                tier.error = 'No stylesheet';
                var ss = new DASStylesheet();
                var defStyle = new DASStyle();
                defStyle.glyph = 'BOX';
                defStyle.BGCOLOR = 'blue';
                defStyle.FGCOLOR = 'black';
                ss.pushStyle({type: 'default'}, null, defStyle);
                tier.setStylesheet(ss);
                tier.browser.refreshTier(tier);
            } else {
                tier.setStylesheet(ss);
                if (ss.geneHint) {
                    tier.dasSource.collapseSuperGroups = true;
                    tier.bumped = false;
                    tier.updateLabel();
                }
                tier.browser.refreshTier(tier);
            }
        });
    }
}

DasTier.prototype.setStylesheet = function(ss) {
    this.stylesheet = shallowCopy(ss);
    for (var si = 0; si < this.stylesheet.styles.length; ++si) {
        var sh = this.stylesheet.styles[si] = shallowCopy(this.stylesheet.styles[si]);
        sh._methodRE = sh._labelRE = sh._typeRE = null;
        sh.style = shallowCopy(sh.style);
        sh.style.id = 'style' + (++this.styleIdSeed);
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

DasTier.prototype.viewFeatures = function(chr, min, max, scale, features, sequence) {
    this.currentFeatures = features;
    this.currentSequence = sequence;
    
    this.knownChr = chr;
    this.knownStart = min; this.knownEnd = max;
    this.status = null; this.error = null;

    this.draw();
}

DasTier.prototype.updateStatus = function(status) {
    if (status) {
        this.currentFeatures = [];
        this.currentSequence = null;
        this.error = status;
        this.placardContent.innerText = status;
        this.placard.style.display = 'block';
        this.holder.style.display = 'none';
    } else {
        this.placard.style.display = 'none';
        this.holder.style.display = 'block';
    }
    this.updateHeight();
}

DasTier.prototype.draw = function() {
    var features = this.currentFeatures;
    var seq = this.currentSequence;
    if (this.dasSource.tier_type === 'sequence') {
        drawSeqTier(this, seq); 
    } else {
        drawFeatureTier(this);
    }
    this.paint();
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


DasTier.prototype.findNextFeature = function(chr, pos, dir, fedge, callback) {
    if (this.quantLeapThreshold) {
        var width = this.browser.viewEnd - this.browser.viewStart + 1;
        pos = (pos +  ((width * dir) / 2))|0
        this.featureSource.quantFindNextFeature(chr, pos, dir, this.quantLeapThreshold, callback);
    } else {
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

        this.featureSource.findNextFeature(chr, pos, dir, callback);
    }
}


DasTier.prototype.updateLabel = function() {
   this.bumpButton.className = this.bumped ? 'fa fa-minus-circle' : 'fa fa-plus-circle';
   if (this.dasSource.collapseSuperGroups) {
        this.bumpButton.style.display = 'inline-block';
    } else {
        this.bumpButton.style.display = 'none';
    }
}

DasTier.prototype.updateHeight = function() {
    this.currentHeight = Math.max(this.layoutHeight, Math.max(this.holder.clientHeight, this.label.clientHeight + 4));
    if (this.placard.style.display !== 'none') {
        // Hard-coded because we don't know exactly when the CSS will have loaded.
        this.currentHeight = Math.max(this.currentHeight, /* this.placard.clientHeight + 2 */ 52);
    }
    this.row.style.height = '' + this.currentHeight + 'px';
    this.browser.updateHeight();
 }

DasTier.prototype.drawOverlay = function() {
    var t = this;
    var b = this.browser;
    var g = t.overlay.getContext('2d');
    
    t.overlay.height = t.viewport.height;
    // g.clearRect(0, 0, t.overlay.width, t.overlay.height);
    
    var origin = b.viewStart - (1000/b.scale);
    var visStart = b.viewStart - (1000/b.scale);
    var visEnd = b.viewEnd + (1000/b.scale);


    for (var hi = 0; hi < b.highlights.length; ++hi) {
        var h = b.highlights[hi];
        if (h.chr == b.chr && h.min < visEnd && h.max > visStart) {
            g.globalAlpha = 0.3;
            g.fillStyle = 'red';
            g.fillRect((h.min - origin) * b.scale,
                       0,
                       (h.max - h.min) * b.scale,
                       t.overlay.height);
        }
    }

    t.oorigin = b.viewStart;
    t.overlay.style.left = '-1000px'
}

DasTier.prototype.notify = function(message, timeout) {
    timeout = timeout || 2000;

    if (this.notifierFadeTimeout) {
        clearTimeout(this.notifierFadeTimeout);
        this.notifierFadeTimeout = null;
    }

    if (message) {
        this.notifier.textContent = message;
        this.notifier.style.opacity = 0.8;
    
        if (timeout > 0) {
            var thisB = this;
            this.notifierFadeTimeout = setTimeout(function() {
                thisB.notifier.style.opacity = 0;
                thisB.notifierFadeTimeout = null;
            }, timeout);
        }
    } else {
        this.notifier.style.opacity = 0;
    }

}

DasTier.prototype.setConfig = function(config) {
    this.config = config || {};
    this._updateFromConfig();
    this.notifyTierListeners();
}

DasTier.prototype.mergeConfig = function(newConfig) {
    for (var k in newConfig) {
        this.config[k] = newConfig[k];
    }
    this._updateFromConfig();
    this.notifyTierListeners();
}

DasTier.prototype._updateFromConfig = function() {
    var needsRefresh = false;

    this.nameElement.innerText = this.config.name || this.dasSource.name;

    var wantedHeight = this.config.height || this.dasSource.forceHeight;
    if (wantedHeight != this.forceHeight) {
        this.forceHeight = wantedHeight;
        needsRefresh = true;
    }

    if (this.forceMinDynamic != this.config.forceMinDynamic) {
        this.forceMinDynamic = this.config.forceMinDynamic;
        needsRefresh = true;
    }

    var forceMin = this.config.forceMin != undefined ? this.config.forceMin : this.dasSource.forceMin;
    if (this.forceMin != forceMin) {
        this.forceMin = forceMin;
        needsRefresh = true;
    }

    if (this.forceMaxDynamic != this.config.forceMaxDynamic) {
        this.forceMaxDynamic = this.config.forceMaxDynamic;
        needsRefresh = true;
    }
    
    var forceMax = this.config.forceMax != undefined ? this.config.forceMax : this.dasSource.forceMax;
    if (this.forceMax != forceMax) {
        this.forceMax = forceMax;
        needsRefresh = true;
    }

    var quantLeapThreshold = null;
    if (this.config.quantLeapThreshold !== undefined)
        quantLeapThreshold = this.config.quantLeapThreshold;
    else if (this.dasSource.quantLeapThreshold !== undefined)
        quantLeapThreshold = this.dasSource.quantLeapThreshold;
    if (quantLeapThreshold != this.quantLeapThreshold) {
        this.quantLeapThreshold = quantLeapThreshold;
        needsRefresh = true;
    }
    

    if (needsRefresh)
        this.scheduleRedraw();
}

DasTier.prototype.scheduleRedraw = function() {
    if (!this.currentFeatures)
        return;
    
    var tier = this;

    if (!this.redrawTimeout) {
        this.redrawTimeout = setTimeout(function() {
            tier.draw();
            tier.redrawTimeout = null;
        }, 10);
    }
}


DasTier.prototype.addTierListener = function(l) {
    this.listeners.push(l);
}

DasTier.prototype.notifyTierListeners = function(change) {
    for (var li = 0; li < this.listeners.length; ++li) {
        try {
            this.listeners[li](change);
        } catch (e) {
            console.log(e);
        }
    }
    this.browser.notifyTier();
}