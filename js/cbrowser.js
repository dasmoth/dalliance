/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// cbrowser.js: canvas browser container
//

"use strict";

if (typeof(require) !== 'undefined') {
    var utils = require('./utils');
    var Observed = utils.Observed;
    var Awaited = utils.Awaited;
    var makeElement = utils.makeElement;
    var removeChildren = utils.removeChildren;
    var miniJSONify = utils.miniJSONify;
    var shallowCopy = utils.shallowCopy;

    var tier = require('./tier');
    var DasTier = tier.DasTier;

    var sha1 = require('./sha1');
    var hex_sha1 = sha1.hex_sha1;

    var thub = require('./thub');
    var connectTrackHub = thub.connectTrackHub;

    var VERSION = require('./version');

    var nf = require('./numformats');
    var formatQuantLabel = nf.formatQuantLabel;

    var Chainset = require('./chainset').Chainset;

    var Promise = require('es6-promise').Promise;
}

function Region(chr, min, max) {
    this.min = min;
    this.max = max;
    this.chr = chr;
}

function Browser(opts) {
    if (!opts) {
        opts = {};
    }

    this.prefix = '//www.biodalliance.org/release-0.12/';

    this.sources = [];
    this.tiers = [];

    this.featureListeners = [];
    this.featureHoverListeners = [];
    this.viewListeners = [];
    this.regionSelectListeners = [];
    this.tierListeners = [];
    this.tierSelectionListeners = [];
    this.tierSelectionWrapListeners = [];

    this.cookieKey = 'browser';
    this.registry = 'http://www.dasregistry.org/das/sources';
    this.chains = {};

    this.pageName = 'svgHolder'
    this.maxExtra = 2.5;
    this.minExtra = 0.5;
    this.zoomFactor = 1.0;
    this.zoomMin = 10.0;
    // this.zoomMax;       // Allow configuration for compatibility, but otherwise clobber.
    this.origin = 0;
    this.targetQuantRes = 1.0;
    this.featurePanelWidth = 750;
    this.zoomBase = 100;
    this.zoomExpt = 30.0; // Back to being fixed....
    this.zoomSliderValue = 100;
    this.entryPoints = null;
    this.currentSeqMax = -1; // init once EPs are fetched.

    this.highlights = [];
    this.selectedTiers = [1];

    this.maxViewWidth = 500000;
    this.defaultSubtierMax = 100;

    // Options.
    
    this.reverseScrolling = false;
    this.rulerLocation = 'center';
    this.defaultHighlightFill = 'red';
    this.defaultHighlightAlpha = 0.3;
    this.exportHighlights = true;
    this.exportRuler = true;

    // Visual config.

    // this.tierBackgroundColors = ["rgb(245,245,245)", "rgb(230,230,250)" /* 'white' */];
    this.tierBackgroundColors = ["rgb(245,245,245)", 'white'];
    this.minTierHeight = 20;
    this.noDefaultLabels = false;
    this.baseColors = {
        A: 'green', 
        C: 'blue', 
        G: 'orange', 
        T: 'red',
        '#' : "rgb(255, 0, 225)" // deletions: pink
    };

    // Registry

    this.availableSources = new Observed();
    this.defaultSources = [];
    this.mappableSources = {};

    this.hubs = [];
    this.hubObjects = [];

    this.sourceCache = new SourceCache();
    
    this.retina = true;

    this.useFetchWorkers = true;
    this.maxWorkers = 2;
    this.workerPath = '$$worker-all.js';

    this.assemblyNamePrimary = true;
    this.assemblyNameUcsc = true;

    this.initListeners = [];

    if (opts.viewStart !== undefined && typeof(opts.viewStart) !== 'number') {
        throw Error('viewStart must be an integer');
    }
    if (opts.viewEnd !== undefined && typeof(opts.viewEnd) !== 'number') {
        throw Error('viewEnd must be an integer');
    }

    for (var k in opts) {
        this[k] = opts[k];
    }
    if (typeof(opts.uiPrefix) === 'string' && typeof(opts.prefix) !== 'string') {
        this.prefix = opts.uiPrefix;
    }
    if (this.prefix.indexOf('//') === 0) {
        if (window.location.prototol === 'http:' || window.location.protocol === 'https:') {
            // Protocol-relative URLs okay.
        } else {
            this.prefix = 'http:' + this.prefix;
        }
    }

    if (!this.coordSystem) {
        throw Error('Coordinate system must be configured');
    }

    if (this.chr === undefined || this.viewStart === undefined || this.viewEnd === undefined) {
        throw Error('Viewed region (chr:start..end) must be defined');
    }

    var thisB = this;

    if (document.readyState === 'complete') {
        thisB.realInit();
    } else {
        window.addEventListener('load', function(ev) {thisB.realInit();}, false);
    }
}

Browser.prototype.resolveURL = function(url) {
    return url.replace('$$', this.prefix);
}

Browser.prototype.realInit = function() {
    if (this.wasInitialized) {
        console.log('Attemping to call realInit on an already-initialized Dalliance instance');
        return;
    }

    this.wasInitialized = true;

    this.defaultChr = this.chr;
    this.defaultStart = this.viewStart;
    this.defaultEnd = this.viewEnd;
    this.defaultSources = [];
    for (var i = 0; i < this.sources.length; ++i) {
        this.defaultSources.push(this.sources[i]);
    }

    if (this.restoreStatus) {
        this.statusRestored = this.restoreStatus();
    }

    var helpPopup;
    var thisB = this;
    this.browserHolderHolder = document.getElementById(this.pageName);
    this.browserHolderHolder.classList.add('dalliance-injection-point');
    this.browserHolder = makeElement('div', null, {className: 'dalliance dalliance-root', tabIndex: -1});
    if (this.maxHeight) {
        this.browserHolder.style.maxHeight = this.maxHeight + 'px';
    } else if (this.maxHeight != undefined) {
        this.browserHolder.style.maxHeight = null;
    }
    removeChildren(this.browserHolderHolder);
    this.browserHolderHolder.appendChild(this.browserHolder);
    this.svgHolder = makeElement('div', null, {className: 'main-holder'});

    this.initUI(this.browserHolder, this.svgHolder);

    this.pinnedTierHolder = makeElement('div', null, {className: 'tier-holder tier-holder-pinned'});
    this.tierHolder = makeElement('div', this.makeLoader(24), {className: 'tier-holder tier-holder-rest'});

    this.tierHolderHolder = makeElement('div', [this.pinnedTierHolder, this.tierHolder], {className: 'tier-holder-holder'});
    this.svgHolder.appendChild(this.tierHolderHolder);

    this.bhtmlRoot = makeElement('div');
    if (!this.disablePoweredBy) {
        this.bhtmlRoot.appendChild(makeElement('span', ['Powered by ', makeElement('a', 'Biodalliance', {href: 'http://www.biodalliance.org/'}), ' ' + VERSION], {className: 'powered-by'}));
    }
    this.browserHolder.appendChild(this.bhtmlRoot);
    
    window.addEventListener('resize', function(ev) {
        thisB.resizeViewer();
    }, false);

    this.ruler = makeElement('div', null, {className: 'guideline'})
    this.ruler2 = makeElement('div', null, {className: 'guideline'}, {backgroundColor: 'gray', opacity: '0.5', zIndex: 899});
    this.tierHolderHolder.appendChild(this.ruler);
    this.tierHolderHolder.appendChild(this.ruler2);

    this.chainConfigs = this.chains || {};
    this.chains = {};
    for (var k in this.chainConfigs) {
        var cc = this.chainConfigs[k];
        if (cc instanceof Chainset) {
            console.log('WARNING: Should no longer use "new Chainset" in Biodalliance configurations.');
        }
        this.chains[k] = new Chainset(cc);
    }

    var promisedWorkers;
    if (this.maxWorkers > 0) {
        var pw = [];
        for (var fi = 0; fi < this.maxWorkers; ++fi)
            pw.push(makeFetchWorker(this));
        promisedWorkers = Promise.all(pw);
    } else {
        promisedWorkers = Promise.resolve([]);
    }

    this.fetchWorkers = null;
    this.nextWorker = 0;
    promisedWorkers.then(function(v) {
        console.log('Booted ' + v.length + ' workers');
        thisB.fetchWorkers = v; 
    }, function(v) {
        console.log('Failed to boot workers', v);
    }).then(function() {
        if (window.getComputedStyle(thisB.browserHolderHolder).display != 'none') {
            setTimeout(function() {thisB.realInit2()}, 1);
        } else {
            var pollInterval = setInterval(function() {
                if (window.getComputedStyle(thisB.browserHolderHolder).display != 'none') {
                    clearInterval(pollInterval);
                    thisB.realInit2();
                } 
            }, 300);
        }
    });
}

