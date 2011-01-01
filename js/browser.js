/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// browser.js: browser setup and UI.
//

// constants

var NS_SVG = "http://www.w3.org/2000/svg";
var NS_HTML = "http://www.w3.org/1999/xhtml"
var NS_XLINK = 'http://www.w3.org/1999/xlink'

// Limit stops

MAX_VIEW_SIZE=500000;

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

    this.placards = [];

    // Visual config.

    this.tierBackgroundColors = ["rgb(245,245,245)", "rgb(230,230,250)"];
    this.minTierHeight = 25;
    
    this.tabMargin = 120;

    this.browserLinks = {
        Ensembl: 'http://ncbi36.ensembl.org/Homo_sapiens/Location/View?r=${chr}:${start}-${end}',
        UCSC: 'http://genome.ucsc.edu/cgi-bin/hgTracks?db=hg18&position=chr${chr}:${start}-${end}'
    }

    this.iconsURI = 'http://www.derkholm.net/dalliance-test/stylesheets/icons2.svg'

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


function formatQuantLabel(v) {
    var t = '' + v;
    var dot = t.indexOf('.');
    if (dot < 0) {
        return t;
    } else {
        if (dot >= 2) {
            return t.substring(0, dot);
        } else {
            return t.substring(0, dot + 2);
        }
    }
}

Browser.prototype.arrangeTiers = function() {
    var browserSvg = this.svgRoot;
    for (var p = 0; p < this.placards.length; ++p) {
	browserSvg.removeChild(this.placards[p]);
    }
    this.placards = [];

    var labelGroup = this.dasLabelHolder;
    removeChildren(labelGroup);
	
    var clh = 50;
    for (ti = 0; ti < this.tiers.length; ++ti) {
	var tier = this.tiers[ti];
	tier.y = clh;
	    
	var labelWidth = this.tabMargin;
	var viewportBackground = document.createElementNS(NS_SVG, 'path');
	viewportBackground.setAttribute('d', 'M 15 ' + (clh+2) + 
					' L 10 ' + (clh+7) +
					' L 10 ' + (clh + 18) +
					' L 15 ' + (clh + 22) +
					' L ' + (10 + labelWidth) + ' ' + (clh+22) +
					' L ' + (10 + labelWidth) + ' ' + (clh+2) + ' Z');
	viewportBackground.setAttribute('fill', this.tierBackgroundColors[ti % this.tierBackgroundColors.length]);
	viewportBackground.setAttribute('stroke', 'none');
	labelGroup.appendChild(viewportBackground);

//        this.makeTooltip(viewportBackground, tier.dasSource.desc ? 
//                    makeElement('span', [makeElement('b', tier.dasSource.name), makeElement('br'), tier.dasSource.desc]) : 
//                   tier.dasSource.name
//                   );
	this.setupTierDrag(viewportBackground, ti);
	    
        var hasWidget = false;
	if (tier.dasSource.collapseSuperGroups || tier.hasBumpedFeatures) {
            hasWidget = true;
	    this.makeToggleButton(labelGroup, tier, clh);
	} 

        if (tier.isQuantitative) {
            hasWidget = true;
            var quantTools = makeElementNS(NS_SVG, 'g');
            quantTools.appendChild(makeElementNS(NS_SVG, 'rect', null, {
                x: this.tabMargin - 25,
                y: clh,
                width: 25,
                height: tier.layoutHeight,
                stroke: 'none',
                fill: this.tierBackgroundColors[ti % this.tierBackgroundColors.length]
            }));
            labelGroup.appendChild(quantTools);
            quantTools.appendChild(makeElementNS(NS_SVG, 'line', null, {
                x1: this.tabMargin,
                y1: clh + (tier.clientMin|0),
                x2: this.tabMargin,
                y2: clh + (tier.clientMax|0),
                strokeWidth: 1
            }));
            quantTools.appendChild(makeElementNS(NS_SVG, 'line', null, {
                x1: this.tabMargin -5 ,
                y1: clh + (tier.clientMin|0),
                x2: this.tabMargin,
                y2: clh + (tier.clientMin|0),
                strokeWidth: 1
            }));
            quantTools.appendChild(makeElementNS(NS_SVG, 'line', null, {
                x1: this.tabMargin -3 ,
                y1: clh + ((tier.clientMin|0) +(tier.clientMax|0))/2 ,
                x2: this.tabMargin,
                y2: clh + ((tier.clientMin|0) +(tier.clientMax|0))/2,
                strokeWidth: 1
            }));
            quantTools.appendChild(makeElementNS(NS_SVG, 'line', null, {
                x1: this.tabMargin -5 ,
                y1: clh + (tier.clientMax|0),
                x2: this.tabMargin,
                y2: clh + (tier.clientMax|0),
                strokeWidth: 1
            }));
            var minQ = makeElementNS(NS_SVG, 'text', formatQuantLabel(tier.min), {
                x: 80,
                y: (clh|0) + (tier.clientMin|0),
                strokeWidth: 0,
                fill: 'black',
                fontSize: '8pt'
            });
            quantTools.appendChild(minQ);
            var mqbb = minQ.getBBox();
            minQ.setAttribute('x', this.tabMargin - mqbb.width - 7);
            minQ.setAttribute('y', (clh|0) + (tier.clientMin|0) + (mqbb.height/2) - 4);
                    
            var maxQ = makeElementNS(NS_SVG, 'text', formatQuantLabel(tier.max), {
                x: 80,
                y: (clh|0) + (tier.clientMax|0),
                strokeWidth: 0,
                fill: 'black',
                fontSize: '8pt'
            });
            quantTools.appendChild(maxQ);
            maxQ.setAttribute('x', this.tabMargin - maxQ.getBBox().width - 3);
            mqbb = maxQ.getBBox();
            maxQ.setAttribute('x', this.tabMargin - mqbb.width - 7);
            maxQ.setAttribute('y', (clh|0) + (tier.clientMax|0) + (mqbb.height/2) -1 );

            var button = this.icons.createIcon('magnifier', labelGroup);
            button.setAttribute('transform', 'translate(' + (this.tabMargin - 18) + ', ' + (clh + (tier.layoutHeight/2) - 8) + '), scale(0.6,0.6)');

            // FIXME style-changes don't currently work because of the way icons get grouped.
            button.addEventListener('mouseover', function(ev) {
	        button.setAttribute('fill', 'red');
            }, false);
            button.addEventListener('mouseout', function(ev) {
	        button.setAttribute('stroke', 'gray');
            }, false);
                
            quantTools.appendChild(button);
            this.makeQuantConfigButton(quantTools, tier, clh);
            this.makeTooltip(quantTools, 'Click to adjust how this data is displayed');
        }

        var labelMaxWidth = this.tabMargin - 20;
        if (hasWidget) {
            labelMaxWidth -= 20;
        }
        var labelString = tier.dasSource.name;
	var labelText = document.createElementNS(NS_SVG, 'text');
	labelText.setAttribute('x', 15);
	labelText.setAttribute('y', clh + 17);
	labelText.setAttribute('stroke-width', 0);
	labelText.setAttribute('fill', 'black');
	labelText.appendChild(document.createTextNode(labelString));
        labelText.setAttribute('pointer-events', 'none');
	labelGroup.appendChild(labelText);

        while (labelText.getBBox().width > labelMaxWidth) {
            removeChildren(labelText);
            labelString = labelString.substring(0, labelString.length - 1);
            labelText.appendChild(document.createTextNode(labelString + '...'));
        }

	this.xfrmTier(tier, this.tabMargin - ((1.0 * (this.viewStart - this.origin)) * this.scale), -1);
	    
	if (tier.placard) {
	    tier.placard.setAttribute('transform', 'translate(' + this.tabMargin + ', ' + (clh + tier.layoutHeight - 4) + ')');
	    browserSvg.appendChild(tier.placard);
	    this.placards.push(tier.placard);
	}

	clh += tier.layoutHeight;
    }
	
    this.featureBackground.setAttribute('height', ((clh | 0) - 50));

    if (clh < 150) {
	clh = 150;
    }
	
    this.svgRoot.setAttribute("height", "" + ((clh | 0) + 10) + "px");
    this.svgBackground.setAttribute("height", "" + ((clh | 0) + 10));
    this.featureClipRect.setAttribute("height", "" + ((clh | 0) - 10));
    this.labelClipRect.setAttribute("height", "" + ((clh | 0) - 10));
}

