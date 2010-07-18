// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// browser.js: browser setup and UI.
//

var NS_SVG = "http://www.w3.org/2000/svg";
var NS_HTML = "http://www.w3.org/1999/xhtml"

var tagLine = "...just some gills and some wings and a few extra thumbs.";

var sources = new Array();
var tiers = new Array();

// Limit stops

MAX_VIEW_SIZE=500000;

// parental configuration

var chr;
var viewStart;
var viewEnd;
var cookieKey = 'browser';
var searchEndpoint;

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
var zoomBase = 50;
var zoomExpt = 30;

var entryPoints = null;
var currentSeqMax = -1; // init once EPs are fetched.

var highlight;
var highlightMin = -1, highlightMax = - 1;

var autoSizeTiers = false;
var guidelines = false;

// UI components

var svg;
var dasTierHolder;
var zoomSlider;
var popupHolder;
var hPopupHolder;

// Visual config.

//  var tierBackgroundColors = ["rgb(255,245,215)", "rgb(255,254,240)"];
var tierBackgroundColors = ["rgb(245,245,245)", "rgb(230,230,250)"];
// var tierBackgroundColors = ["red", "blue"];
var minTierHeight = 25;

var browserLinks = {
    Ensembl: 'http://may2009.archive.ensembl.org/Homo_sapiens/Location/View?r=${chr}:${start}-${end}',
    UCSC: 'http://genome.ucsc.edu/cgi-bin/hgTracks?db=hg18&position=chr${chr}:${start}-${end}'
}

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
    this.layoutHeight = 100;
    this.bumped = false; // until we've decided what to do about tier-collapsing...
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
	// alert('will try credentials for ' + this.source.name);
	this.dasSource.credentials = true;
    }
    var tier = this;
    tier.status = 'Fetching stylesheet';
    this.dasSource.stylesheet(function(stylesheet) {
	tier.stylesheet = stylesheet;
	tier.refreshTier();
    }, function() {
	tier.error = 'No stylesheet';
	tier.refreshTier();
    });
}

DasTier.prototype.styles = function(scale) {
    if (this.stylesheet == null) {
	return null;
    } else if (scale > 1) {
	return this.stylesheet.highZoomStyles;
    } else if (scale > 0.05) {
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
	    viewportBackground.setAttribute("x", "10");
	    viewportBackground.setAttribute("y", clh + 5);
	    viewportBackground.setAttribute("width", "100");
	    viewportBackground.setAttribute("height", "25");
	    viewportBackground.setAttribute("stroke", "none");
	    labelGroup.appendChild(viewportBackground);
	    
	    setupTierDrag(viewportBackground, ti);
	    
	    var labelText = document.createElementNS(NS_SVG, "text");
	    labelText.setAttribute("x", 20);
	    labelText.setAttribute("y", clh + 17);
	    labelText.setAttribute("stroke-width", "0");
	    labelText.setAttribute("fill", "black");
	    labelText.appendChild(document.createTextNode(tiers[ti].source.name));
	    labelGroup.appendChild(labelText);
	    

	    if (tier.source.opts.collapseSuperGroups) {
		makeToggleButton(labelGroup, tier, clh);
	    } 

		/* {
	        
	    } else if (BarRenderer.prototype.isPrototypeOf(tier.source.renderer)) {
	        makeQuantConfigButton(labelGroup, tier, clh);
	    }*/
	    
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
        var cly = ((ev.clientY - dragOriginY) | 0) - 50;
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
        svg.root().removeEventListener('mousemove', moveHandler, true);
        svg.root().removeEventListener('mouseup', upHandler, true);
        bin.removeEventListener('mouseover', binEnterHandler, true);
        bin.removeEventListener('mouseout', binLeaveHandler, true);
        svg.remove(dragFeedbackRect);
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
        }
    }
    
    element.addEventListener('mousedown', function(ev) {
            ev.stopPropagation(); ev.preventDefault();
            var origin = $('#svgHolder').offset();
            dragOriginX = origin.left; dragOriginY = origin.top;
            svg.root().addEventListener('mousemove', moveHandler, true);
            svg.root().addEventListener('mouseup', upHandler, true);
            bin.addEventListener('mouseover', binEnterHandler, true);
            bin.addEventListener('mouseout', binLeaveHandler, true);
            targetTier = ti;
            dragFeedbackRect = svg.rect(popupHolder, 100, offsetForTier(targetTier) - 2, featurePanelWidth, 4, {fill: 'red', stroke: 'none'});
    },true);
}