Browser.prototype.realInit2 = function() {
    var thisB = this;

    // Remove the loader icon, if needed
    removeChildren(this.tierHolder);
    removeChildren(this.pinnedTierHolder);

    this.featurePanelWidth = this.tierHolder.getBoundingClientRect().width | 0;
    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);
    if (!this.zoomMax) {
        this.zoomMax = this.zoomExpt * Math.log(this.maxViewWidth / this.zoomBase);
        this.zoomMin = this.zoomExpt * Math.log(this.featurePanelWidth / 10 / this.zoomBase);
    }
    this.zoomSliderValue = this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase);

    // Event handlers

    this.tierHolderHolder.addEventListener('mousewheel', function(ev) {
        ev.stopPropagation(); ev.preventDefault();

        if (ev.wheelDeltaX) {
            var delta = ev.wheelDeltaX/5;
            if (!thisB.reverseScrolling) {
                delta = -delta;
            }
            thisB.move(delta);
        }

        if (ev.wheelDeltaY) {
            var delta = ev.wheelDeltaY;
            if (thisB.reverseScrolling) {
                delta = -delta;
            }
            thisB.tierHolder.scrollTop += delta;
        }
    }, false); 

    this.tierHolderHolder.addEventListener('MozMousePixelScroll', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        if (ev.axis == 1) {
            if (ev.detail != 0) {
                var delta = ev.detail/4;
                if (thisB.reverseScrolling) {
                    delta = -delta;
                }
                thisB.move(delta);
            }
        } else {
            var delta = ev.detail;
            if (!thisB.reverseScrolling) {
              delta = -delta;
            }

            thisB.tierHolder.scrollTop += delta;
        }
    }, false); 

    this.tierHolderHolder.addEventListener('touchstart', function(ev) {return thisB.touchStartHandler(ev)}, false);
    this.tierHolderHolder.addEventListener('touchmove', function(ev) {return thisB.touchMoveHandler(ev)}, false);
    this.tierHolderHolder.addEventListener('touchend', function(ev) {return thisB.touchEndHandler(ev)}, false);
    this.tierHolderHolder.addEventListener('touchcancel', function(ev) {return thisB.touchCancelHandler(ev)}, false);

    var keyHandler = function(ev) {
        // console.log('cbkh: ' + ev.keyCode);
        if (ev.keyCode == 13) { // enter
            var layoutsChanged = false;
            for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                var t = thisB.tiers[ti];
                if (t.wantedLayoutHeight && t.wantedLayoutHeight != t.layoutHeight) {
                    t.layoutHeight = t.wantedLayoutHeight;
                    t.clipTier();
                    layoutsChanged = true;
                }
            }
            if (layoutsChanged) {
                thisB.arrangeTiers();
            }
        } else if (ev.keyCode == 32 || ev.charCode == 32) { // space
            if (!thisB.isSnapZooming) {
                thisB.isSnapZooming = true;
                var newZoom = (thisB.savedZoom || 0.0) + thisB.zoomMin;
                thisB.savedZoom = thisB.zoomSliderValue - thisB.zoomMin;
                thisB.zoomSliderValue = newZoom;
                thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
            } else {
                thisB.isSnapZooming = false;
                var newZoom = (thisB.savedZoom || 20.0) + thisB.zoomMin;
                thisB.savedZoom = thisB.zoomSliderValue - thisB.zoomMin;
                thisB.zoomSliderValue = newZoom;
                thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
            }
            thisB.snapZoomLockout = true;
            ev.stopPropagation(); ev.preventDefault();      
        } else if (ev.keyCode == 39) { // right arrow
            ev.stopPropagation(); ev.preventDefault();
            thisB.scrollArrowKey(ev, -1);
        } else if (ev.keyCode == 37) { // left arrow
            ev.stopPropagation(); ev.preventDefault();
            thisB.scrollArrowKey(ev, 1);
        } else if (ev.keyCode == 38 || ev.keyCode == 87) { // up arrow | w
            ev.stopPropagation(); ev.preventDefault();

            if (ev.shiftKey) {
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                var tt = thisB.tiers[st];
                var ch = tt.forceHeight || tt.subtiers[0].height;
                if (ch >= 40) {
                    tt.mergeConfig({height: ch-10});
                }
            } else if (ev.ctrlKey || ev.metaKey) {
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                var tt = thisB.tiers[st];
  
                if (tt.quantLeapThreshold) {
                    var th = tt.subtiers[0].height;
                    var tq = tt.subtiers[0].quant;
                    if (!tq)
                        return;

                    var qmin = 1.0 * tq.min;
                    var qmax = 1.0 * tq.max;

                    var qscale = (qmax - qmin) / th;
                    tt.mergeConfig({quantLeapThreshold: qmin + ((Math.round((tt.quantLeapThreshold - qmin)/qscale)|0)+1)*qscale});

                    tt.notify('Threshold: ' + formatQuantLabel(tt.quantLeapThreshold));
                }                
            } else if (ev.altKey) {
                var cnt = thisB.selectedTiers.length;
                if (cnt == 0)
                    return;

                var st = thisB.selectedTiers[0];
                var contiguous = true;
                var mt = [];
                for (var si = 0; si < thisB.selectedTiers.length; ++si) {
                    mt.push(thisB.tiers[thisB.selectedTiers[si]]);
                    if (si > 0 && thisB.selectedTiers[si] - thisB.selectedTiers[si - 1] != 1)
                        contiguous = false;
                }

                if (contiguous && st <= 0)
                    return;

                for (var si = thisB.selectedTiers.length - 1; si >= 0; --si)
                    thisB.tiers.splice(thisB.selectedTiers[si], 1);

                thisB.selectedTiers.splice(0, cnt);

                var ip = contiguous ? st - 1 : st;
                for (var si = 0; si < mt.length; ++si) {
                    thisB.tiers.splice(ip+si, 0, mt[si]);
                    thisB.selectedTiers.push(ip + si);
                }

                thisB.markSelectedTiers();
                thisB.notifyTierSelection();
                thisB.reorderTiers();
                thisB.notifyTier();
            } else {
                var st = thisB.getSelectedTier();
                if (st > 0) {
                    thisB.setSelectedTier(st - 1);
                    var nst = thisB.tiers[thisB.getSelectedTier()];
                    var top = nst.row.offsetTop, bottom = top + nst.row.offsetHeight;
                    if (top < thisB.tierHolder.scrollTop || bottom > thisB.tierHolder.scrollTop + thisB.tierHolder.offsetHeight) {
                        thisB.tierHolder.scrollTop = top;
                    }
                } else {
                    thisB.notifyTierSelectionWrap(-1);
                }
            }
        } else if (ev.keyCode == 40 || ev.keyCode == 83) { // down arrow | s
            ev.stopPropagation(); ev.preventDefault();

            if (ev.shiftKey) {
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                var tt = thisB.tiers[st];
                var ch = tt.forceHeight || tt.subtiers[0].height;
                tt.mergeConfig({height: ch+10});
            } else if (ev.ctrlKey || ev.metaKey) {
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                var tt = thisB.tiers[st];

                if (tt.quantLeapThreshold) {
                    var th = tt.subtiers[0].height;
                    var tq = tt.subtiers[0].quant;
                    if (!tq)
                        return;

                    var qmin = 1.0 * tq.min;
                    var qmax = 1.0 * tq.max;
                    var qscale = (qmax - qmin) / th;

                    var it = Math.round((tt.quantLeapThreshold - qmin)/qscale)|0;
                    if (it > 1) {
                        tt.mergeConfig({quantLeapThreshold: qmin + (it-1)*qscale});
                        tt.notify('Threshold: ' + formatQuantLabel(tt.quantLeapThreshold));
                    }
                }
            } else if (ev.altKey) {
                var cnt = thisB.selectedTiers.length;
                if (cnt == 0)
                    return;

                var st = thisB.selectedTiers[0];
                var discontig = 0;
                var mt = [];
                for (var si = 0; si < thisB.selectedTiers.length; ++si) {
                    mt.push(thisB.tiers[thisB.selectedTiers[si]]);
                    if (si > 0)
                        discontig += (thisB.selectedTiers[si] - thisB.selectedTiers[si - 1] - 1);
                }
                var contiguous = discontig == 0;

                if (contiguous && st + cnt >= thisB.tiers.length)
                    return;

                for (var si = thisB.selectedTiers.length - 1; si >= 0; --si)
                    thisB.tiers.splice(thisB.selectedTiers[si], 1);

                thisB.selectedTiers.splice(0, cnt);

                var ip = contiguous ? st + 1 : st + discontig;
                for (var si = 0; si < mt.length; ++si) {
                    thisB.tiers.splice(ip+si, 0, mt[si]);
                    thisB.selectedTiers.push(ip + si);
                }

                thisB.markSelectedTiers();
                thisB.notifyTierSelection();
                thisB.reorderTiers();
                thisB.notifyTier();
            } else {
                var st = thisB.getSelectedTier();
                if (st < thisB.tiers.length -1) {
                    thisB.setSelectedTier(st + 1);
                    var nst = thisB.tiers[thisB.getSelectedTier()];
                    var top = nst.row.offsetTop, bottom = top + nst.row.offsetHeight;
                    if (top < thisB.tierHolder.scrollTop || bottom > thisB.tierHolder.scrollTop + thisB.tierHolder.offsetHeight) {
                        thisB.tierHolder.scrollTop = Math.min(top, bottom - thisB.tierHolder.offsetHeight);
                    }
                }
            }
        } else if (ev.keyCode == 187 || ev.keyCode == 61) { // +
            ev.stopPropagation(); ev.preventDefault();
            thisB.zoomStep(-10);
        } else if (ev.keyCode == 189 || ev.keyCode == 173) { // -
            ev.stopPropagation(); ev.preventDefault();
            thisB.zoomStep(10);
        } else if (ev.keyCode == 73 || ev.keyCode == 105) { // i
            ev.stopPropagation(); ev.preventDefault();
            var st = thisB.getSelectedTier();
            if (st < 0) return;
            var t = thisB.tiers[st];
            if (!t.infoVisible) {
                t.infoElement.style.display = 'block';
                t.updateHeight();
                t.infoVisible = true;
            } else {
                t.infoElement.style.display = 'none';
                t.updateHeight();
                t.infoVisible = false;
            }
        } else if (ev.keyCode == 84 || ev.keyCode == 116) { // t
            var bumpStatus;
            if( ev.shiftKey ){
                ev.stopPropagation(); ev.preventDefault();
                for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                    var t = thisB.tiers[ti];
                    if (t.dasSource.collapseSuperGroups) {
                        if (bumpStatus === undefined) {
                            bumpStatus = !t.bumped;
                        }
                        t.bumped = bumpStatus;
                        t.layoutWasDone = false;
                        t.draw();
                        t.updateLabel();
                    }
                }
            } else if (!ev.ctrlKey && !ev.metaKey) {
                ev.stopPropagation(); ev.preventDefault();
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                var t = thisB.tiers[st];
                if (t.dasSource.collapseSuperGroups) {
                    if (bumpStatus === undefined) {
                        bumpStatus = !t.bumped;
                    }
                    t.bumped = bumpStatus;
                    t.layoutWasDone = false;
                    t.draw();
                    t.updateLabel();
                }
            }
        } else if (ev.keyCode == 77 || ev.keyCode == 109) { // m
            ev.stopPropagation(); ev.preventDefault();
            if ((ev.ctrlKey || ev.metaKey) && thisB.selectedTiers.length > 1) {
                thisB.mergeSelectedTiers();
            }
        } else if (ev.keyCode == 68 || ev.keyCode == 100) { // d
            ev.stopPropagation(); ev.preventDefault();
            if (ev.ctrlKey || ev.metaKey) {
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                thisB.addTier(thisB.tiers[st].dasSource);
            }
        } else if (ev.keyCode == 80 || ev.keyCode == 112) { // p
            if (ev.ctrlKey || ev.metaKey) {
                // Need to be careful because order of tiers could change
                // once we start updating pinning.
                var tt = [];
                for (var st = 0; st < thisB.selectedTiers.length; ++st) {
                    tt.push(thisB.tiers[thisB.selectedTiers[st]]);
                }
                for (var ti = 0; ti < tt.length; ++ti) {
                    tt[ti].mergeConfig({pinned: !tt[ti].pinned});
                }
            }
        } else {
            // console.log('key: ' + ev.keyCode + '; char: ' + ev.charCode);
        }
    };
    var keyUpHandler = function(ev) {
        thisB.snapZoomLockout = false;
    }

    this.browserHolder.addEventListener('focus', function(ev) {
        thisB.browserHolder.addEventListener('keydown', keyHandler, false);
    }, false);
    this.browserHolder.addEventListener('blur', function(ev) {
        thisB.browserHolder.removeEventListener('keydown', keyHandler, false);
    }, false);

    // Popup support (does this really belong here? FIXME)
    this.hPopupHolder = makeElement('div');
    this.hPopupHolder.style['font-family'] = 'helvetica';
    this.hPopupHolder.style['font-size'] = '12pt';
    this.hPopupHolder.classList.add('dalliance');
    document.body.appendChild(this.hPopupHolder);

    for (var t = 0; t < this.sources.length; ++t) {
        var source = this.sources[t];
        var config = {};
        if (this.restoredConfigs) {
            config = this.restoredConfigs[t];
        }

        if (!source.disabled) {
            this.makeTier(source, config);
        }
    }

    thisB.arrangeTiers();
    thisB.refresh();
    thisB.setSelectedTier(1);

    thisB.positionRuler();


    var ss = this.getSequenceSource();
    if (ss) {
        ss.getSeqInfo(this.chr, function(si) {
            thisB.currentSeqMax = si.length;
        });
    }

    this.queryRegistry();
    for (var m in this.chains) {
        this.queryRegistry(m, true);
    }

    if (this.hubs) {
        for (var hi = 0; hi < this.hubs.length; ++hi) {
            var hc = this.hubs[hi];
            if (typeof hc == 'string') {
                hc = {url: hc};
            };

            (function(hc) {
                connectTrackHub(hc.url, function(hub, err) {
                    if (err) {
                        console.log(err);
                    } else {
                        var tdb;
                        if (hc.genome)
                            tdb = hub.genomes[hc.genome];
                        else 
                            tdb = hub.genomes[thisB.coordSystem.ucscName];

                        if (tdb) {
                            if (hc.mapping) 
                                tdb.mapping = hc.mapping;
                            thisB.hubObjects.push(tdb);
                        }
                    }
                }, hc);
            })(hc);
        }
    }

    if (this.fullScreen) {
        this.setFullScreenHeight();
    }

    if (!this.statusRestored && this.storeStatus) {
        this.storeStatus();
    }

    // Ping any init listeners.
    for (var ii = 0; ii < this.initListeners.length; ++ii) {
        try {
            this.initListeners[ii].call(this);
        } catch (e) {
            console.log(e);
        }
    }
}