Browser.prototype.offsetForTier = function(ti) {
    var clh = 50;
    for (var t = 0; t < ti; ++t) {
        clh += this.tiers[t].layoutHeight;
    }
    return clh;
}

Browser.prototype.tierInfoPopup = function(tier, ev) {
    var regel;

    var popcontents = [];
    if (tier.dasSource.desc) {
        popcontents.push(tier.dasSource.desc);
    }

    var srcs = this.availableSources.get();
    if (tier.dasSource.mapping) {
        var mcs = this.chains[tier.dasSource.mapping].coords;
        popcontents.push(makeElement('p', makeElement('i', 'Mapped from ' + mcs.auth + mcs.version)));
        srcs = this.mappableSources[tier.dasSource.mapping];
    }

    if (srcs == 0) {
        regel = makeElement('p', 'Registry data not available');
    } else {
        for (var ri = 0; ri < srcs.length; ++ri) {
            var re = srcs[ri];
            if (re.uri == tier.dasSource.uri && re.source_uri) {
                regel = makeElement('p', makeElement('a', 'Registry entry: ' + re.name, {href: 'http://www.dasregistry.org/showdetails.jsp?auto_id=' + re.source_uri, target: '_new'})); 
                break;
            }
        }
        if (!regel) {
            regel = makeElement('p', 'No registry information for this source');
        }
    }

    popcontents.push(regel);

    this.popit(ev, tier.dasSource.name, popcontents, {width: 300});
}

Browser.prototype.setupTierDrag = function(element, ti) {
    var thisB = this;
    var dragOriginX, dragOriginY;
    var dragFeedbackRect;
    var targetTier;
    var clickTimeout = null;
    var tier = this.tiers[ti];
    
    var moveHandler = function(ev) {
        var cly = ((ev.clientY + window.scrollY - dragOriginY) | 0) - 50;
        var destTier = 0;
        while (destTier < thisB.tiers.length && cly > thisB.tiers[destTier].layoutHeight) {
            cly -= thisB.tiers[destTier].layoutHeight;
            ++destTier;
        }
        if (destTier != targetTier) {
            targetTier = destTier;
            dragFeedbackRect.setAttribute('y', thisB.offsetForTier(targetTier) - 2);
        }
    };
    
    var binned = false;
    var binEnterHandler = function(ev) {
        thisB.bin.setAttribute('stroke', 'red');
        dragFeedbackRect.setAttribute('fill', 'none');
        binned = true;
    }
    var binLeaveHandler = function(ev) {
        thisB.bin.setAttribute('stroke', 'gray');
        dragFeedbackRect.setAttribute('fill', 'red');
        binned = false;
    }
    
    var upHandler = function(ev) {
        window.removeEventListener('mousemove', moveHandler, true);
        window.removeEventListener('mouseup', upHandler, true);
        thisB.bin.removeEventListener('mouseover', binEnterHandler, true);
        thisB.bin.removeEventListener('mouseout', binLeaveHandler, true);
        thisB.bin.setAttribute('stroke', 'gray');

        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
            thisB.tierInfoPopup(tier, ev);
            return;
        }

        thisB.popupHolder.removeChild(dragFeedbackRect);
        if (binned) {
            var newTiers = [];
            
            for (var t = 0; t < thisB.tiers.length; ++t) {
                if (t != ti) {
                    newTiers.push(thisB.tiers[t]);
                }
            }
            
            thisB.tierHolder.removeChild(thisB.tiers[ti].viewport);
            
            thisB.tiers = newTiers;
            for (var nti = 0; nti < thisB.tiers.length; ++nti) {
                thisB.tiers[nti].background.setAttribute("fill", thisB.tierBackgroundColors[nti % thisB.tierBackgroundColors.length]);
            }
            
            thisB.arrangeTiers();
	    thisB.storeStatus();
        } else if (targetTier == ti) {
            // Nothing at all.
        } else {
            var newTiers = [];
            
            var fromCnt = 0;
            if (targetTier > ti) {
                --targetTier;
            }
            while (newTiers.length < thisB.tiers.length) {
                if (newTiers.length == targetTier) {
                    newTiers.push(thisB.tiers[ti]);
                } else {
                    if (fromCnt != ti) {
                        newTiers.push(thisB.tiers[fromCnt]);
                    }
                    ++fromCnt;
                }
            }
            
            thisB.tiers = newTiers;
            for (var nti = 0; nti < thisB.tiers.length; ++nti) {
                thisB.tiers[nti].background.setAttribute("fill", thisB.tierBackgroundColors[nti % thisB.tierBackgroundColors.length]);
            }
            
            thisB.arrangeTiers();
	    thisB.storeStatus();
        }
    }
    
    element.addEventListener('mousedown', function(ev) {
        thisB.removeAllPopups();
        ev.stopPropagation(); ev.preventDefault();
        
        var origin = thisB.svgHolder.getBoundingClientRect();
        dragOriginX = origin.left + window.scrollX; dragOriginY = origin.top + window.scrollY;
        window.addEventListener('mousemove', moveHandler, true);
        window.addEventListener('mouseup', upHandler, true);
        thisB.bin.addEventListener('mouseover', binEnterHandler, true);
        thisB.bin.addEventListener('mouseout', binLeaveHandler, true);
        targetTier = ti;
        dragFeedbackRect = makeElementNS(NS_SVG, 'rect', null, {
            x: thisB.tabMargin,
            y: thisB.offsetForTier(targetTier) - 2,
            width: thisB.featurePanelWidth,
            height: 4,
            fill: 'red',
            stroke: 'none'
        });
        
        clickTimeout = setTimeout(function() {
            clickTimeout = null;
            // We can do all the setup on click, but don't show the feedback rectangle
            // until we're sure it's a click rather than a drag.
            thisB.popupHolder.appendChild(dragFeedbackRect);
        }, 200);

    },true);
}

