/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// cbrowser.js: canvas browser container
//

var NS_SVG = 'http://www.w3.org/2000/svg';
var NS_HTML = 'http://www.w3.org/1999/xhtml';
var NS_XLINK = 'http://www.w3.org/1999/xlink';

function Region(chr, min, max) {
    this.min = min;
    this.max = max;
    this.chr = chr;
}

function Browser(opts) {
    if (!opts) {
        opts = {};
    }

    this.uiPrefix = 'http://www.biodalliance.org/release-0.10/';

    this.sources = [];
    this.tiers = [];

    this.featureListeners = [];
    this.featureHoverListeners = [];
    this.viewListeners = [];
    this.regionSelectListeners = [];
    this.tierListeners = [];
    this.tierSelectionWrapListeners = [];

    this.cookieKey = 'browser';
    this.karyoEndpoint = new DASSource('http://www.derkholm.net:8080/das/hsa_54_36p/');
    this.registry = 'http://www.dasregistry.org/das/sources';
    this.coordSystem = {
        speciesName: 'Human',
        taxon: 9606,
        auth: 'NCBI',
        version: '36',
        ucscName: 'hg18'
    };
    this.chains = {};

    this.pageName = 'svgHolder'
    this.maxExtra = 2.5;
    this.minExtra = 0.5;
    this.zoomFactor = 1.0;
    this.zoomMin = 10.0;
    this.zoomMax;       // Allow configuration for compatibility, but otherwise clobber.
    this.origin = 0;
    this.targetQuantRes = 5.0;
    this.featurePanelWidth = 750;
    this.zoomBase = 100;
    this.zoomExpt = 30.0; // Back to being fixed....
    this.zoomSliderValue = 100;
    this.entryPoints = null;
    this.currentSeqMax = -1; // init once EPs are fetched.

    this.highlights = [];

    this.autoSizeTiers = false;
    this.guidelineStyle = 'foreground';
    this.guidelineSpacing = 75;
    this.fgGuide = null;
    this.positionFeedback = false;
    
    this.selectedTiers = [1];

    this.placards = [];

    this.maxViewWidth = 500000;

    // Options.
    
    this.reverseScrolling = false;
    this.rulerLocation = 'center';

    // Visual config.

    // this.tierBackgroundColors = ["rgb(245,245,245)", "rgb(230,230,250)" /* 'white' */];
    this.tierBackgroundColors = ["rgb(245,245,245)", 'white'];
    this.minTierHeight = 30;

    this.browserLinks = {
        Ensembl: 'http://ncbi36.ensembl.org/Homo_sapiens/Location/View?r=${chr}:${start}-${end}',
        UCSC: 'http://genome.ucsc.edu/cgi-bin/hgTracks?db=hg18&position=chr${chr}:${start}-${end}'
    }

    // Registry

    this.availableSources = new Observed();
    this.defaultSources = [];
    this.mappableSources = {};

    this.hubs = [];
    this.hubObjects = [];

    this.sourceCache = new SourceCache();


    for (var k in opts) {
        this[k] = opts[k];
    }

    var thisB = this;
    window.addEventListener('load', function(ev) {thisB.realInit();}, false);
}

Browser.prototype.realInit = function() {
    this.supportsBinary = true; /* (typeof Int8Array === 'function');*/ 
    
    this.defaultChr = this.chr;
    this.defaultStart = this.viewStart;
    this.defaultEnd = this.viewEnd;
    this.defaultSources = [];
    for (var i = 0; i < this.sources.length; ++i) {
        this.defaultSources.push(this.sources[i]);
    }

    if (this.restoreStatus) {
        this.restoreStatus();
    }

    var helpPopup;
    var thisB = this;
    this.browserHolderHolder = document.getElementById(this.pageName);
    this.browserHolder = makeElement('div', null, {tabIndex: -1}, {outline: 'none', display: 'inline-block', width: '100%'});
    removeChildren(this.browserHolderHolder);
    this.browserHolderHolder.appendChild(this.browserHolder);
    this.svgHolder = makeElement('div', null, {className: 'main-holder'});

    this.initUI(this.browserHolder, this.svgHolder);

    this.tierHolder = makeElement('div', null, {className: 'tier-holder'});
    this.svgHolder.appendChild(this.tierHolder);

    this.bhtmlRoot = makeElement('div');
    if (!this.disablePoweredBy) {
        this.bhtmlRoot.appendChild(makeElement('span', ['Powered by ', makeElement('a', 'Dalliance', {href: 'http://www.biodalliance.org/'}), ' ' + VERSION], {className: 'powered-by'}));
    }
    this.browserHolder.appendChild(this.bhtmlRoot);
    
    window.addEventListener('resize', function(ev) {
        thisB.resizeViewer();
    }, false);

    this.ruler = makeElement('div', null, {className: 'guideline'})
    this.ruler2 = makeElement('div', null, {className: 'guideline'}, {backgroundColor: 'gray', opacity: '0.5', zIndex: 899});
    this.svgHolder.appendChild(this.ruler);
    this.svgHolder.appendChild(this.ruler2);

    setTimeout(function() {thisB.realInit2()}, 1);
}