// 
// iOS touch support

Browser.prototype.touchStartHandler = function(ev) {
    ev.stopPropagation(); ev.preventDefault();
    
    this.touchOriginX = ev.touches[0].pageX;
    this.touchOriginY = ev.touches[0].pageY;
    if (ev.touches.length == 2) {
        var sep = Math.abs(ev.touches[0].pageX - ev.touches[1].pageX);
        this.zooming = true;
        this.zoomLastSep = this.zoomInitialSep = sep;
        this.zoomInitialScale = this.scale;
    }
}

Browser.prototype.touchMoveHandler = function(ev) {
    ev.stopPropagation(); ev.preventDefault();
    
    if (ev.touches.length == 1) {
        var touchX = ev.touches[0].pageX;
        var touchY = ev.touches[0].pageY;
        if (this.touchOriginX && touchX != this.touchOriginX) {
            this.move(touchX - this.touchOriginX);
        }
        if (this.touchOriginY && touchY != this.touchOriginY) {
            this.tierHolder.scrollTop -= (touchY - this.touchOriginY);
        }
        this.touchOriginX = touchX;
        this.touchOriginY = touchY;
    } else if (this.zooming && ev.touches.length == 2) {
        var sep = Math.abs(ev.touches[0].pageX - ev.touches[1].pageX);
        if (sep != this.zoomLastSep) {
            var cp = (ev.touches[0].pageX + ev.touches[1].pageX)/2;
            var scp = this.viewStart + (cp/this.scale)|0
            this.scale = this.zoomInitialScale * (sep/this.zoomInitialSep);
            this.viewStart = scp - (cp/this.scale)|0;
            for (var i = 0; i < this.tiers.length; ++i) {
	           this.tiers[i].draw();
            }
        }
        this.zoomLastSep = sep;
    }
}

Browser.prototype.touchEndHandler = function(ev) {
    ev.stopPropagation(); ev.preventDefault();
}

Browser.prototype.touchCancelHandler = function(ev) {
}


Browser.prototype.makeTier = function(source, config) {
    try {
        return this.realMakeTier(source, config);
    } catch (e) {
        console.log(e.stack || e);
    }
}