Browser.prototype.makeToggleButton = function(labelGroup, tier, ypos) {
    var thisB = this;
    var bumpToggle = makeElementNS(NS_SVG, 'g', null, {fill: 'cornsilk', strokeWidth: 1, stroke: 'gray'});
    bumpToggle.appendChild(makeElementNS(NS_SVG, 'rect', null, {x: this.tabMargin - 15, y: ypos + 8, width: 8, height: 8}));
    bumpToggle.appendChild(makeElementNS(NS_SVG, 'line', null, {x1: this.tabMargin - 15, y1: ypos + 12, x2: this.tabMargin - 7, y2: ypos+12}));
    if (!tier.bumped) {
        bumpToggle.appendChild(makeElementNS(NS_SVG, 'line', null, {x1: this.tabMargin - 11, y1: ypos+8, x2: this.tabMargin - 11, y2: ypos+16}));
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
    this.makeTooltip(bumpToggle, 'Click to ' + (tier.bumped ? 'collapse' : 'expand'));
}

Browser.prototype.updateRegion = function()
{
    var chrLabel = this.chr;
    if (chrLabel.indexOf('chr') < 0) {
        chrLabel = 'chr' + chrLabel;
    }
    var fullLabel = chrLabel + ':' + (this.viewStart|0) + '..' + (this.viewEnd|0);

    removeChildren(this.regionLabel);
    this.regionLabel.appendChild(document.createTextNode(fullLabel));
    var bb = this.regionLabel.getBBox();
    var rlm = bb.x + bb.width;
    if (this.regionLabelMax && rlm > this.regionLabelMax) {
        removeChildren(this.regionLabel);
        this.regionLabel.appendChild(document.createTextNode(chrLabel));
    }
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
        this.knownSpace = new KnownSpace(this.tiers, this.chr, outerDrawnStart, outerDrawnEnd, scaledQuantRes);
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


// var originX;
// var dcTimeoutID = null;
// var clickTestTB = null;

Browser.prototype.mouseDownHandler = function(ev)
{
    var thisB = this;
    this.removeAllPopups();
    ev.stopPropagation(); ev.preventDefault();

    var target = document.elementFromPoint(ev.clientX, ev.clientY);
    while (target && !target.dalliance_feature && !target.dalliance_group) {
        target = target.parentNode;
    }

    if (target && (target.dalliance_feature || target.dalliance_group)) {
	if (this.dcTimeoutID && target.dalliance_feature) {
            var f = target.dalliance_feature;
            var org = this.svgHolder.getBoundingClientRect();
            var fstart = (((f.min|0) - (this.viewStart|0)) * this.scale) + org.left + this.tabMargin;
            var fwidth = (((f.max - f.min) + 1) * this.scale);

	    clearTimeout(this.dcTimeoutID);
	    this.dcTimeoutID = null;

            var newMid = (((target.dalliance_feature.min|0) + (target.dalliance_feature.max|0)))/2;
            if (fwidth > 10) {
                var frac = (1.0 * (ev.clientX - fstart)) / fwidth;
                if (frac < 0.3) {
                    newMid = (target.dalliance_feature.min|0);
                } else  if (frac > 0.7) {
                    newMid = (target.dalliance_feature.max|0) + 1;
                }
            }

	    var width = this.viewEnd - this.viewStart;
	    this.setLocation(newMid - (width/2), newMid + (width/2));
            
            var extraPix = this.featurePanelWidth - ((width+1)*this.scale);
            // alert(extraPix);
            if (Math.abs(extraPix) > 1) {
                this.move(extraPix/2);
            }
	} else {
	    this.dcTimeoutID = setTimeout(function() {
		thisB.dcTimeoutID = null;
		thisB.featurePopup(ev, target.dalliance_feature, target.dalliance_group);
	    }, 200);
	}
    } else {
	this.originX = ev.clientX;
	document.addEventListener('mousemove', this.__mouseMoveHandler, true);
	document.addEventListener('mouseup', this.__mouseUpHandler, true);
        this.clickTestTB = setTimeout(function() {
            thisB.clickTestTB = null;
        }, 200);
    }
}


var TAGVAL_NOTE_RE = new RegExp('^([A-Za-z]+)=(.+)');

Browser.prototype.featurePopup = function(ev, feature, group){
    if (!feature) feature = {};
    if (!group) group = {};

    this.removeAllPopups();

    dlog('starting popup');
    var table = makeElement('table', null);
    table.style.width = '100%';

    var name = pick(group.type, feature.type);
    var fid = pick(group.label, feature.label, group.id, feature.id);
    if (fid && fid.indexOf('__dazzle') != 0) {
        name = name + ': ' + fid;
    }

    dlog('done id');
    var idx = 0;
    if (feature.method) {
        var row = makeElement('tr', [
            makeElement('th', 'Method'),
            makeElement('td', feature.method)
        ]);
        row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
        table.appendChild(row);
        ++idx;
    }
    dlog('done method');
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
        row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
        table.appendChild(row);
        ++idx;
    }
    dlog('done loc');
    if (feature.score && feature.score != '-') {
        var row = makeElement('tr', [
            makeElement('th', 'Score'),
            makeElement('td', '' + feature.score)
        ]);
        row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
        table.appendChild(row);
        ++idx;
    }
    dlog('score done');
    {
        var links = maybeConcat(group.links, feature.links);
        if (links && links.length > 0) {
            var row = makeElement('tr', [
                makeElement('th', 'Links'),
                makeElement('td', links.map(function(l) {
                    return makeElement('div', makeElement('a', l.desc, {href: l.uri, target: '_new'}));
                }))
            ]);
            row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
            table.appendChild(row);
            ++idx;
        }
    }
    dlog('links done');
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
            row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
            table.appendChild(row);
            ++idx;
        }
    }
    dlog('notes done');

    this.popit(ev, name, table, {width: 400});
}

Browser.prototype.mouseUpHandler = function(ev) {
    var thisB = this;

    if (this.clickTestTB && this.positionFeedback) {
        var origin = svgHolder.getBoundingClientRect();
        var ppos = ev.clientX - origin.left - this.tabMargin;
        var spos = (((1.0*ppos)/this.scale) + this.viewStart)|0;
        
        var mx = ev.clientX + window.scrollX, my = ev.clientY + window.scrollY;
        var popup = makeElement('div', '' + spos, {}, {
            position: 'absolute',
            top: '' + (my + 20) + 'px',
            left: '' + Math.max(mx - 30, 20) + 'px',
            backgroundColor: 'rgb(250, 240, 220)',
            borderWidth: '1px',
            borderColor: 'black',
            borderStyle: 'solid',
            padding: '2px',
            maxWidth: '400px'
        });
        this.hPopupHolder.appendChild(popup);
        var moveHandler;
        moveHandler = function(ev) {
            try {
                thisB.hPopupHolder.removeChild(popup);
            } catch (e) {
                // May have been removed by other code which clears the popup layer.
            }
            window.removeEventListener('mousemove', moveHandler, false);
        }
        window.addEventListener('mousemove', moveHandler, false);
    }
    
    ev.stopPropagation(); ev.preventDefault();

    document.removeEventListener('mousemove', this.__mouseMoveHandler, true);
    document.removeEventListener('mouseup', this.__mouseUpHandler, true);
    this.storeStatus();
}

Browser.prototype.mouseMoveHandler = function(ev) {
    ev.stopPropagation(); ev.preventDefault();
    if (ev.clientX != this.originX) {
        this.move(ev.clientX - this.originX);
        this.originX = ev.clientX;
    }
}

/*

var touchOriginX;

function touchStartHandler(ev)
{
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
    ev.stopPropagation(); ev.preventDefault();
    storeStatus();
}

function touchCancelHandler(ev) {
}

*/


Browser.prototype.removeAllPopups = function() {
    removeChildren(this.popupHolder);
    removeChildren(this.hPopupHolder);
}

function EPMenuItem(entryPoint) {
    this.entryPoint = entryPoint;
    this.nums = stringToNumbersArray(entryPoint.name);
}