function makeToggleButton(labelGroup, tier, ypos) {

    var bumpToggle = svg.group(labelGroup, {fill: 'cornsilk', strokeWidth: 1, stroke: 'gray'});
    svg.rect(bumpToggle, 85, ypos + 8, 8, 8);
    svg.line(bumpToggle, 85, ypos + 12, 93, ypos + 12);
    if (!tier.bumped) {
        svg.line(bumpToggle, 89, ypos + 8, 89, ypos + 16);
    }
    bumpToggle.addEventListener('mouseover', function(ev) {bumpToggle.setAttribute('stroke', 'red');}, false);
    bumpToggle.addEventListener('mouseout', function(ev) {
        bumpToggle.setAttribute('stroke', 'gray');
    }, false);
	bumpToggle.addEventListener('mousedown', function(ev) {
	    tier.bumped = !tier.bumped; 
	    dasRequestComplete(tier);   // is there a more abstract way to do this?
	}, false);
}

function makeQuantConfigButton(labelGroup, tier, ypos) {
 
/*

   var quantToggle = svg.group(labelGroup, {fill: 'cornsilk', strokeWidth: 1, stroke: 'gray'});
    svg.circle(quantToggle, 88, ypos + 16, 4, {strokeWidth: 2});
    svg.line(quantToggle, 85.1, ypos + 18.9, 78, ypos + 25, {strokeWidth: 3});
    quantToggle.addEventListener('mouseover', function(ev) {quantToggle.setAttribute('stroke', 'red');}, false);
    quantToggle.addEventListener('mouseout', function(ev) {
        quantToggle.setAttribute('stroke', 'gray');
    }, false);
    quantToggle.addEventListener('mousedown', function(ev) {
            ev.stopPropagation(); ev.preventDefault();
            	var mx =  ev.clientX, my = ev.clientY;
	            mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
	            my +=  document.documentElement.scrollTop || document.body.scrollTop;
	            var popup = $('#popupTest').clone().css({
	                position: 'absolute', 
	                top: (my - 10), 
	                left:  (mx - 10),
	                width: 80,
	                height: 200,
	                backgroundColor: 'white',
	                borderColor: 'black',
	                borderWidth: 1,
	                borderStyle: 'solid',
	                padding: 2,
	            }).html('Scale <span id="scaler_readout">' + tier.source.renderer.scale + '</span><div id="scaler_popup"></div>').get(0);
	            
	            // $(popup).hide();
	            hPopupHolder.appendChild(popup);

	            var popSvg = $(popup).svg().svg('get');
                var popSvgRoot = popSvg.root();
                popSvgRoot.setAttribute('width', '200px');
                popSvgRoot.setAttribute('height', '200px');
                var scalerGroup = popSvg.group('scaler_popup');

                popSvg.path(scalerGroup, "M 30 50 L 50 50 L 30 150", {stroke: 'none', fill: 'grey'});
                popSvg.rect(scalerGroup, 25, 100, 30, 8, {id: 'scalerHandle', stroke: 'none', fill: 'red', fillOpacity: 0.5});
                var scalerHandle = document.getElementById('scalerHandle');
                
                var scalerDeltaY = -1;
                
                var scalerMouseUpHandler = function (ev) {
                    ev.stopPropagation(); ev.preventDefault();
                    document.removeEventListener("mousemove", scalerMouseMoveHandler, true);
                    document.removeEventListener("mouseup", scalerMouseUpHandler, true);
                }
                
                var scalerMouseMoveHandler = function(ev)
                {
                    ev.stopPropagation(); ev.preventDefault();
                    var sliderY = Math.max(46, Math.min(ev.clientY + scalerDeltaY, 146));
                    scalerHandle.setAttribute("y", sliderY);
                    
                    var scale = (100 - (sliderY - 46)) / 100;
                    
                    $('#scaler_readout').html('' + scale);
                    
                    tier.source.renderer.scale = scale;
                    dasRequestComplete(tier);
                }

                var scalerMouseDownHandler = function(ev) {
                    ev.stopPropagation(); ev.preventDefault();
                    scalerDeltaY = scalerHandle.getAttribute("y") - ev.clientY;
                    document.addEventListener("mousemove", scalerMouseMoveHandler, true);
                    document.addEventListener("mouseup", scalerMouseUpHandler, true);
                }
                scalerHandle.addEventListener('mousedown', scalerMouseDownHandler, false);

                
	            $(popup).fadeIn(500);
	            
	            
	            popup.addEventListener('mouseout', function(ev2) {
	                    var rel = ev2.relatedTarget;
	                    while (rel) {
	                        if (rel == popup) {
	                            return;
	                        }
	                        rel = rel.parentNode;
	                    }
	                    removeAllPopups();
	            }, false); 
    }, false);

*/

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
    var statusElement = document.getElementById("status");
    while (statusElement.childNodes.length > 0) {
	    statusElement.removeChild(statusElement.firstChild);
    }
    statusElement.appendChild(document.createTextNode(msg));
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

function mouseDownHandler(ev)
{
    removeAllPopups();
    ev.stopPropagation(); ev.preventDefault();
    originX = ev.clientX;
    document.addEventListener("mousemove", mouseMoveHandler, true);
    document.addEventListener("mouseup", mouseUpHandler, true);
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
    //
    // Configuration processing
    //

    if (cookieKey) {
        var cookieView = $.cookie(cookieKey + '-svgdas-view');
        if (cookieView != null) {
            var cookieViewToks = cookieView.split(':');
            chr = cookieViewToks[0];
            viewStart = cookieViewToks[1] | 0;
            viewEnd = cookieViewToks[2] | 0;
        }
    }
    
    var region_exp = /([\d+,\w,\.,\_,\-]+):(\d+)[\-,\,](\d+)/;

    var qChr = $.query.get('chr');
    var qMin = $.query.get('min');
    var qMax = $.query.get('max');
    guidelines = $.query.get('guidelines') || false;

	if (qChr == '') {
		regstr = $.query.get('r');
		if (regstr == '') {
			regstr = $.query.get('segment');
		}
		var match = regstr.match(region_exp);
		if ((regstr != '') && match) {
			qChr = match[1];
			qMin = match[2] | 0;
			qMax = match[3] | 0;
		}
	}
	
	if (qMax < qMin) {
		qMax = qMin + 10000;
		// $.jGrowl("WARNING: max < min coord! Will present 1KB downstream from min coord.", { life: 5000 });
	}

    var histr = $.query.get('h');
    var match = histr.match(region_exp);
    if (match) {
	highlightMin = match[2]|0;
	highlightMax = match[3]|0;
    }



    //
    // Set up the UI (factor out?)
    //
           


    svg = $('#svgHolder').svg().svg('get');
    var svgRoot = svg.root();
    svgRoot.setAttribute('width', '860px');
    svgRoot.setAttribute('height', '500px');
    svgRoot.setAttribute('id', 'browser_svg');
    var main = svg.group('main', {fillOpacity: 1.0, stroke: 'black', strokeWidth: '0.1cm', fontFamily: 'helvetica', fontSize: '10pt'});
    svg.rect(main, 0, 0, 860, 500, {id: 'background', fill: 'white'});
    svg.text(main, 40, 30, 'ChrXYZZY', {id: 'region', strokeWidth: 0});
    svg.text(main, 300, 30, 'Add track...', {id: 'addTrack', strokeWidth: 0});
    svg.text(main, 400, 30, 'Initializing', {id: 'status', strokeWidth: 0});
    
    var bin = svg.group(main, 'bin', {stroke: 'gray', strokeWidth: '0.05cm', fill: 'white'});
    svg.path(bin, 'M 10 15 L 12 35 L 25 35 L 27 15 L 10 15');
    svg.line(bin, 11, 18, 26, 25);
    svg.line(bin, 11, 25, 26, 18);
    svg.line(bin, 11, 28, 26, 35);
    svg.line(bin, 11, 35, 26, 28);
    
    var clip = svg.other(main, 'clipPath', {id: 'featureClip'});
      svg.rect(clip, 100, 50, 750, 440, {id: 'featureClipRect'});
    var clip = svg.other(main, 'clipPath', {id: 'labelClip'});
      svg.rect(clip, 10, 50, 90, 440, {id: 'labelClipRect'});
        
    dasTierHolder = svg.group(main, {clipPath: 'url(#featureClip)'}); 
    svg.group(dasTierHolder, 'dasTiers');

    makeHighlight();

    var dasLabelHolder = svg.group(main, {clipPath: 'url(#labelClip)'}); 
    svg.group(dasLabelHolder, 'dasLabels');
    
    zoomSlider = new DSlider(250);
    zoomSlider.onchange = function(zoomVal, released) {
	zoom(Math.exp((1.0 * zoomVal) / zoomExpt));
	if (released) {
	    refresh();
	    storeStatus();
	}
    };
    main.appendChild(zoomSlider.svg);
    
    popupHolder = svg.group(main);    
    hPopupHolder = $('#hPopups').get(0);
    
    var bhtmlRoot = document.getElementById("browser_html");
    removeChildren(bhtmlRoot);
    bhtmlRoot.appendChild(document.createTextNode(tagLine));
    

    
    // set up the navigator
    document.getElementById("region").addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
	removeAllPopups(); 

        if (entryPoints == null) {
            alert("entry_points aren't currently available for this genome");
        }
             
	var linkouts = '';
	for (l in browserLinks) {
	    linkouts += '<li><a href="' + browserLinks[l].replace(new RegExp('\\${([a-z]+)}', 'g'), function(s, p1) {
		if (p1 == 'chr') {
		    return chr;
		} else if (p1 == 'start') {
		    return viewStart|0;
		} else if (p1 == 'end') {
		    return viewEnd|0;
		} else {
		    return '';
		}
	    }) + '" target="_new">' + l + '</a></li>';
	}

            	var mx =  ev.clientX, my = ev.clientY;
	            mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
	            my +=  document.documentElement.scrollTop || document.body.scrollTop;
	            var popup = $('#popupTest').clone().css({
	                position: 'absolute', 
	                top: (my - 10), 
	                left:  (mx - 10),
	                width: 200,
	                backgroundColor: 'white',
	                borderColor: 'black',
	                borderWidth: 1,
	                borderStyle: 'solid',
	                padding: 2,
	            }).html((linkouts.length > 0 ? ('<p>Link to this region in...</p><ul>' + linkouts + '</ul>') : '') + 
			    '<p>Jump to...</p>' +
			    '<form id="navform">Chr:<select id="chrMenu" name="seq" value="' + chr + '"><option value="1">1</option><option value="2">2</option></select><br>' +
	                    'Start:<input name="min" value="' + (viewStart|0) + '"></input><br>' + 
	                    'End:<input name="max" value="' + (viewEnd|0) + '"></input>' + 
	                    '<input type="submit" value="Go"></form>' +
			    (searchEndpoint ? '<p>Or search for...</p><form id="gene_nav">Gene:<input name="gene" value=""></input><br><input type="submit" value="Go"></form>' : '')
	            ).get(0);
	            $(popup).hide();
	            hPopupHolder.appendChild(popup);
	            $(popup).fadeIn(500);

                var epMenuItems = new Array();
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

	var epsByChrName = {};
	        var epMenuOptions = '';
                for (var epi = 0; epi < entryPoints.length; ++epi) {
                    var ep = epMenuItems[epi].entryPoint;
		    epsByChrName[ep.name] = ep;
                    epMenuOptions += '<option value="' + ep.name + '">' + ep.toString() +'</option>';
                }
                $('#chrMenu').html(epMenuOptions).attr({value: chr});
	
	$('#gene_nav').submit(function(ev) {
	    ev.stopPropagation(); ev.preventDefault();
	    var g = $('input:eq(3)').val(); // ughugh.
	    removeAllPopups();

	    if (!g || g.length == 0) {
		return false;
	    }

	    searchEndpoint.features(null, {group: g, type: 'transcript' /* HAXX */}, function(found) {
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
	    });

	    return false;
	});

	$('#navform').submit(function(ev) {
	    ev.stopPropagation(); ev.preventDefault();

	    var nchr = $('select:eq(0)').val();    // ugh!  But couldn't get selection on input names working.
	    var nmin = stringToInt($('input:eq(0)').val());
	    var nmax = stringToInt($('input:eq(1)').val());    
	    removeAllPopups();

	    if (nchr && nmin && nmax) {
		setLocation(nmin, nmax, nchr);
	    } else {
		alert('Must specify min and max');
	    }

	    return false;
	});
    }, false);
    
    // set up the track-adder
    document.getElementById("addTrack").addEventListener('mousedown', function(ev) {
         ev.stopPropagation(); ev.preventDefault();

         var mx =  ev.clientX, my = ev.clientY;
	     mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
	     my +=  document.documentElement.scrollTop || document.body.scrollTop;
         var popup = $('#popupTest').clone().css({
	                position: 'absolute', 
	                top: (my - 10), 
	                left:  (mx - 10),
	                width: 600,
	                backgroundColor: 'white',
	                borderColor: 'black',
	                borderWidth: 1,
	                borderStyle: 'solid',
	                padding: 2,
	      }).html('<form id="addform">' +
	               '  URL:<input size="100" name="dasuri" value="http://.../"></input><br>' +
	               '  <input type="submit" value="Add...">' +
	               '</form>'
	            ).get(0);
	            $(popup).hide();
	            hPopupHolder.appendChild(popup);
	            $(popup).fadeIn(500);
	            
	           $('#addform').submit(function(ev) {
		       ev.stopPropagation(); ev.preventDefault();
	                    var nuri = $('input:eq(0)').val();    // ugh!  But couldn't get selection on input names working.

	                    var nds = new DataSource('added', nuri);
	                    sources.push(nds);
	                    // this should be factored out.
	                    var viewport = document.createElementNS("http://www.w3.org/2000/svg", "g");
                        var viewportBackground = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        var col = tierBackgroundColors[tiers.length % tierBackgroundColors.length];
                        viewportBackground.setAttribute("fill", col);
                        viewportBackground.setAttribute("x", "-1000000");
                        viewportBackground.setAttribute("y", "0");
                        viewportBackground.setAttribute("width", "2000000");
                        viewportBackground.setAttribute("height", "200");
                        viewportBackground.setAttribute("stroke-width", "0");
                        viewport.appendChild(viewportBackground);
                        viewport.setAttribute("transform", "translate(200, " + ((2 * 200) + 50) + ")");
                        tierHolder.appendChild(viewport);

		       var tier = new DasTier(nds, viewport, viewportBackground)
                       tiers.push(tier);
		       tier.init();
	                    
	                    removeAllPopups();
	                    return true;
	            });
	}, false);
	
	
    tierHolder = document.getElementById("dasTiers");
    tiers = new Array();	  
    for (var t = 0; t < sources.length; ++t) {
	var source = sources[t];
	var viewport = document.createElementNS(NS_SVG, "g");
	var viewportBackground = document.createElementNS(NS_SVG, "rect");
	var col = tierBackgroundColors[t % tierBackgroundColors.length];
	viewportBackground.setAttribute("fill", col);
	viewportBackground.setAttribute("x", "-1000000");
	viewportBackground.setAttribute("y", "0");
	viewportBackground.setAttribute("width", "2000000");
	viewportBackground.setAttribute("height", "200");
	viewportBackground.setAttribute("stroke-width", "0");
	viewport.appendChild(viewportBackground);
	viewport.setAttribute("transform", "translate(200, " + ((t * 200) + 50) + ")");
	tierHolder.appendChild(viewport);
	
	var tier = new DasTier(source, viewport, viewportBackground);
	tier.init(); // fetches stylesheet
	tiers.push(tier);
    }
    
    //
    // Window resize support (should happen before first fetch so we know the actual size of the viewed area).
    //

    resizeViewer();
    window.addEventListener("resize", function(ev) {
            resizeViewer();
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
    zoomSlider.setValue(zoomExpt * Math.log((viewEnd - viewStart + 1) / zoomBase));

    move(0);
    refresh(); // FIXME do we still want to be doing this?

    // 
    // Set up interactivity handlers
    //
    
    document.getElementById("main").addEventListener("mousedown", mouseDownHandler, false);
    document.getElementById('main').addEventListener('touchstart', touchStartHandler, false);
    document.getElementById('main').addEventListener('touchmove', touchMoveHandler, false);
    document.getElementById('main').addEventListener('touchend', touchEndHandler, false);
    document.getElementById('main').addEventListener('touchcancel', touchCancelHandler, false);
    document.addEventListener('mousewheel', function(ev) {
	if (!ev.wheelDeltaX) {
	    return;
	}

	ev.stopPropagation(); ev.preventDefault();
	move (-ev.wheelDeltaX/5);
    }, false);
    document.addEventListener('MozMousePixelScroll', function(ev) {
	ev.stopPropagation(); ev.preventDefault();
	if (ev.axis == 1 && ev.detail != 0) {
            move(ev.detail);
        }
    }, false);
    
    // Low-priority stuff
    
    tiers[0].dasSource.entryPoints(
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

function resizeViewer() {
    var width = window.innerWidth;
    width = Math.max(width, 600);
    document.getElementById("browser_svg").setAttribute('width', width - 30);
    document.getElementById("background").setAttribute('width', width - 30);
    document.getElementById("featureClipRect").setAttribute('width', width - 140);


    zoomSlider.svg.setAttribute('transform', 'translate(' + (width - zoomSlider.width - 40) + ', 0)');
// FIXME: should move the zoomer.
//    document.getElementById('sliderTrack').setAttribute('transform', 'translate(' + (width - 190 - 600) + ', 0)');
//    document.getElementById('sliderHandle').setAttribute('transform', 'translate(' + (width - 190 - 600) + ', 0)');
    
    var oldFPW = featurePanelWidth;
    featurePanelWidth = (width - 140)|0;
    
    if (oldFPW != featurePanelWidth) {
        var viewWidth = viewEnd - viewStart;
        viewEnd = viewStart + (viewWidth * featurePanelWidth) / oldFPW;
        // FIXME: should also fix the zoom slider...
        updateRegion();
	spaceCheck();
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
//	alert('triggering refresh, knownStart=' + knownStart + ', knownEnd=' + knownEnd);
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
    refresh();
    xfrmTiers(100 - ((1.0 * (viewStart - origin)) * scale), 1);   // FIXME currently needed to set the highlight (!)
    storeStatus();
}


function storeStatus()
{
    $.cookie('' + cookieKey + '-svgdas-view', '' + chr + ':' + (viewStart|0) + ':' + (viewEnd|0), {expires: 14});
}
