/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// cbrowser.js: canvas browser container
//

function Region(chr, min, max) {
    this.min = min;
    this.max = max;
    this.chr = chr;
}

function Browser(opts) {
    if (!opts) {
        opts = {};
    }

    this.sources = [];
    this.tiers = [];

    this.featureListeners = [];
    this.featureHoverListeners = [];
    this.viewListeners = [];
    this.regionSelectListeners = [];
    this.tierListeners = [];

    this.cookieKey = 'browser';
    this.karyoEndpoint = new DASSource('http://www.derkholm.net:8080/das/hsa_54_36p/');
    this.registry = 'http://www.dasregistry.org/das/sources';
    this.coordSystem = {
        speciesName: 'Human',
        taxon: 9606,
        auth: 'NCBI',
        version: '36'
    };
    this.chains = {};

    this.exportServer = 'http://www.biodalliance.org:8765/'

    this.pageName = 'svgHolder'
    this.maxExtra = 2.5;
    this.minExtra = 0.5;
    this.zoomFactor = 1.0;
    this.zoomMin = 10.0;
    this.zoomMax = 220.0;
    this.origin = 0;
    this.targetQuantRes = 5.0;
    this.featurePanelWidth = 750;
    this.zoomBase = 100;
    this.zoomExpt = 30; // Now gets clobbered.
    this.zoomSliderValue = 100;
    this.entryPoints = null;
    this.currentSeqMax = -1; // init once EPs are fetched.

    this.highlights = [];

    this.autoSizeTiers = false;
    this.guidelineStyle = 'foreground';
    this.guidelineSpacing = 75;
    this.fgGuide = null;
    this.positionFeedback = false;

    this.selectedTier = 1;

    this.placards = [];

    // Visual config.

    this.tierBackgroundColors = [/* "rgb(245,245,245)", */ 'white' /* , "rgb(230,230,250)" */];
    this.minTierHeight = 25;
    
    // FIXME are either of these needed any more?
    this.tabMargin = 10;
    this.embedMargin = 50;

    this.browserLinks = {
        Ensembl: 'http://ncbi36.ensembl.org/Homo_sapiens/Location/View?r=${chr}:${start}-${end}',
        UCSC: 'http://genome.ucsc.edu/cgi-bin/hgTracks?db=hg18&position=chr${chr}:${start}-${end}'
    }

    // Registry

    this.availableSources = new Observed();
    this.defaultSources = [];
    this.mappableSources = {};

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

    var thisB = this;
    this.svgHolder = document.getElementById(this.pageName);
    removeChildren(this.svgHolder);

    this.tierHolder = makeElement('div', null, null, {width: '100%', padding: '0px', margin: '0px', border: '0px', position: 'relative'});
    this.svgHolder.appendChild(this.tierHolder);

    this.bhtmlRoot = makeElement('div');
    if (!this.disablePoweredBy) {
        this.bhtmlRoot.appendChild(makeElement('span', ['Powered by ', makeElement('a', 'Dalliance', {href: 'http://www.biodalliance.org/'}), ' ' + VERSION]));
    }
    this.svgHolder.appendChild(this.bhtmlRoot);

    //
    // Window resize support (should happen before first fetch so we know the actual size of the viewed area).
    //

    // this.resizeViewer(true);
    this.featurePanelWidth = this.tierHolder.getBoundingClientRect().width | 0;
    window.addEventListener('resize', function(ev) {
        thisB.resizeViewer();
    }, false);

    this.ruler = makeElement('div', null, null, {width: '1px', height: '2000px', backgroundColor: 'blue', position: 'absolute', zIndex: '900', left: '' + ((this.featurePanelWidth/2)|0) + 'px', top: '0px'});
    this.tierHolder.appendChild(this.ruler);

    // Dimension stuff

    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);
    this.zoomExpt = 250 / Math.log(/* MAX_VIEW_SIZE */ 500000.0 / this.zoomBase);
    this.zoomSliderValue = this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase);

    // Event handlers
    this.tierHolder.addEventListener('mousewheel', function(ev) {
        if (!ev.wheelDeltaX) {
            return;
        }

        ev.stopPropagation(); ev.preventDefault();
        thisB.move(-ev.wheelDeltaX/5);
    }, false);
    this.tierHolder.addEventListener('MozMousePixelScroll', function(ev) {
        if (ev.axis == 1) {
            ev.stopPropagation(); ev.preventDefault();
            if (ev.detail != 0) {
                thisB.move(ev.detail/4);
            }
        }
    }, false);

    this.tierHolder.addEventListener('touchstart', function(ev) {return thisB.touchStartHandler(ev)}, false);
    this.tierHolder.addEventListener('touchmove', function(ev) {return thisB.touchMoveHandler(ev)}, false);
    this.tierHolder.addEventListener('touchend', function(ev) {return thisB.touchEndHandler(ev)}, false);
    this.tierHolder.addEventListener('touchcancel', function(ev) {return thisB.touchCancelHandler(ev)}, false); 


    var keyHandler = function(ev) {
//        dlog('keycode=' + ev.keyCode + '; charCode=' + ev.charCode);
        if (ev.keyCode == 13) {
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
        } else if (ev.keyCode == 32 || ev.charCode == 32) {
            if (!thisB.snapZoomLockout) {
                if (!thisB.isSnapZooming) {
                    thisB.isSnapZooming = true;
                    var newZoom = thisB.savedZoom || 1.0;
                    thisB.savedZoom = thisB.zoomSliderValue;
                    thisB.zoomSliderValue = newZoom;
                    thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
                    // thisB.invalidateLayouts();
                    // thisB.zoomSlider.setColor('red');
                    // thisB.refresh();
                } else {
                    thisB.isSnapZooming = false;
                    var newZoom = thisB.savedZoom || 10.0;
                    thisB.savedZoom = thisB.zoomSliderValue;
                    thisB.zoomSliderValue = newZoom;
                    thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
                    // thisB.invalidateLayouts();
                    // thisB.zoomSlider.setColor('blue');
                    // thisB.refresh();
                }
                thisB.snapZoomLockout = true;
            }
            ev.stopPropagation(); ev.preventDefault();      
        } else if (ev.keyCode == 39) {
            ev.stopPropagation(); ev.preventDefault();
            if (ev.ctrlKey) {
                var fedge = 0;
                if(ev.shiftKey){
                    fedge = 1;
                }
                var pos=((thisB.viewStart + thisB.viewEnd + 1)/2)|0;
                thisB.tiers[thisB.selectedTier].findNextFeature(
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
                              dlog('no next feature');
                          }
                      });
            } else {
                thisB.move(ev.shiftKey ? 100 : 25);
            }
        } else if (ev.keyCode == 37) {
            ev.stopPropagation(); ev.preventDefault();
            if (ev.ctrlKey) {
                var fedge = 0;
                if(ev.shiftKey){
                    fedge = 1;
                }
                var pos=((thisB.viewStart + thisB.viewEnd + 1)/2)|0;
                thisB.tiers[thisB.selectedTier].findNextFeature(
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
                              dlog('no next feature');
                          }
                      });
            } else {
                thisB.move(ev.shiftKey ? -100 : -25);
            }
        } else if (ev.keyCode == 38 || ev.keyCode == 87) {
            ev.stopPropagation(); ev.preventDefault();

            if (ev.shiftKey) {
                var tt = thisB.tiers[thisB.selectedTier];
                var ch = tt.forceHeight || tt.subtiers[0].height;
                if (ch >= 20) {
                    tt.forceHeight = ch - 20;
                    tt.draw();
                }
            } else {
                if (thisB.selectedTier > 0) {
                    --thisB.selectedTier;
                    thisB.markSelectedTier();
                }
            }
        } else if (ev.keyCode == 40 || ev.keyCode == 83) {
            ev.stopPropagation(); ev.preventDefault();

            if (ev.shiftKey) {
                var tt = thisB.tiers[thisB.selectedTier];
                var ch = tt.forceHeight || tt.subtiers[0].height;
                tt.forceHeight = ch + 10;
                tt.draw();
            } else {
                if (thisB.selectedTier < thisB.tiers.length -1) {
                    ++thisB.selectedTier;
                    thisB.markSelectedTier();
                }
            }
        } else if (ev.keyCode == 187 || ev.keyCode == 61) {
            ev.stopPropagation(); ev.preventDefault();
            thisB.zoomStep(-10);
        } else if (ev.keyCode == 189 || ev.keyCode == 173) {
            ev.stopPropagation(); ev.preventDefault();
            thisB.zoomStep(10);
        } else if (ev.keyCode == 84 || ev.keyCode == 116) {
            ev.stopPropagation(); ev.preventDefault();
            var bumpStatus;
            if( ev.shiftKey ){
                for (var ti = 0; ti < thisB.tiers.length; ++ti) {
                    var t = thisB.tiers[ti];
                    if (t.dasSource.collapseSuperGroups) {
                        if (bumpStatus === undefined) {
                            bumpStatus = !t.bumped;
                        }
                        t.bumped = bumpStatus;
                        t.isLabelValid = false;
                        t.layoutWasDone = false;
                        t.draw();
                        t.updateLabel();
                    }
                }
            } else {
                var t = thisB.tiers[thisB.selectedTier];
                if (t.dasSource.collapseSuperGroups) {
                    if (bumpStatus === undefined) {
                        bumpStatus = !t.bumped;
                    }
                    t.bumped = bumpStatus;
                    t.layoutWasDone = false;
                    t.isLabelValid = false;
                    t.draw();
                    t.updateLabel();
                }
            }
        } else {
            console.log('key: ' + ev.keyCode + '; char: ' + ev.charCode);
        }
    };
    var keyUpHandler = function(ev) {

        thisB.snapZoomLockout = false;
/*
        if (ev.keyCode == 32) {
            if (thisB.isSnapZooming) {
                thisB.isSnapZooming = false;
                thisB.zoomSlider.setValue(thisB.savedZoom);
                thisB.zoom(Math.exp((1.0 * thisB.savedZoom / thisB.zoomExpt)));
                thisB.invalidateLayouts();
                thisB.refresh();
            }
            ev.stopPropagation(); ev.preventDefault();
        } */
    }

    var mouseLeaveHandler;
    mouseLeaveHandler = function(ev) {
        window.removeEventListener('keydown', keyHandler, false);
        window.removeEventListener('keyup', keyUpHandler, false);
        // window.removeEventListener('keypress', keyHandler, false);
        thisB.tierHolder.removeEventListener('mouseout', mouseLeaveHandler, false);
    }

    this.tierHolder.addEventListener('mouseover', function(ev) {
        window.addEventListener('keydown', keyHandler, false);
        window.addEventListener('keyup', keyUpHandler, false);
        // window.addEventListener('keypress', keyHandler, false);
        thisB.tierHolder.addEventListener('mouseout', mouseLeaveHandler, false);
    }, false);


    // Popup support (does this really belong here? FIXME)
    this.hPopupHolder = makeElement('div');
    this.hPopupHolder.style['font-family'] = 'helvetica';
    this.hPopupHolder.style['font-size'] = '12pt';
    this.svgHolder.appendChild(this.hPopupHolder);

    for (var t = 0; t < this.sources.length; ++t) {
        var source = this.sources[t];
        if (source.bwgURI && !this.supportsBinary) {
            if (!this.binaryWarningGiven) {
                this.popit({clientX: 300, clientY: 100}, 'Warning', makeElement('p', 'your browser does not support binary data formats, some track(s) not loaded.  We currently recommend Google Chrome 9 or later, or Firefox 4 or later.'));
                this.binaryWarningGiven = true;
            }
            continue;
        }
        this.makeTier(source);
    }
    thisB.arrangeTiers();
    thisB.refresh();

    var epSource;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var s = this.tiers[ti].dasSource;
        if (s.provides_entrypoints) {
            epSource = this.tiers[ti].dasSource;
            break;
        }
    }
    if (epSource) {
        epSource.entryPoints(
            function(ep) {
                thisB.entryPoints = ep;
                for (var epi = 0; epi < thisB.entryPoints.length; ++epi) {
                    if (thisB.entryPoints[epi].name == thisB.chr) {
                        thisB.currentSeqMax = thisB.entryPoints[epi].end;
                        break;
                    }
                }
            }
        );
    }

    this.queryRegistry();
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
            // dlog('sep=' + sep + '; zis=' + this.zoomInitialScale);
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
//    this.storeStatus();
}

