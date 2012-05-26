/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// cbrowser.js: canvas browser container
//

// constants

function Browser(opts) {
    if (!opts) {
        opts = {};
    }

    this.sources = [];
    this.tiers = [];

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
    this.origin = 0;
    this.targetQuantRes = 5.0;
    this.featurePanelWidth = 750;
    this.zoomBase = 100;
    this.zoomExpt = 30; // Now gets clobbered.
    this.zoomSliderValue = 100;
    this.entryPoints = null;
    this.currentSeqMax = -1; // init once EPs are fetched.

    this.highlight = false;
    this.highlightMin = -1
    this.highlightMax = - 1;

    this.autoSizeTiers = false;
    this.guidelineStyle = 'foreground';
    this.guidelineSpacing = 75;
    this.fgGuide = null;
    this.positionFeedback = false;

    this.selectedTier = 1;

    this.placards = [];

    // Visual config.

    this.tierBackgroundColors = ["rgb(245,245,245)", 'white' /* , "rgb(230,230,250)" */];
    this.minTierHeight = 25;
    
    this.tabMargin = 120;
    this.embedMargin = 50;

    this.browserLinks = {
        Ensembl: 'http://ncbi36.ensembl.org/Homo_sapiens/Location/View?r=${chr}:${start}-${end}',
        UCSC: 'http://genome.ucsc.edu/cgi-bin/hgTracks?db=hg18&position=chr${chr}:${start}-${end}'
    }

    this.iconsURI = 'http://www.biodalliance.org/resources/icons.svg'

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

    var thisB = this;
    this.svgHolder = document.getElementById(this.pageName);
    removeChildren(this.svgHolder);

    this.tierHolder = makeElement('div', null, null, {padding: '0px', margin: '0px', border: '0px'});
    this.svgHolder.appendChild(this.tierHolder);

    this.bhtmlRoot = makeElement('div');
    if (!this.disablePoweredBy) {
        this.bhtmlRoot.appendChild(makeElement('span', ['Powered by ', makeElement('a', 'Dalliance', {href: 'http://www.biodalliance.org/'}), ' ' + VERSION]));
    }
    this.svgHolder.appendChild(this.bhtmlRoot);

    //
    // Window resize support (should happen before first fetch so we know the actual size of the viewed area).
    //

    this.resizeViewer(true);
    window.addEventListener('resize', function(ev) {
        thisB.resizeViewer();
    }, false);

    // Dimension stuff

    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);
    this.zoomExpt = 250 / Math.log(/* MAX_VIEW_SIZE */ 500000.0 / this.zoomBase);
    this.zoomSliderValue = this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase);



    // Event handlers

    this.tierHolder.addEventListener('mousewheel', function(ev) {   // FIXME does this need to be on the document?
        if (!ev.wheelDeltaX) {
            return;
        }

        ev.stopPropagation(); ev.preventDefault();
        thisB.move(-ev.wheelDeltaX/5);
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
                    thisB.savedZoom = thisB.zoomSlider.getValue();
                    thisB.zoomSlider.setValue(newZoom);
                    thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
                    thisB.invalidateLayouts();
                    thisB.zoomSlider.setColor('red');
                    thisB.refresh();
                } else {
                    thisB.isSnapZooming = false;
                    var newZoom = thisB.savedZoom || 10.0;
                    thisB.savedZoom = thisB.zoomSlider.getValue();
                    thisB.zoomSlider.setValue(newZoom);
                    thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
                    thisB.invalidateLayouts();
                    thisB.zoomSlider.setColor('blue');
                    thisB.refresh();
                }
                thisB.snapZoomLockout = true;
            }
            ev.stopPropagation(); ev.preventDefault();      
        } else if (ev.keyCode == 39 || ev.keyCode == 68) {
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
        } else if (ev.keyCode == 37 || ev.keyCode == 65) {
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
            if (thisB.selectedTier > 0) {
                --thisB.selectedTier;
                thisB.tiers[thisB.selectedTier].isLabelValid = false;
                thisB.tiers[thisB.selectedTier + 1].isLabelValid = false;
                thisB.arrangeTiers();
            }
        } else if (ev.keyCode == 40 || ev.keyCode == 83) {
            ev.stopPropagation(); ev.preventDefault();
            if (thisB.selectedTier < thisB.tiers.length -1) {
                ++thisB.selectedTier;
                thisB.tiers[thisB.selectedTier].isLabelValid = false;
                thisB.tiers[thisB.selectedTier - 1].isLabelValid = false;
                thisB.arrangeTiers();
            }
        } else if (ev.charCode == 61) {
            ev.stopPropagation(); ev.preventDefault();

            var oz = thisB.zoomSliderValue;
            thisB.zoomSliderValue=oz - 10;
            var nz = thisB.zoomSliderValue;
            if (nz != oz) {
                thisB.zoom(Math.exp((1.0 * nz) / thisB.zoomExpt));
            }
        } else if (ev.charCode == 45) {
            ev.stopPropagation(); ev.preventDefault();

            var oz = thisB.zoomSliderValue;
            thisB.zoomSliderValue=oz + 10;
            var nz = thisB.zoomSliderValue;
            if (nz != oz) {
                thisB.zoom(Math.exp((1.0 * nz) / thisB.zoomExpt));
            }
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
                }
            }
        } else {
            //dlog('key: ' + ev.keyCode)
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
        window.removeEventListener('keypress', keyHandler, false);
        thisB.svgHolder.removeEventListener('mouseout', mouseLeaveHandler, false);
    }

    this.svgHolder.addEventListener('mouseover', function(ev) {
        window.addEventListener('keydown', keyHandler, false);
        window.addEventListener('keyup', keyUpHandler, false);
        window.addEventListener('keypress', keyHandler, false);
        thisB.svgHolder.addEventListener('mouseout', mouseLeaveHandler, false);
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
    var thisB = this;
    var background = this.tierBackgroundColors[this.tiers.length % this.tierBackgroundColors.length];
    var viewport = makeElement('canvas', null, {width: '' + ((this.featurePanelWidth|0) + 2000), height: "50"}, {position: 'relative', padding: '0px', margin: '0px', border: '0px', left: '-1000px', /* borderTopStyle: 'solid', borderTopColor: 'black', */ borderBottomStyle: 'solid', borderBottomColor: 'rgb(180,180,180)', borderRightStyle: 'solid', borderRightColor: 'rgb(180,180,180)'});
    var vph = makeElement('div', viewport, {}, {display: 'inline-block', position: 'relative', width: '' + this.featurePanelWidth + 'px', overflow: 'hidden', border: '0px', borderBottom: '1px', borderStyle: 'solid'});
    var tier = new DasTier(this, source, viewport, vph);
    tier.background = background;
    
    viewport.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();

        var br = viewport.getBoundingClientRect();
        var rx = ev.clientX - br.left, ry = ev.clientY - br.top;
        var st = tier.subtiers;
        if (!st) {
            return;
        }

        var sti = 0;
        ry -= MIN_PADDING;
        while (ry > st[sti].height) {
            ry = ry - st[sti].height - MIN_PADDING;
            ++sti;
        }

        var glyphs = st[sti].glyphs;
        var offset = (tier.glyphCacheOrigin - thisB.viewStart)*thisB.scale;
        rx -= offset;
        var hit;
        for (var gi = 0; gi < glyphs.length; ++gi) {
            var g = glyphs[gi];
//            dlog(rx + ':    ' + g.min() + '...' + g.max());
            if (g.min() <= rx && g.max() >= rx) {
                hit = g.group || g.feature;
                break;
            }
        }

        if (hit) {
            thisB.featurePopup(ev, hit);
        }
    }, false);

    tier.init(); // fetches stylesheet

    var label = makeElement('span', source.name);
    viewport.style['vertical-align'] = 'top';
    label.style['width'] = this.tabMargin + 'px';
    label.style['display'] = 'inline-block';
    label.style['background'] = background;
    label.style['vertical-align'] = 'top';
    this.tierHolder.appendChild(makeElement('div', [label, vph], {} /*, {margin: '-2px'} */));    
    this.tiers.push(tier);  // NB this currently tells any extant knownSpace about the new tier.
    this.refreshTier(tier);
    this.arrangeTiers();
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
    
    var viewCenter = (this.viewStart + this.viewEnd)/2;
    
    for (var i = 0; i < this.tiers.length; ++i) {
        var offset = (viewCenter - this.tiers[i].norigin)*this.scale;
	this.tiers[i].viewport.style.left = '' + ((-offset|0) - 1000) + 'px';
    }

    /*
    
    for (var i = 0; i < this.tiers.length; ++i) {
	this.tiers[i].paint();
    }

    */

