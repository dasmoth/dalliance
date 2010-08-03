/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// browser.js: browser setup and UI.
//

var NS_SVG = "http://www.w3.org/2000/svg";
var NS_HTML = "http://www.w3.org/1999/xhtml"

var sources = [];
var tiers = [];

// Limit stops

MAX_VIEW_SIZE=500000;

// parental configuration

var chr;
var viewStart;
var viewEnd;
var cookieKey = 'browser';
var searchEndpoint;
var karyoEndpoint = new DASSource('http://www.derkholm.net:8080/das/hsa_54_36p/');
var registry = 'http://www.dasregistry.org/das/sources';
var coordSystem = {
    speciesName: 'Human',
    taxon: 9606,
    auth: 'NCBI',
    version: '36'
};


// state

var maxExtra = 1.5;
var minExtra = 0.2;
var knownStart;
var knownEnd;
var scale;
var scaleAtLastRedraw;
var zoomFactor = 1.0;
var origin = 0;
var targetQuantRes = 5.0;
var featurePanelWidth = 750;
var zoomBase = 100;
var zoomExpt = 30; // Now gets clobbered.

var entryPoints = null;
var currentSeqMax = -1; // init once EPs are fetched.

var highlight;
var highlightMin = -1, highlightMax = - 1;

var autoSizeTiers = false;
var guidelineStyle = 'foreground';
var guidelineSpacing = 75;
var fgGuide;

// UI components

var svg;
var dasTierHolder;
var zoomSlider;
var zoomWidget;
var zoomTickMarks;
var popupHolder;
var hPopupHolder;
var karyo;
var icons;

// Visual config.

//  var tierBackgroundColors = ["rgb(255,245,215)", "rgb(255,254,240)"];
var tierBackgroundColors = ["rgb(245,245,245)", "rgb(230,230,250)"];
// var tierBackgroundColors = ["red", "blue"];
var minTierHeight = 25;

var tabMargin = 100;

var browserLinks = {
    Ensembl: 'http://ncbi36.ensembl.org/Homo_sapiens/Location/View?r=${chr}:${start}-${end}',
    UCSC: 'http://genome.ucsc.edu/cgi-bin/hgTracks?db=hg18&position=chr${chr}:${start}-${end}'
}

var iconsURI = 'http://www.derkholm.net/dalliance-test/stylesheets/icons.svg'

// Registry

var availableSources;
var defaultSources;

function DataSource(name, uri, opts)
{
    if (!opts) {
	opts = {};
    }
    this.name = name;
    this.uri = uri;
    this.opts = opts;
}


function DasTier(source, viewport, background)
{
    this.source = source;
    this.viewport = viewport;
    this.background = background;
    this.req = null;
    this.layoutHeight = 50;
    this.bumped = true; 
    if (source.opts.collapseSuperGroups) {
        this.bumped = false;
    }
    this.y = 0;

    if (source.opts.tier_type == 'sequence') {
	this.refreshTier = refreshTier_sequence;
    } else {
	this.refreshTier = refreshTier_features;
    }

    this.layoutWasDone = false;
}

DasTier.prototype.init = function() {
    this.dasSource = new DASSource(this.source.uri);
    if (this.source.opts.credentials) {
	this.dasSource.credentials = true;
    }
    if (this.source.opts.stylesheet) {
        this.dasSource.endpoint_stylesheet = this.source.opts.stylesheet;
    }
    var tier = this;
    tier.status = 'Fetching stylesheet';
    this.dasSource.stylesheet(function(stylesheet) {
	tier.stylesheet = stylesheet;
	tier.refreshTier();
    }, function() {
	// tier.error = 'No stylesheet';
        tier.stylesheet = new DASStylesheet();
        var defStyle = new DASStyle();
        defStyle.glyph = 'BOX';
        defStyle.BGCOLOR = 'blue';
        defStyle.FGCOLOR = 'black';
        tier.stylesheet.pushStyle('default', null, defStyle);
	tier.refreshTier();
    });
}

DasTier.prototype.styles = function(scale) {
    if (this.stylesheet == null) {
	return null;
    } else if (scale > 0.2) {
	return this.stylesheet.highZoomStyles;
    } else if (scale > 0.01) {
	return this.stylesheet.mediumZoomStyles;
    } else {
	return this.stylesheet.lowZoomStyles;
    }
}


var placards = [];