Browser.prototype.realMakeTier = function(source, config) {
    var thisB = this;
    var background = null;
    if (this.tierBackgroundColors) {
        background = this.tierBackgroundColors[this.tiers.length % this.tierBackgroundColors.length];
    }

    var tier = new DasTier(this, source, config, background);
    tier.oorigin = this.viewStart

    var isDragging = false;
    var dragOrigin, dragMoveOrigin;
    var hoverTimeout;

    var featureLookup = function(rx, ry) {
        var st = tier.subtiers;
        if (!st) {
            return;
        }

        var sti = 0;
        ry -= tier.padding;;
        while (sti < st.length && ry > st[sti].height && sti < (st.length - 1)) {
            ry = ry - st[sti].height - tier.padding;
            ++sti;
        }
        if (sti >= st.length) {
            return;
        }

        var glyphs = st[sti].glyphs;
        var viewCenter = (thisB.viewStart + thisB.viewEnd)/2;
        var offset = (tier.glyphCacheOrigin - thisB.viewStart)*thisB.scale;
        rx -= offset;
       
        return glyphLookup(glyphs, rx, ry);
    }

    var dragMoveHandler = function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        var rx = ev.clientX;
        if (rx != dragMoveOrigin) {
            thisB.move((rx - dragMoveOrigin));
            dragMoveOrigin = rx;
        }
        thisB.isDragging = true;
    }

    var dragUpHandler = function(ev) {
        window.removeEventListener('mousemove', dragMoveHandler, true);
        window.removeEventListener('mouseup', dragUpHandler, true);
    }
        

    tier.viewport.addEventListener('mousedown', function(ev) {
        thisB.browserHolder.focus();
        ev.preventDefault();
        var br = tier.row.getBoundingClientRect();
        var rx = ev.clientX, ry = ev.clientY;

        window.addEventListener('mousemove', dragMoveHandler, true);
        window.addEventListener('mouseup', dragUpHandler, true);
        dragOrigin = dragMoveOrigin = rx;
        thisB.isDragging = false; // Not dragging until a movement event arrives.
    }, false);

    tier.viewport.addEventListener('mousemove', function(ev) {
        var br = tier.row.getBoundingClientRect();
        var rx = ev.clientX - br.left, ry = ev.clientY - br.top;

        var hit = featureLookup(rx, ry);
        if (hit && hit.length > 0) {
            tier.row.style.cursor = 'pointer';
        } else {
            tier.row.style.cursor = 'default';
        }

        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }

        if (isDragging) {
            // if (tier.dasSource.tier_type !== 'sequence' && rx != dragMoveOrigin) {
            //    thisB.move((rx - dragMoveOrigin));
            //    dragMoveOrigin = rx;
            // }
        } else {
            hoverTimeout = setTimeout(function() {
                var hit = featureLookup(rx, ry);
                if (hit && hit.length > 0) {
                    thisB.notifyFeatureHover(ev, hit[hit.length - 1], hit, tier);
                }
            }, 1000);
        }
    });

    var doubleClickTimeout = null;
    tier.viewport.addEventListener('mouseup', function(ev) {
        var br = tier.row.getBoundingClientRect();
        var rx = ev.clientX - br.left, ry = ev.clientY - br.top;

        var hit = featureLookup(rx, ry);
        if (hit && hit.length > 0 && !thisB.isDragging) {
            if (doubleClickTimeout) {
                clearTimeout(doubleClickTimeout);
                doubleClickTimeout = null;
                thisB.featureDoubleClick(hit, rx, ry);
            } else {
                doubleClickTimeout = setTimeout(function() {
                    doubleClickTimeout = null;
                    thisB.notifyFeature(ev, hit[hit.length-1], hit, tier);
                }, 500);
            }
        }

        if (thisB.isDragging && rx != dragOrigin && tier.sequenceSource) {
            var a = thisB.viewStart + (rx/thisB.scale);
            var b = thisB.viewStart + (dragOrigin/thisB.scale);

            var min, max;
            if (a < b) {
                min = a|0; max = b|0;
            } else {
                min = b|0; max = a|0;
            }

            thisB.notifyRegionSelect(thisB.chr, min, max);
        }
        thisB.isDragging = false;
    }, false);

    tier.viewport.addEventListener('mouseout', function(ev) {
        isDragging = false;
    });

    tier.removeButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        for (var ti = 0; ti < thisB.tiers.length; ++ti) {
            if (thisB.tiers[ti] === tier) {
                thisB.removeTier({index: ti});
                break;
            }
        }
    }, false);
    tier.nameButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();

        if (ev.shiftKey) {
            var hitTier = -1;
            for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                if (thisB.tiers[ti] === tier) {
                    hitTier = ti;
                    break;
                }
            }
            if (hitTier >= 0) {
                var i = thisB.selectedTiers.indexOf(hitTier);
                if (i >= 0) {
                    thisB.selectedTiers.splice(i, 1);
                } else {
                    thisB.selectedTiers.push(hitTier);
                    thisB.selectedTiers.sort();
                }
                thisB.markSelectedTiers();
                thisB.notifyTierSelection();

                if (thisB.selectedTiers.length > 0) {
                    thisB.browserHolder.focus();
                } else {
                    thisB.notifyTierSelectionWrap(-1);
                }
            }
        } else {
            for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                if (thisB.tiers[ti] === tier) {
                    thisB.browserHolder.focus();
                    if (thisB.selectedTiers.length != 1 || thisB.selectedTiers[0] != ti) {
                        thisB.setSelectedTier(ti);
                        return;
                    }
                }
            }

            if (!tier.infoVisible) {
                tier.infoElement.style.display = 'block';
                tier.updateHeight();
                tier.infoVisible = true;
            } else {
                tier.infoElement.style.display = 'none';
                tier.updateHeight();
                tier.infoVisible = false;
            }
        }
    }, false);
    tier.bumpButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        var bumpStatus;
        var t = tier;
        if (t.dasSource.collapseSuperGroups) {
            
            if (bumpStatus === undefined) {
                bumpStatus = !t.bumped;
            }
            t.bumped = bumpStatus;
            t.layoutWasDone = false;
            t.draw();
            
            t.updateLabel();
        }
    }, false);

    
    var dragLabel;
    var dragTierHolder;
    var dragTierHolderScrollLimit;
    var tierOrdinal;
    var yAtLastReorder;
    var tiersWereReordered = false;

    var labelDragHandler = function(ev) {
        var label = tier.label;

        ev.stopPropagation(); ev.preventDefault();
        if (!dragLabel) {
            if (tier.pinned) {
                dragTierHolder = thisB.pinnedTierHolder;
            } else {
                dragTierHolder = thisB.tierHolder;
            }
            dragTierHolderScrollLimit = dragTierHolder.scrollHeight - dragTierHolder.offsetHeight;

            dragLabel = label.cloneNode(true);
            dragLabel.style.cursor = 'pointer';
            dragTierHolder.appendChild(dragLabel);
            label.style.visibility = 'hidden';

            for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                if (thisB.tiers[ti] === tier) {
                    tierOrdinal = ti;
                    break;
                }
            }

            yAtLastReorder = ev.clientY;
        }
        
        var holderBCR = dragTierHolder.getBoundingClientRect();
        dragLabel.style.left = (label.getBoundingClientRect().left - holderBCR.left) + 'px'; 
        dragLabel.style.top = (ev.clientY - holderBCR.top + dragTierHolder.scrollTop - 10) + 'px';

        var pty = ev.clientY - holderBCR.top + dragTierHolder.scrollTop;
        for (var ti = 0; ti < thisB.tiers.length; ++ti) {
            var tt = thisB.tiers[ti];
            if (tt.pinned ^ tier.pinned)
                continue; 

            var ttr = tt.row.getBoundingClientRect();
            pty -= (ttr.bottom - ttr.top);
            if (pty < 0) {
                if (ti < tierOrdinal && ev.clientY < yAtLastReorder || ti > tierOrdinal && ev.clientY > yAtLastReorder) {
                    thisB.withPreservedSelection(function() {
                        thisB.tiers.splice(tierOrdinal, 1);
                        thisB.tiers.splice(ti, 0, tier);
                    });

                    tierOrdinal = ti;
                    yAtLastReorder = ev.clientY;
                    thisB.reorderTiers();
                    dragTierHolder.appendChild(dragLabel); // Because reorderTiers removes all children.
                    tiersWereReordered = true;
                }
                break;
            }
        }

        if (dragLabel.offsetTop < dragTierHolder.scrollTop) {
            dragTierHolder.scrollTop -= (dragTierHolder.scrollTop - dragLabel.offsetTop);
        } else if ((dragLabel.offsetTop + dragLabel.offsetHeight) > (dragTierHolder.scrollTop + dragTierHolder.offsetHeight)) {
            dragTierHolder.scrollTop = Math.min(dragTierHolder.scrollTop + 
                                                   (dragLabel.offsetTop + dragLabel.offsetHeight) - 
                                                   (dragTierHolder.scrollTop + dragTierHolder.offsetHeight),
                                                dragTierHolderScrollLimit);
        }
    };

    var labelReleaseHandler = function(ev) {
        var label = tier.label;

        ev.stopPropagation(); ev.preventDefault();
        if (dragLabel) {
            dragLabel.style.cursor = 'auto';
            dragTierHolder.removeChild(dragLabel);
            dragLabel = null;
            label.style.visibility = null;
        }
        document.removeEventListener('mousemove', labelDragHandler, false);
        document.removeEventListener('mouseup', labelReleaseHandler, false);

        if (tiersWereReordered) {
            for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                if (thisB.tiers[ti] == tier) {
                    thisB.setSelectedTier(ti);
                    break;
                }
            }
            thisB.notifyTier();
        }
    };

    tier.label.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        tiersWereReordered = false;
        document.addEventListener('mousemove', labelDragHandler, false);
        document.addEventListener('mouseup', labelReleaseHandler, false);
    }, false);

    this.tiers.push(tier);  // NB this currently tells any extant knownSpace about the new tier.
    
    tier.init(); // fetches stylesheet
    tier.currentlyHeight = 50;
    this.updateHeight();
    tier.updateLabel();

    if (tier.featureSource && tier.featureSource.addActivityListener) {
        tier.featureSource.addActivityListener(function(busy) {
            if (busy > 0) {
                tier.loaderButton.style.display = 'inline-block';
            } else {
                tier.loaderButton.style.display = 'none';
            }
            thisB.pingActivity();
        });
    }

    tier._updateFromConfig();
    this.reorderTiers();

    return tier;
}

