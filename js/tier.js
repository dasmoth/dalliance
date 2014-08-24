/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// tier.js: (try) to encapsulate the functionality of a browser tier.
//

"use strict";

if (typeof(require) !== 'undefined') {
    var utils = require('./utils');
    var makeElement = utils.makeElement;
    var shallowCopy = utils.shallowCopy;
    var pushnew = utils.pushnew;

    var das = require('./das');
    var DASStylesheet = das.DASStylesheet;
    var DASStyle = das.DASStyle;
}

var __tier_idSeed = 0;

function DasTier(browser, source, config, background)
{
    this.config = config || {};
    this.id = 'tier' + (++__tier_idSeed);
    this.browser = browser;
    this.dasSource = shallowCopy(source);
    this.background = background;

    this.viewport = makeElement('canvas', null, 
                                {width: '' + ((this.browser.featurePanelWidth|0) + 2000), 
                                 height: "30",
                                 className: 'viewport_12_5'},
                                {position: 'inline-block',
                                 margin: '0px', border: '0px'});
    this.viewportHolder = makeElement('div', this.viewport, {className: 'viewport-holder_12_5'}, 
                                      {background: background,
                                       position: 'absolute',
                                       padding: '0px', margin: '0px',
                                       border: '0px',
                                       left: '-1000px',
                                       minHeight: '200px'});
    this.overlay = makeElement('canvas', null,
         {width: + ((this.browser.featurePanelWidth|0)), 
          height: "30",
          className: 'viewport-overlay'});

    this.notifier = makeElement('div', '', {className: 'notifier'});
    this.notifierHolder = makeElement('div', this.notifier, {className: 'notifier-holder'});
    this.quantOverlay = makeElement(
        'canvas', null, 
        {width: '50', height: "56",
         className: 'quant-overlay'});

    this.removeButton = makeElement('i', null, {className: 'fa fa-times'});
    this.bumpButton = makeElement('i', null, {className: 'fa fa-plus-circle'});
    this.loaderButton = browser.makeLoader(16);
    this.loaderButton.style.display = 'none';
    this.infoElement = makeElement('div', this.dasSource.desc, {className: 'track-label-info'});
    this.nameButton = makeElement('div', [], {className: 'tier-tab'});
    this.nameButton.appendChild(this.removeButton);
    if (source.pennant) {
        this.nameButton.appendChild(makeElement('img', null, {src: source.pennant, width: '16', height: '16'}))
    }
    this.nameElement = makeElement('span', source.name);
    this.nameButton.appendChild(makeElement('span', [this.nameElement, this.infoElement], {className: 'track-name-holder'}));
    this.nameButton.appendChild(this.bumpButton);
    this.nameButton.appendChild(this.loaderButton);
    
    this.label = makeElement('span',
       [this.nameButton],
       {className: 'btn-group track-label'});


    this.row = makeElement('div', [this.viewportHolder,
                                   this.overlay, 
                                   this.quantOverlay],
                            {className: 'tier'});

    if (!background) {
        this.row.style.background = 'none';
    }

    if (!browser.noDefaultLabels)
        this.row.appendChild(this.label);
    this.row.appendChild(this.notifierHolder);
    
    this.layoutHeight = 25;
    this.bumped = true;
    this.styleIdSeed = 0;
    if (source.quantLeapThreshold) {
        this.quantLeapThreshold = source.quantLeapThreshold;
    }
    if (this.dasSource.collapseSuperGroups) {
        this.bumped = false;
    }
    this.layoutWasDone = false;

    if (source.featureInfoPlugin) {
        this.addFeatureInfoPlugin(source.featureInfoPlugin);
    }

    this.initSources();

    var thisB = this;
    if (this.featureSource && this.featureSource.getDefaultFIPs && !source.noSourceFeatureInfo) {
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
    this.featuresLoadedListeners = [];
}

DasTier.prototype.setBackground = function(b) {
    this.background = b;
    this.viewportHolder.style.background = b;
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
        tier.status = 'Fetching stylesheet';
        tier.fetchStylesheet(function(ss, err) {
            if (err || !ss) {
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
    this.baseStylesheet = shallowCopy(ss);
    for (var si = 0; si < this.baseStylesheet.styles.length; ++si) {
        var sh = this.baseStylesheet.styles[si] = shallowCopy(this.baseStylesheet.styles[si]);
        sh._methodRE = sh._labelRE = sh._typeRE = null;
        sh.style = shallowCopy(sh.style);
        sh.style.id = 'style' + (++this.styleIdSeed);
    }
    this._updateFromConfig();
}

DasTier.prototype.getSource = function() {
    return this.featureSource;
}

DasTier.prototype.getDesiredTypes = function(scale) {
    var fetchTypes = [];
    var inclusive = false;
    var ssScale = this.browser.zoomForCurrentScale();

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
    if (this.sequenceSource && scale < 5) {
        return true;
    } else if ((this.dasSource.bamURI || this.dasSource.bamBlob || this.dasSource.bwgURI || this.dasSource.bwgBlob)
                 && scale < 20) {
        return true
    }
    return false;
}

DasTier.prototype.viewFeatures = function(chr, coverage, scale, features, sequence) {
    this.currentFeatures = features;
    this.currentSequence = sequence;
    this.notifyFeaturesLoaded();
    
    this.knownChr = chr;
    this.knownCoverage = coverage;

    if (this.status) {
        this.status = null;
        this._notifierToStatus();
    }

    this.draw();
}

DasTier.prototype.draw = function() {
    var features = this.currentFeatures;
    var seq = this.currentSequence;
    if (this.sequenceSource) {
        drawSeqTier(this, seq); 
    } else {
        drawFeatureTier(this);
    }
    this.paint();
    this.originHaxx = 0;
    this.browser.arrangeTiers();
}

DasTier.prototype.findNextFeature = function(chr, pos, dir, fedge, callback) {
    if (this.quantLeapThreshold) {
        var width = this.browser.viewEnd - this.browser.viewStart + 1;
        pos = (pos +  ((width * dir) / 2))|0
        this.featureSource.quantFindNextFeature(chr, pos, dir, this.quantLeapThreshold, callback);
    } else {
        if (this.knownCoverage && pos >= this.knownCoverage.min() && pos <= this.knownCoverage.max()) {
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
                    return callback(bestFeature);
                }
                if (dir < 0) {
                    pos = this.browser.knownSpace.min;
                } else {
                    pos = this.browser.knownSpace.max;
                }
            }
        }

        this.trySourceFNF(chr, pos, dir, callback);
    }
}

DasTier.prototype.trySourceFNF = function(chr, pos, dir, callback) {
    var self = this;
    this.featureSource.findNextFeature(chr, pos, dir, function(feature) {
        if (!feature)
            callback(feature);

        var ss = self.browser.getSequenceSource();
        if (!ss) // We're probably in trouble, but return anyway.
            callback(feature)

        ss.getSeqInfo(feature.segment, function(si) {
            if (si)
                callback(feature);
            else
                self.trySourceFNF(feature.segment, dir > 0 ? 10000000000 : 0, dir, callback);
        });
    });
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
    this.currentHeight = Math.max(Math.max(this.layoutHeight, this.label.clientHeight + 2), this.browser.minTierHeight);
    this.row.style.height = '' + this.currentHeight + 'px';
    this.browser.updateHeight();
 }


DasTier.prototype.drawOverlay = function() {
    var t = this;
    var b = this.browser;
    var retina = b.retina && window.devicePixelRatio > 1;
    
    t.overlay.height = t.viewport.height;
    t.overlay.width = retina ? b.featurePanelWidth * 2 : b.featurePanelWidth;

    var g = t.overlay.getContext('2d');
    if (retina) {
        g.scale(2, 2);
    }
    
    var origin = b.viewStart;
    var visStart = b.viewStart;
    var visEnd = b.viewEnd;

    if (this.overlayLabelCanvas) {
        var offset = ((this.glyphCacheOrigin - this.browser.viewStart)*this.browser.scale);
        g.save();
        g.translate(offset, 0);
        this.overlayLabelCanvas.draw(g, -offset, b.featurePanelWidth-offset);
        g.restore();
    }

    for (var hi = 0; hi < b.highlights.length; ++hi) {
        var h = b.highlights[hi];
        if (((h.chr === b.chr) || (h.chr === ('chr' + b.chr))) && h.min < visEnd && h.max > visStart) {
            g.globalAlpha = b.defaultHighlightAlpha;
            g.fillStyle = b.defaultHighlightFill;
            g.fillRect((h.min - origin) * b.scale,
                       0,
                       (h.max - h.min) * b.scale,
                       t.overlay.height);
        }
    } 

    // t.oorigin = b.viewStart;
    t.overlay.style.width = b.featurePanelWidth;
    t.overlay.style.height = t.viewport.style.height;
    t.overlay.style.left = '0px';
}


DasTier.prototype.updateStatus = function(status) {
    if (status) {
        this.status = status;
        this._notifierToStatus();
    } else {
        if (this.status) {
            this.status = null
            this._notifierToStatus();
        }
    }
}

DasTier.prototype.notify = function(message, timeout) {
    if (typeof(timeout) !== 'number')
        timeout = 2000;

    if (this.notifierFadeTimeout) {
        clearTimeout(this.notifierFadeTimeout);
        this.notifierFadeTimeout = null;
    }

    if (message) {
        this._notifierOn(message);
        if (timeout > 0) {
            var thisB = this;
            this.notifierFadeTimeout = setTimeout(function() {
                thisB._notifierToStatus();
            }, timeout);
        }
    } else {
        this._notifierToStatus();
    }
}

DasTier.prototype._notifierOn = function(message) {
    this.notifier.textContent = message;
    this.notifier.style.opacity = 0.8;
}

DasTier.prototype._notifierOff = function() {
    this.notifier.style.opacity = 0;
}

DasTier.prototype._notifierToStatus = function() {
    if (this.status) {
        this._notifierOn(this.status)
    } else {
        this._notifierOff();
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
    var needsReorder = false;

    if (typeof this.config.name === 'string')
        this.nameElement.textContent = this.config.name;
    else
        this.nameElement.textContent = this.dasSource.name;

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
    
    // Possible FIXME -- are there cases where style IDs need to be reassigned?
    var stylesheet = this.config.stylesheet || this.baseStylesheet;
    if (this.stylesheet !== stylesheet) {
        this.stylesheet = stylesheet;
        needsRefresh = true;
    }

    var wantedPinned = this.config.pinned !== undefined ? this.config.pinned : this.dasSource.pinned;
    if (wantedPinned !== this.pinned) {
        this.pinned = wantedPinned;
        needsReorder = true;
    }

    var wantedSubtierMax = (typeof(this.config.subtierMax === 'number') ? 
        this.config.subtierMax : this.dasSource.subtierMax || this.browser.defaultSubtierMax);
    if (wantedSubtierMax != this.subtierMax) {
        this.subtierMax = wantedSubtierMax;
        needsRefresh = true;
    }

    var wantedBumped = this.config.bumped;
    if (wantedBumped !== this.bumped) {
        this.bumped = wantedBumped;
        needsRefresh = true;
        this.updateLabel();
    }

    if (needsRefresh)
        this.scheduleRedraw();

    if (needsReorder)
        this.browser.reorderTiers();
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

DasTier.prototype.addFeaturesLoadedListener = function(handler) {
    this.featuresLoadedListeners.push(handler);
}

DasTier.prototype.notifyFeaturesLoaded = function() {
    for (var li = 0; li < this.featuresLoadedListeners.length; ++li) {
        try {
            this.featuresLoadedListeners[li].call(this);
        } catch (e) {
            console.log(e);
        }
    }
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        DasTier: DasTier
    };

    // Imported for side effects
    var fd = require('./feature-draw');
    var drawFeatureTier = fd.drawFeatureTier;
    var sd = require('./sequence-draw');
    var drawSeqTier = sd.drawSeqTier;
    // require('./sourceadapters');  /* Done in cbrowser instead */
}