function arrangeTiers() {
    var browserSvg = document.getElementById('browser_svg');
    for (var p = 0; p < placards.length; ++p) {
	browserSvg.removeChild(placards[p]);
    }
    placards = [];

	var labelGroup = document.getElementById("dasLabels");
	removeChildren(labelGroup);
	
	var clh = 50;
	for (ti = 0; ti < tiers.length; ++ti) {
	    var tier = tiers[ti];
	    tier.y = clh;
	    
	    var labelWidth = 100;
	    var viewportBackground = document.createElementNS(NS_SVG, 'path');
	    viewportBackground.setAttribute('d', 'M 15 ' + (clh+2) + 
					    ' L 10 ' + (clh+7) +
					    ' L 10 ' + (clh + 18) +
					    ' L 15 ' + (clh + 22) +
					    ' L ' + (10 + labelWidth) + ' ' + (clh+22) +
					    ' L ' + (10 + labelWidth) + ' ' + (clh+2) + ' Z');
	    viewportBackground.setAttribute("fill", tierBackgroundColors[ti % tierBackgroundColors.length]);
	    viewportBackground.setAttribute("stroke", "none");
	    labelGroup.appendChild(viewportBackground);

            makeTooltip(viewportBackground, tier.source.description ? 
                        makeElement('span', [makeElement('b', tier.source.name), makeElement('br'), tier.source.description]) : 
                        tier.source.name
            );

	    
	    setupTierDrag(viewportBackground, ti);
	    
	    var labelText = document.createElementNS(NS_SVG, "text");
	    labelText.setAttribute("x", 15);
	    labelText.setAttribute("y", clh + 17);
	    labelText.setAttribute("stroke-width", "0");
	    labelText.setAttribute("fill", "black");
	    labelText.appendChild(document.createTextNode(tiers[ti].source.name));
            labelText.style.pointerEvents = 'none';
	    labelGroup.appendChild(labelText);
	    

	    if (tier.source.opts.collapseSuperGroups || tier.hasBumpedFeatures) {
		makeToggleButton(labelGroup, tier, clh);
	    } 

            if (tier.isQuantitative) {
                labelGroup.appendChild(makeElementNS(NS_SVG, 'line', null, {
                    x1: tabMargin,
                    y1: clh + (tier.clientMin|0),
                    x2: tabMargin,
                    y2: clh + (tier.clientMax|0),
                    strokeWidth: 1
                }));
                labelGroup.appendChild(makeElementNS(NS_SVG, 'line', null, {
                    x1: tabMargin -5 ,
                    y1: clh + (tier.clientMin|0),
                    x2: tabMargin,
                    y2: clh + (tier.clientMin|0),
                    strokeWidth: 1
                }));
                labelGroup.appendChild(makeElementNS(NS_SVG, 'line', null, {
                    x1: tabMargin -3 ,
                    y1: clh + ((tier.clientMin|0) +(tier.clientMax|0))/2 ,
                    x2: tabMargin,
                    y2: clh + ((tier.clientMin|0) +(tier.clientMax|0))/2,
                    strokeWidth: 1
                }));
                labelGroup.appendChild(makeElementNS(NS_SVG, 'line', null, {
                    x1: tabMargin -5 ,
                    y1: clh + (tier.clientMax|0),
                    x2: tabMargin,
                    y2: clh + (tier.clientMax|0),
                    strokeWidth: 1
                }));
                var minQ = makeElementNS(NS_SVG, 'text', '' + tier.min, {
                    x: 80,
                    y: (clh|0) + (tier.clientMin|0),
                    strokeWidth: 0,
                    fill: 'black',
                    fontSize: '8pt'
                });
                labelGroup.appendChild(minQ);
                var mqbb = minQ.getBBox();
                minQ.setAttribute('x', tabMargin - mqbb.width - 7);
                minQ.setAttribute('y', (clh|0) + (tier.clientMin|0) + (mqbb.height/2) - 4);
                    
                var maxQ = makeElementNS(NS_SVG, 'text', '' + tier.max, {
                    x: 80,
                    y: (clh|0) + (tier.clientMax|0),
                    strokeWidth: 0,
                    fill: 'black',
                    fontSize: '8pt'
                });
                labelGroup.appendChild(maxQ);
                maxQ.setAttribute('x', tabMargin - maxQ.getBBox().width - 3);
                mqbb = maxQ.getBBox();
                maxQ.setAttribute('x', tabMargin - mqbb.width - 7);
                maxQ.setAttribute('y', (clh|0) + (tier.clientMax|0) + (mqbb.height/2) -1 );

                makeQuantConfigButton(labelGroup, tier, clh);
            }

	    xfrmTier(tier, 100 - ((1.0 * (viewStart - origin)) * scale), -1);
	    
	    if (tier.placard) {
		tier.placard.setAttribute('transform', 'translate(100, ' + (clh + tier.layoutHeight - 4) + ')');
		browserSvg.appendChild(tier.placard);
		placards.push(tier.placard);
	    }

	    clh += tiers[ti].layoutHeight;
	}
	
	if (clh < 290) {
	    clh = 290;
	}
	
	document.getElementById("browser_svg").setAttribute("height", "" + ((clh | 0) + 10) + "px");
	document.getElementById("background").setAttribute("height", "" + ((clh | 0) + 10));
	document.getElementById("featureClipRect").setAttribute("height", "" + ((clh | 0) - 10));
	document.getElementById("labelClipRect").setAttribute("height", "" + ((clh | 0) - 10));
}

function offsetForTier(ti) {
    var clh = 50;
    for (var t = 0; t < ti; ++t) {
        clh += tiers[t].layoutHeight;
    }
    return clh;
}

function setupTierDrag(element, ti) {
    var dragOriginX, dragOriginY;
    var dragFeedbackRect;
    var targetTier;
    
    var moveHandler = function(ev) {
        var cly = ((ev.clientY + window.scrollY - dragOriginY) | 0) - 50;
        var destTier = 0;
        while (destTier < tiers.length && cly > tiers[destTier].layoutHeight) {
            cly -= tiers[destTier].layoutHeight;
            ++destTier;
        }
        if (destTier != targetTier) {
            targetTier = destTier;
            dragFeedbackRect.setAttribute('y', offsetForTier(targetTier) - 2);
        }
    };
    
    var bin = document.getElementById('bin');
    var binned = false;
    var binEnterHandler = function(ev) {
        bin.setAttribute('stroke', 'red');
        dragFeedbackRect.setAttribute('fill', 'none');
        binned = true;
    }
    var binLeaveHandler = function(ev) {
        bin.setAttribute('stroke', 'gray');
        dragFeedbackRect.setAttribute('fill', 'red');
        binned = false;
    }
    
    var upHandler = function(ev) {
        window.removeEventListener('mousemove', moveHandler, true);
        window.removeEventListener('mouseup', upHandler, true);
        bin.removeEventListener('mouseover', binEnterHandler, true);
        bin.removeEventListener('mouseout', binLeaveHandler, true);
        popupHolder.removeChild(dragFeedbackRect);
        bin.setAttribute('stroke', 'gray');
        
        if (binned) {
            var newTiers = new Array();
            
            for (var t = 0; t < tiers.length; ++t) {
                if (t != ti) {
                    newTiers.push(tiers[t]);
                }
            }
            
            tierHolder.removeChild(tiers[ti].viewport);
            
            tiers = newTiers;
            for (var nti = 0; nti < tiers.length; ++nti) {
                tiers[nti].background.setAttribute("fill", tierBackgroundColors[nti % tierBackgroundColors.length]);
            }
            
            arrangeTiers();
	    storeStatus();
        } else if (targetTier == ti) {
            // setViewerStatus('Nothing to do');
        } else {
            var newTiers = new Array();
            
            var fromCnt = 0;
            if (targetTier > ti) {
                --targetTier;
            }
            while (newTiers.length < tiers.length) {
                if (newTiers.length == targetTier) {
                    newTiers.push(tiers[ti]);
                } else {
                    if (fromCnt != ti) {
                        newTiers.push(tiers[fromCnt]);
                    }
                    ++fromCnt;
                }
            }
            
            tiers = newTiers;
            for (var nti = 0; nti < tiers.length; ++nti) {
                tiers[nti].background.setAttribute("fill", tierBackgroundColors[nti % tierBackgroundColors.length]);
            }
            arrangeTiers();
	    storeStatus();
        }
    }
    
    element.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        var origin = document.getElementById('svgHolder').getBoundingClientRect();
        dragOriginX = origin.left + window.scrollX; dragOriginY = origin.top + window.scrollY;
        window.addEventListener('mousemove', moveHandler, true);
        window.addEventListener('mouseup', upHandler, true);
        bin.addEventListener('mouseover', binEnterHandler, true);
        bin.addEventListener('mouseout', binLeaveHandler, true);
        targetTier = ti;
        dragFeedbackRect = makeElementNS(NS_SVG, 'rect', null, {
            x: 100,    // FIXME tabMargin
            y: offsetForTier(targetTier) - 2,
            width: featurePanelWidth,
            height: 4,
            fill: 'red',
            stroke: 'none'
        });
        popupHolder.appendChild(dragFeedbackRect);
    },true);
}