/*    this.xfrmTiers((this.tabMargin - (1.0 * (this.viewStart - this.origin)) * this.scale), 1);
    this.updateRegion();
    this.karyo.update(this.chr, this.viewStart, this.viewEnd); */

    this.spaceCheck();
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
//    this.updateRegion();

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
    var width = window.innerWidth;
    width = Math.max(width, 640);

    if (this.forceWidth) {
        width = this.forceWidth;
    }
/*
    if (this.center) {
        this.svgHolder.style['margin-left'] = (((window.innerWidth - width) / 2)|0) + 'px';
    } */

/*
    this.zoomWidget.setAttribute('transform', 'translate(' + (width - this.zoomSlider.width - 100) + ', 0)');
    if (width < 1075) {
        this.karyo.svg.setAttribute('transform', 'translate(2000, 15)');
    } else {
        this.karyo.svg.setAttribute('transform', 'translate(450, 20)');
    }
    this.regionLabelMax = (width - this.zoomSlider.width - 120) */


    var oldFPW = this.featurePanelWidth;
    this.featurePanelWidth = (width - this.tabMargin - this.embedMargin)|0;
    
    if (oldFPW != this.featurePanelWidth) {
        for (var ti = 0; ti < this.tiers.length; ++ti) {
            var tier = this.tiers[ti];
            tier.holder.style.width = '' + this.featurePanelWidth + 'px';
            // tier.paint();
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
    
        // this.xfrmTiers((this.tabMargin - (1.0 * (this.viewStart - this.origin)) * this.scale), 1);
        // this.updateRegion();
        if (!skipRefresh) {
            this.spaceCheck();
        }
    }

/*
    if (this.fgGuide) {
        this.fgGuide.setAttribute('x1', (this.featurePanelWidth/2) + this.tabMargin);
        this.fgGuide.setAttribute('x2', (this.featurePanelWidth/2) + this.tabMargin);
    }
        

    for (var pi = 0; pi < this.placards.length; ++pi) {
        var placard = this.placards[pi];
        var rects = placard.getElementsByTagName('rect');
        if (rects.length > 0) {
            rects[0].setAttribute('width', this.featurePanelWidth);
        }
    } */
}

Browser.prototype.setLocation = function(newChr, newMin, newMax) {
    if (newChr && (newChr !== this.chr)) {
        if (!this.entryPoints) {
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

    this.viewStart = newMin|0;
    this.viewEnd = newMax|0;
    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);
    // this.zoomSlider.setValue(this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase));

    // this.updateRegion();
    // this.karyo.update(this.chr, this.viewStart, this.viewEnd);
    this.spaceCheck();
}