Browser.prototype.reorderTiers = function() {
    removeChildren(this.tierHolder);
    removeChildren(this.pinnedTierHolder);
    var hasPinned = false;
    var pinnedTiers = [], unpinnedTiers = [];
    for (var i = 0; i < this.tiers.length; ++i) {
        var t = this.tiers[i];
        if (t.pinned) {
            pinnedTiers.push(t);
            this.pinnedTierHolder.appendChild(this.tiers[i].row);
            hasPinned = true;
        } else {
            unpinnedTiers.push(t);
            this.tierHolder.appendChild(this.tiers[i].row);
        }
    }

    this.withPreservedSelection(function() {
        this.tiers.splice(0, this.tiers.length);
        for (var i = 0; i < pinnedTiers.length; ++i)
            this.tiers.push(pinnedTiers[i]);
        for (var i = 0; i < unpinnedTiers.length; ++i)
            this.tiers.push(unpinnedTiers[i]);
    });

    if (hasPinned)
        this.pinnedTierHolder.classList.add('tier-holder-pinned-full');
    else
        this.pinnedTierHolder.classList.remove('tier-holder-pinned-full');

    this.arrangeTiers();
}

Browser.prototype.withPreservedSelection = function(f) {
    var st = [];
    for (var xi = 0; xi < this.selectedTiers.length; ++xi) {
        st.push(this.tiers[this.selectedTiers[xi]]);
    }

    f.call(this);

    this.selectedTiers = [];
    for (var sti = 0; sti < this.tiers.length; ++sti) {
        if (st.indexOf(this.tiers[sti]) >= 0)
            this.selectedTiers.push(sti);
    }
}

Browser.prototype.refreshTier = function(tier) {
    if (this.knownSpace) {
        this.knownSpace.invalidate(tier);
    }
}

Browser.prototype.arrangeTiers = function() {
    var arrangedTiers = [];
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var t = this.tiers[ti];
        if (t.pinned) {
            arrangedTiers.push(t);
        }
    }
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var t = this.tiers[ti];
        if (!t.pinned) {
            arrangedTiers.push(t);
        }
    }

    if (this.tierBackgroundColors) {
        for (var ti = 0; ti < arrangedTiers.length; ++ti) {
            var t = arrangedTiers[ti];
            t.background = this.tierBackgroundColors[ti % this.tierBackgroundColors.length];
        }
    }
}

Browser.prototype.refresh = function() {
    this.notifyLocation();
    var width = (this.viewEnd - this.viewStart) + 1;
    var minExtraW = (100.0/this.scale)|0;
    var maxExtraW = (1000.0/this.scale)|0;

    var newOrigin = (this.viewStart + this.viewEnd) / 2;
    var oh = newOrigin - this.origin;
    this.origin = newOrigin;
    this.scaleAtLastRedraw = this.scale;
    for (var t = 0; t < this.tiers.length; ++t) {
        var od = oh;
        if (this.tiers[t].originHaxx) {
            od += this.tiers[t].originHaxx;
        }
        this.tiers[t].originHaxx = od;
    }

    var scaledQuantRes = this.targetQuantRes / this.scale;

    var innerDrawnStart = Math.max(1, (this.viewStart|0) - minExtraW);
    var innerDrawnEnd = Math.min((this.viewEnd|0) + minExtraW, ((this.currentSeqMax|0) > 0 ? (this.currentSeqMax|0) : 1000000000))
    var outerDrawnStart = Math.max(1, (this.viewStart|0) - maxExtraW);
    var outerDrawnEnd = Math.min((this.viewEnd|0) + maxExtraW, ((this.currentSeqMax|0) > 0 ? (this.currentSeqMax|0) : 1000000000));

    if (!this.knownSpace || this.knownSpace.chr !== this.chr) {
        var ss = this.getSequenceSource();
        this.knownSpace = new KnownSpace(this.tiers, this.chr, outerDrawnStart, outerDrawnEnd, scaledQuantRes, ss);
    }
    
    var seg = this.knownSpace.bestCacheOverlapping(this.chr, innerDrawnStart, innerDrawnEnd);
    if (seg && seg.min <= innerDrawnStart && seg.max >= innerDrawnEnd) {
        this.drawnStart = Math.max(seg.min, outerDrawnStart);
        this.drawnEnd = Math.min(seg.max, outerDrawnEnd);
    } else {
        this.drawnStart = outerDrawnStart;
        this.drawnEnd = outerDrawnEnd;
    }
    
    this.knownSpace.viewFeatures(this.chr, this.drawnStart, this.drawnEnd, scaledQuantRes);
    this.drawOverlays();
}

function setSources(msh, availableSources, maybeMapping) {
    if (maybeMapping) {
        for (var s = 0; s < availableSources.length; ++s) {
            availableSources[s].mapping = maybeMapping;
        }
    }
    msh.set(availableSources);
}

Browser.prototype.queryRegistry = function(maybeMapping, tryCache) {
    var thisB = this;
    var coords, msh;
    if (maybeMapping) {
        coords = this.chains[maybeMapping].coords;
        if (!thisB.mappableSources[maybeMapping]) {
            thisB.mappableSources[maybeMapping] = new Observed();
        }
        msh = thisB.mappableSources[maybeMapping];
    } else {
        coords = this.coordSystem;
        msh = this.availableSources;
    }
    var cacheHash = hex_sha1(miniJSONify(coords));
    if (tryCache) {
        var cacheTime = localStorage['dalliance.registry.' + cacheHash + '.last_queried'];
        if (cacheTime) {
            try {
                setSources(msh, JSON.parse(localStorage['dalliance.registry.' + cacheHash + '.sources']), maybeMapping);
                var cacheAge = (Date.now()|0) - (cacheTime|0);
                if (cacheAge < (12 * 60 * 60 * 1000)) {
                    return;
                }
            } catch (rex) {
                console.log('Bad registry cache: ' + rex);
            }
        }
    }
            
    new DASRegistry(this.registry).sources(function(sources) {
        var availableSources = [];
        for (var s = 0; s < sources.length; ++s) {
            var source = sources[s];
            if (!source.coords || source.coords.length == 0) {
                continue;
            }
            var scoords = source.coords[0];
            if (scoords.taxon != coords.taxon || scoords.auth != coords.auth || scoords.version != coords.version) {
                continue;
            }   
            availableSources.push(source);
        }

        localStorage['dalliance.registry.' + cacheHash + '.sources'] = JSON.stringify(availableSources);
        localStorage['dalliance.registry.' + cacheHash + '.last_queried'] = '' + Date.now();
        
        setSources(msh, availableSources, maybeMapping);
    }, function(error) {
        // msh.set(null);
    }, coords);
}

//
// Navigation
//

Browser.prototype.move = function(pos)
{
    var wid = this.viewEnd - this.viewStart;
    var nStart = this.viewStart - pos / this.scale;
    var nEnd = nStart + wid;

    if (this.currentSeqMax > 0 && nEnd > this.currentSeqMax) {
        nEnd = this.currentSeqMax;
        nStart = this.viewEnd - wid;
    }
    if (nStart < 1) {
        nStart = 1;
        nEnd = nStart + wid;
    }

    this.setLocation(null, nStart, nEnd);
}

Browser.prototype.zoomStep = function(delta) {
    var oz = 1.0 * this.zoomSliderValue;
    var nz = oz + delta;
    if (nz < this.zoomMin) {
        nz= this.zoomMin;
    }
    if (nz > this.zoomMax) {
        nz = this.zoomMax;
    }

    if (nz != oz) {
        this.zoomSliderValue = nz; // FIXME maybe ought to set inside zoom!
        this.zoom(Math.exp((1.0 * nz) / this.zoomExpt));
    }
}