function makeToggleButton(labelGroup, tier, ypos) {

    var bumpToggle = makeElementNS(NS_SVG, 'g', null, {fill: 'cornsilk', strokeWidth: 1, stroke: 'gray'});
    bumpToggle.appendChild(makeElementNS(NS_SVG, 'rect', null, {x: 85, y: ypos + 8, width: 8, height: 8}));
    bumpToggle.appendChild(makeElementNS(NS_SVG, 'line', null, {x1: 85, y1: ypos + 12, x2: 93, y2: ypos+12}));
    if (!tier.bumped) {
        bumpToggle.appendChild(makeElementNS(NS_SVG, 'line', null, {x1: 89, y1: ypos+8, x2: 89, y2: ypos+16}));
    }
    labelGroup.appendChild(bumpToggle);
    bumpToggle.addEventListener('mouseover', function(ev) {bumpToggle.setAttribute('stroke', 'red');}, false);
    bumpToggle.addEventListener('mouseout', function(ev) {
        bumpToggle.setAttribute('stroke', 'gray');
    }, false);
    bumpToggle.addEventListener('mousedown', function(ev) {
	tier.bumped = !tier.bumped;
        tier.layoutWasDone = false;   // permits the feature-tier layout code to resize the tier.
	dasRequestComplete(tier);   // is there a more abstract way to do this?
    }, false);
    makeTooltip(bumpToggle, 'Click to ' + (tier.bumped ? 'collapse' : 'expand'));
}

function updateRegion()
{
    var regionDisplay = "chr: " + chr + " start: " + Math.round(viewStart) + " end: " + Math.round(viewEnd);
    
    var regionElement = document.getElementById("region");
    while (regionElement.childNodes.length > 0) {
	    regionElement.removeChild(regionElement.firstChild);
    }
    regionElement.appendChild(document.createTextNode(regionDisplay));
}

function setViewerStatus(msg)
{
/*
    var statusElement = document.getElementById("status");
    while (statusElement.childNodes.length > 0) {
	    statusElement.removeChild(statusElement.firstChild);
    }
    statusElement.appendChild(document.createTextNode(msg)); */
}

function setLoadingStatus()
{
    var count = 0;
    for (var t in tiers) {
        if (tiers[t].req != null && tiers[t].req.readyState != 4) {
            ++count;
        }
    }
    if (count > 0) {
        setViewerStatus("Loading (" + count + ")");
    } else {
        setViewerStatus("Idle");
    }
}

function refresh()
{
    var width = (viewEnd - viewStart) + 1;
    var maxExtraW = (width * maxExtra) | 0;
    knownStart = Math.max(1, viewStart - maxExtraW)|0;
    knownEnd = Math.min(viewEnd + maxExtraW, (currentSeqMax > 0 ? currentSeqMax : 1000000000))|0;

    var newOrigin = (viewStart + viewEnd) / 2;
    var oh = newOrigin - origin;
    origin = newOrigin;
    scaleAtLastRedraw = scale;
    for (var t = 0; t < tiers.length; ++t) {
	if (tiers[t].originHaxx) {
	    oh += tiers[t].originHaxx;
	}
	tiers[t].originHaxx = oh;
	tiers[t].refreshTier();
    }
}


var originX;
var dcTimeoutID = null;

function mouseDownHandler(ev)
{
    removeAllPopups();
    ev.stopPropagation(); ev.preventDefault();

    var target = document.elementFromPoint(ev.clientX, ev.clientY);
    while (target && !target.dalliance_feature && !target.dalliance_group) {
        target = target.parentNode;
    }

    if (target && (target.dalliance_feature || target.dalliance_group)) {
	if (dcTimeoutID && target.dalliance_feature) {
	    clearTimeout(dcTimeoutID);
	    dcTimeoutID = null;
	    var width = viewEnd - viewStart;
	    var newMid = (((target.dalliance_feature.min|0) + (target.dalliance_feature.max|0)))/2;
	    setLocation(newMid - (width/2), newMid + (width/2));
	} else {
	    dcTimeoutID = setTimeout(function() {
		dcTimeoutID = null;
		featurePopup(ev, target.dalliance_feature, target.dalliance_group);
	    }, 200);
	}
    } else {
	originX = ev.clientX;
	document.addEventListener("mousemove", mouseMoveHandler, true);
	document.addEventListener("mouseup", mouseUpHandler, true);
    }
}


var TAGVAL_NOTE_RE = new RegExp('^([A-Za-z]+)=(.+)');

function featurePopup(ev, feature, group)
{
    if (!feature) feature = {};
    if (!group) group = {};

    removeAllPopups();

    var mx =  ev.clientX, my = ev.clientY;
    mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
    my +=  document.documentElement.scrollTop || document.body.scrollTop;
    
    var popup = makeElement('div');
    var winWidth = window.innerWidth;
    popup.style.position = 'absolute';
    popup.style.top = '' + (my + 30) + 'px';
    popup.style.left = '' + Math.min((mx - 30), (winWidth-410)) + 'px';
    popup.style.width = '400px';
    popup.style.backgroundColor = 'white';
    popup.style.borderWidth = '1px';
    popup.style.borderColor = 'black'
    popup.style.borderStyle = 'solid';
    popup.style.padding = '2px';

    var table = makeElement('table', null);
    table.style.width = '100%';
    var idx = 0;
    {
        var row = makeElement('tr', [
            makeElement('th', pick(group.type, feature.type)),
            makeElement('td', pick(group.label, feature.label, group.id, feature.id))
        ]);
        row.style.backgroundColor = tierBackgroundColors[idx % tierBackgroundColors.length];
        table.appendChild(row);
        ++idx;
    }
    {
        var loc;
        if (group.segment) {
            loc = group;
        } else {
            loc = feature;
        }
        var row = makeElement('tr', [
            makeElement('th', 'Location'),
            makeElement('td', loc.segment + ':' + loc.min + '-' + loc.max)
        ]);
        row.style.backgroundColor = tierBackgroundColors[idx % tierBackgroundColors.length];
        table.appendChild(row);
        ++idx;
    }
    if (feature.score && feature.score != '-') {
        var row = makeElement('tr', [
            makeElement('th', 'Score'),
            makeElement('td', feature.score)
        ]);
        row.style.backgroundColor = tierBackgroundColors[idx % tierBackgroundColors.length];
        table.appendChild(row);
        ++idx;
    }
    {
        var links = maybeConcat(group.links, feature.links);
        if (links && links.length > 0) {
            var row = makeElement('tr', [
                makeElement('th', 'Links'),
                makeElement('td', links.map(function(l) {
                    return makeElement('div', makeElement('a', l.desc, {href: l.uri, target: '_new'}));
                }))
            ]);
            row.style.backgroundColor = tierBackgroundColors[idx % tierBackgroundColors.length];
            table.appendChild(row);
            ++idx;
        }
    }
    {
        var notes = maybeConcat(group.notes, feature.notes);
        for (var ni = 0; ni < notes.length; ++ni) {
            var k = 'Note';
            var v = notes[ni];
            var m = v.match(TAGVAL_NOTE_RE);
            if (m) {
                k = m[1];
                v = m[2];
            }

            var row = makeElement('tr', [
                makeElement('th', k),
                makeElement('td', v)
            ]);
            row.style.backgroundColor = tierBackgroundColors[idx % tierBackgroundColors.length];
            table.appendChild(row);
            ++idx;
        }
    }
    popup.appendChild(table);

    hPopupHolder.appendChild(popup);
}

