/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
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
    this.maxExtra = 1.5;
    this.minExtra = 0.2;
    this.zoomFactor = 1.0;
    this.origin = 0;
    this.targetQuantRes = 5.0;
    this.featurePanelWidth = 750;
    this.zoomBase = 100;
    this.zoomExpt = 30; // Now gets clobbered.
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

    this.tierBackgroundColors = ["rgb(245,245,245)", "rgb(230,230,250)"];
    this.minTierHeight = 25;
    
    this.tabMargin = 120;

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

    this.tierHolder = makeElement('div');
    this.svgHolder.appendChild(this.tierHolder);

    this.bhtmlRoot = makeElement('div');
    if (!this.disablePoweredBy) {
        this.bhtmlRoot.appendChild(makeElement('span', ['Powered by ', makeElement('a', 'Dalliance', {href: 'http://www.biodalliance.org/'}), ' ' + VERSION]));
    }
    this.svgHolder.appendChild(this.bhtmlRoot);

    // Dimension stuff

    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);

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
}

// 
// iOS touch support

Browser.prototype.touchStartHandler = function(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    
    this.touchOriginX = ev.touches[0].pageX;
}

Browser.prototype.touchMoveHandler = function(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    
    var touchX = ev.touches[0].pageX;
    if (this.touchOriginX && touchX != this.touchOriginX) {
        this.move(touchX - this.touchOriginX);
    }
    this.touchOriginX = touchX;
}

Browser.prototype.touchEndHandler = function(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    this.storeStatus();
}

Browser.prototype.touchCancelHandler = function(ev) {
}


Browser.prototype.makeTier = function(source) {
    var viewport = makeElement('canvas', null, {width: "1000", height: "50"});    
    var tier = new DasTier(this, source, viewport);
    tier.init(); // fetches stylesheet

    this.tierHolder.appendChild(viewport);    
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
    var minExtraW = (width * this.minExtra) | 0;
    var maxExtraW = (width * this.maxExtra) | 0;

    
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
    
    for (var i = 0; i < this.tiers.length; ++i) {
	this.tiers[i].draw();
    }

/*    this.xfrmTiers((this.tabMargin - (1.0 * (this.viewStart - this.origin)) * this.scale), 1);
    this.updateRegion();
    this.karyo.update(this.chr, this.viewStart, this.viewEnd); */

    this.spaceCheck();
}

Browser.prototype.spaceCheck = function(dontRefresh) {
    if (!this.knownSpace || this.knownSpace.chr !== this.chr) {
        this.refresh();
        return;
    } 

    var width = ((this.viewEnd - this.viewStart)|0) + 1;
    var minExtraW = (width * this.minExtra) | 0;
    var maxExtraW = (width * this.maxExtra) | 0;
    if ((this.drawnStart|0) > Math.max(1, ((this.viewStart|0) - minExtraW)|0)  || (this.drawnEnd|0) < Math.min((this.viewEnd|0) + minExtraW, ((this.currentSeqMax|0) > 0 ? (this.currentSeqMax|0) : 1000000000)))  {
        this.refresh();
    }
}