Browser.prototype.zoom = function(factor) {
    this.zoomFactor = factor;
    var viewCenter = Math.round((this.viewStart + this.viewEnd) / 2.0)|0;
    this.viewStart = viewCenter - this.zoomBase * this.zoomFactor / 2;
    this.viewEnd = viewCenter + this.zoomBase * this.zoomFactor / 2;
    if (this.currentSeqMax > 0 && (this.viewEnd > this.currentSeqMax + 5)) {
        var len = this.viewEnd - this.viewStart + 1;
        this.viewEnd = this.currentSeqMax;
        this.viewStart = this.viewEnd - len + 1;
    }
    if (this.viewStart < 1) {
        var len = this.viewEnd - this.viewStart + 1;
        this.viewStart = 1;
        this.viewEnd = this.viewStart + len - 1;
    }
    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart)
    var width = this.viewEnd - this.viewStart + 1;
    
    var scaleRat = (this.scale / this.scaleAtLastRedraw);

    this.refresh();
}

Browser.prototype.spaceCheck = function(dontRefresh) {
    if (!this.knownSpace || this.knownSpace.chr !== this.chr) {
        this.refresh();
        return;
    } 

    var width = ((this.viewEnd - this.viewStart)|0) + 1;
    var minExtraW = (100.0/this.scale)|0;
    var maxExtraW = (1000.0/this.scale)|0;

    if ((this.drawnStart|0) > Math.max(1, ((this.viewStart|0) - minExtraW)|0)  || (this.drawnEnd|0) < Math.min((this.viewEnd|0) + minExtraW, ((this.currentSeqMax|0) > 0 ? (this.currentSeqMax|0) : 1000000000)))  {
        this.refresh();
    }
}

Browser.prototype.resizeViewer = function(skipRefresh) {
    var width = this.tierHolder.getBoundingClientRect().width | 0;
    if (width == 0)
        return;

    var oldFPW = Math.max(this.featurePanelWidth, 300); // Can get silly values stored
                                                        // when the browser is hidden.
    this.featurePanelWidth = width|0;

    if (oldFPW != this.featurePanelWidth) {
        this.zoomMax = this.zoomExpt * Math.log(this.maxViewWidth / this.zoomBase);
        this.zoomMin = this.zoomExpt * Math.log(this.featurePanelWidth / 10 / this.zoomBase);
        this.zoomSliderValue = this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase);

        var viewWidth = this.viewEnd - this.viewStart;
        var nve = this.viewStart + (viewWidth * this.featurePanelWidth) / oldFPW;

        this.viewEnd = nve;

        var wid = this.viewEnd - this.viewStart + 1;
        if (this.currentSeqMax > 0 && this.viewEnd > this.currentSeqMax) {
            this.viewEnd = this.currentSeqMax;
            this.viewStart = this.viewEnd - wid + 1;
        }
        if (this.viewStart < 1) {
            this.viewStart = 1;
            this.viewEnd = this.viewStart + wid - 1;
        }

        this.positionRuler();

        if (!skipRefresh) {
            this.spaceCheck();
        }
        this.notifyLocation();
    }

    if (this.fullScreen) {
        this.setFullScreenHeight();
    }
}

Browser.prototype.setFullScreenHeight = function() {
    var rest = document.body.offsetHeight - this.browserHolder.offsetHeight;
    this.browserHolder.style.maxHeight = Math.max(300, window.innerHeight - rest - 20) + 'px'
}

Browser.prototype.addTier = function(conf) {
    conf = shallowCopy(conf);
    conf.disabled = false;
    
    var tier = this.makeTier(conf);
    this.markSelectedTiers();
    this.positionRuler();
    this.notifyTier();
    return tier;
}

function sourceDataURI(conf) {
    if (conf.uri) {
        return conf.uri;
    } else if (conf.blob) {
        return 'file:' + conf.blob.name;
    } else if (conf.bwgBlob) {
        return 'file:' + conf.bwgBlob.name;
    } else if (conf.bamBlob) {
        return 'file:' + conf.bamBlob.name;
    } else if (conf.twoBitBlob) {
        return 'file:' + conf.twoBitBlob.name;
    }

    return conf.bwgURI || conf.bamURI || conf.jbURI || conf.twoBitURI || 'http://www.biodalliance.org/magic/no_uri';
}

function sourceStyleURI(conf) {
    if (conf.stylesheet_uri)
        return conf.stylesheet_uri;
    else if (conf.tier_type == 'sequence' || conf.twoBitURI || conf.twoBitBlob)
        return 'http://www.biodalliance.org/magic/sequence'
    else
        return sourceDataURI(conf);
}

function sourcesAreEqual(a, b) {
    if (sourceDataURI(a) != sourceDataURI(b) ||
        sourceStyleURI(a) != sourceStyleURI(b))
        return false;

    if (a.mapping != b.mapping)
        return false;

    if (a.tier_type != b.tier_type)
        return false;

    if (a.overlay) {
        if (!b.overlay || b.overlay.length != a.overlay.length)
            return false;
        for (var oi = 0; oi < a.overlay.length; ++oi) {
            if (!sourcesAreEqual(a.overlay[oi], b.overlay[oi]))
                return false;
        }
    } else {
        if (b.overlay)
            return false;
    }

    return true;
}

Browser.prototype.removeTier = function(conf, force) {
    var target = -1;

    if (typeof conf.index !== 'undefined' && conf.index >=0 && conf.index < this.tiers.length) {
        target = conf.index;
    } else {
        for (var ti = 0; ti < this.tiers.length; ++ti) {
            var ts = this.tiers[ti].dasSource;
            
            if (sourcesAreEqual(conf, ts)) {
                target = ti; break;
            }
        }
    }

    if (target < 0) {
        throw "Couldn't find requested tier";
    }

    this.tiers.splice(target, 1);

    var nst = [];
    for (var sti = 0; sti < this.selectedTiers.length; ++sti) {
        var st = this.selectedTiers[sti];
        if (st < target) {
            nst.push(st);
        } else if (st > target) {
            nst.push(st - 1);
        }
    }
    this.selectedTiers = nst;
    this.markSelectedTiers();

    this.reorderTiers();
    this.notifyTier();
}

Browser.prototype.getSequenceSource = function() {
    if (this._sequenceSource === undefined)
        this._sequenceSource = this._getSequenceSource();
    return this._sequenceSource;
}

Browser.prototype._getSequenceSource = function() {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        if (this.tiers[ti].sequenceSource) {
            return this.tiers[ti].sequenceSource;
        }
    }

    for (var si = 0; si < this.defaultSources.length; ++si) {
        var s = this.defaultSources[si];
        if (s.provides_entrypoints || s.tier_type == 'sequence' || s.twoBitURI || s.twoBitBlob) {
            if (s.twoBitURI || s.twoBitBlob) {
                return new TwoBitSequenceSource(s);
            } else {
                return new DASSequenceSource(s);
            }
        }
    }
}

Browser.prototype.setLocation = function(newChr, newMin, newMax, callback) {
    if (typeof(newMin) !== 'number') {
        throw Error('minimum must be a number (got ' + JSON.stringify(newMin) + ')');
    }
    if (typeof(newMax) !== 'number') {
        throw Error('maximum must be a number (got ' + JSON.stringify(newMax) + ')');
    }

    if (!callback) {
        callback = function(err) {
            if (err) {
                throw err;
            }
        }
    }
    var thisB = this;

    if (!newChr || newChr == this.chr) {
        return this._setLocation(null, newMin, newMax, null, callback);
    } else {
        var ss = this.getSequenceSource();
        if (!ss) {
            return callback('Need a sequence source');
        }

        ss.getSeqInfo(newChr, function(si) {
            if (!si) {
                var altChr;
                if (newChr.indexOf('chr') == 0) {
                    altChr = newChr.substr(3);
                } else {
                    altChr = 'chr' + newChr;
                }
                ss.getSeqInfo(altChr, function(si2) {
                    if (!si2) {
                        return callback("Couldn't find sequence '" + newChr + "'");
                    } else {
                        return thisB._setLocation(altChr, newMin, newMax, si2, callback);
                    }
                });
            } else {
                return thisB._setLocation(newChr, newMin, newMax, si, callback);
            }
        });
    }
}