function mouseUpHandler(ev)
{
     ev.stopPropagation(); ev.preventDefault();

    document.removeEventListener("mousemove", mouseMoveHandler, true);
    document.removeEventListener("mouseup", mouseUpHandler, true);
    storeStatus();
}

function mouseMoveHandler(ev) 
{
    ev.stopPropagation(); ev.preventDefault();
    if (ev.clientX != originX) {
        move(ev.clientX - originX);
        originX = ev.clientX;
    }
}

var touchOriginX;

function touchStartHandler(ev)
{
    // setViewerStatus('touching');
    removeAllPopups();
    ev.stopPropagation(); ev.preventDefault();
    
    touchOriginX = ev.touches[0].pageX;
}

function touchMoveHandler(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    
    var touchX = ev.touches[0].pageX;
    if (touchX != touchOriginX) {
	move(touchX - touchOriginX);
	touchOriginX = touchX;
    }
}

function touchEndHandler(ev)
{
    // setViewerStatus('notTouching');
    ev.stopPropagation(); ev.preventDefault();
    storeStatus();
}

function touchCancelHandler(ev) {
    setViewerStatus('cancelledTouching');
}

function removeChildren(node)
{
    if (!node || !node.childNodes) {
        return;
    }

    while (node.childNodes.length > 0) {
        node.removeChild(node.firstChild);
    }
}

function removeAllPopups()
{
    removeChildren(popupHolder);
    removeChildren(hPopupHolder);
}

function EPMenuItem(entryPoint) {
    this.entryPoint = entryPoint;
    this.nums = stringToNumbersArray(entryPoint.name);
}

function stringifyObject(o)
{
    var s = null;
    for (k in o) {
	var v = o[k];
	if (s) {
	    s = s + ', ' + k + ':' + v;
	} else {
	    s = '{' + k + ':' + v;
	}
    }
    if (s == null) {
	return '{}';
    } else {
	return s + '}';
    }
}

function makeHighlight() {
    if (highlight) {
	dasTierHolder.removeChild(highlight);
	highlight = null;
    }

    if (highlightMin > 0) {
	highlight = document.createElementNS(NS_SVG, 'rect');
	highlight.setAttribute('x', (highlightMin - origin) * scale);
	highlight.setAttribute('y', 0);
	highlight.setAttribute('width', (highlightMax - highlightMin + 1) * scale);
	highlight.setAttribute('height', 10000);
	highlight.setAttribute('stroke', 'none');
	highlight.setAttribute('fill', 'red');
	highlight.setAttribute('fill-opacity', 0.2);
	highlight.setAttribute('pointer-events', 'none');
	dasTierHolder.appendChild(highlight);
    }
}

