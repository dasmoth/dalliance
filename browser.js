var NS_SVG = "http://www.w3.org/2000/svg";
var NS_HTML = "http://www.w3.org/1999/xhtml"

var tagLine = "...après moi le déluge.";

var sources = new Array();
var tiers = new Array();
var types = ['transcript', 'translation'];

// parental configuration

var chr;
var viewStart;
var viewEnd;
var cookieKey = 'browser';

// state

var maxExtra = 1;
var minExtra = 0.25;
var knownStart;
var knownEnd;
var scale;
var scaleAtLastRedraw;
var zoomFactor = 1.0;
var origin = 0;
var targetQuantRes = 5.0;
var featurePanelWidth = 750;
var zoomTrackMin = 496;
var zoomTrackMax = 746;
var zoomBase = 50;
var zoomExpt = 30;
var svg;
var entryPoints = null;
var currentSeqMax = -1; // init once EPs are fetched.

var highlight;
var highlightMin = -1, highlightMax = - 1;

var popupHolder;
var hPopupHolder;

var tierBackgroundColors = ["cornsilk", "wheat"];

var styleOracle = {
    'repeat': 'orange',
    'tandem_repeat': 'gray',
    'Dust': 'gray'
};

// Experimental feature toggles

var labels = true;
var liveZoom = true;
var defaultBumpStatus = false;

function Range(min, max)
{
    this.min = min;
    this.max = max;
}

function DataSource(name, uri, bumped, renderer, opts)
{
    if (!opts) {
	opts = {};
    }
    this.name = name;
    this.uri = uri;
    this.bumped = bumped;
    this.renderer = renderer;
    this.opts = opts;
}

function DasTier(source, viewport, background)
{
    this.source = source;
    this.viewport = viewport;
    this.background = background;
    this.req = null;
    this.layoutHeight = 200;
    this.bumped = source.bumped ? defaultBumpStatus : false;
    this.y = 0;
    this.scale = 1;
}

function SeqTier(source, viewport, background)
{
    this.source = source;
    this.viewport = viewport;
    this.background = background;
    this.seq = null;
}

function LineRenderer(x, scale)
{
    this.scale = scale;
    this.height = function() {
	return x;
    }
}

function BoxRenderer(x)
{
    if (!x) x=40;
    this.height = function() {
        return x;
    }
}

function BarRenderer(x, scale) {
    if (!scale) {
        scale = 1;
    }
    
    this.height = function() {
        return x;
    }
    this.scale = scale;
}

function SeqRenderer()
{
    this.height = function() {
        return 50;
    }
}

function getValue(element, tag)
{
    var children = element.getElementsByTagName(tag);
    if (children.length > 0) {
        return children[0].firstChild.nodeValue;
    } else {
        return "n/a";
    }
}

function rangeOrder(a, b)
{
    if (a.min < b.min) {
        return -1;
    } else if (a.min > b.min) {
        return 1;
    } else if (a.max < b.max) {
        return -1;
    } else if (b.max > a.max) {
        return 1;
    } else {
        return 0;
    }
}

var flag;