Browser.prototype.realInit2 = function() {
    var thisB = this;
    this.featurePanelWidth = this.tierHolder.getBoundingClientRect().width | 0;
    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);
    // this.zoomExpt = 250 / Math.log(/* MAX_VIEW_SIZE */ 500000.0 / this.zoomBase);
    if (!this.zoomMax) {
        this.zoomMax = this.zoomExpt * Math.log(this.maxViewWidth / this.zoomBase);
    }
    this.zoomSliderValue = this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase);

    // Event handlers
    this.tierHolder.addEventListener('mousewheel', function(ev) {
        if (!ev.wheelDeltaX) {
            return;
        }

        ev.stopPropagation(); ev.preventDefault();
        var delta = ev.wheelDeltaX/5;
        if (!thisB.reverseScrolling) {
            delta = -delta;
        }
        thisB.move(delta);
    }, false);
    this.tierHolder.addEventListener('MozMousePixelScroll', function(ev) {
        if (ev.axis == 1) {
            ev.stopPropagation(); ev.preventDefault();

            if (ev.detail != 0) {
                var delta = ev.detail/4;
                if (thisB.reverseScrolling) {
                    delta = -delta;
                }
                thisB.move(delta);
            }
        }
    }, false);

    var keyHandler = function(ev) {
        // console.log('cbkh: ' + ev.keyCode);
        if (ev.keyCode == 13) { // enter
            var layoutsChanged = false;
            for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                var t = thisB.tiers[ti];
                if (t.wantedLayoutHeight && t.wantedLayoutHeight != t.layoutHeight) {
                    t.layoutHeight = t.wantedLayoutHeight;
                    t.placard = null;
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
                var newZoom = thisB.savedZoom || 1.0;
                thisB.savedZoom = thisB.zoomSliderValue;
                thisB.zoomSliderValue = newZoom;
                thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
            } else {
                thisB.isSnapZooming = false;
                var newZoom = thisB.savedZoom || 10.0;
                thisB.savedZoom = thisB.zoomSliderValue;
                thisB.zoomSliderValue = newZoom;
                thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
            }
            thisB.snapZoomLockout = true;
            ev.stopPropagation(); ev.preventDefault();      
        } else if (ev.keyCode == 39) { // right arrow
            ev.stopPropagation(); ev.preventDefault();
            if (ev.ctrlKey) {
                var fedge = 0;
                if(ev.shiftKey){
                    fedge = 1;
                }
                var pos=((thisB.viewStart + thisB.viewEnd + 1)/2)|0;

                var st = thisB.getSelectedTier();
                if (st < 0) return;
                thisB.tiers[st].findNextFeature(
                      thisB.chr,
                      pos,
                      -1,
                      fedge,
                      function(nxt) {
                          if (nxt) {
                              var nmin = nxt.min;
                              var nmax = nxt.max;
                              if (fedge) {
                                  if (nmax<pos-1) {
                                      nmax++;
                                      nmin=nmax;
                                  } else {
                                      nmax=nmin;
                                  }
                              }
                              var wid = thisB.viewEnd - thisB.viewStart + 1;
                              if(parseFloat(wid/2) == parseInt(wid/2)){wid--;}
                              var newStart = (nmin + nmax - wid)/2 + 1;
                              var newEnd = newStart + wid - 1;
                              var pos2=pos;
                              thisB.setLocation(nxt.segment, newStart, newEnd);
                          } else {
                              alert('no next feature');
                          }
                      });
            } else {
                thisB.move(ev.shiftKey ? 100 : 25);
            }
        } else if (ev.keyCode == 37) { // left arrow
            ev.stopPropagation(); ev.preventDefault();
            if (ev.ctrlKey) {
                var fedge = 0;
                if(ev.shiftKey){
                    fedge = 1;
                }
                var pos=((thisB.viewStart + thisB.viewEnd + 1)/2)|0;
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                thisB.tiers[st].findNextFeature(
                      thisB.chr,
                      pos,
                      1,
                      fedge,
                      function(nxt) {
                          if (nxt) {
                              var nmin = nxt.min;
                              var nmax = nxt.max;
                              if (fedge) { 
                                  if (nmin>pos+1) {
                                      nmax=nmin;
                                  } else {
                                      nmax++;
                                      nmin=nmax
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
                thisB.move(ev.shiftKey ? -100 : -25);
            }
        } else if (ev.keyCode == 38 || ev.keyCode == 87) { // up arrow | w
            ev.stopPropagation(); ev.preventDefault();

            if (ev.shiftKey) {
                var st = thisB.getSelectedTier();
                if (st < 0) return;
                var tt = thisB.tiers[st];
                var ch = tt.forceHeight || tt.subtiers[0].height;
                if (ch >= 40) {
                    tt.forceHeight = ch - 10;
                    tt.draw();
                }
            } else if (ev.ctrlKey) {
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
                    tt.quantLeapThreshold = qmin + ((Math.round((tt.quantLeapThreshold - qmin)/qscale)|0)+1)*qscale;

                    tt.notify('Threshold: ' + formatQuantLabel(tt.quantLeapThreshold));
                    tt.draw();
                }                
            } else {
                var st = thisB.getSelectedTier();
                if (st > 0) {
                    thisB.setSelectedTier(st - 1);
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
                tt.forceHeight = ch + 10;
                tt.draw();
            } else if (ev.ctrlKey) {
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
                        tt.quantLeapThreshold = qmin + (it-1)*qscale;
                        tt.notify('Threshold: ' + formatQuantLabel(tt.quantLeapThreshold));
                        tt.draw();
                    }
                }
            } else {
                var st = thisB.getSelectedTier();
                if (st < thisB.tiers.length -1) {
                    thisB.setSelectedTier(st + 1);
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
            if (thisB.selectedTiers.length > 1) {
                thisB.mergeSelectedTiers();
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
        if (source.bwgURI && !this.supportsBinary) {
            if (!this.binaryWarningGiven) {
                this.popit({clientX: 300, clientY: 100}, 'Warning', makeElement('p', 'your browser does not support binary data formats, some track(s) not loaded.  We currently recommend Google Chrome 9 or later, or Firefox 4 or later.'));
                this.binaryWarningGiven = true;
            }
            continue;
        }

        if (!source.disabled)
            this.makeTier(source);
    }
    thisB.arrangeTiers();
    thisB.refresh();
    thisB.setSelectedTier(1);

    thisB.positionRuler();


    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var t = this.tiers[ti];
        if (t.sequenceSource) {
            t.sequenceSource.getSeqInfo(this.chr, function(si) {
                if (si) {
                    // console.log(si);
                    thisB.currentSeqMax = si.length;
                }
            });
            break;
        }
    }

    this.queryRegistry();
    for (var m in this.chains) {
        this.queryRegistry(m, true);
    }

    if (this.hubs) {
        for (var hi = 0; hi < this.hubs.length; ++hi) {
            connectTrackHub(this.hubs[hi], function(hub, err) {
                if (err) {
                    console.log(err);
                } else {
                    thisB.hubObjects.push(hub);
                }
            });
        }
    }
}

// 
// iOS touch support

Browser.prototype.touchStartHandler = function(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    
    this.touchOriginX = ev.touches[0].pageX;
    if (ev.touches.length == 2) {
        var sep = Math.abs(ev.touches[0].pageX - ev.touches[1].pageX);
        this.zooming = true;
        this.zoomLastSep = this.zoomInitialSep = sep;
        this.zoomInitialScale = this.scale;
    }
}

Browser.prototype.touchMoveHandler = function(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    
    if (ev.touches.length == 1) {
        var touchX = ev.touches[0].pageX;
        if (this.touchOriginX && touchX != this.touchOriginX) {
            this.move(touchX - this.touchOriginX);
        }
        this.touchOriginX = touchX;
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

Browser.prototype.touchEndHandler = function(ev)
{
    ev.stopPropagation(); ev.preventDefault();
}

Browser.prototype.touchCancelHandler = function(ev) {
}


Browser.prototype.makeTier = function(source) {
    try {
        this.realMakeTier(source);
    } catch (e) {
        console.log(e.stack);
    }
}

Browser.prototype.realMakeTier = function(source) {
    var thisB = this;
    var background = this.tierBackgroundColors[this.tiers.length % this.tierBackgroundColors.length];

    var viewport = makeElement('canvas', null, 
                               {width: '' + ((this.featurePanelWidth|0) + 2000), 
                                height: "50",
                                className: 'viewport'});
                               

    var viewportOverlay = makeElement('canvas', null,
         {width: + ((this.featurePanelWidth|0) + 2000), 
          height: "50",
          className: 'viewport-overlay'});

    var placardContent = makeElement('span', '');
    var placard = makeElement('div', [makeElement('i', null, {className: 'icon-warning-sign'}), ' ', placardContent], {className: 'placard'});
    
    var notifier = makeElement('div', 'Exciting message', {},
        {backgroundColor: 'black',
         color: 'white', 
         zIndex: 5000,
         position: 'relative',
         top: '-25px',
         opacity: 0.0,
         padding: '6px',
         borderRadius: '4px',
         display: 'inline-block',
         transition: 'opacity 0.6s ease-in-out'
         });

    var vph = makeElement('div', [viewport, viewportOverlay], {className: 'view-holder'});
    // vph.className = 'tier-viewport-background';
    vph.style.background = background;

    vph.addEventListener('touchstart', function(ev) {return thisB.touchStartHandler(ev)}, false);
    vph.addEventListener('touchmove', function(ev) {return thisB.touchMoveHandler(ev)}, false);
    vph.addEventListener('touchend', function(ev) {return thisB.touchEndHandler(ev)}, false);
    vph.addEventListener('touchcancel', function(ev) {return thisB.touchCancelHandler(ev)}, false); 

    var tier = new DasTier(this, source, viewport, vph, viewportOverlay, placard, placardContent);
    tier.oorigin = this.viewStart;
    tier.background = background;
    tier.notifier = notifier;

    tier.quantOverlay = makeElement(
        'canvas', null, 
        {width: '50', height: "56",
         className: 'quant-overlay'});
    tier.holder.appendChild(tier.quantOverlay);
    
    var isDragging = false;
    var dragOrigin, dragMoveOrigin;
    var hoverTimeout;

    var featureLookup = function(rx, ry) {
        var st = tier.subtiers;
        if (!st) {
            return;
        }

        var sti = 0;
        ry -= MIN_PADDING;
        while (sti < st.length && ry > st[sti].height && sti < (st.length - 1)) {
            ry = ry - st[sti].height - MIN_PADDING;
            ++sti;
        }
        if (sti >= st.length) {
            return;
        }

        var glyphs = st[sti].glyphs;
        var viewCenter = (thisB.viewStart + thisB.viewEnd)/2;
        var offset = (tier.glyphCacheOrigin - thisB.viewStart)*thisB.scale;
        rx -= offset;
       
        return glyphLookup(glyphs, rx);
    }

    var dragMoveHandler = function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        var rx = ev.clientX;
        if (tier.dasSource.tier_type !== 'sequence' && rx != dragMoveOrigin) {
            thisB.move((rx - dragMoveOrigin));
            dragMoveOrigin = rx;
        }
        thisB.isDragging = true;
    }

    var dragUpHandler = function(ev) {
        window.removeEventListener('mousemove', dragMoveHandler, true);
        window.removeEventListener('mouseup', dragUpHandler, true);
        // thisB.isDragging = false;    // Can't clear here before the per-tier mouseups get called later :-(.
                                        // Shouldn't matter because cleared on next mousedown. 
    }
        

    vph.addEventListener('mousedown', function(ev) {
        thisB.browserHolder.focus();
        ev.preventDefault();
        var br = vph.getBoundingClientRect();
        var rx = ev.clientX, ry = ev.clientY;

        window.addEventListener('mousemove', dragMoveHandler, true);
        window.addEventListener('mouseup', dragUpHandler, true);
        dragOrigin = dragMoveOrigin = rx;
        thisB.isDragging = false; // Not dragging until a movement event arrives.
    }, false);

    vph.addEventListener('mousemove', function(ev) {
        var br = vph.getBoundingClientRect();
        var rx = ev.clientX - br.left, ry = ev.clientY - br.top;

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
    vph.addEventListener('mouseup', function(ev) {
        var br = vph.getBoundingClientRect();
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

        if (thisB.isDragging && rx != dragOrigin && tier.dasSource.tier_type === 'sequence') {
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

    vph.addEventListener('mouseout', function(ev) {
        isDragging = false;
    });



    tier.removeButton = makeElement('i', null, {className: 'icon-remove'});
    tier.bumpButton = makeElement('i', null, {className: 'icon-plus-sign'});
    tier.loaderButton = makeElement('img', null, {src: this.uiPrefix + 'img/loader.gif'}, {display: 'none'});
    tier.infoElement = makeElement('div', tier.dasSource.desc, {}, {display: 'none', maxWidth: '200px', whiteSpace: 'normal', color: 'rgb(100,100,100)'});
    tier.nameButton = makeElement('a', [], {className: 'tier-tab'});
    tier.nameButton.appendChild(tier.removeButton);
    if (source.pennant) {
        tier.nameButton.appendChild(makeElement('img', null, {src: source.pennant, width: '16', height: '16'}))
    }
    tier.nameElement = makeElement('span', source.name);
    tier.nameButton.appendChild(makeElement('span', [tier.nameElement, tier.infoElement], {}, {display: 'inline-block', marginLeft: '5px', marginRight: '5px'}));
    tier.nameButton.appendChild(tier.bumpButton);
    tier.nameButton.appendChild(tier.loaderButton);
    
    tier.label = makeElement('span',
       [tier.nameButton],
       {className: 'btn-group'},
       {zIndex: 1001, position: 'absolute', left: '2px', top: '2px', opacity: 0.8, display: 'inline-block'});
    var row = makeElement('div', [vph, placard , tier.label, notifier], {}, {position: 'relative', display: 'block', textAlign: 'center' /*, transition: 'height 0.5s' */});
    tier.row = row;


    tier.removeButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        thisB.removeTier(source);
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
    var tierOrdinal;
    var yAtLastReorder;
    var tiersWereReordered = false;

    var labelDragHandler = function(ev) {
        var label = tier.label;
        ev.stopPropagation(); ev.preventDefault();
        if (!dragLabel) {
            dragLabel = label.cloneNode(true);
            dragLabel.style.cursor = 'pointer';
            thisB.svgHolder.appendChild(dragLabel);
            label.style.visibility = 'hidden';
            

            for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                if (thisB.tiers[ti] === tier) {
                    tierOrdinal = ti;
                    break;
                }
            }

            yAtLastReorder = ev.clientY;
        }
        
        var holderBCR = thisB.svgHolder.getBoundingClientRect();
        dragLabel.style.left = (label.getBoundingClientRect().left - holderBCR.left) + 'px'; 
        dragLabel.style.top = (ev.clientY - holderBCR.top - 10) + 'px';
        
        var pty = ev.clientY - thisB.tierHolder.getBoundingClientRect().top;
        for (var ti = 0; ti < thisB.tiers.length; ++ti) {
            var tt = thisB.tiers[ti];
            var ttr = tt.row.getBoundingClientRect();
            pty -= (ttr.bottom - ttr.top);
            if (pty < 0) {
                if (ti < tierOrdinal && ev.clientY < yAtLastReorder || ti > tierOrdinal && ev.clientY > yAtLastReorder) {
                    var st = [];
                    for (var xi = 0; xi < thisB.selectedTiers.length; ++xi) {
                        st.push(thisB.tiers[thisB.selectedTiers[xi]]);
                    }

                    thisB.tiers.splice(tierOrdinal, 1);
                    thisB.tiers.splice(ti, 0, tier);
                    var ts = thisB.sources[tierOrdinal];
                    thisB.sources.splice(tierOrdinal, 1);
                    thisB.sources.splice(ti, 0, ts);

                    thisB.selectedTiers = [];
                    for (var sti = 0; sti < thisB.tiers.length; ++sti) {
                        if (st.indexOf(thisB.tiers[sti]) >= 0)
                            thisB.selectedTiers.push(sti);
                    }

                    tierOrdinal = ti;
                    yAtLastReorder = ev.clientY;
                    removeChildren(thisB.tierHolder);
                    for (var i = 0; i < thisB.tiers.length; ++i) {
                        thisB.tierHolder.appendChild(thisB.tiers[i].row);
                    }
                    thisB.tierHolder.appendChild(thisB.ruler);
                    thisB.tierHolder.appendChild(thisB.ruler2);
                    tiersWereReordered = true;
                    thisB.arrangeTiers();
                }
                break;
            }
        }
    };

    var labelReleaseHandler = function(ev) {
        var label = tier.label;
        ev.stopPropagation(); ev.preventDefault();
        if (dragLabel) {
            dragLabel.style.cursor = 'auto';
            thisB.svgHolder.removeChild(dragLabel);
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

    this.tierHolder.appendChild(row);    
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
        });
    }
}

Browser.prototype.refreshTier = function(tier) {
    if (this.knownSpace) {
        this.knownSpace.invalidate(tier);
    }
}

Browser.prototype.arrangeTiers = function() {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var t = this.tiers[ti];
        t.background = this.tierBackgroundColors[ti % this.tierBackgroundColors.length];
        t.holder.style.background = t.background;
    }
}



Browser.prototype.refresh = function() {
    this.notifyLocation();
    var width = (this.viewEnd - this.viewStart) + 1;
    /* var minExtraW = (width * this.minExtra) | 0;
    var maxExtraW = (width * this.maxExtra) | 0;*/
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
        var ss = null;
        for (var i = 0; i < this.tiers.length; ++i) {
            if (this.tiers[i].sequenceSource) {
                ss = this.tiers[i].sequenceSource;
                break;
            }
        }
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
                    // alert('Using cached registry data');
                    return;
                } else {
                    // alert('Registry data is stale, refetching');
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
    this.viewStart -= pos / this.scale;
    this.viewEnd = this.viewStart + wid;
    if (this.currentSeqMax > 0 && this.viewEnd > this.currentSeqMax) {
        this.viewEnd = this.currentSeqMax;
        this.viewStart = this.viewEnd - wid;
    }
    if (this.viewStart < 1) {
        this.viewStart = 1;
        this.viewEnd = this.viewStart + wid;
    }
    this.notifyLocation();
    
    var viewCenter = (this.viewStart + this.viewEnd)/2;
    
    for (var i = 0; i < this.tiers.length; ++i) {
        var offset = (this.viewStart - this.tiers[i].norigin)*this.scale;
	this.tiers[i].viewport.style.left = '' + ((-offset|0) - 1000) + 'px';
        var ooffset = (this.viewStart - this.tiers[i].oorigin)*this.scale;
        this.tiers[i].overlay.style.left = '' + ((-ooffset|0) - 1000) + 'px';
    }

    this.spaceCheck();
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

    var oldFPW = this.featurePanelWidth;
    this.featurePanelWidth = width|0;

    if (oldFPW != this.featurePanelWidth) {
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
}

Browser.prototype.addTier = function(conf) {
    this.sources.push(conf);
    this.makeTier(conf);
    this.markSelectedTiers();
    this.positionRuler();
    this.notifyTier();
}

function sourceDataURI(conf) {
    if (conf.uri) {
        return conf.uri;
    } else if (conf.bwgBlob) {
        return 'file:' + conf.bwgBlob.name;
    } else if (conf.bamBlob) {
        return 'file:' + conf.bamBlob.name;
    }

    return conf.bwgURI || conf.bamURI || conf.jbURI || conf.twoBitURI || 'http://www.biodalliance.org/magic/no_uri';
}

function sourceStyleURI(conf) {
    if (conf.stylesheet_uri)
        return conf.stylesheet_uri;
    else if (conf.tier_type == 'sequence')
        return 'http://www.biodalliance.org/magic/sequence'
    else
        return sourceDataURI(conf);
}

function sourcesAreEqual(a, b) {
    if (sourceDataURI(a) != sourceDataURI(b) ||
        sourceStyleURI(a) != sourceStyleURI(b))
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

Browser.prototype.removeTier = function(conf) {
    var target = -1;

    // FIXME can this be done in a way that doesn't need changing every time we add
    // new datasource types.

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

    var victim = this.tiers[target];
    this.tierHolder.removeChild(victim.row);
    this.tiers.splice(target, 1);
    this.sources.splice(target, 1);

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

    this.arrangeTiers();
    this.notifyTier();
}


Browser.prototype.setLocation = function(newChr, newMin, newMax, callback) {
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
        var ss;
        for (var ti = 0; ti < this.tiers.length; ++ti) {
            if (this.tiers[ti].sequenceSource) {
                ss = this.tiers[ti].sequenceSource;
                break;
            }
        }
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
    if (newChr) {
        if (newChr.indexOf('chr') == 0)
            newChr = newChr.substring(3);

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
    var newScale = this.featurePanelWidth / (this.viewEnd - this.viewStart);
    var scaleChanged = (Math.abs(newScale - this.scale)) > 0.0001;
    this.scale = newScale;
    this.zoomSliderValue = this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase);
    this.isSnapZooming = false;
    this.savedZoom = null;
    this.notifyLocation();

    if (scaleChanged) {
        this.refresh();
    } else {
        var viewCenter = (this.viewStart + this.viewEnd)/2;
    
        for (var i = 0; i < this.tiers.length; ++i) {
            var offset = (this.viewStart - this.tiers[i].norigin)*this.scale;
	    this.tiers[i].viewport.style.left = '' + ((-offset|0) - 1000) + 'px';
            var ooffset = (this.viewStart - this.tiers[i].oorigin)*this.scale;
            this.tiers[i].overlay.style.left = '' + ((-ooffset|0) - 1000) + 'px';
        }
    }

    this.spaceCheck();
    return callback();
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
    this.highlights.push(new Region(chr, min, max));
    var visStart = this.viewStart - (1000/this.scale);
    var visEnd = this.viewEnd + (1000/this.scale);
    if (chr == this.chr && min < visEnd && max > visStart) {
        this.drawOverlays();
    }
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
    this.selectedTiers = [t];
    this.markSelectedTiers();
}

Browser.prototype.markSelectedTiers = function() {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var button = this.tiers[ti].nameButton;

        if (this.selectedTiers.indexOf(ti) >= 0) {
            button.classList.add('active');
            // this.tiers[ti].label.focus();
        } else {
            button.classList.remove('active');
        }
    }
    if (this.selectedTiers.length > 0) {
        this.browserHolder.focus();
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
        var q = this.tiers[ti].quantOverlay;
        if (q) {
            q.style.display = display;
            q.style.left = left;
            q.style.right = right;
        }
    }
}

Browser.prototype.featureDoubleClick = function(hit, rx, ry) {
    if (!hit || hit.length == 0)
        return;

    f = hit[hit.length - 1];

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

Browser.prototype.updateHeight = function() {
    var tierTotal = 0;
    for (var ti = 0; ti < this.tiers.length; ++ti) 
        tierTotal += (this.tiers[ti].currentHeight || 30);
    this.svgHolder.style.maxHeight = '' + Math.max(tierTotal, 500) + 'px';
}

function glyphLookup(glyphs, rx, matches) {
    matches = matches || [];

    for (var gi = 0; gi < glyphs.length; ++gi) {
        var g = glyphs[gi];
        if (!g.notSelectable && g.min() <= rx && g.max() >= rx) {
            if (g.feature) {
                matches.push(g.feature);
            } else if (g.group) {
                matches.push(g.group);
            }
    
            if (g.glyphs) {
                return glyphLookup(g.glyphs, rx, matches);
            } else if (g.glyph) {
                return glyphLookup([g.glyph], rx, matches);
            } else {
                return matches;
            }
        }
    }
    return matches;
}