function init() 
{
    // Cache away the default sources before anything else

    defaultSources = [];
    for (var i = 0; i < sources.length; ++i) {
        defaultSources.push(sources[i]);
    }

    icons = new IconSet(iconsURI);

    var overrideSources;
    var reset = false;
    var qChr = null, qMin = null, qMax = null;
    
    //
    // Configuration processing
    //

    var queryDict = {};
    if (location.search) {
        var query = location.search.substring(1);
        var queries = query.split(new RegExp('[&;]'));
        for (var qi = 0; qi < queries.length; ++qi) {
            var kv = queries[qi].split('=');
            var k = decodeURIComponent(kv[0]), v=null;
            if (kv.length > 1) {
                v = decodeURIComponent(kv[1]);
            }
            queryDict[k] = v;
        }
        
        reset = queryDict.reset;
    }

    if (cookieKey && localStorage['dalliance.' + cookieKey + '.view-chr'] && !reset) {
        qChr = localStorage['dalliance.' + cookieKey + '.view-chr'];
        qMin = localStorage['dalliance.' + cookieKey + '.view-start']|0;
        qMax = localStorage['dalliance.' + cookieKey + '.view-end']|0;
    }

    if (cookieKey) {
	var maybeSourceConfig = localStorage['dalliance.' + cookieKey + '.sources'];
	if (maybeSourceConfig && !reset) {
	    overrideSources = eval(maybeSourceConfig);
	}
    }
    
    var region_exp = /([\d+,\w,\.,\_,\-]+):(\d+)[\-,\,](\d+)/;

    var queryRegion = false;
    if (queryDict.chr) {
	var qChr = queryDict.chr;
	var qMin = queryDict.min;
	var qMax = queryDict.max;
	queryRegion = true;
    }

    guidelineConfig = queryDict.guidelines || 'foreground';
    if (guidelineConfig == 'true') {
	guidelineStyle = 'background';
    } else if (STRICT_NUM_REGEXP.test(guidelineConfig)) {
	guidelineStyle = 'background';
	guidelineSpacing = guidelineConfig|0;
    } else {
	guidelineStyle = guidelineConfig;
    }

    if (!queryRegion) {
	regstr = queryDict.r;
	if (!regstr) {
	    regstr = queryDict.segment || '';
	}
	var match = regstr.match(region_exp);
	if ((regstr != '') && match) {
	    qChr = match[1];
	    qMin = match[2] | 0;
	    qMax = match[3] | 0;
	}
	queryRegion = true;
    }
	
    if (qMax < qMin) {
	qMax = qMin + 10000;
    }

    var histr = queryDict.h || '';
    var match = histr.match(region_exp);
    if (match) {
	highlightMin = match[2]|0;
	highlightMax = match[3]|0;
    }



    //
    // Set up the UI (factor out?)
    //
           
    var svgHolder = document.getElementById('svgHolder');
    removeChildren(svgHolder);
    var svgRoot = makeElementNS(NS_SVG, 'svg', null, {
        version: '1.1',
        width: '860px',
        height: '500px',
        id: 'browser_svg'
    });
    svgHolder.appendChild(svgRoot);

    var main = makeElementNS(NS_SVG, 'g',
                             makeElementNS(NS_SVG, 'rect', null,  {id: 'background', fill: 'white'}),
                             {fillOpacity: 1.0, stroke: 'black', strokeWidth: '0.1cm', fontFamily: 'helvetica', fontSize: '10pt'});
    svgRoot.appendChild(main);

    var regionLabel = makeElementNS(NS_SVG, 'text', 'chr???', {
        x: 240,
        y: 30,
        id: 'region',   // FIXME id
        strokeWidth: 0
    });
    main.appendChild(regionLabel);
    makeTooltip(regionLabel, 'Click to jump to a new location or gene');

    var addButton = icons.createButton('add-track', main, 30, 30);
    addButton.setAttribute('transform', 'translate(100, 10)');
    makeTooltip(addButton, 'Add tracks from the DAS registry');
    main.appendChild(addButton);

    var linkButton = icons.createButton('link', main, 30, 30);
    linkButton.setAttribute('transform', 'translate(140, 10)');
    makeTooltip(linkButton, 'Link to other genome browsers');
    main.appendChild(linkButton);

    var resetButton = icons.createButton('reset', main, 30, 30);
    resetButton.setAttribute('transform', 'translate(180, 10)');
    makeTooltip(resetButton, 'Reset the browser to a default state');
    main.appendChild(resetButton);

    var bin = icons.createIcon('bin', main);
    bin.setAttribute('transform', 'translate(10, 18)');
    main.appendChild(bin);
    
    var featureClipRect = makeElementNS(NS_SVG, 'rect', null, {
        x: 100,      // FIXME tabMargin
        y: 50,
        width: 750,
        height: 440,
        id: 'featureClipRect'
    });
    main.appendChild(makeElementNS(NS_SVG, 'clipPath', featureClipRect, {id: 'featureClip'}));
    var labelClipRect = makeElementNS(NS_SVG, 'rect', null, {
        x: 10,      // FIXME tabMargin
        y: 50,
        width: 90,
        height: 440,
        id: 'labelClipRect'
    });
    main.appendChild(makeElementNS(NS_SVG, 'clipPath', labelClipRect, {id: 'labelClip'}));
      
    dasTierHolder = makeElementNS(NS_SVG, 'g', null, {clipPath: 'url(#featureClip)'});
    main.appendChild(dasTierHolder);
    var dasTiers = makeElementNS(NS_SVG, 'g', null, {id: 'dasTiers'});
    dasTierHolder.appendChild(dasTiers);

    makeHighlight();
    
    var dasLabelHolder = makeElementNS(NS_SVG, 'g', makeElementNS(NS_SVG, 'g', null, {id: 'dasLabels'}), {clipPath: 'url(#labelClip)'}); 
    main.appendChild(dasLabelHolder);
    
    {
        var plusIcon = icons.createIcon('magnifier-plus', main);
        var minusIcon = icons.createIcon('magnifier-minus', main);
        zoomTickMarks = makeElementNS(NS_SVG, 'g');
        zoomSlider = new DSlider(250);
        zoomSlider.onchange = function(zoomVal, released) {
	    zoom(Math.exp((1.0 * zoomVal) / zoomExpt));
	    if (released) {
                for (var t = 0; t < tiers.length; ++t) {
                    tiers[t].layoutWasDone = false;
                }
	        refresh();
	        storeStatus();
	    }
        };
        plusIcon.setAttribute('transform', 'translate(0,15)');
        zoomSlider.svg.setAttribute('transform', 'translate(30, 0)');
        minusIcon.setAttribute('transform', 'translate(285,15)');
        zoomWidget = makeElementNS(NS_SVG, 'g', [zoomTickMarks, plusIcon, zoomSlider.svg, minusIcon]);

        makeTooltip(zoomWidget, 'Drag to zoom');
        main.appendChild(zoomWidget);
    }

    karyo = new Karyoscape(karyoEndpoint);
    // now updated via setLocation.
    karyo.svg.setAttribute('transform', 'translate(500, 15)');
    karyo.onchange = function(pos) {
        var width = viewEnd - viewStart + 1;
        var newStart = ((pos * currentSeqMax) - (width/2))|0;
        var newEnd = newStart + width - 1;
        setLocation(newStart, newEnd);
    };
    main.appendChild(karyo.svg);
    
    popupHolder = makeElementNS(NS_SVG, 'g');
    main.appendChild(popupHolder);
    // hPopupHolder = document.getElementById('hPopups');
    hPopupHolder = makeElement('div');
    svgHolder.appendChild(hPopupHolder);
  
    bhtmlRoot = makeElement('div', ['Powered by ', makeElement('a', 'Dalliance', {href: 'http://www.biodalliance.org/'}), ' ' + VERSION]);
    svgHolder.appendChild(bhtmlRoot);
    
    if (guidelineStyle == 'foreground') {
	fgGuide = document.createElementNS(NS_SVG, 'line');
	fgGuide.setAttribute('x1', 500);
	fgGuide.setAttribute('y1', 50);
	fgGuide.setAttribute('x2', 500);
	fgGuide.setAttribute('y2', 10000);
	fgGuide.setAttribute('stroke', 'red');
	fgGuide.setAttribute('stroke-width', 1);
	fgGuide.setAttribute('pointer-events', 'none');
	main.appendChild(fgGuide);
    }
    
    // set up the linker

    linkButton.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
	removeAllPopups(); 

        var mx =  ev.clientX, my = ev.clientY;
	mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
	my +=  document.documentElement.scrollTop || document.body.scrollTop;
        
        var popup = makeElement('div', makeElement('p', 'Link to this region in...'));
        var winWidth = window.innerWidth;
        popup.style.position = 'absolute';
        popup.style.top = '' + (my + 30) + 'px';
        popup.style.left = '' + Math.min((mx - 30), (winWidth-410)) + 'px';
        popup.style.width = '200px';
        popup.style.backgroundColor = 'white';
        popup.style.borderWidth = '1px';
        popup.style.borderColor = 'black'
        popup.style.borderStyle = 'solid';
        popup.style.padding = '2px';
        
        var linkList = makeElement('ul');
        for (l in browserLinks) {
            linkList.appendChild(makeElement('li', makeElement('a', l, {
                href: browserLinks[l].replace(new RegExp('\\${([a-z]+)}', 'g'), function(s, p1) {
		    if (p1 == 'chr') {
		        return chr;
		    } else if (p1 == 'start') {
		        return viewStart|0;
		    } else if (p1 == 'end') {
		        return viewEnd|0;
		    } else {
		        return '';
		    }
	        }),
                target: '_new'
            })));
        }
        popup.appendChild(linkList);

	hPopupHolder.appendChild(popup);
    }, false);

    // set up the navigator


    document.getElementById("region").addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
	removeAllPopups(); 

        if (entryPoints == null) {
            alert("entry_points aren't currently available for this genome");
            return;
        }
        var epMenuItems = [], epsByChrName = {};
        for (var epi = 0; epi < entryPoints.length; ++epi) {
            epMenuItems.push(new EPMenuItem(entryPoints[epi]));
        }
        epMenuItems = epMenuItems.sort(function(epmi0, epmi1) {
            var n0 = epmi0.nums;
            var n1 = epmi1.nums;
            var idx = 0;
            while (true) {
                if (idx >= n0.length) {
                    return -1;
                } else if (idx >= n1.length) {
                    return 1;
                } else {
                    var dif = n0[idx] - n1[idx];
                    if (dif != 0) {
                        return dif;
                    } 
                }
                ++idx;
            }
        });

        var mx =  ev.clientX, my = ev.clientY;
	mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
	my +=  document.documentElement.scrollTop || document.body.scrollTop;

        var popup = makeElement('div');
        var winWidth = window.innerWidth;
        popup.style.position = 'absolute';
        popup.style.top = '' + (my + 30) + 'px';
        popup.style.left = '' + Math.min((mx - 30), (winWidth-410)) + 'px';
        popup.style.width = '200px';
        popup.style.backgroundColor = 'white';
        popup.style.borderWidth = '1px';
        popup.style.borderColor = 'black'
        popup.style.borderStyle = 'solid';
        popup.style.padding = '2px';

        popup.appendChild(makeElement('p'), 'Jump to...');
        var form = makeElement('form');
        form.appendChild(document.createTextNode('Chr:'));
        var selectChr = makeElement('select', null);
        for (var epi = 0; epi < entryPoints.length; ++epi) {
            var ep = epMenuItems[epi].entryPoint;
	    epsByChrName[ep.name] = ep;
            selectChr.appendChild(makeElement('option', ep.toString(), {value: ep.name}));
        }
        selectChr.value = chr;
        form.appendChild(selectChr);
        form.appendChild(makeElement('br'));
        form.appendChild(document.createTextNode('Start:'));
        var minPosInput = makeElement('input', null, {value: (viewStart|0)});
        form.appendChild(minPosInput);
        form.appendChild(makeElement('br'));
        form.appendChild(document.createTextNode('End:'));
        var maxPosInput = makeElement('input', null, {value: (viewEnd|0)});
        form.appendChild(maxPosInput);
        form.appendChild(makeElement('br'));
        form.appendChild(makeElement('input', null, {type: 'submit', value: 'Go'}));
        popup.appendChild(form);

        hPopupHolder.appendChild(popup);


	form.addEventListener('submit', function(ev) {
	    ev.stopPropagation(); ev.preventDefault();

	    var nchr = selectChr.value;    // ugh!  But couldn't get selection on input names working.
	    var nmin = stringToInt(minPosInput.value);
	    var nmax = stringToInt(maxPosInput.value);    
	    removeAllPopups();

	    if (nchr && nmin && nmax) {
		setLocation(nmin, nmax, nchr);
	    } else {
		alert('Must specify min and max');
	    }

	    return false;
	}, false);

        if (searchEndpoint) {
            var geneForm = makeElement('form');
            geneForm.appendChild(makeElement('p', 'Or search for...'))
            geneForm.appendChild(document.createTextNode('Gene:'));
            var geneInput = makeElement('input', null, {value: ''});
            geneForm.appendChild(geneInput);
            geneForm.appendChild(makeElement('br'));
            geneForm.appendChild(makeElement('input', null, {type: 'submit', value: 'Go'}));
            popup.appendChild(geneForm);
        
	
	    geneForm.addEventListener('submit', function(ev) {
	        ev.stopPropagation(); ev.preventDefault();
	        var g = geneInput.value;
	        removeAllPopups();

	        if (!g || g.length == 0) {
		    return false;
	        }

	        searchEndpoint.features(null, {group: g, type: 'transcript'}, function(found) {        // HAXX
		    if (!found || found.length == 0) {
		        alert("no match for '" + g + "' (NB. server support for search is currently rather limited...)");
		    } else {
		        var min = 500000000, max = -100000000;
		        var nchr = null;
		        for (var fi = 0; fi < found.length; ++fi) {
			    var f = found[fi];
			    if (nchr == null) {
			        nchr = f.segment;
			    }
			    min = Math.min(min, f.min);
			    max = Math.max(max, f.max);
		        }
		        highlightMin = min;
		        highlightMax = max;
		        makeHighlight();

		        var padding = Math.max(2500, (0.3 * (max - min + 1))|0);
		        setLocation(min - padding, max + padding, nchr);
		    }
	        }, false);
                
	        return false;
	    }, false);
        }

    }, false);

  
    addButton.addEventListener('mousedown', function(ev) {
	ev.stopPropagation(); ev.preventDefault();
	removeAllPopups();
        showTrackAdder(ev);
    }, false);

    // set up the resetter
    resetButton.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
	window.location.assign('?reset=true');
    }, false);
	
    tierHolder = document.getElementById("dasTiers");
    tiers = new Array();
    if (overrideSources) {
	sources = overrideSources;
    }
    for (var t = 0; t < sources.length; ++t) {
	var source = sources[t];
        makeTier(source);
    }
    
    //
    // Window resize support (should happen before first fetch so we know the actual size of the viewed area).
    //

    resizeViewer();
    window.addEventListener("resize", function(ev) {
        resizeViewer();
        // makeZoomerTicks();
    }, false);

    //
    // Finalize initial viewable region, and kick off a fetch.
    //

    if (qChr && qMin && qMax) {
        chr = qChr; viewStart = qMin; viewEnd = qMax;
	if (highlightMin < 0) {
	    highlightMin = qMin;  highlightMax = qMax;
	}
    }
    
    if ((viewEnd - viewStart) > MAX_VIEW_SIZE) {
        var mid = ((viewEnd + viewStart) / 2)|0;
        viewStart = mid - (MAX_VIEW_SIZE/2);
        viewEnd = mid + (MAX_VIEW_SIZE/2) - 1;
    }

    origin = ((viewStart + viewEnd) / 2) | 0;
    scale = featurePanelWidth / (viewEnd - viewStart);

    zoomExpt = 250 / Math.log(MAX_VIEW_SIZE / zoomBase);

    zoomSlider.setValue(zoomExpt * Math.log((viewEnd - viewStart + 1) / zoomBase));

    move(0);
    refresh(); // FIXME do we still want to be doing this?

    //
    // Tick-marks on the zoomer
    //

    makeZoomerTicks();

    // 
    // Set up interactivity handlers
    //
    
    main.addEventListener('mousedown', mouseDownHandler, false);
    main.addEventListener('touchstart', touchStartHandler, false);
    main.addEventListener('touchmove', touchMoveHandler, false);
    main.addEventListener('touchend', touchEndHandler, false);
    main.addEventListener('touchcancel', touchCancelHandler, false);
    document.addEventListener('mousewheel', function(ev) {
	if (!ev.wheelDeltaX) {
	    return;
	}

	ev.stopPropagation(); ev.preventDefault();
	move (-ev.wheelDeltaX/5);
    }, false);
    document.addEventListener('MozMousePixelScroll', function(ev) {
	if (ev.axis == 1) {
	    ev.stopPropagation(); ev.preventDefault();
	    if (ev.detail != 0) {
		move(ev.detail);
	    }
        }
    }, false);
    
    // Low-priority stuff
    

    var epSource;
    for (var ti = 0; ti < tiers.length; ++ti) {
        var s = tiers[ti].source;
        if (s.opts && s.opts.tier_type && s.opts.tier_type == 'sequence') {
            epSource = tiers[ti].dasSource;
            break;
        }
    }
    if (epSource) {
        epSource.entryPoints(
            function(ep) {
                entryPoints = ep;
                for (var epi = 0; epi < entryPoints.length; ++epi) {
                    if (entryPoints[epi].name == chr) {
                        currentSeqMax = entryPoints[epi].end;
                        break;
                    }
                }
            }
        );
    }

    new DASRegistry(registry).sources(function(sources) {
	availableSources = [];
        for (var s = 0; s < sources.length; ++s) {
            var source = sources[s];
            if (!source.coords || source.coords.length == 0) {
                continue;
            }
            var coords = source.coords[0];
            if (coords.taxon != coordSystem.taxon || coords.auth != coordSystem.auth || coords.version != coordSystem.version) {
                continue;
            }
            var ds = new DataSource(sources[s].title, sources[s].uri);
            ds.description = source.desc;
            if (!source.props || !source.props.cors) {
                ds.disabled = true;
            }
            availableSources.push(ds);
        }
    }, function(error) {
        alert('Warning: registry query failed');
        availableSources = [];
    }, coordSystem);
}