Browser.prototype.makeHighlight = function() {
    if (this.highlight) {
	this.dasTierHolder.removeChild(this.highlight);
	this.highlight = null;
    }

    if (this.highlightMin > 0) {
	this.highlight = document.createElementNS(NS_SVG, 'rect');
	this.highlight.setAttribute('x', (this.highlightMin - this.origin) * this.scale);
	this.highlight.setAttribute('y', 0);
	this.highlight.setAttribute('width', (this.highlightMax - this.highlightMin + 1) * this.scale);
	this.highlight.setAttribute('height', 10000);
	this.highlight.setAttribute('stroke', 'none');
	this.highlight.setAttribute('fill', 'red');
	this.highlight.setAttribute('fill-opacity', 0.15);
	this.highlight.setAttribute('pointer-events', 'none');
	this.dasTierHolder.appendChild(this.highlight);
    }
}

Browser.prototype.init = function() {
    // Just here for backwards compatibility.
}

Browser.prototype.realInit = function(opts) {
    if (!opts) {
        opts = {};
    }

    var thisB = this;
    // Cache away the default sources before anything else

    this.defaultSources = [];
    for (var i = 0; i < this.sources.length; ++i) {
        this.defaultSources.push(this.sources[i]);
    }
    this.defaultChr = this.chr;
    this.defaultStart = this.viewStart;
    this.defaultEnd = this.viewEnd;

    this.icons = new IconSet(this.iconsURI);

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

    var storedConfigVersion = localStorage['dalliance.' + this.cookieKey + '.version'];
    if (storedConfigVersion) {
        storedConfigVersion = storedConfigVersion|0;
    } else {
        storedConfigVersion = -100;
    }
    if (VERSION.CONFIG != storedConfigVersion) {
//        alert("Don't understand config version " + storedConfigVersion + ", resetting.");
        reset = true;
    }

    var storedConfigHash = localStorage['dalliance.' + this.cookieKey + '.configHash'] || '';
    var pageConfigHash = hex_sha1(miniJSONify(this.sources));
    if (pageConfigHash != storedConfigHash) {
//        alert('page config seems to have changed, resetting');
        reset=true;
        localStorage['dalliance.' + this.cookieKey + '.configHash'] = pageConfigHash;
    }

    if (this.cookieKey && localStorage['dalliance.' + this.cookieKey + '.view-chr'] && !reset) {
        qChr = localStorage['dalliance.' + this.cookieKey + '.view-chr'];
        qMin = localStorage['dalliance.' + this.cookieKey + '.view-start']|0;
        qMax = localStorage['dalliance.' + this.cookieKey + '.view-end']|0;
    }

    if (this.cookieKey) {
	var maybeSourceConfig = localStorage['dalliance.' + this.cookieKey + '.sources'];
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

    this.positionFeedback = queryDict.positionFeedback || false;
    guidelineConfig = queryDict.guidelines || 'foreground';
    if (guidelineConfig == 'true') {
	this.guidelineStyle = 'background';
    } else if (STRICT_NUM_REGEXP.test(guidelineConfig)) {
	this.guidelineStyle = 'background';
	this.guidelineSpacing = guidelineConfig|0;
    } else {
	this.guidelineStyle = guidelineConfig;
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
	this.highlightMin = match[2]|0;
	this.highlightMax = match[3]|0;
    }

    //
    // Set up the UI (factor out?)
    //
           
    this.svgHolder = document.getElementById(this.pageName);
    this.svgRoot = makeElementNS(NS_SVG, 'svg', null, {
        version: '1.1',
        width: '860px',
        height: '500px',
        id: 'browser_svg'
    });
    removeChildren(this.svgHolder);
    this.svgHolder.appendChild(this.svgRoot);

    {
        var patdata = '';
         for (var i = -90; i <= 90; i += 20) {
             patdata = patdata + 'M ' + (Math.max(0, i) - 2) + ' ' + (Math.max(-i, 0) - 2) + ' L ' + (Math.min(100 + i, 100) + 2) + ' ' + (Math.min(100 - i, 100) + 2) + ' ';
             patdata = patdata + 'M ' + Math.max(i, 0) + ' ' + Math.min(i + 100, 100) + ' L ' + Math.min(i + 100, 100) + ' ' + Math.max(i, 0) + ' ';
        }
        var pat =  makeElementNS(NS_SVG, 'pattern',
                                 makeElementNS(NS_SVG, 'path', null, {
                                     stroke: 'lightgray',
                                     strokeWidth: 2,
                                     d: patdata
                                     // d: 'M 0 90 L 10 100 M 0 70 L 30 100 M 0 50 L 50 100 M 0 30 L 70 100 M 0 10 L 90 100 M 10 0 L 100 90 M 30 0 L 100 70 M 50 0 L 100 50 M 70 0 L 100 30 M 90 0 L 100 10'
                                     // 'M 0 90 L 90 0 M 0 70 L 70 0'
                                 }),
                                 {
                                     id: 'bgpattern-' + this.pageName,
                                     x: 0,
                                     y: 0,
                                     width: 100,
                                     height: 100
                                 });
        pat.setAttribute('patternUnits', 'userSpaceOnUse');
        this.svgRoot.appendChild(pat);
    }

    this.svgBackground = makeElementNS(NS_SVG, 'rect', null,  {id: 'background', fill: 'white' /*'url(#bgpattern-' + this.pageName + ')' */});
    var main = makeElementNS(NS_SVG, 'g', this.svgBackground, {
        fillOpacity: 1.0, 
        stroke: 'black', 
        strokeWidth: '0.1cm', 
        fontFamily: 'helvetica', 
        fontSize: '10pt'
    });
    this.svgRoot.appendChild(main);

    this.regionLabel = makeElementNS(NS_SVG, 'text', 'chr???', {
        x: 260,
        y: 30,
        strokeWidth: 0
    });
    main.appendChild(this.regionLabel);
    this.makeTooltip(this.regionLabel, 'Click to jump to a new location or gene');

    var addButton = this.icons.createButton('add-track', main, 30, 30);
    addButton.setAttribute('transform', 'translate(100, 10)');
    this.makeTooltip(addButton, 'Add tracks from the DAS registry');
    main.appendChild(addButton);

    var linkButton = this.icons.createButton('link', main, 30, 30);
    linkButton.setAttribute('transform', 'translate(140, 10)');
    this.makeTooltip(linkButton, 'Link to other genome browsers');
    main.appendChild(linkButton);

    var resetButton = this.icons.createButton('reset', main, 30, 30);
    resetButton.setAttribute('transform', 'translate(180, 10)');
    this.makeTooltip(resetButton, 'Reset the browser to a default state');
    main.appendChild(resetButton);

    var saveButton = this.icons.createButton('export', main, 30, 30);
    saveButton.setAttribute('transform', 'translate(220, 10)');
    this.makeTooltip(saveButton, 'Export the current genome display as a vector graphics file');
    main.appendChild(saveButton);
    var savePopupHandle;
    saveButton.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        var showing = savePopupHandle && savePopupHandle.displayed;
        thisB.removeAllPopups();
        
        if (showing) {
            return;
        }

        var saveDoc = document.implementation.createDocument(NS_SVG, 'svg', null);
        var saveWidth = thisB.svgRoot.getAttribute('width')|0;
        saveDoc.documentElement.setAttribute('width', saveWidth);
        saveDoc.documentElement.setAttribute('height', thisB.svgRoot.getAttribute('height'));

        var saveRoot = makeElementNS(NS_SVG, 'g', null, {
            fontFamily: 'helvetica'
        });
        saveDoc.documentElement.appendChild(saveRoot);
        var dallianceAnchor = makeElementNS(NS_SVG, 'text', 'Graphics from Dalliance ' + VERSION, {
                x: 80,
                y: 30,
                strokeWidth: 0,
                fill: 'black',
                fontSize: '12pt'
        });
        thisB.svgRoot.appendChild(dallianceAnchor);
        var daWidth = dallianceAnchor.getBBox().width;
        thisB.svgRoot.removeChild(dallianceAnchor);
        dallianceAnchor.setAttribute('x', saveWidth - daWidth - 60);
        saveRoot.appendChild(dallianceAnchor);
        // dallianceAnchor.setAttributeNS(NS_XLINK, 'xlink:href', 'http://www.biodalliance.org/');
        
        var chrLabel = thisB.chr;
        if (chrLabel.indexOf('chr') < 0) {
            chrLabel = 'chr' + chrLabel;
        }
        var fullLabel = chrLabel + ':' + (thisB.viewStart|0) + '..' + (thisB.viewEnd|0);
        saveRoot.appendChild(makeElementNS(NS_SVG, 'text', fullLabel, {
            x: 40,
            y: 30,
            strokeWidth: 0,
            fill: 'black',
            fontSize: '12pt'
        })); 

        saveRoot.appendChild(labelClip.cloneNode(true));
        saveRoot.appendChild(thisB.dasLabelHolder.cloneNode(true));
        saveRoot.appendChild(featureClip.cloneNode(true));
        saveRoot.appendChild(thisB.dasTierHolder.cloneNode(true));

        var svgButton = makeElement('input', null, {
            type: 'radio',
            name: 'format',
            value: 'svg',
            checked: true
        });
        var pdfButton = makeElement('input', null, {
            type: 'radio',
            name: 'format',
            value: 'pdf'
        });
        var saveForm = makeElement('form', [makeElement('p', "To work around restrictions on saving files from web applications, image export currently requires transmission of the browser's current state to a remote server.  Depending on connection speed, this can take a few seconds -- please be patient."),
                                            makeElement('p', 'The download links only work once, so if you wish to keep or share your exported images, please save a copy on your computer'),
                                            svgButton, 'SVG', makeElement('br'),
                                            pdfButton, 'PDF', makeElement('br'),
                                            makeElement('br'),
                                            makeElement('input', null, {type: 'hidden',  name: 'svgdata', value: new XMLSerializer().serializeToString(saveDoc)}),
                                            makeElement('input', null, {type: 'submit'})],
                                   {action: thisB.exportServer + 'browser-image.svg', method: 'POST'});
        svgButton.addEventListener('click', function(cev) {
            saveForm.setAttribute('action', thisB.exportServer + 'browser-image.svg');
        }, false);
        pdfButton.addEventListener('click', function(cev) {
            saveForm.setAttribute('action', thisB.exportServer + 'browser-image.pdf');
        }, false);
        saveForm.addEventListener('submit', function(sev) {
            setTimeout(function() {
                thisB.removeAllPopups();
            }, 200);
            return true;
        }, false);
        savePopupHandle = thisB.popit(ev, 'Export', saveForm, {width: 400});
    }, false);

    this.bin = this.icons.createIcon('bin', main);
    this.bin.setAttribute('transform', 'translate(10, 18)');
    main.appendChild(this.bin);
    this.makeTooltip(this.bin, 'Drag tracks here to discard');
    
    this.featureClipRect = makeElementNS(NS_SVG, 'rect', null, {
        x: this.tabMargin,
        y: 50,
        width: 850 - this.tabMargin,
        height: 440
    });
    var featureClip = makeElementNS(NS_SVG, 'clipPath', this.featureClipRect, {id: 'featureClip-' + this.pageName});
    main.appendChild(featureClip);
    this.labelClipRect = makeElementNS(NS_SVG, 'rect', null, {
        x: 10,
        y: 50,
        width: this.tabMargin - 10,
        height: 440
    });
    var labelClip = makeElementNS(NS_SVG, 'clipPath', this.labelClipRect, {id: 'labelClip-' + this.pageName});
    main.appendChild(labelClip);
    
    this.featureBackground = makeElementNS(NS_SVG, 'rect', null, {
        x: this.tabMargin,
        y: 50,
        width: 850 - this.tabMargin,
        height: 440,
        stroke: 'none',
        fill: 'url(#bgpattern-' + this.pageName + ')'
    });
    main.appendChild(this.featureBackground);

    this.dasTierHolder = makeElementNS(NS_SVG, 'g', null, {clipPath: 'url(#featureClip-' + this.pageName + ')'});   // FIXME needs a unique ID.
    main.appendChild(this.dasTierHolder);
    var dasTiers = makeElementNS(NS_SVG, 'g', null, {id: 'dasTiers'});
    this.dasTierHolder.appendChild(dasTiers);

    this.makeHighlight();
    
    this.dasLabelHolder = makeElementNS(NS_SVG, 'g', makeElementNS(NS_SVG, 'g', null, {id: 'dasLabels'}), {clipPath: 'url(#labelClip-' + this.pageName + ')'}); 
    main.appendChild(this.dasLabelHolder);
    
    {
        var plusIcon = this.icons.createIcon('magnifier-plus', main);
        var minusIcon = this.icons.createIcon('magnifier-minus', main);
        this.zoomTickMarks = makeElementNS(NS_SVG, 'g');
        this.zoomSlider = new DSlider(250);
        this.zoomSlider.onchange = function(zoomVal, released) {
	    thisB.zoom(Math.exp((1.0 * zoomVal) / thisB.zoomExpt));
	    if (released) {
                thisB.invalidateLayouts();
	        thisB.refresh();
	        thisB.storeStatus();
	    }
        };
        plusIcon.setAttribute('transform', 'translate(0,15)');
        this.zoomSlider.svg.setAttribute('transform', 'translate(30, 0)');
        minusIcon.setAttribute('transform', 'translate(285,15)');
        this.zoomWidget = makeElementNS(NS_SVG, 'g', [this.zoomTickMarks, plusIcon, this.zoomSlider.svg, minusIcon]);

        this.makeTooltip(this.zoomWidget, 'Drag to zoom');
        main.appendChild(this.zoomWidget);
    }

    this.karyo = new Karyoscape(this, this.karyoEndpoint);
    this.karyo.svg.setAttribute('transform', 'translate(480, 15)');
    this.karyo.onchange = function(pos) {
        var width = thisB.viewEnd - thisB.viewStart + 1;
        var newStart = ((pos * thisB.currentSeqMax) - (width/2))|0;
        var newEnd = newStart + width - 1;
        thisB.setLocation(newStart, newEnd);
    };
    main.appendChild(this.karyo.svg);
    
    this.popupHolder = makeElementNS(NS_SVG, 'g');
    main.appendChild(this.popupHolder);
    this.hPopupHolder = makeElement('div');
    this.svgHolder.appendChild(this.hPopupHolder);
  
    this.bhtmlRoot = makeElement('div');
    if (!this.disablePoweredBy) {
        this.bhtmlRoot.appendChild(makeElement('span', ['Powered by ', makeElement('a', 'Dalliance', {href: 'http://www.biodalliance.org/'}), ' ' + VERSION]));
    }
    this.svgHolder.appendChild(this.bhtmlRoot);
    
    if (this.guidelineStyle == 'foreground') {
	this.fgGuide = document.createElementNS(NS_SVG, 'line');
	this.fgGuide.setAttribute('x1', 500);
	this.fgGuide.setAttribute('y1', 50);
	this.fgGuide.setAttribute('x2', 500);
	this.fgGuide.setAttribute('y2', 10000);
	this.fgGuide.setAttribute('stroke', 'red');
	this.fgGuide.setAttribute('stroke-width', 1);
	this.fgGuide.setAttribute('pointer-events', 'none');
	main.appendChild(this.fgGuide);
    }
    
    // set up the linker

    var linkPopupHandle;
    linkButton.addEventListener('mousedown', function(ev) {
        var showing = linkPopupHandle && linkPopupHandle.displayed;
        ev.stopPropagation(); ev.preventDefault();
	thisB.removeAllPopups();
        if (showing) {
            return;
        }

        var linkList = makeElement('ul');
        for (l in thisB.browserLinks) {
            linkList.appendChild(makeElement('li', makeElement('a', l, {
                href: thisB.browserLinks[l].replace(new RegExp('\\${([a-z]+)}', 'g'), function(s, p1) {
		    if (p1 == 'chr') {
		        return thisB.chr;
		    } else if (p1 == 'start') {
		        return thisB.viewStart|0;
		    } else if (p1 == 'end') {
		        return thisB.viewEnd|0;
		    } else {
		        return '';
		    }
	        }),
                target: '_new'
            })));
        }
        linkPopupHandle = thisB.popit(ev, 'Link to...', linkList);
    }, false);

    // set up the navigator

    var navPopupHandle;
    this.regionLabel.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        var showing = navPopupHandle && navPopupHandle.displayed;
	thisB.removeAllPopups(); 
        if (showing) {
            return;
        }

        if (thisB.entryPoints == null) {
            alert("entry_points aren't currently available for this genome");
            return;
        }
        var epMenuItems = [], epsByChrName = {};
        for (var epi = 0; epi < thisB.entryPoints.length; ++epi) {
            epMenuItems.push(new EPMenuItem(thisB.entryPoints[epi]));
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

        var popup = makeElement('div');
        popup.style.padding = '5px';
        popup.style.paddingRight = '9px';
       
        {
            var form = makeElement('form');
            var tab = makeElement('table');

            var selectChr = makeElement('select', null);
            for (var epi = 0; epi < epMenuItems.length; ++epi) {
                var ep = epMenuItems[epi].entryPoint;
	        epsByChrName[ep.name] = ep;
                selectChr.appendChild(makeElement('option', ep.toString(), {value: ep.name}));
            }
            selectChr.value = thisB.chr;
            tab.appendChild(makeElement('tr', [makeElement('td', 'Chr:'), makeElement('td', selectChr)]));

            var minPosInput = makeElement('input', null, {value: (thisB.viewStart|0)});
            tab.appendChild(makeElement('tr', [makeElement('td', 'Start:'), makeElement('td',  minPosInput)]));
            
            var maxPosInput = makeElement('input', null, {value: (thisB.viewEnd|0)});
            tab.appendChild(makeElement('tr', [makeElement('td', 'End:'), makeElement('td',  maxPosInput)]));

            form.appendChild(tab);
            form.appendChild(makeElement('input', null, {type: 'submit', value: 'Go'}));
            popup.appendChild(form);
        }
        navPopupHandle = thisB.popit(ev, 'Jump to...', popup, {width: 300});

	form.addEventListener('submit', function(ev) {
	    ev.stopPropagation(); ev.preventDefault();

	    var nchr = selectChr.value;
	    var nmin = stringToInt(minPosInput.value);
	    var nmax = stringToInt(maxPosInput.value);    
	    thisB.removeAllPopups();

	    if (nchr && nmin && nmax) {
                if (nchr != thisB.chr) {
                    thisB.highlightMin = -1;
                    thisB.highlightMax = -1;
                }
		thisB.setLocation(nmin, nmax, nchr);
	    } else {
		alert('Must specify min and max');
	    }

	    return false;
	}, false);

        if (thisB.searchEndpoint) {
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
	        thisB.removeAllPopups();

	        if (!g || g.length == 0) {
		    return false;
	        }

	        thisB.searchEndpoint.features(null, {group: g, type: 'transcript'}, function(found) {        // HAXX
                    if (!found) found = [];
                    var min = 500000000, max = -100000000;
		    var nchr = null;
		    for (var fi = 0; fi < found.length; ++fi) {
			var f = found[fi];

                        if (f.label != g) {
                            // ...because Dazzle can return spurious overlapping features.
                            continue;
                        }

			if (nchr == null) {
			    nchr = f.segment;
			}
			min = Math.min(min, f.min);
			max = Math.max(max, f.max);
		    }

		    if (!nchr) {
		        alert("no match for '" + g + "' (NB. server support for search is currently rather limited...)");
		    } else {
		        thisB.highlightMin = min;
		        thisB.highlightMax = max;
		        thisB.makeHighlight();

		        var padding = Math.max(2500, (0.3 * (max - min + 1))|0);
		        thisB.setLocation(min - padding, max + padding, nchr);
		    }
	        }, false);
                
	        return false;
	    }, false);
        }

    }, false);

  
    var addPopupHandle;
    addButton.addEventListener('mousedown', function(ev) {
	ev.stopPropagation(); ev.preventDefault();
        var showing = addPopupHandle && addPopupHandle.displayed;
	thisB.removeAllPopups();
        if (!showing) {
            addPopupHandle = thisB.showTrackAdder(ev);
        }
    }, false);

    // set up the resetter
    resetButton.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();

        removeChildren(thisB.tierHolder);
        thisB.tiers = [];
        thisB.sources = [];

        for (var t = 0; t < thisB.defaultSources.length; ++t) {
	    var source = thisB.defaultSources[t];
            thisB.sources.push(source);
            thisB.makeTier(source);
        }
        thisB.arrangeTiers();
        thisB.highlightMin = thisB.highlightMax = -1;
        thisB.setLocation(thisB.defaultStart, thisB.defaultEnd, thisB.defaultChr);
    }, false);
	
    this.tierHolder = dasTiers;
    this.tiers = [];
    if (overrideSources) {
	this.sources = overrideSources;
    }
    for (var t = 0; t < this.sources.length; ++t) {
	var source = this.sources[t];
        this.makeTier(source);
    }
    thisB.arrangeTiers();
    
    //
    // Window resize support (should happen before first fetch so we know the actual size of the viewed area).
    //

    this.resizeViewer();
    window.addEventListener('resize', function(ev) {
        thisB.resizeViewer();
    }, false);

    //
    // Finalize initial viewable region, and kick off a fetch.
    //

    if (qChr && qMin && qMax) {
        this.chr = qChr; this.viewStart = qMin; this.viewEnd = qMax;
	if (this.highlightMin < 0) {
	    this.highlightMin = qMin;  this.highlightMax = qMax;
	}
    }
    
    if ((this.viewEnd - this.viewStart) > MAX_VIEW_SIZE) {
        var mid = ((this.viewEnd + this.viewStart) / 2)|0;
        this.viewStart = mid - (MAX_VIEW_SIZE/2);
        this.viewEnd = mid + (MAX_VIEW_SIZE/2) - 1;
    }

    this.origin = ((this.viewStart + this.viewEnd) / 2) | 0;
    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);

    this.zoomExpt = 250 / Math.log(MAX_VIEW_SIZE / this.zoomBase);
    this.zoomSlider.setValue(this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase));

    this.move(0);
    this.refresh();

    //
    // Tick-marks on the zoomer
    //

    this.makeZoomerTicks();

    // 
    // Set up interactivity handlers
    //

    this.__mouseMoveHandler = function(ev) {
        return thisB.mouseMoveHandler(ev);
    }
    this.__mouseUpHandler = function(ev) {
        return thisB.mouseUpHandler(ev);
    }
    main.addEventListener('mousedown', function(ev) {return thisB.mouseDownHandler(ev)}, false);