Browser.prototype.touchCancelHandler = function(ev) {
}


Browser.prototype.makeTier = function(source) {
    try {
        this.realMakeTier(source);
    } catch (e) {
        console.log(e);
    }
}

Browser.prototype.realMakeTier = function(source) {
    var thisB = this;
    var background = this.tierBackgroundColors[this.tiers.length % this.tierBackgroundColors.length];

    var viewport = makeElement('canvas', null, 
                               {width: '' + ((this.featurePanelWidth|0) + 2000), height: "50"}, 
                               {position: 'absolute', 
                                padding: '0px', 
                                margin: '0px',
                                border: '0px', 
                                left: '-1000px', /* borderTopStyle: 'solid', borderTopColor: 'black', */ 
                                borderBottomStyle: 'solid', 
                                borderBottomColor: 'rgb(180,180,180)', 
                                borderRightStyle: 'solid', 
                                borderRightColor: 'rgb(180,180,180)'});

    var viewportOverlay = makeElement('canvas', null,
         {width: + ((this.featurePanelWidth|0) + 2000), height: "50"}, 
         {position: 'relative', 
          padding: '0px', 
          margin: '0px',
          border: '0px', 
          left: '-1000px',
          zIndex: '1000',
          pointerEvents: 'none'});

    var placardContent = makeElement('span', 'blah');
    var placard = makeElement('div', [makeElement('i', null, {className: 'icon-warning-sign'}), placardContent], {}, {
        display: 'none',
        position: 'relative',
        width: '100%',
        height: '50px',
        textAlign: 'center',
        lineHeight: '50px',
        borderStyle: 'solid',
        borderColor: 'red',
        borderWidth: '1px'});
    
    var vph = makeElement('div', [viewport, viewportOverlay], {}, {display: 'inline-block', position: 'relative', width: '100%' , overflowX: 'hidden', overflowY: 'hidden', border: '0px', borderBottom: '0px', borderStyle: 'solid'});
    vph.className = 'tier-viewport-background';
    var tier = new DasTier(this, source, viewport, vph, viewportOverlay, placard, placardContent);
    tier.oorigin = (this.viewStart + this.viewEnd)/2;
    tier.background = background;

    if (tier.dasSource.quantHack) {
        tier.quantOverlay = makeElement(
            'canvas', null, 
            {width: '50', height: "56"}, 
            {position: 'absolute', 
             padding: '0px', 
             margin: '0px',
             border: '0px', 
             left: '' + ((this.featurePanelWidth/2)|0) + 'px', top: '0px'});
        tier.holder.appendChild(tier.quantOverlay);
    }
    
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
        ev.preventDefault();
        var br = vph.getBoundingClientRect();
        var rx = ev.clientX - br.left, ry = ev.clientY - br.top;

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
            if (tier.dasSource.tier_type !== 'sequence' && rx != dragMoveOrigin) {
                thisB.move((rx - dragMoveOrigin));
                dragMoveOrigin = rx;
            }
        } else {
            hoverTimeout = setTimeout(function() {
                var hit = featureLookup(rx, ry);
                if (hit) {
                    thisB.notifyFeatureHover(ev, hit); // FIXME group
                }
            }, 1000);
        }
    });

    var doubleClickTimeout = null;
    vph.addEventListener('mouseup', function(ev) {
        var br = vph.getBoundingClientRect();
        var rx = ev.clientX - br.left, ry = ev.clientY - br.top;

        var hit = featureLookup(rx, ry);
        if (hit && !thisB.isDragging) {
            if (doubleClickTimeout) {
                clearTimeout(doubleClickTimeout);
                doubleClickTimeout = null;
                thisB.featureDoubleClick(hit, rx, ry);
            } else {
                doubleClickTimeout = setTimeout(function() {
                    doubleClickTimeout = null;
                    thisB.notifyFeature(ev, hit);
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

    tier.init(); // fetches stylesheet

/*
    var label = makeElement('span', 
                            [source.name, makeElement('a', makeElement('i', null, {className: 'icon-remove'}), {className: 'btn'})], 
                            {className: 'track-label'}, 
                            {left: tier.quantOverlay ? '35px' : '2px', 
                             top: '2px'}); */


    tier.removeButton =  makeElement('a', makeElement('i', null, {className: 'icon-remove'}), {className: 'btn'});
    tier.bumpButton = makeElement('i', null, {className: 'icon-plus-sign'});
    tier.nameButton = makeElement('a', [source.name + ' ', tier.bumpButton], {className: 'tier-tab'});
    tier.label = makeElement('span',
       [tier.removeButton,
        tier.nameButton],
       {className: 'btn-group'},
       {zIndex: 1001, position: 'absolute', left: /* tier.quantOverlay ? '35px' :*/ '2px', top: '2px', opacity: 0.8, display: 'inline-block'});
    var row = makeElement('div', [vph, placard, tier.label], {}, {position: 'relative', display: 'block'});
    tier.row = row;

    tier.removeButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        thisB.removeTier(source);
    }, false);
    tier.nameButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        thisB.selectedTier = -1;
        for (var ti = 0; ti < thisB.tiers.length; ++ti) {
            if (thisB.tiers[ti] === tier) {
                thisB.selectedTier = ti;
                break;
            }
        }
        thisB.markSelectedTier();

        /*
        console.log('before: ' + nameButton.clientHeight);
        nameButton.appendChild(makeElement('p', 'Really interesting stuff'));
        nameButton.appendChild(makeElement('p', 'And more stuff'));
        console.log('after: ' + nameButton.clientHeight);
        if (nameButton.clientHeight > row.clientHeight) {
            row.style.height = '' + (nameButton.clientHeight + 4) + 'px';
        }*/
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
            t.isLabelValid = false;
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
        dragLabel.style.left = label.getBoundingClientRect().left + 'px'; dragLabel.style.top = ev.clientY - 10 + 'px';
        
        var pty = ev.clientY - thisB.tierHolder.getBoundingClientRect().top;
        for (var ti = 0; ti < thisB.tiers.length; ++ti) {
            var tt = thisB.tiers[ti];
            var ttr = tt.row.getBoundingClientRect();
            pty -= (ttr.bottom - ttr.top);
            if (pty < 0) {
                if (ti < tierOrdinal && ev.clientY < yAtLastReorder || ti > tierOrdinal && ev.clientY > yAtLastReorder) {
                    var st = thisB.tiers[thisB.selectedTier];

                    thisB.tiers.splice(tierOrdinal, 1);
                    thisB.tiers.splice(ti, 0, tier);
                    var ts = thisB.sources[tierOrdinal];
                    thisB.sources.splice(tierOrdinal, 1);
                    thisB.sources.splice(ti, 0, ts);

                    // FIXME probably shouldn't be recorded selected tier by index (!)
                    for (var sti = 0; sti < thisB.tiers.length; ++sti) {
                        if (thisB.tiers[sti] === st) {
                            thisB.selectedTier = sti; break;
                        }
                    }

                    tierOrdinal = ti;
                    yAtLastReorder = ev.clientY;
                    removeChildren(thisB.tierHolder);
                    for (var i = 0; i < thisB.tiers.length; ++i) {
                        thisB.tierHolder.appendChild(thisB.tiers[i].row);
                    }
                    thisB.tierHolder.appendChild(thisB.ruler);
                    tiersWereReordered = true;
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

        if (tiersWereReordered)
            thisB.notifyTier();
    };

    tier.label.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        tiersWereReordered = false;
        document.addEventListener('mousemove', labelDragHandler, false);
        document.addEventListener('mouseup', labelReleaseHandler, false);
    }, false);

    this.tierHolder.appendChild(row);    
    this.tiers.push(tier);  // NB this currently tells any extant knownSpace about the new tier.
    this.refreshTier(tier);
    this.arrangeTiers();
    tier.updateLabel();
}

Browser.prototype.refreshTier = function(tier) {
    if (this.knownSpace) {
        this.knownSpace.invalidate(tier);
    }
}

Browser.prototype.arrangeTiers = function() {
    // Do we need anything like this now?
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
    
    // dlog('ref ' + this.chr + ':' + this.drawnStart + '..' + this.drawnEnd);
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
                dlog('Bad registry cache: ' + rex);
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
        var offset = (viewCenter - this.tiers[i].norigin)*this.scale;
	this.tiers[i].viewport.style.left = '' + ((-offset|0) - 1000) + 'px';
        var ooffset = (viewCenter - this.tiers[i].oorigin)*this.scale;
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

    // console.log('zoom ' + oz + ' -> ' + nz);

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
    // var minExtraW = (width * this.minExtra) | 0;
    // var maxExtraW = (width * this.maxExtra) | 0;
    var minExtraW = (100.0/this.scale)|0;
    var maxExtraW = (1000.0/this.scale)|0;

    if ((this.drawnStart|0) > Math.max(1, ((this.viewStart|0) - minExtraW)|0)  || (this.drawnEnd|0) < Math.min((this.viewEnd|0) + minExtraW, ((this.currentSeqMax|0) > 0 ? (this.currentSeqMax|0) : 1000000000)))  {
        this.refresh();
    }
}




Browser.prototype.resizeViewer = function(skipRefresh) {
    var width = this.tierHolder.getBoundingClientRect().width | 0;

    var oldFPW = this.featurePanelWidth;
    // this.featurePanelWidth = (width - this.tabMargin - this.embedMargin)|0;
    this.featurePanelWidth = width|0;

    if (oldFPW != this.featurePanelWidth) {
        for (var ti = 0; ti < this.tiers.length; ++ti) {
            var tier = this.tiers[ti];
        }

        var viewWidth = this.viewEnd - this.viewStart;
        var nve = this.viewStart + (viewWidth * this.featurePanelWidth) / oldFPW;
        var delta = nve - this.viewEnd;
        this.viewStart = this.viewStart - (delta/2);
        this.viewEnd = this.viewEnd + (delta/2);

        var wid = this.viewEnd - this.viewStart + 1;
        if (this.currentSeqMax > 0 && this.viewEnd > this.currentSeqMax) {
            this.viewEnd = this.currentSeqMax;
            this.viewStart = this.viewEnd - wid + 1;
        }
        if (this.viewStart < 1) {
            this.viewStart = 1;
            this.viewEnd = this.viewStart + wid - 1;
        }
        

        this.ruler.style.left = '' + ((this.featurePanelWidth/2)|0) + 'px';
        for (var ti = 0; ti < this.tiers.length; ++ti) {
            var q = this.tiers[ti].quantOverlay;
            if (q) {
                q.style.left = '' + ((this.featurePanelWidth/2)|0) + 'px';
            }
        }

        if (!skipRefresh) {
            this.spaceCheck();
        }
        this.notifyLocation();
    }
}

Browser.prototype.addTier = function(conf) {
    this.sources.push(conf);
    this.makeTier(conf);
}

Browser.prototype.removeTier = function(conf) {
    var target = -1;

    if (typeof conf.index !== 'undefined' && conf.index >=0 && conf.index < this.tiers.length) {
        target = conf.index;
    } else {
        for (var ti = 0; ti < this.tiers.length; ++ti) {
            var ts = this.tiers[ti].dasSource;
            if ((conf.uri && ts.uri === conf.uri) ||
                (conf.bwgURI && ts.bwgURI === conf.bwgURI) ||
                (conf.bamURI && ts.bamURI === conf.bamURI) ||
                (conf.twoBitURI && ts.twoBitURI === conf.twoBitURI))
            {
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

    for (var ti = target; ti < this.tiers.length; ++ti) {
        this.tiers[ti].background = this.tierBackgroundColors[ti % this.tierBackgroundColors.length];
    }
    this.refresh();
}


Browser.prototype.setLocation = function(newChr, newMin, newMax) {
    if (newChr && (newChr !== this.chr)) {
        if (!this.entryPoints) {
            // FIXME is this too strict?
            throw 'Need entry points';
        }
        var ep = null;
        for (var epi = 0; epi < this.entryPoints.length; ++epi) {
            var epName = this.entryPoints[epi].name;
            if (epName === newChr || ('chr' + epName) === newChr || epName === ('chr' + newChr)) {
                ep = this.entryPoints[epi];
                break;
            }
        }
        if (!ep) {
            throw "Couldn't find chromosome " + newChr;
        }

        this.chr = ep.name;
        this.currentSeqMax = ep.end;
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
            var offset = (viewCenter - this.tiers[i].norigin)*this.scale;
	    this.tiers[i].viewport.style.left = '' + ((-offset|0) - 1000) + 'px';
            var ooffset = (viewCenter - this.tiers[i].oorigin)*this.scale;
            this.tiers[i].overlay.style.left = '' + ((-ooffset|0) - 1000) + 'px';
        }
    }

    this.spaceCheck();
}

Browser.prototype.addFeatureListener = function(handler, opts) {
    opts = opts || {};
    this.featureListeners.push(handler);
}

Browser.prototype.notifyFeature = function(ev, feature, group) {
  for (var fli = 0; fli < this.featureListeners.length; ++fli) {
      try {
          this.featureListeners[fli](ev, feature, group);
      } catch (ex) {
          console.log(ex);
      }
  }
}

Browser.prototype.addFeatureHoverListener = function(handler, opts) {
    opts = opts || {};
    this.featureHoverListeners.push(handler);
}

Browser.prototype.notifyFeatureHover = function(ev, feature, group) {
    for (var fli = 0; fli < this.featureHoverListeners.length; ++fli) {
        try {
            this.featureHoverListeners[fli](ev, feature, group);
        } catch (ex) {
            console.log(ex);
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
            this.viewListeners[lli](this.chr, this.viewStart|0, this.viewEnd|0, this.zoomSliderValue);
        } catch (ex) {
            console.log(ex);
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
            console.log(ex);
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
            console.log(ex);
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
        var t = this.tiers[ti];
        var g = t.overlay.getContext('2d');
        
        t.overlay.height = t.viewport.height;
        // g.clearRect(0, 0, t.overlay.width, t.overlay.height);
        
        var origin = this.viewStart - (1000/this.scale);
        var visStart = this.viewStart - (1000/this.scale);
        var visEnd = this.viewEnd + (1000/this.scale);


        for (var hi = 0; hi < this.highlights.length; ++hi) {
            var h = this.highlights[hi];
            if (h.chr == this.chr && h.min < visEnd && h.max > visStart) {
                g.globalAlpha = 0.3;
                g.fillStyle = 'red';
                g.fillRect((h.min - origin) * this.scale,
                           0,
                           (h.max - h.min) * this.scale,
                           t.overlay.height);
        }
        }

        t.oorigin = (this.viewStart + this.viewEnd)/2;
        t.overlay.style.left = '-1000px'
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

Browser.prototype.markSelectedTier = function() {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var button = this.tiers[ti].nameButton;
        if (ti == this.selectedTier) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }
}

Browser.prototype.featureDoubleClick = function(f, rx, ry) {
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




function glyphLookup(glyphs, rx) {
    for (var gi = 0; gi < glyphs.length; ++gi) {
        var g = glyphs[gi];
        if (g.min() <= rx && g.max() >= rx) {
            if (g.feature) {
                return g.feature;
            } else if (g.glyphs) {
                return glyphLookup(g.glyphs, rx) || g.group;
            } else if (g.glyph) {
                return glyphLookup([g.glyph], rx) || g.group;
            } else {
                return g.group;
            }
        }
    }
    return null;
}