function makeTier(source) {
    var viewport = document.createElementNS(NS_SVG, 'g');
    var viewportBackground = document.createElementNS(NS_SVG, 'rect');
    var col = tierBackgroundColors[tiers.length % tierBackgroundColors.length];
    viewportBackground.setAttribute('fill', col);
    viewportBackground.setAttribute('x', "-1000000");
    viewportBackground.setAttribute('y', "0");
    viewportBackground.setAttribute('width', "2000000");
    viewportBackground.setAttribute('height', "200");
    viewportBackground.setAttribute('stroke-width', "0");
    viewport.appendChild(viewportBackground);
    viewport.setAttribute("transform", "translate(200, " + ((2 * 200) + 50) + ")");
    tierHolder.appendChild(viewport);
    
    var tier = new DasTier(source, viewport, viewportBackground);
    tier.init(); // fetches stylesheet
    tiers.push(tier);
}


function makeZoomerTicks() {
    removeChildren(zoomTickMarks);

    var makeSliderMark = function(markSig) {
        var markPos = zoomExpt * Math.log(markSig/zoomBase);
        if (markPos < 0 || markPos > 250) {
            return;
        }
        var smark = makeElementNS(NS_SVG, 'line', null, {
            x1: 30 + markPos,
            y1: 35,
            x2: 30 + markPos,
            y2: 38,
            stroke: 'gray',
            strokeWidth: 1
        });
        var markText;
        if (markSig > 1500) {
            markText = '' + (markSig/1000) + 'kb';
        } else {
            markText= '' + markSig + 'bp';
        }
        var slabel = makeElementNS(NS_SVG, 'text', markText, {
            x: 30 + markPos,
            y: 48,
            fontSize: '8pt',
            stroke: 'none'
        });
        zoomTickMarks.appendChild(smark);
        zoomTickMarks.appendChild(slabel);
        slabel.setAttribute('x', 29 + markPos - (slabel.getBBox().width/2));
    }

    makeSliderMark(1000000);
    makeSliderMark(500000);
    makeSliderMark(100000);
    makeSliderMark(20000);
    makeSliderMark(4000);
    makeSliderMark(500);
    makeSliderMark(100);
    makeSliderMark(50);
}