function drawFeatureGroup(featureGroupElement, y, features, bumpMatrix, label, renderer, groupElement)
{
    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    var gmin = 10000000000;
    var gmax = -10000000000;
    var blockList = new Array(0);
    var strand = null;
    var elideTents = false;
    var th = renderer.height();
    
    for (var i = 0; i < features.length; ++i) {
        var feature = features[i];
        var min = feature.min;
        var max = feature.max;
        var type = feature.type;
        if (strand == null && feature.orientation) {
            strand = feature.orientation;
        }
        var score = feature.score;
        if (label != null && label != "") {
            if (feature.label) {
                label = feature.label;
            }
        }
        
        if (!flag) {
            // alert('first feature ' + min + ':' + max);
            flag=1;
        }
        
        if (type == 'density') {
           bumpMatrix = null;      // HAXXXX!
        }

        var minPos = (min - origin) * scale;
        var maxPos = (max - origin) * scale;
        gmin = Math.min(minPos, gmin);
        gmax = Math.max(maxPos, gmax);

	var fMinSize = 5.0;       
        if (maxPos - minPos < fMinSize) {
            var midPos = (maxPos + minPos) / 2;
            minPos = midPos - (fMinSize/2);
            maxPos = minPos + (fMinSize/2);
        }
 
        var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", minPos);
        rect.setAttribute("y", y);
        rect.setAttribute("width", maxPos - minPos);
	if (th >= 18) {
            rect.setAttribute("height", "12");
        } else {
	    rect.setAttribute("height", th - 4);
        }
        var fill="blue", stroke="1"
        if (type == "translation") {
		  	fill="red";
		} else {
			if (type == "exon" || type == 'transcript') {
		  	    fill="cornsilk";
                        } else if (type == "cpg-meth") {
                            fill="blue"; stroke="0";
                        } else if (type == "cpg-unmeth") {
                            fill="red"; stroke="0";
                        } else if (type == "read") {
                            fill="cornsilk"; elideTents = true;
			} else if (type == "meth" || type == "depth") {
			     if (BoxRenderer.prototype.isPrototypeOf(renderer)) {
			        var red = 0,green = 0,blue = 255;
			        if (score < 50) {
			            var prop = Math.max(0, score - 20) / 30;
			            green = 255;
			            red = (1.0 - prop) * 255;
			            blue = 0;
			        } else {
			            var prop = Math.min(30, score - 50) / 30
			            red = 0;
			            green = (1.0 - prop) * 255;
			            blue = prop * 255;
			        }
			        fill = "rgb(" + (red|0) + "," + (green|0) + "," + (blue|0) +")";
			        stroke = "0";
			        rect.setAttribute("width", maxPos - minPos + 1);
			    } 
			    
			}  else {
			    var soc = styleOracle[type];
			    if (soc) {
				fill = soc;
			    }
			}
			blockList.push(new Range(minPos, maxPos));
			if (strand == "-") {
				isReverseStrand = true;
			}
		}
		if (BarRenderer.prototype.isPrototypeOf(renderer) /* || type == 'density' */) {
		    var sc = (score * renderer.scale)|0;
			rect.setAttribute("y", y + renderer.height() - sc);
			rect.setAttribute("height", sc);
		} else if (type == 'density') {
		    var sc = score | 0;
		    rect.setAttribute("y", y + renderer.height() - sc);
		    rect.setAttribute("height", sc);
		}
		rect.setAttribute("fill", fill);
		rect.setAttribute("stroke-width", stroke);
		g.appendChild(rect);
	}


	if (labels && label != null && label != "" && type != 'read' && type != 'cpg-meth' && type != 'cpg-unmeth') {
	    var labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
	    labelText.setAttribute("x", gmin);
	    labelText.setAttribute("y", y + 25);
	    labelText.setAttribute("stroke-width", "0");
	    labelText.setAttribute("fill", "black");
	    labelText.setAttribute("class", "label-text");
	    var lt = label;
	    if (strand == '+') {
		lt = label + '>';
	    } else if (strand == '-') {
		lt = '<' + label;
            }
	    labelText.appendChild(document.createTextNode(lt));
	    g.appendChild(labelText);
	    
	    g.addEventListener("mouseover", function(ev) {
	            var link = '';
	            if (groupElement) {
	                if (groupElement.links) {
	                    for (var li = 0; li < groupElement.links.length; ++li) {
	                        var dasLink = groupElement.links[li];
	                        link += ' <a href="' + dasLink.uri + '">(' + dasLink.desc + ')</a>';
	                    }
	                }
	            }
	            
	           	removeAllPopups();
	            
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
	            }).html('Gene: ' + label + link).get(0);
	            $(popup).hide();
	            hPopupHolder.appendChild(popup);
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
		}, true);
	}
	
	blockList.sort(rangeOrder);
	
	if (!elideTents) {
	for (var i = 1; i < blockList.length; ++i) {
	    var lmin = blockList[i - 1].max;
	    var lmax = blockList[i].min;
	    
	    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	    path.setAttribute("fill", "none");
	    path.setAttribute("stroke-width", "1");
	    
	    if (strand == "+" || strand == "-") {
	        var lmid = (lmin + lmax) / 2;
	        var lmidy = (strand == "-") ? y + 12 : y;
	        path.setAttribute("d", "M " + lmin + " " + (y + 6) + " L " + lmid + " " + lmidy + " L " + lmax + " " + (y + 6));
	    } else {
	        path.setAttribute("d", "M " + lmin + " " + (y + 6) + " L " + lmax + " " + (y + 6));
	    }
	    
	    g.appendChild(path);
	}
        }

	var tier = bump(bumpMatrix, new Range(gmin - 2, gmax + 2));
	var toffset = tier * renderer.height();
	g.setAttribute("transform", "translate(0," + toffset + ")");
	
	featureGroupElement.appendChild(g);
	return toffset + renderer.height() + 5;
}