Browser.prototype._setLocation = function(newChr, newMin, newMax, newChrInfo, callback) {
    var chrChanged = false;
    if (newChr) {
        if (newChr.indexOf('chr') == 0)
            newChr = newChr.substring(3);

        if (this.chr != newChr)
            chrChanged = true;
        this.chr = newChr;
        this.currentSeqMax = newChrInfo.length;
    }

    newMin|=0; newMax|=0;
    var newWidth = Math.max(10, newMax-newMin+1);
    if (newMin < 1) {
        newMin = 1; newMax = newMin + newWidth - 1;
    }
    if (newMax > this.currentSeqMax) {
        newMax = this.currentSeqMax;
        newMin = Math.max(1, newMax - newWidth + 1);
    }

    this.viewStart = newMin;
    this.viewEnd = newMax;
    var newScale = Math.max(this.featurePanelWidth, 50) / (this.viewEnd - this.viewStart);
    var oldScale = this.scale;
    var scaleChanged = (Math.abs(newScale - oldScale)) > 0.0001;
    this.scale = newScale;

    var newZS, oldZS;
    oldZS = this.zoomSliderValue;
    this.zoomSliderValue = newZS = this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase);
    
    if (scaleChanged || chrChanged) {
        for (var i = 0; i < this.tiers.length; ++i) {
            this.tiers[i].viewport.style.left = '5000px';
            this.tiers[i].overlay.style.left = '5000px';
        }

        this.refresh();

        if (this.savedZoom) {
            newZS -= this.zoomMin;
            oldZS -= this.zoomMin;
            var difToActive = newZS - oldZS;
            var difToSaved = newZS - this.savedZoom;
            if (Math.abs(difToActive) > Math.abs(difToSaved)) {
                this.isSnapZooming = !this.isSnapZooming;
                this.savedZoom = oldZS;
            }
        } else {
            this.isSnapZooming = false;
            this.savedZoom = null;
        }
    } else {
        var viewCenter = (this.viewStart + this.viewEnd)/2;
    
        for (var i = 0; i < this.tiers.length; ++i) {
            var offset = (this.viewStart - this.tiers[i].norigin)*this.scale;
	        this.tiers[i].viewport.style.left = '' + ((-offset|0) - 1000) + 'px';
            this.tiers[i].drawOverlay();
        }
    }

    this.notifyLocation();

    this.spaceCheck();
    if (this.instrumentActivity)
        this.activityStartTime = Date.now()|0;
    return callback();
}

Browser.prototype.pingActivity = function() {
    if (!this.instrumentActivity || !this.activityStartTime)
        return;

    var activity = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        if (this.tiers[ti].loaderButton.style.display !== 'none')
            ++activity;
    }

    if (activity == 0) {
        var now = Date.now()|0;
        console.log('Loading took ' + (now-this.activityStartTime) + 'ms');
        this.activityStartTime = null;
    }
}

Browser.prototype.addInitListener = function(handler) {
    this.initListeners.push(handler);
}

Browser.prototype.addFeatureListener = function(handler, opts) {
    opts = opts || {};
    this.featureListeners.push(handler);
}

Browser.prototype.notifyFeature = function(ev, feature, hit, tier) {
  for (var fli = 0; fli < this.featureListeners.length; ++fli) {
      try {
          if (this.featureListeners[fli](ev, feature, hit, tier))
            return;
      } catch (ex) {
          console.log(ex.stack);
      }
  }
}

Browser.prototype.addFeatureHoverListener = function(handler, opts) {
    opts = opts || {};
    this.featureHoverListeners.push(handler);
}

Browser.prototype.notifyFeatureHover = function(ev, feature, hit, tier) {
    for (var fli = 0; fli < this.featureHoverListeners.length; ++fli) {
        try {
            this.featureHoverListeners[fli](ev, feature, hit, tier);
        } catch (ex) {
            console.log(ex.stack);
        }
    }
}

Browser.prototype.addViewListener = function(handler, opts) {
    opts = opts || {};
    this.viewListeners.push(handler);
}

Browser.prototype.notifyLocation = function() {
    for (var lli = 0; lli < this.viewListeners.length; ++lli) {
        try {
            this.viewListeners[lli](this.chr, this.viewStart|0, this.viewEnd|0, this.zoomSliderValue, {current: this.zoomSliderValue, min: this.zoomMin, max: this.zoomMax});
        } catch (ex) {
            console.log(ex.stack);
        }
    }
}

Browser.prototype.addTierListener = function(handler) {
    this.tierListeners.push(handler);
}

Browser.prototype.notifyTier = function() {
    for (var tli = 0; tli < this.tierListeners.length; ++tli) {
        try {
            this.tierListeners[tli]();
        } catch (ex) {
            console.log(ex.stack);
        }
    }
}

Browser.prototype.addRegionSelectListener = function(handler) {
    this.regionSelectListeners.push(handler);
}

Browser.prototype.notifyRegionSelect = function(chr, min, max) {
    for (var rli = 0; rli < this.regionSelectListeners.length; ++rli) {
        try {
            this.regionSelectListeners[rli](chr, min, max);
        } catch (ex) {
            console.log(ex.stack);
        }
    }
}


Browser.prototype.highlightRegion = function(chr, min, max) {
    var thisB = this;
    
    if (chr == this.chr) {
        return this._highlightRegion(chr, min, max);
    }

    var ss = this.getSequenceSource();
    if (!ss) {
        throw 'Need a sequence source';
    }

    ss.getSeqInfo(chr, function(si) {
        if (!si) {
            var altChr;
            if (chr.indexOf('chr') == 0) {
                altChr = chr.substr(3);
            } else {
                altChr = 'chr' + chr;
            }
            ss.getSeqInfo(altChr, function(si2) {
                if (!si2) {
                    // Fail silently.
                } else {
                    return thisB._highlightRegion(altChr, min, max);
                }
            });
        } else {
            return thisB._highlightRegion(chr, min, max);
        }
    });
}

Browser.prototype._highlightRegion = function(chr, min, max) {
    for (var hi = 0; hi < this.highlights.length; ++hi) {
        var h = this.highlights[hi];
        if (h.chr == chr && h.min == min && h.max == max)
            return;
    }

    this.highlights.push(new Region(chr, min, max));
    var visStart = this.viewStart - (1000/this.scale);
    var visEnd = this.viewEnd + (1000/this.scale);
    if ((chr == this.chr || chr == ('chr'+this.chr)) && min < visEnd && max > visStart) {
        this.drawOverlays();
    }

    this.notifyLocation();
}

Browser.prototype.clearHighlights = function() {
    this.highlights = [];
    this.drawOverlays();
    this.notifyLocation();
}

Browser.prototype.drawOverlays = function() {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        this.tiers[ti].drawOverlay();
    }
}

Browser.prototype.featuresInRegion = function(chr, min, max) {
    var features = [];
    if (chr !== this.chr) {
        return [];
    }

    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var fl = this.tiers[ti].currentFeatures || [];
        for (var fi = 0; fi < fl.length; ++fi) {
            var f = fl[fi];
            if (f.min <= max && f.max >= min) {
                features.push(f);
            }
        }
    }
    return features;
}


Browser.prototype.getSelectedTier = function() {
    if (this.selectedTiers.length > 0) 
        return this.selectedTiers[0];
    else
        return -1;
}

Browser.prototype.setSelectedTier = function(t) {
    if (t == null) {
        this.selectedTiers = [];
    } else {
        this.selectedTiers = [t];
    }
    this.markSelectedTiers();
    this.notifyTierSelection();
}

Browser.prototype.markSelectedTiers = function() {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var button = this.tiers[ti].nameButton;

        if (this.selectedTiers.indexOf(ti) >= 0) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }
    if (this.selectedTiers.length > 0) {
        this.browserHolder.focus();
    }
}

Browser.prototype.addTierSelectionListener = function(f) {
    this.tierSelectionListeners.push(f);
}

Browser.prototype.notifyTierSelection = function() {
    for (var fli = 0; fli < this.tierSelectionListeners.length; ++fli) {
        try {
            this.tierSelectionListeners[fli](this.selectedTiers);
        } catch (ex) {
            console.log(ex.stack);
        }
    }
}

Browser.prototype.addTierSelectionWrapListener = function(f) {
    this.tierSelectionWrapListeners.push(f);
}

Browser.prototype.notifyTierSelectionWrap = function(i) {
    for (var fli = 0; fli < this.tierSelectionWrapListeners.length; ++fli) {
        try {
            this.tierSelectionWrapListeners[fli](i);
        } catch (ex) {
            console.log(ex.stack);
        }
    }
}

Browser.prototype.positionRuler = function() {
    var display = 'none';
    var left = '';
    var right = '';

    if (this.rulerLocation == 'center') {
        display = 'block';
        left = '' + ((this.featurePanelWidth/2)|0) + 'px';
    } else if (this.rulerLocation == 'left') {
        display = 'block';
        left = '0px';
    } else if (this.rulerLocation == 'right') {
        display = 'block';
        right = '0px'
    } else {
        display = 'none';
    }

    this.ruler.style.display = display;
    this.ruler.style.left = left;
    this.ruler.style.right = right;

    this.ruler2.style.display = this.rulerLocation == 'center' ? 'none' : 'block';
    this.ruler2.style.left = '' + ((this.featurePanelWidth/2)|0) + 'px';

    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var tier = this.tiers[ti];
        var q = tier.quantOverlay;

        var quant;
        if (tier.subtiers && tier.subtiers.length > 0)
            quant = tier.subtiers[0].quant;

        if (q) {
            q.style.display = quant ? display : 'none';
            q.style.left = left;
            q.style.right = right;
        }
    }
}