function resizeViewer() {
    var width = window.innerWidth;
    width = Math.max(width, 600);
    document.getElementById("browser_svg").setAttribute('width', width - 30);
    document.getElementById("background").setAttribute('width', width - 30);
    document.getElementById("featureClipRect").setAttribute('width', width - 140);


    zoomWidget.setAttribute('transform', 'translate(' + (width - zoomSlider.width - 100) + ', 0)');
// FIXME: should move the zoomer.
//    document.getElementById('sliderTrack').setAttribute('transform', 'translate(' + (width - 190 - 600) + ', 0)');
//    document.getElementById('sliderHandle').setAttribute('transform', 'translate(' + (width - 190 - 600) + ', 0)');
    
    var oldFPW = featurePanelWidth;
    featurePanelWidth = (width - 140)|0;
    
    if (oldFPW != featurePanelWidth) {
        var viewWidth = viewEnd - viewStart;
	var nve = viewStart + (viewWidth * featurePanelWidth) / oldFPW;
	var delta = nve - viewEnd;
	viewStart = viewStart - (delta/2);
	viewEnd = viewEnd + (delta/2);

	var wid = viewEnd - viewStart;
	if (currentSeqMax > 0 && viewEnd > currentSeqMax) {
            viewEnd = currentSeqMax;
            viewStart = viewEnd - wid;
	}
	if (viewStart < 1) {
            viewStart = 1;
            viewEnd = viewStart + wid;
	}
    
	xfrmTiers((100 - (1.0 * (viewStart - origin)) * scale), 1);
	updateRegion();
	spaceCheck();
    }

    if (fgGuide) {
	fgGuide.setAttribute('x1', (featurePanelWidth/2) + 100);
	fgGuide.setAttribute('x2', (featurePanelWidth/2) + 100);
    }
	

    for (var pi = 0; pi < placards.length; ++pi) {
	var placard = placards[pi];
	var rects = placard.getElementsByTagName('rect');
	if (rects.length > 0) {
	    rects[0].setAttribute('width', featurePanelWidth);
	}
    }
}




function xfrmTiers(x, xs)
{
    for (ti in tiers) {
        xfrmTier(tiers[ti], x, xs);
    }
    if (highlight) {
	var axs = xs;
	if (axs < 0) {
            axs = scale;
	}
	var xfrm = 'translate(' + x + ',0)';
	highlight.setAttribute('transform', xfrm);
	highlight.setAttribute('x', (highlightMin - origin) * scale);
	highlight.setAttribute('width', (highlightMax - highlightMin + 1) * scale);
    } 
}