function bump(bm, range)
{
    if (bm == null) {
        return 0;
    }
    
    for (var tier = 0; tier < bm.length; ++tier) {
        var occupants = bm[tier];
        var covered = false;
        for (var o = 0; o < occupants.length; ++o) {
            if (occupants[o].min <= range.max && occupants[o].max >= range.min) {
                covered = true;
                break;
            }
        }
        if (!covered) {
            occupants.push(range);
            return tier;
        }
    }
    var mt = bm.length;
    var occupants = new Array(0);
    occupants.push(range);
    bm.push(occupants);
    return mt;
}

function dasRequestComplete(tier)
{
    if (LineRenderer.prototype.isPrototypeOf(tier.source.renderer)) {
	drawLineTier(tier);
    } else {
	drawFeatureTier(tier);
    }
    arrangeTiers();
    setLoadingStatus();
}

function drawLineTier(tier)
{
    var featureGroupElement = tier.viewport;
    while (featureGroupElement.childNodes.length > 0) {
	    featureGroupElement.removeChild(featureGroupElement.firstChild);
    }
    featureGroupElement.appendChild(tier.background);

    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "1");
    var pathOps = '';

    // FIXME: sort first?
    for (var fi = 0; fi < tier.currentFeatures.length; ++fi) {
	var f = tier.currentFeatures[fi];

	var px = ((((f.min|0) + (f.max|0)) / 2) - origin) * scale;
        var sc = (f.score * tier.source.renderer.scale)|0;
	var py = 0 + tier.source.renderer.height() - sc;
	if (fi == 0) {
	    pathOps = 'M ' + px + ' ' + py;
	} else {
	    pathOps += ' L ' + px + ' ' + py;
	}	
    }
    // alert(pathOps);
    path.setAttribute('d', pathOps);
    featureGroupElement.appendChild(path);

    var lh = tier.source.renderer.height();
    tier.layoutHeight=lh;
    tier.background.setAttribute("height", lh);
    tier.scale = 1;
}