/*
    main.addEventListener('touchstart', touchStartHandler, false);
    main.addEventListener('touchmove', touchMoveHandler, false);
    main.addEventListener('touchend', touchEndHandler, false);
    main.addEventListener('touchcancel', touchCancelHandler, false); */

    this.svgRoot.addEventListener('mousewheel', function(ev) {   // FIXME does this need to be on the document?
	if (!ev.wheelDeltaX) {
	    return;
	}

	ev.stopPropagation(); ev.preventDefault();
	thisB.move(-ev.wheelDeltaX/5);
    }, false);
    this.svgRoot.addEventListener('MozMousePixelScroll', function(ev) {
	if (ev.axis == 1) {
	    ev.stopPropagation(); ev.preventDefault();
	    if (ev.detail != 0) {
		thisB.move(ev.detail);
	    }
        }
    }, false);

    var keyHandler = function(ev) {
        if (ev.keyCode == 32 || ev.charCode == 32) {
            if (!thisB.snapZoomLockout) {
                if (!thisB.isSnapZooming) {
                    thisB.isSnapZooming = true;
                    var newZoom = thisB.savedZoom || 1.0;
                    thisB.savedZoom = thisB.zoomSlider.getValue();
                    thisB.zoomSlider.setValue(newZoom);
                    thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
                    // thisB.invalidateLayouts();
                    thisB.zoomSlider.setColor('red');
                    thisB.refresh();
                } else {
                    thisB.isSnapZooming = false;
                    var newZoom = thisB.savedZoom || 10.0;
                    thisB.savedZoom = thisB.zoomSlider.getValue();
                    thisB.zoomSlider.setValue(newZoom);
                    thisB.zoom(Math.exp((1.0 * newZoom) / thisB.zoomExpt));
                    // thisB.invalidateLayouts();
                    thisB.zoomSlider.setColor('blue');
                    thisB.refresh();
                }
                thisB.snapZoomLockout = true;
            }
            ev.stopPropagation(); ev.preventDefault();      
        } else if (ev.keyCode == 37) {
            // left
            ev.stopPropagation(); ev.preventDefault();
            thisB.move(ev.shiftKey ? - 100 : -25);
        } else if (ev.keyCode == 39) {
            ev.stopPropagation(); ev.preventDefault();
            thisB.move(ev.shiftKey ? 100 : 25);
        } 

        else if (ev.charCode == 61) {
            ev.stopPropagation(); ev.preventDefault();

            var oz = thisB.zoomSlider.getValue();
            thisB.zoomSlider.setValue(oz - 10);
            var nz = thisB.zoomSlider.getValue();
            if (nz != oz) {
                thisB.zoom(Math.exp((1.0 * nz) / thisB.zoomExpt));
                thisB.scheduleRefresh(500);
            }
        } else if (ev.charCode == 45) {
            ev.stopPropagation(); ev.preventDefault();

            var oz = thisB.zoomSlider.getValue();
            thisB.zoomSlider.setValue(oz + 10);
            var nz = thisB.zoomSlider.getValue();
            if (nz != oz) {
                thisB.zoom(Math.exp((1.0 * nz) / thisB.zoomExpt));
                thisB.scheduleRefresh(500);
            }
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
        thisB.svgRoot.removeEventListener('mouseout', mouseLeaveHandler, false);
    }

    this.svgRoot.addEventListener('mouseover', function(ev) {
        window.addEventListener('keydown', keyHandler, false);
        window.addEventListener('keyup', keyUpHandler, false);
        window.addEventListener('keypress', keyHandler, false);
        thisB.svgRoot.addEventListener('mouseout', mouseLeaveHandler, false);
    }, false);
    
    // Low-priority stuff
    this.storeStatus();   // to make sure things like resets are permanent.

    var epSource;
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var s = this.tiers[ti].dasSource;
        if (s.tier_type == 'sequence') {
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

    thisB.queryRegistry(null, true);
    for (var m in this.chains) {
        this.queryRegistry(m, true);
    }
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
            setSources(msh, eval(localStorage['dalliance.registry.' + cacheHash + '.sources']), maybeMapping);
            var cacheAge = (Date.now()|0) - (cacheTime|0);
            if (cacheAge < (12 * 60 * 60 * 1000)) {
                // alert('Using cached registry data');
                return;
            } else {
                // alert('Registry data is stale, refetching');
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

        localStorage['dalliance.registry.' + cacheHash + '.sources'] = miniJSONify(availableSources);
        localStorage['dalliance.registry.' + cacheHash + '.last_queried'] = '' + Date.now();
        
        setSources(msh, availableSources, maybeMapping);
    }, function(error) {
        // msh.set(null);
    }, coords);
}