Browser.prototype.featureDoubleClick = function(hit, rx, ry) {
    if (!hit || hit.length == 0)
        return;

    var f = hit[hit.length - 1];

    if (!f.min || !f.max) {
        return;
    }

    var fstart = (((f.min|0) - (this.viewStart|0)) * this.scale);
    var fwidth = (((f.max - f.min) + 1) * this.scale);
    
    var newMid = (((f.min|0) + (f.max|0)))/2;
    if (fwidth > 10) {
        var frac = (1.0 * (rx - fstart)) / fwidth;
        if (frac < 0.3) {
            newMid = (f.min|0);
        } else  if (frac > 0.7) {
            newMid = (f.max|0) + 1;
        }
    }

    var width = this.viewEnd - this.viewStart;
    this.setLocation(null, newMid - (width/2), newMid + (width/2));
}

Browser.prototype.zoomForScale = function(scale) {
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

Browser.prototype.zoomForCurrentScale = function() {
    return this.zoomForScale(this.scale);
}

Browser.prototype.updateHeight = function() {
    var tierTotal = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) 
        tierTotal += (this.tiers[ti].currentHeight || 30);
    this.ruler.style.height = '' + tierTotal + 'px';
    this.ruler2.style.height = '' + tierTotal + 'px';
    // this.svgHolder.style.maxHeight = '' + Math.max(tierTotal, 500) + 'px';
}

Browser.prototype.scrollArrowKey = function(ev, dir) {
    if (this.reverseKeyScrolling)
        dir = -dir;
    
    if (ev.ctrlKey || ev.metaKey) {
        var fedge = false;
        if(ev.shiftKey){
            fedge = true;
        }

        this.leap(dir, fedge);
    } else {
        this.move(ev.shiftKey ? 100*dir : 25*dir);
    }
}

Browser.prototype.leap = function(dir, fedge) {
    var thisB = this;
    var pos=((thisB.viewStart + thisB.viewEnd + 1)/2)|0;
    if (dir > 0 && thisB.viewStart <= 1) {
        pos -= 100000000;
    } else if (dir < 0 && thisB.viewEnd >= thisB.currentSeqMax) {
        pos += 100000000;
    }

    var st = thisB.getSelectedTier();
    if (st < 0) return;
    var tier = thisB.tiers[st];

    if (tier && ((tier.featureSource && this.sourceAdapterIsCapable(tier.featureSource, 'quantLeap') && typeof(tier.quantLeapThreshold) == 'number')
                 || (tier.featureSource && this.sourceAdapterIsCapable(tier.featureSource, 'leap')))) {
        tier.findNextFeature(
              thisB.chr,
              pos,
              -dir,
              fedge,
              function(nxt) {
                  if (nxt) {
                      var nmin = nxt.min;
                      var nmax = nxt.max;
                      if (fedge) { 
                        if (dir > 0) {
                          if (nmin>pos+1) {
                              nmax=nmin;
                          } else {
                              nmax++;
                              nmin=nmax
                          }
                        } else {
                            if (nmax<pos-1) {
                                nmax++;
                                nmin=nmax;
                            } else {
                                nmax=nmin;
                            }
                        } 
                      }
                      var wid = thisB.viewEnd - thisB.viewStart + 1;
                      if(parseFloat(wid/2) == parseInt(wid/2)){wid--;}
                      var newStart = (nmin + nmax - wid)/2 + 1;
                      var newEnd = newStart + wid - 1;
                      var pos2=pos;
                      thisB.setLocation(nxt.segment, newStart, newEnd);
                  } else {
                      alert('no next feature'); // FIXME better reporting would be nice!
                  }
              });
    } else {
        this.move(100*dir);
    }
}

function glyphLookup(glyphs, rx, ry, matches) {
    matches = matches || [];

    for (var gi = glyphs.length - 1; gi >= 0; --gi) {
        var g = glyphs[gi];
        if (!g.notSelectable && g.min() <= rx && g.max() >= rx) {
            if (g.minY) {
                if (ry < g.minY() || ry > g.maxY())
                    continue;
            }

            if (g.feature) {
                matches.push(g.feature);
            } else if (g.group) {
                matches.push(g.group);
            }
    
            if (g.glyphs) {
                return glyphLookup(g.glyphs, rx, ry, matches);
            } else if (g.glyph) {
                return glyphLookup([g.glyph], rx, ry, matches);
            } else {
                return matches;
            }
        }
    }
    return matches;
}

Browser.prototype.nameForCoordSystem = function(cs) {
    var primary = null, ucsc = null;
    if (this.assemblyNamePrimary) {
        primary = '' + cs.auth;
        if (typeof(cs.version) !== 'undefined')
            primary += cs.version;
    }
    if (this.assemblyNameUcsc) {
        ucsc = cs.ucscName;
    }
    if (primary != null && ucsc != null)
        return primary + '/' + ucsc;
    else 
        return primary || ucsc || 'unknown';
}

Browser.prototype.makeLoader = function(size) {
    size = size || 16;
    var retina = window.devicePixelRatio > 1;
    if (size < 20) {
        return makeElement('img', null, {src: this.resolveURL('$$img/spinner_' + (retina ? 16 : 32) + '.gif'), width: '16', height: '16'});
    } else {
        return makeElement('img', null, {src: this.resolveURL('$$img/spinner_' + (retina ? 24 : 48) + '.gif'), width: '24', height: '24'});
    }
}

Browser.prototype.getWorker = function() {
    if (!this.useFetchWorkers || !this.fetchWorkers || this.fetchWorkers.length==0)
        return null;

    if (this.nextWorker >= this.fetchWorkers.length)
        this.nextWorker = 0;
    return this.fetchWorkers[this.nextWorker++];
}

function FetchWorker(browser, worker) {
    var thisB = this;
    this.tagSeed = 0;
    this.callbacks = {};
    this.browser = browser;
    this.worker = worker;

    this.worker.onmessage = function(ev) {
        var cb = thisB.callbacks[ev.data.tag];
        if (cb) {
            cb(ev.data.result, ev.data.error);
            delete thisB.callbacks[ev.data.tag];
        }
    };
}

function makeFetchWorker(browser) {
    var wurl = browser.resolveURL(browser.workerPath);
    if (wurl.indexOf('//') == 0) {
        if (window.location.prototype === 'https:')
            wurl = 'https:' + wurl;
        else
            wurl = 'http:' + wurl;
    }

    var wscript = 'importScripts("' + wurl + '");';
    var wblob = new Blob([wscript], {type: 'application/javascript'});


    return new Promise(function(resolve, reject) {
        var worker = new Worker(URL.createObjectURL(wblob));

        worker.onmessage = function(ev) {
            if (ev.data.tag === 'init') {
                console.log('Worker initialized');
                resolve(new FetchWorker(browser, worker))
            }
            
        }

        worker.onerror = function(ev) {
            reject(ev.message);
        }
    });    
}

FetchWorker.prototype.postCommand = function(cmd, callback, transfer) {
    var tag = 'x' + (++this.tagSeed);
    cmd.tag = tag;
    this.callbacks[tag] = callback;
    this.worker.postMessage(cmd, transfer);
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        Browser: Browser,
        sourcesAreEqual: sourcesAreEqual,
        sourceDataURI: sourceDataURI
    };

    // Required because they add stuff to Browser.prototype
    require('./browser-ui');
    require('./track-adder');
    require('./feature-popup');
    require('./tier-actions');
    require('./domui');
    require('./search');

    var sa = require('./sourceadapters');
    var TwoBitSequenceSource = sa.TwoBitSequenceSource;
    var DASSequenceSource = sa.DASSequenceSource;

    var KnownSpace = require('./kspace').KnownSpace;

    var DASRegistry = require('./das').DASRegistry;
}

function SourceCache() {
    this.sourcesByURI = {}
}

SourceCache.prototype.get = function(conf) {
    var scb = this.sourcesByURI[sourceDataURI(conf)];
    if (scb) {
        for (var si = 0; si < scb.configs.length; ++si) {
            if (sourcesAreEqual(scb.configs[si], conf)) {
                return scb.sources[si];
            }
        }
    }
}

SourceCache.prototype.put = function(conf, source) {
    var uri = sourceDataURI(conf);
    var scb = this.sourcesByURI[uri];
    if (!scb) {
        scb = {configs: [], sources: []};
        this.sourcesByURI[uri] = scb;
    }
    scb.configs.push(conf);
    scb.sources.push(source);
}