function drawFeatureTier(tier)
{
    var featureGroupElement = tier.viewport;
    while (featureGroupElement.childNodes.length > 0) {
	    featureGroupElement.removeChild(featureGroupElement.firstChild);
	}
	featureGroupElement.appendChild(tier.background);
	
	var offset = 5;
	var lh = tier.source.renderer.height() + 5;
	var bumpMatrix = null;
	if (tier.bumped) {
	    bumpMatrix = new Array(0);
	}
	
	var ungroupedFeatures = new Array();
	var groupedFeatures = {};
	var groups = {};
	
	for (var fi = 0; fi < tier.currentFeatures.length; ++fi) {
	    var f = tier.currentFeatures[fi];
	    var gid = null;
	    if (f.groups) {
	        for (var gi = 0; gi < f.groups.length; ++gi) {
	            var g = f.groups[gi];
	            if (g.type == 'transcript' || g.type=='CDS' || g.type == 'read' || g.type=='cpg-meth' || g.type=='cpg-unmeth') {
	                gid = g.id;
	                groups[gid] = g;
	            }
	        }
	    }
	    if (gid != null) {
	        if (groupedFeatures[gid]) {
	            groupedFeatures[gid].push(f);
	        } else {
	            groupedFeatures[gid] = new Array(f);
	        }
	    } else {
	        ungroupedFeatures.push(f);
	    }
	}
	
	for (var pgid = 0; pgid < ungroupedFeatures.length; ++pgid) {
	    lh = Math.max(lh, drawFeatureGroup(featureGroupElement, offset, new Array(ungroupedFeatures[pgid]), bumpMatrix, "", tier.source.renderer));
	}
	var gl = new Array();
	for (var gid in groupedFeatures) {
	    // alert('pushing ' + gid);
	    gl.push(gid);
	}
	// alert(gl);
	gl.sort(function(g1, g2) {
	    var d = groupedFeatures[g1][0].score - groupedFeatures[g2][0].score;
	    if (d > 0) {
	       return -1;
            } else if (d = 0) {
	       return 0;
            } else {
	       return 1;
            }
        });
	// alert(gl[0]);
	for (var gx in gl) {
	    var gid = gl[gx];
	    // alert('drawing ' + gid);
	    lh = Math.max(lh, drawFeatureGroup(featureGroupElement, offset, groupedFeatures[gid], bumpMatrix, gid, tier.source.renderer, groups[gid]));
	}
	tier.layoutHeight=lh;
	tier.background.setAttribute("height", lh);
	tier.scale = 1;
}

var rulerTileColors = ['black', 'white'];
var baseColors = {A: 'green', C: 'blue', G: 'black', T: 'red'};


function drawSeqTier(tier, seq)
{
    var featureGroupElement = tier.viewport;
    while (featureGroupElement.childNodes.length > 0) {
	    featureGroupElement.removeChild(featureGroupElement.firstChild);
	}
	featureGroupElement.appendChild(tier.background);
    
	var steps = [1,2,5];
	function ts(p) {
	    return steps[p % steps.length] * Math.pow(10, (p / steps.length)|0);
	}
	var pow = steps.length;
	while (scale * ts(pow) < 50) {
	    ++pow;
	}
	var tile = ts(pow);
	var pos = Math.max(0, ((knownStart / tile)|0) * tile);
	
	var seqTierMax = knownEnd;
	if (currentSeqMax > 0 && currentSeqMax < knownEnd) {
	    seqTierMax = currentSeqMax;
	}
	
	while (pos <= seqTierMax) {
        var rect = document.createElementNS(NS_SVG, "rect");
        rect.setAttribute('x', (pos - origin) * scale);
        rect.setAttribute('y', 5);
        rect.setAttribute('height', 3);
        var rwid = Math.min(tile, seqTierMax - pos) * scale;
        rect.setAttribute('width', rwid);
        rect.setAttribute('fill', rulerTileColors[(pos / tile) % 2]);
        rect.setAttribute('stroke-width', 1);
        featureGroupElement.appendChild(rect);
        
        if ((pos / tile) % 2 == 0) {
            var labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            labelText.setAttribute("x", ((pos - origin) * scale));
            labelText.setAttribute("y",  25);
            labelText.setAttribute("stroke-width", "0");
            labelText.setAttribute("fill", "black");
            labelText.setAttribute("class", "label-text");
            labelText.appendChild(document.createTextNode('' + pos));
            featureGroupElement.appendChild(labelText);
        }
	     
	    pos += tile;
	}
	
	var height = 30;
	
	if (seq) {
	    for (var i = seq.start; i <= seq.end; ++i) {
	        var base = seq.seq.substr(i - seq.start, 1).toUpperCase();
	        var color = baseColors[base];
	        if (!color) {
	            color = 'gray';
	        }
	        
	        if (scale >= 8) {
                var labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                labelText.setAttribute("x", ((i - origin) * scale));
                labelText.setAttribute("y",  45);
                labelText.setAttribute("stroke-width", "0");
                labelText.setAttribute("fill", color);
                labelText.setAttribute("class", "label-text");
                labelText.appendChild(document.createTextNode(base));
                featureGroupElement.appendChild(labelText);
                height = 50;
            } else {
                var rect = document.createElementNS(NS_SVG, "rect");
                rect.setAttribute('x', ((i - origin) * scale));
                rect.setAttribute('y', 30);
                rect.setAttribute('height', 8);
                rect.setAttribute('width', scale);
                rect.setAttribute('fill', color);
                rect.setAttribute('stroke', 'none');
                featureGroupElement.appendChild(rect);
                height = 42;
            }
        }
    }
	
    tier.layoutHeight = height;
    tier.background.setAttribute("height", height);
    tier.scale = 1;
    arrangeTiers();
}