Browser.prototype.makeTier = function(source) {
    var viewport = document.createElementNS(NS_SVG, 'g');
    var viewportBackground = document.createElementNS(NS_SVG, 'rect');
    var col = this.tierBackgroundColors[this.tiers.length % this.tierBackgroundColors.length];
    viewportBackground.setAttribute('fill', col);
    viewportBackground.setAttribute('x', "-1000000");
    viewportBackground.setAttribute('y', "0");
    viewportBackground.setAttribute('width', "2000000");
    viewportBackground.setAttribute('height', "200");
    viewportBackground.setAttribute('stroke-width', "0");
    viewport.appendChild(viewportBackground);
    viewport.setAttribute("transform", "translate(200, " + ((2 * 200) + 50) + ")");
    this.tierHolder.appendChild(viewport);
    
    var tier = new DasTier(this, source, viewport, viewportBackground);
    tier.init(); // fetches stylesheet
    this.tiers.push(tier);
}


Browser.prototype.makeZoomerTicks = function() {
    var thisB = this;
    removeChildren(this.zoomTickMarks);

    var makeSliderMark = function(markSig) {
        var markPos = thisB.zoomExpt * Math.log(markSig/thisB.zoomBase);
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
        thisB.zoomTickMarks.appendChild(smark);
        thisB.zoomTickMarks.appendChild(slabel);
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


Browser.prototype.resizeViewer = function() {
    var width = window.innerWidth;
    width = Math.max(width, 640);

    if (this.forceWidth) {
        width = this.forceWidth;
    }

    this.svgRoot.setAttribute('width', width - 30);
    this.svgBackground.setAttribute('width', width - 30);
    this.featureClipRect.setAttribute('width', width - this.tabMargin - 40);
    this.featureBackground.setAttribute('width', width - this.tabMargin - 40);

    this.zoomWidget.setAttribute('transform', 'translate(' + (width - this.zoomSlider.width - 100) + ', 0)');
    if (width < 1075) {
        this.karyo.svg.setAttribute('transform', 'translate(2000, 15)');
    } else {
        this.karyo.svg.setAttribute('transform', 'translate(450, 20)');
    }
    this.regionLabelMax = (width - this.zoomSlider.width - 120)
    var oldFPW = this.featurePanelWidth;
    this.featurePanelWidth = (width - this.tabMargin - 40)|0;
    
    if (oldFPW != this.featurePanelWidth) {
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
    
	this.xfrmTiers((this.tabMargin - (1.0 * (this.viewStart - this.origin)) * this.scale), 1);
	this.updateRegion();
	this.spaceCheck();
    }

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
    }
}

Browser.prototype.xfrmTiers = function(x, xs) {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        this.xfrmTier(this.tiers[ti], x, xs);
    }
    if (this.highlight) {
	var axs = xs;
	if (axs < 0) {
            axs = this.scale;
	}
	var xfrm = 'translate(' + x + ',0)';
	this.highlight.setAttribute('transform', xfrm);
	this.highlight.setAttribute('x', (this.highlightMin - this.origin) * this.scale);
	this.highlight.setAttribute('width', (this.highlightMax - this.highlightMin + 1) * this.scale);
    } 
}