function xfrmTier(tier, x , xs)
{
    if (tier.originHaxx && tier.originHaxx != 0) {
	// alert(tier.originHaxx);
	x -= ((1.0 * tier.originHaxx) * scale);
    }
   
    var axs = xs;
    if (axs < 0) {
        axs = tier.scale;
    } else {
        tier.scale = xs;
    }
    var xfrm = 'translate(' + x + ',' + tier.y + ')';
    if (axs != 1) {
        xfrm += ', scale(' + axs + ',1)';
    }
    // setViewerStatus(xfrm);
    tiers[ti].viewport.setAttribute('transform', xfrm);
}

//
// Navigation prims.
//

function spaceCheck()
{
    var width = (viewEnd - viewStart) + 1;
    var minExtraW = (width * minExtra) | 0;
    var maxExtraW = (width * maxExtra) | 0;
    if (knownStart > Math.max(1, viewStart - minExtraW) || knownEnd < Math.min(viewEnd + minExtraW, (currentSeqMax > 0 ? currentSeqMax : 1000000000))) {
	refresh();
    }
}

function move(pos)
{
    var wid = viewEnd - viewStart;
    viewStart -= pos / scale;
    viewEnd = viewStart + wid;
    if (currentSeqMax > 0 && viewEnd > currentSeqMax) {
        viewEnd = currentSeqMax;
        viewStart = viewEnd - wid;
    }
    if (viewStart < 1) {
        viewStart = 1;
        viewEnd = viewStart + wid;
    }
    
    xfrmTiers((100 - (1.0 * (viewStart - origin)) * scale), 1);
    updateRegion();
    karyo.update(chr, viewStart, viewEnd);
    spaceCheck();
}

function zoom(factor)
{
    zoomFactor = factor;
    var viewCenter = (viewStart + viewEnd) / 2.0;
    viewStart = viewCenter - zoomBase * zoomFactor / 2;
    viewEnd = viewCenter + zoomBase * zoomFactor / 2;
    if (currentSeqMax > 0 && (viewEnd > currentSeqMax + 5)) {
        var len = viewEnd - viewStart + 1;
        viewEnd = currentSeqMax;
        viewStart = viewEnd - len + 1;
    }
    if (viewStart < 1) {
        var len = viewEnd - viewStart + 1;
        viewStart = 1;
        viewEnd = viewStart + len - 1;
    }
    scale = featurePanelWidth / (viewEnd - viewStart)
    updateRegion();
    
    var width = viewEnd - viewStart + 1;
    var minExtraW = (width * minExtra) | 0;
    var maxExtraW = (width * maxExtra) | 0;
    // Currently, always reset Known Space after a zoom :-(
    // if (viewStart - knownStart < minExtra || knownEnd - viewEnd < minExtra) {
        knownStart = Math.max(1, Math.round(viewStart) - maxExtraW);
        knownEnd = Math.round(viewEnd) + maxExtraW;
    // }
    
        var scaleRat = (scale / scaleAtLastRedraw);
        // document.getElementById("dasTiers").setAttribute("transform", "translate(" + ((-1.0 * (viewStart - origin)) * scale) + ",0), scale(" + (scale / scaleAtLastRedraw) + ",1)");
        xfrmTiers(100 - ((1.0 * (viewStart - origin)) * scale),  (scale / scaleAtLastRedraw));
        
    var labels = document.getElementsByClassName("label-text");
    for (var li = 0; li < labels.length; ++li) {
        var label = labels[li];
        var x = label.getAttribute("x");
        var xfrm = "scale(" + (scaleAtLastRedraw/scale) + ",1), translate( " + ((x*scale - x*scaleAtLastRedraw) /scaleAtLastRedraw) +",0)";
        label.setAttribute("transform", xfrm);
    }
}

function setLocation(newMin, newMax, newChr)
{
    newMin = newMin|0;
    newMax = newMax|0;

    if (newChr && (newChr != chr)) {
	if (!entryPoints) {
	    return;
	}
	var ep = null;
	for (var epi = 0; epi < entryPoints.length; ++epi) {
	    if (entryPoints[epi].name == newChr) {
		ep = entryPoints[epi];
		break;
	    }
	}
	if (!ep) {
	    return;
	}

	chr = newChr;
	currentSeqMax = ep.end;
    }

    if (newMin < 1) {
	var wid = newMax - newMin + 1;
	newMin = 1;
	newMax = Math.min(newMin + wid - 1, currentSeqMax);
    }
    if (newMax > currentSeqMax) {
	var wid = newMax - newMin + 1;
	newMax = currentSeqMax;
	newMin = Math.max(1, newMax - wid + 1);
    }

    viewStart = newMin|0;
    viewEnd = newMax|0;
    scale = featurePanelWidth / (viewEnd - viewStart);
    zoomSlider.setValue(zoomExpt * Math.log((viewEnd - viewStart + 1) / zoomBase));

    updateRegion();
    karyo.update(chr, viewStart, viewEnd);
    refresh();
    xfrmTiers(100 - ((1.0 * (viewStart - origin)) * scale), 1);   // FIXME currently needed to set the highlight (!)
    storeStatus();
}


function storeStatus()
{
    if (!cookieKey) {
	return;
    }

    localStorage['dalliance.' + cookieKey + '.view-chr'] = chr;
    localStorage['dalliance.' + cookieKey + '.view-start'] = viewStart|0;
    localStorage['dalliance.' + cookieKey + '.view-end'] = viewEnd|0

    var currentSourceList = [];
    for (var t = 0; t < tiers.length; ++t) {
	currentSourceList.push(tiers[t].source);
    }
    localStorage['dalliance.' + cookieKey + '.sources'] = miniJSONify(currentSourceList);
}

//
// WARNING: not for general use!
//

function miniJSONify(o) {
    if (typeof o == 'string') {
	return "'" + o + "'";
    } else if (typeof o == 'number') {
	return "" + o;
    } else if (typeof o == 'boolean') {
	return "" + o;
    } else if (typeof o == 'object') {
	if (o instanceof Array) {
	    var s = null;
	    for (var i = 0; i < o.length; ++i) {
		s = (s == null ? '' : (s + ', ')) + miniJSONify(o[i]);
	    }
	    return '[' + (s?s:'') + ']';
	} else {
	    var s = null;
	    for (var k in o) {
		if (k != undefined) {
		    s = (s == null ? '' : (s + ', ')) + k + ': ' + miniJSONify(o[k]);
		}
	    }
	    return '{' + (s?s:'') + '}';
	}
    } else {
	return (typeof o);
    }
}