function arrangeTiers() {
	var labelGroup = document.getElementById("dasLabels");
	removeChildren(labelGroup);
	
	var clh = 50;
	for (ti = 0; ti < tiers.length; ++ti) {
	    var tier = tiers[ti];
	    tier.y = clh;
	    
	    var viewportBackground = document.createElementNS(NS_SVG, "rect");
	    viewportBackground.setAttribute("fill", tierBackgroundColors[ti % tierBackgroundColors.length]);
	    viewportBackground.setAttribute("x", "10");
	    viewportBackground.setAttribute("y", clh + 5);
	    viewportBackground.setAttribute("width", "100");
	    viewportBackground.setAttribute("height", "25");
	    viewportBackground.setAttribute("stroke", "none");
	    labelGroup.appendChild(viewportBackground);
	    
	    setupTierDrag(viewportBackground, ti);
	    
	    var labelText = document.createElementNS(NS_SVG, "text");
	    labelText.setAttribute("x", 15);
	    labelText.setAttribute("y", clh + 20);
	    labelText.setAttribute("stroke-width", "0");
	    labelText.setAttribute("fill", "black");
	    labelText.appendChild(document.createTextNode(tiers[ti].source.name));
	    labelGroup.appendChild(labelText);
	    
	    if (tier.source.bumped) {
	        makeToggleButton(labelGroup, tier, clh);
	    } else if (BarRenderer.prototype.isPrototypeOf(tier.source.renderer)) {
	        makeQuantConfigButton(labelGroup, tier, clh);
	    }
	    
	    xfrmTier(tier, 100 - ((1.0 * (viewStart - origin)) * scale), -1);
	    
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
            // setViewerStatus('Re-ordering ' + ti + '->' + targetTier);
            
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
    svg.rect(bumpToggle, 85, ypos + 12, 8, 8);
    svg.line(bumpToggle, 85, ypos + 16, 93, ypos + 16);
    if (!tier.bumped) {
        svg.line(bumpToggle, 89, ypos + 12, 89, ypos + 20);
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
}

function dasRequestStateChangeHandler(tier)
{
    if (tier.req.readyState == 4) {
        if (tier.req.status == 200 || tier.req.status == 0) {
            // (status=0 to allow file:// URIs to work for debug mode)
            dasRequestComplete(tier);
        } else {
            alert("Request processed: " + req.status);
        }
    }
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
    scaleAtLastRedraw = scale;
    for (var t = 0; t < tiers.length; ++t) {
	    refreshTier(tiers[t]);
    }
}

function refreshTier(tier)
{	    
    if (SeqRenderer.prototype.isPrototypeOf(tier.source.renderer)) {
        if (scale >= 1) {
            new DASSource(tier.source.uri).sequence(
                new DASSegment(chr, knownStart, knownEnd),
                function(seqs) {
                    drawSeqTier(tier, seqs[0]);  // FIXME: check array.
                }
            );
        } else {
            drawSeqTier(tier);
        }
    } else {
        var scaledQuantRes = targetQuantRes / scale;
        var maxBins = 1 + (((knownEnd - knownStart) / scaledQuantRes) | 0);
        var fetchTypes = tier.source.opts.types;
        if (!fetchTypes) {
	    fetchTypes = types;
	}

	if (tier.source.opts.zoomThreshold) {
	    if (scale > tier.source.opts.zoomThreshold) {
		fetchTypes = tier.source.opts.largeTypes;
	    } else {
		fetchTypes = tier.source.opts.smallTypes;
            }
        }

        
        new DASSource(tier.source.uri).features(
            new DASSegment(chr, knownStart, knownEnd),
            {type: fetchTypes, maxbins: maxBins},
            function(features) {
                tier.currentFeatures = features;
                dasRequestComplete(tier);
            }
        );
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

var sliderDeltaX;
var mouseDownCount = 0;

function sliderMouseDownHandler(ev)
{
    removeAllPopups();
    ev.stopPropagation(); ev.preventDefault();
    sliderDeltaX = document.getElementById("sliderHandle").getAttribute("x") - ev.clientX;
    document.addEventListener("mousemove", sliderMouseMoveHandler, true);
    document.addEventListener("mouseup", sliderMouseUpHandler, true);
}

function sliderMouseUpHandler(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    document.removeEventListener("mousemove", sliderMouseMoveHandler, true);
    document.removeEventListener("mouseup", sliderMouseUpHandler, true);
    // document.getElementById("dasTiers").setAttribute("transform", "translate(" + ((-1.0 * (viewStart - origin)) * scale) + ",0)");
    storeStatus();
    refresh()
}

function sliderMouseMoveHandler(ev)
{
    ev.stopPropagation(); ev.preventDefault();
    var sliderX = Math.max(zoomTrackMin, Math.min(ev.clientX + sliderDeltaX, zoomTrackMax));
    document.getElementById("sliderHandle").setAttribute("x", sliderX);
    zoom(Math.exp((1.0 * (sliderX - zoomTrackMin)) / zoomExpt));
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


var NUM_REGEXP = new RegExp('[0-9]+');

function stringToNumbersArray(str) {
    var nums = new Array();
    var m;
    while (m = NUM_REGEXP(str)) {
        nums.push(m[0]);
        str=str.substring(m.index + (m[0].length));
    }
    return nums;
}

function EPMenuItem(entryPoint) {
    this.entryPoint = entryPoint;
    this.nums = stringToNumbersArray(entryPoint.name);
}

function init() 
{
    //alert(localStorage.getItem('foo'));
    localStorage.setItem('foo', 'bar');
    if (cookieKey) {
        var cookieView = $.cookie(cookieKey + '-svgdas-view');
        if (cookieView != null) {
            var cookieViewToks = cookieView.split(':');
            chr = cookieViewToks[0];
            viewStart = cookieViewToks[1] | 0;
            viewEnd = cookieViewToks[2] | 0;
        }
    }
    
    var qChr = $.query.get('chr');
    var qMin = $.query.get('min');
    var qMax = $.query.get('max');

	if (qChr == '') {
		regstr = $.query.get('r');
		if (regstr == '') {
			regstr = $.query.get('segment');
		}
		
		region_exp = /([\d+,\w,\.,\_,\-]+):(\d+)[\-,\,](\d+)/;
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

    if (qChr && qMin && qMax) {
        chr = qChr; viewStart = qMin; viewEnd = qMax;
	highlightMin = qMin;  highlightMax = qMax;
    }
    
    if ((viewEnd - viewStart) > 50000) {
        var mid = ((viewEnd + viewStart) / 2)|0;
        viewStart = mid - 25000;
        viewEnd = mid + 25000;
    }
    
    origin = ((viewStart + viewEnd) / 2) | 0;
    scale = featurePanelWidth / (viewEnd - viewStart);
    var width = viewEnd - viewStart + 1;
    var minExtraW = (width * minExtra) | 0;
    var maxExtraW = (width * maxExtra) | 0;
    knownStart = Math.max(1, viewStart - maxExtraW); knownEnd = viewEnd + maxExtraW;

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
      
      
    var dasTierHolder = svg.group(main, {clipPath: 'url(#featureClip)'}); 
    svg.group(dasTierHolder, 'dasTiers');
    if (highlightMin > 0) {
	highlight = svg.rect(dasTierHolder, (highlightMin - origin) * scale, 0, (highlightMax - highlightMin + 1) * scale, 10000, {id: 'highlight', stroke: 'none', fill: 'red', fillOpacity: 0.2});
    }
    var dasLabelHolder = svg.group(main, {clipPath: 'url(#labelClip)'}); 
    svg.group(dasLabelHolder, 'dasLabels');
    
    svg.path(main, "M 500 35 L 750 35 L 750 15", {id: 'sliderTrack', stroke: 'none', fill: 'grey'});
    svg.rect(main, 600, 10, 8, 30, {id: 'sliderHandle', stroke: 'none', fill: 'blue', fillOpacity: 0.5});
    
    popupHolder = svg.group(main);    
    hPopupHolder = $('#hPopups').get(0);
    
    var bhtmlRoot = document.getElementById("browser_html");
    removeChildren(bhtmlRoot);
    bhtmlRoot.appendChild(document.createTextNode(tagLine));
    
    // set up zoom thumb
    document.getElementById("sliderHandle").setAttribute("x", zoomTrackMin + (zoomExpt * Math.log((viewEnd - viewStart + 1) / zoomBase)));
    
    // set up the navigator
    document.getElementById("region").addEventListener('mousedown', function(ev) {
             ev.stopPropagation(); ev.preventDefault();
             if (entryPoints == null) {
                 // should growl a warning?
                 return;
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
	            }).html('<form id="navform">Chr:<select id="chrMenu" name="seq" value="' + chr + '"><option value="1">1</option><option value="2">2</option></select><br>' +
	                    'Start:<input name="min" value="' + (viewStart|0) + '"></input><br>' + 
	                    'End:<input name="max" value="' + (viewEnd|0) + '"></input>' + 
	                    '<input type="submit" value="Go"></form>'
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
	            
	            var epMenuOptions = '';
                for (var epi = 0; epi < entryPoints.length; ++epi) {
                     var ep = epMenuItems[epi].entryPoint;
                     epMenuOptions += '<option value="' + ep.name + '">' + ep.toString() +'</option>';
                }
                $('#chrMenu').html(epMenuOptions).attr({value: chr});
	            
	            $('#navform').submit(function() {
	                    var nchr = $('select:eq(0)').val();    // ugh!  But couldn't get selection on input names working.
	                    var nmin = $('input:eq(0)').val();
	                    var nmax = $('input:eq(1)').val();
	                    
	                    if (nmin < 1) {
	                        nmin = 1;
	                    }
	                    
	                    var nwid = nmax - nmin + 1;
	                    if (nwid < 100 || nwid > 1000000) {
	                        var nmid = (nmin + nmax) / 2;
	                        nmin = nmid - 10000;
	                        nmax = nmid + 9999;
	                    }
	                    
	                    // would be nice to factor this stuff out.
	                    // also update zoom slider!
	                    
	                    viewStart = nmin | 0;
	                    viewEnd = nmax | 0;
	                    chr = nchr;
	                    scale = featurePanelWidth / (viewEnd - viewStart);
                        
	                    currentSeqMax = -1;
	                    for (var epi = 0; epi < entryPoints.length; ++epi) {
	                        if (entryPoints[epi].name == chr) {
	                            currentSeqMax = entryPoints[epi].end;
	                            break;
	                        }
	                    }
	                    if (currentSeqMax < 0) {
	                        alert("Couldn't match entrypoint");
	                    }
	                    
                        // xfrmTiers((-1.0 * (viewStart - origin)) * scale, 1);
                        updateRegion();
                        
                        knownStart = Math.max(1, Math.round(viewStart) - maxExtraW);
                        knownEnd = Math.round(viewEnd) + maxExtraW;
                        refresh();
	                    
	                    removeAllPopups();
	                    return false;
	            });
	            
	            /*
	            
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
	            
	            */
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
	                width: 500,
	                backgroundColor: 'white',
	                borderColor: 'black',
	                borderWidth: 1,
	                borderStyle: 'solid',
	                padding: 2,
	      }).html(/* '<form id="addform">Chr:<select id="chrMenu" name="seq" value="' + chr + '"><option value="1">1</option><option value="2">2</option></select><br>' +
	                    'Start:<input name="min" value="' + (viewStart|0) + '"></input><br>' + 
	                    'End:<input name="max" value="' + (viewEnd|0) + '"></input>' + 
	                    '<input type="submit" value="Go"></form>'  */
	                    
	               '<form id="addform">' +
	               '  URL:<input name="dasuri" value="http://.../"></input><br>' +
	               '  <input type="submit" value="Add...">' +
	               '</form>'
	               
	            ).get(0);
	            $(popup).hide();
	            hPopupHolder.appendChild(popup);
	            $(popup).fadeIn(500);
	            
	           $('#addform').submit(function() {
	                    var nuri = $('input:eq(0)').val();    // ugh!  But couldn't get selection on input names working.
	                    
	                    var nds = new DataSource('added', nuri, false, new BoxRenderer());
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
                        tiers.push(new DasTier(nds, viewport, viewportBackground));
                        
                        // Can we get away with a softer refresh???
                        refresh();
	                    
	                    removeAllPopups();
	                    return false;
	            });
	}, false);
	
	
    tierHolder = document.getElementById("dasTiers");
    tiers = new Array();	  
    for (var t = 0; t < sources.length; ++t) {
	    var source = sources[t];
	    var viewport = document.createElementNS("http://www.w3.org/2000/svg", "g");
	    var viewportBackground = document.createElementNS("http://www.w3.org/2000/svg", "rect");
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
	    tiers.push(new DasTier(source, viewport, viewportBackground));
    }
    
    move(0);
    refresh();
    document.getElementById("sliderHandle").addEventListener("mousedown", sliderMouseDownHandler, true);
    document.getElementById("main").addEventListener("mousedown", mouseDownHandler, false);
    document.getElementById('main').addEventListener('touchstart', touchStartHandler, false);
    document.getElementById('main').addEventListener('touchmove', touchMoveHandler, false);
    document.getElementById('main').addEventListener('touchend', touchEndHandler, false);
    document.getElementById('main').addEventListener('touchcancel', touchCancelHandler, false);
    // document.getElementById('main').addEventListener('MozTouchDown', mozTouchStartHandler, false);
    // document.getElementById('main').addEventListener('MozTouchMove', mozTouchMoveHandler, false);
    // document.getElementById('main').addEventListener('MozTouchRelease', mozTouchEndHandler, false);
    document.addEventListener('mousewheel', function(ev) {
	
	// setViewerStatus('wheelDeltaX=' + ev.wheelDeltaX);
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

    resizeViewer();
    window.addEventListener("resize", function(ev) {
            resizeViewer();
    }, false);
    
    // Low-priority stuff
    
    new DASSource(sources[0].uri).entryPoints(
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
    document.getElementById('sliderTrack').setAttribute('transform', 'translate(' + (width - 190 - 600) + ', 0)');
    document.getElementById('sliderHandle').setAttribute('transform', 'translate(' + (width - 190 - 600) + ', 0)');
    
    var oldFPW = featurePanelWidth;
    featurePanelWidth = (width - 140)|0;
    
    if (oldFPW != featurePanelWidth) {
        var viewWidth = viewEnd - viewStart;
        viewEnd = viewStart + (viewWidth * featurePanelWidth) / oldFPW;
        // should do a Known Space check.
        // should also fix the zoom slider...
        updateRegion();
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
    
    var width = viewEnd - viewStart + 1;
    var minExtraW = (width * minExtra) | 0;
    var maxExtraW = (width * maxExtra) | 0;
    if (knownStart > Math.max(1, viewStart - minExtraW) || knownEnd - viewEnd < minExtraW) {
        knownStart = Math.max(1, Math.round(viewStart) - maxExtraW);
        knownEnd = Math.round(viewEnd) + maxExtraW;
        refresh();
    }
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
        for (var li in labels) {
            var label = labels[li];
            var x = label.getAttribute("x");
            var xfrm = "scale(" + (scaleAtLastRedraw/scale) + ",1), translate( " + ((x*scale - x*scaleAtLastRedraw) /scaleAtLastRedraw) +",0)";
            label.setAttribute("transform", xfrm);
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

function storeStatus()
{
    $.cookie('' + cookieKey + '-svgdas-view', '' + chr + ':' + (viewStart|0) + ':' + (viewEnd|0), {expires: 14});
}