Browser.prototype.xfrmTier = function(tier, x , xs) {
    if (tier.originHaxx && tier.originHaxx != 0) {
	x -= ((1.0 * tier.originHaxx) * this.scale);
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
    tier.viewport.setAttribute('transform', xfrm);
}

//
// Navigation prims.
//

Browser.prototype.spaceCheck = function(dontRefresh) {
    var width = ((this.viewEnd - this.viewStart)|0) + 1;
    var minExtraW = (width * this.minExtra) | 0;
    var maxExtraW = (width * this.maxExtra) | 0;
    if ((this.drawnStart|0) > Math.max(1, ((this.viewStart|0) - minExtraW)|0)  || (this.drawnEnd|0) < Math.min((this.viewEnd|0) + minExtraW, ((this.currentSeqMax|0) > 0 ? (this.currentSeqMax|0) : 1000000000)))  {
//         this.drawnStart = Math.max(1, (this.viewStart|0) - maxExtraW);
//        this.drawnEnd = Math.min((this.viewEnd|0) + maxExtraW, ((this.currentSeqMax|0) > 0 ? (this.currentSeqMax|0) : 1000000000));
	this.refresh();
    }
}

Browser.prototype.move = function(pos)
{
    var wid = this.viewEnd - this.viewStart;
    this.viewStart -= pos / this.scale;
    this.viewEnd = this.viewStart + wid;
    if (this.currentSeqMax > 0 && this.viewEnd > this.currentSeqMax) {
        this.viewEnd = currentSeqMax;
        this.viewStart = this.viewEnd - wid;
    }
    if (this.viewStart < 1) {
        this.viewStart = 1;
        this.viewEnd = this.viewStart + wid;
    }
    
    this.xfrmTiers((this.tabMargin - (1.0 * (this.viewStart - this.origin)) * this.scale), 1);
    this.updateRegion();
    this.karyo.update(this.chr, this.viewStart, this.viewEnd);
    this.spaceCheck();
}

Browser.prototype.zoom = function(factor) {
    this.zoomFactor = factor;
    var viewCenter = (this.viewStart + this.viewEnd) / 2.0;
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
    this.updateRegion();
    this.spaceCheck(false);
    
    var width = this.viewEnd - this.viewStart + 1;
    var minExtraW = (width * this.minExtra) | 0;
    var maxExtraW = (width * this.maxExtra) | 0;
    // Currently, always reset Known Space after a zoom :-(
//    this.knownStart = Math.max(1, Math.round(this.viewStart) - maxExtraW);
//    this.knownEnd = Math.round(this.viewEnd) + maxExtraW;
    
    var scaleRat = (this.scale / this.scaleAtLastRedraw);
    this.xfrmTiers(this.tabMargin - ((1.0 * (this.viewStart - this.origin)) * this.scale),  (this.scale / this.scaleAtLastRedraw));
        
    var labels = this.svgRoot.getElementsByClassName("label-text");
    for (var li = 0; li < labels.length; ++li) {
        var label = labels[li];
        var x = label.getAttribute("x");
        var xfrm = "scale(" + (this.scaleAtLastRedraw/this.scale) + ",1), translate( " + ((x*this.scale - x*this.scaleAtLastRedraw) /this.scaleAtLastRedraw) +",0)";
        label.setAttribute("transform", xfrm);
    }
}

Browser.prototype.setLocation = function(newMin, newMax, newChr) {
    newMin = newMin|0;
    newMax = newMax|0;

    if (newChr && (newChr != this.chr)) {
	if (!this.entryPoints) {
            alert('Need entry points');
	    return;
	}
	var ep = null;
	for (var epi = 0; epi < this.entryPoints.length; ++epi) {
	    if (this.entryPoints[epi].name == newChr) {
		ep = this.entryPoints[epi];
		break;
	    }
	}
	if (!ep) {
            alert("Couldn't find new chromosome");
	    return;
	}

	this.chr = newChr;
	this.currentSeqMax = ep.end;
    }

    var newWidth = newMax - newMin + 1;
    if (newWidth > MAX_VIEW_SIZE) {
        newMin = ((newMax + newMin - MAX_VIEW_SIZE)/2)|0;
        newMax = (newMin + MAX_VIEW_SIZE - 1)|0;
    }
    if (newWidth < this.zoomBase) {
        newMin = ((newMax + newMin - this.zoomBase)/2)|0;
        mewMax = (newMin + this.zoomBase - 1)|0;
    }

    if (newMin < 1) {
	var wid = newMax - newMin + 1;
	newMin = 1;
	newMax = Math.min(newMin + wid - 1, this.currentSeqMax);
    }
    if (newMax > this.currentSeqMax) {
	var wid = newMax - newMin + 1;
	newMax = this.currentSeqMax;
	newMin = Math.max(1, newMax - wid + 1);
    }

    this.viewStart = newMin|0;
    this.viewEnd = newMax|0;
    this.scale = this.featurePanelWidth / (this.viewEnd - this.viewStart);
    this.zoomSlider.setValue(this.zoomExpt * Math.log((this.viewEnd - this.viewStart + 1) / this.zoomBase));

    this.updateRegion();
    this.karyo.update(this.chr, this.viewStart, this.viewEnd);
    this.refresh();
    this.xfrmTiers(this.tabMargin - ((1.0 * (this.viewStart - this.origin)) * this.scale), 1);   // FIXME currently needed to set the highlight (!)
    this.storeStatus();
}


Browser.prototype.storeStatus = function(){
    if (!this.cookieKey) {
	return;
    }

    localStorage['dalliance.' + this.cookieKey + '.view-chr'] = this.chr;
    localStorage['dalliance.' + this.cookieKey + '.view-start'] = this.viewStart|0;
    localStorage['dalliance.' + this.cookieKey + '.view-end'] = this.viewEnd|0

    var currentSourceList = [];
    for (var t = 0; t < this.tiers.length; ++t) {
	currentSourceList.push(this.tiers[t].dasSource);
    }
    localStorage['dalliance.' + this.cookieKey + '.sources'] = miniJSONify(currentSourceList);
    localStorage['dalliance.' + this.cookieKey + '.version'] = VERSION.CONFIG;
}

Browser.prototype.scheduleRefresh = function(time) {
    if (!time) {
        time = 500;
    }
    var thisB = this;

    if (this.refreshTB) {
        clearTimeout(this.refreshTB);
    }
    this.refreshTB = setTimeout(function() {
        thisB.refreshTB = null;
        thisB.refresh();
    }, time);
}

Browser.prototype.invalidateLayouts = function() {
    for (var t = 0; t < this.tiers.length; ++t) {
        this.tiers[t].layoutWasDone = false;
    }
}