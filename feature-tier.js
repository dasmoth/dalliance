// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-tier.js: renderers for glyphic data
//

var MIN_FEATURE_PX = 5;   

function DColour(red, green, blue, name) {
    this.red = red|0;
    this.green = green|0;
    this.blue = blue|0;
    if (name) {
	this.name = name;
    }
}

DColour.prototype.toSvgString = function() {
    if (!this.name) {
	this.name = "rgb(" + this.red + "," + this.green + "," + this.blue + ")";
    }

    return this.name;
}

var palette = {
    red: new DColour(255, 0, 0, 'red'),
    green: new DColour(0, 255, 0, 'green'),
    blue: new DColour(0, 0, 255, 'blue'),
    white: new DColour(255, 255, 255, 'white'),
    black: new DColour(0, 0, 0, 'black'),
};

function dasColourForName(name) {
    var c = palette[name];
    if (!c) {
	alert("couldn't handle color: " + name);
    }
    return c;
}

function drawLine(featureGroupElement, features, style, tier)
{
    var height = style.HEIGHT || 30;
    var min = style.MIN || 0, max = style.MAX || 100;
    var yscale = ((1.0 * height) / (max - min));
    var width = style.LINEWIDTH || 1;
    var color = style.COLOR || style.COLOR1 || 'black';

    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "none");
    path.setAttribute('stroke', color);
    path.setAttribute("stroke-width", width);
    var pathOps = '';

    for (var fi = 0; fi < features.length; ++fi) {
	var f = features[fi];

	var px = ((((f.min|0) + (f.max|0)) / 2) - origin) * scale;
        var sc = (f.score * yscale)|0;
	var py = 0 + height - sc;
	if (fi == 0) {
	    pathOps = 'M ' + px + ' ' + py;
	} else {
	    pathOps += ' L ' + px + ' ' + py;
	}	
    }
    path.setAttribute('d', pathOps);
    featureGroupElement.appendChild(path);
   
    return height;
}

function pusho(obj, k, v) {
    if (obj[k]) {
	obj[k].push(v);
    } else {
	obj[k] = new Array(v);
    }
}

function sortFeatures(tier)
{
    var ungroupedFeatures = {};
    var groupedFeatures = {};
    var groups = {};
    
    for (var fi = 0; fi < tier.currentFeatures.length; ++fi) {
	var f = tier.currentFeatures[fi];
	var wasGrouped = false;
	if (f.groups) {
	    for (var gi = 0; gi < f.groups.length; ++gi) {
	        var g = f.groups[gi];
	        if (g.type == 'transcript' || g.type=='CDS' || g.type == 'read') {
	            var gid = g.id;
		    pusho(groupedFeatures, gid, f);
	            groups[gid] = g;
		    wasGrouped = true;
	        }
	    }
	}

	if (!wasGrouped) {
	    pusho(ungroupedFeatures, f.type, f);
	}
    }

    tier.ungroupedFeatures = ungroupedFeatures;
    tier.groupedFeatures = groupedFeatures;
    tier.groups = groups;
}

function drawFeatureTier(tier)
{
    sortFeatures(tier);

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
    var styles = tier.source.styles(scale);
	
    for (var uft in tier.ungroupedFeatures) {
	var ufl = tier.ungroupedFeatures[uft];
	var style = styles[uft];
	if (!style) continue;
	if (style.glyph == 'LINEPLOT') {
	    lh = Math.max(drawLine(featureGroupElement, ufl, style, tier));
	} else {
	    for (var pgid = 0; pgid < ufl.length; ++pgid) {
		var g = glyphForFeature(ufl[pgid], offset /* FIXME */, style);
		if (g) {
		    featureGroupElement.appendChild(g);
		}
	    }
	}
	// update layoutHeight?
    }

    var gl = new Array();
    for (var gid in tier.groupedFeatures) {
	gl.push(gid);
    }
    gl.sort(function(g1, g2) {
	var d = tier.groupedFeatures[g1][0].score - tier.groupedFeatures[g2][0].score;
	if (d > 0) {
	    return -1;
        } else if (d = 0) {
	    return 0;
        } else {
	    return 1;
        }
    });
    for (var gx in gl) {
	var gid = gl[gx];
	lh = Math.max(lh, drawFeatureGroup(featureGroupElement, offset, tier.groupedFeatures[gid], bumpMatrix, gid, tier.source.renderer, tier.groups[gid]));
    }
    tier.layoutHeight=lh;
    tier.background.setAttribute("height", lh);
    tier.scale = 1;
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


function glyphForFeature(feature, y, style)
{
    var gtype = style.glyph || 'BOX';
    var glyph;

    var min = feature.min;
    var max = feature.max;
    var type = feature.type;
    var strand = feature.orientation;
    var score = feature.score;
    var label = feature.label;

    var minPos = (min - origin) * scale;
    var maxPos = (max - origin) * scale;

    if (gtype == 'HIDDEN') {
	glyph = null;
    } else if (gtype == 'CROSS' || gtype == 'EX' || gtype == 'SPAN' || gtype == 'DOT') {
	var stroke = style.FGCOLOR || 'black';
	var fill = style.BGCOLOR || 'none';
	var height = style.HEIGHT || 12;
	height = 1.0 * height;

	var mid = (minPos + maxPos)/2;
	var hh = height/2;

	var mark;

	if (gtype == 'CROSS') {
	    mark = document.createElementNS(NS_SVG, 'path');
	    mark.setAttribute('fill', 'none');
	    mark.setAttribute('stroke', stroke);
	    mark.setAttribute('stroke-width', 1);
	    mark.setAttribute('d', 'M ' + (mid-hh) + ' ' + (y+hh) + 
			      ' L ' + (mid+hh) + ' ' + (y+hh) + 
			      ' M ' + mid + ' ' + y +
			      ' L ' + mid + ' ' + (y+height));
	} else if (gtype == 'EX') {
	    mark = document.createElementNS(NS_SVG, 'path');
	    mark.setAttribute('fill', 'none');
	    mark.setAttribute('stroke', stroke);
	    mark.setAttribute('stroke-width', 1);
	    mark.setAttribute('d', 'M ' + (mid-hh) + ' ' + (y) + 
			      ' L ' + (mid+hh) + ' ' + (y+height) + 
			      ' M ' + (mid+hh) + ' ' + (y) +
			      ' L ' + (mid-hh) + ' ' + (y+height));  
	} else if (gtype == 'SPAN') {
	    mark = document.createElementNS(NS_SVG, 'path');
	    mark.setAttribute('fill', 'none');
	    mark.setAttribute('stroke', stroke);
	    mark.setAttribute('stroke-width', 1);
	    mark.setAttribute('d', 'M ' + minPos + ' ' + (y+hh) +
			      ' L ' + maxPos + ' ' + (y+hh) +
			      ' M ' + minPos + ' ' + y +
			      ' L ' + minPos + ' ' + (y + height) +
			      ' M ' + maxPos + ' ' + y +
			      ' L ' + maxPos + ' ' + (y + height));
	} else if (gtype == 'DOT') {
	    mark = document.createElementNS(NS_SVG, 'circle');
	    mark.setAttribute('fill', stroke);   // yes, really...
	    mark.setAttribute('stroke', 'none');
	    mark.setAttribute('cx', mid);
	    mark.setAttribute('cy', (y+hh));
	    mark.setAttribute('r', hh);
	} 



	if (fill == 'none') {
	    glyph = mark;
	} else {
	    glyph = document.createElementNS(NS_SVG, 'g');
	    var bg = document.createElementNS(NS_SVG, 'rect');
	    bg.setAttribute('x', minPos);
            bg.setAttribute('y', y);
            bg.setAttribute('width', maxPos - minPos);
            bg.setAttribute('height', height);
	    bg.setAttribute('stroke', 'none');
	    bg.setAttribute('fill', fill);
	    glyph.appendChild(bg);
	    glyph.appendChild(mark);
	}
    } else if (gtype == 'ARROW') {
	var stroke = style.FGCOLOR || 'none';
	var fill = style.BGCOLOR || 'green';
	var height = style.HEIGHT || 12;
	height = 1.0 * height;
	var headInset = 0.5 *height;
	var minLength = height + 2;
	var instep = 0.333333 * height;
	
        if (maxPos - minPos < minLength) {
            minPos = (maxPos + minPos - minLength) / 2;
            maxPos = minPos + minLength;
        }

	var path = document.createElementNS(NS_SVG, "path");
	path.setAttribute("fill", fill);
	path.setAttribute('stroke', stroke);
	if (stroke != 'none') {
	    path.setAttribute("stroke-width", 1);
	}
	
	path.setAttribute('d', 'M ' + ((minPos + headInset)) + ' ' + ((y+instep)) +
                          ' L ' + ((maxPos - headInset)) + ' ' + ((y+instep)) +
			  ' L ' + ((maxPos - headInset)) + ' ' + (y) +
			  ' L ' + (maxPos) + ' ' + ((y+(height/2))) +
			  ' L ' + ((maxPos - headInset)) + ' ' + ((y+height)) +
			  ' L ' + ((maxPos - headInset)) + ' ' + ((y + instep + instep)) +
			  ' L ' + ((minPos + headInset)) + ' ' + ((y + instep + instep)) +
			  ' L ' + ((minPos + headInset)) + ' ' + ((y + height)) +
			  ' L ' + (minPos) + ' ' + ((y+(height/2))) +
			  ' L ' + ((minPos + headInset)) + ' ' + (y) +
			  ' L ' + ((minPos + headInset)) + ' ' + ((y+instep)));

	glyph = path;
    } else if (gtype == 'ANCHORED_ARROW') {
	var stroke = style.FGCOLOR || 'none';
	var fill = style.BGCOLOR || 'green';
	var height = style.HEIGHT || 12;
	height = 1.0 * height;
	var lInset = 0;
	var rInset = 0;
	var minLength = height + 2;
	var instep = 0.333333 * height;
	

	if (feature.orientation) {
	    if (feature.orientation == '+') {
		rInset = height/2;
	    } else if (feature.orientation == '-') {
		lInset = height/2;
	    }
	}

        if (maxPos - minPos < minLength) {
            minPos = (maxPos + minPos - minLength) / 2;
            maxPos = minPos + minLength;
        }

	var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", fill);
	path.setAttribute('stroke', stroke);
	if (stroke != 'none') {
	    path.setAttribute("stroke-width", 1);
	}
	
	path.setAttribute('d', 'M ' + ((minPos + lInset)) + ' ' + ((y+instep)) +
                          ' L ' + ((maxPos - rInset)) + ' ' + ((y+instep)) +
			  ' L ' + ((maxPos - rInset)) + ' ' + (y) +
			  ' L ' + (maxPos) + ' ' + ((y+(height/2))) +
			  ' L ' + ((maxPos - rInset)) + ' ' + ((y+height)) +
			  ' L ' + ((maxPos - rInset)) + ' ' + ((y + instep + instep)) +
			  ' L ' + ((minPos + lInset)) + ' ' + ((y + instep + instep)) +
			  ' L ' + ((minPos + lInset)) + ' ' + ((y + height)) +
			  ' L ' + (minPos) + ' ' + ((y+(height/2))) +
			  ' L ' + ((minPos + lInset)) + ' ' + (y) +
			  ' L ' + ((minPos + lInset)) + ' ' + ((y+instep)));

	glyph = path;
    } else {
	// BOX (plus some other rectangular stuff...)
    
	var stroke = style.FGCOLOR || 'none';
	var fill = style.BGCOLOR || 'green';
	var height = style.HEIGHT || 12;
	
        if (maxPos - minPos < MIN_FEATURE_PX) {
            minPos = (maxPos + minPos - MIN_FEATURE_PX) / 2;
            maxPos = minPos + MIN_FEATURE_PX;
        }

	if (gtype == 'HISTOGRAM' || gtype == 'GRADIENT' && score && style.COLOR2) {
	    var smin = style.MIN || 0;
	    var smax = style.MAX || 100;
	    if ((1.0 * score) < smin) {
		score = smin;
	    }
	    if ((1.0 * score) > smax) {
		score = smax;
	    }
	    var relScore = ((1.0 * score) - smin) / (smax-smin);

	    var loc, hic, frac;
	    if (style.COLOR3) {
		if (relScore < 0.5) {
		    loc = dasColourForName(style.COLOR1);
		    hic = dasColourForName(style.COLOR2);
		    frac = relScore * 2;
		} else {
		    loc = dasColourForName(style.COLOR2);
		    hic = dasColourForName(style.COLOR3);
		    frac = (relScore * 2.0) - 1.0;
		}
	    } else {
		loc = dasColourForName(style.COLOR1);
		hic = dasColourForName(style.COLOR2);
		frac = relScore;
	    }

	    fill = new DColour(
		((loc.red * (1.0 - frac)) + (hic.red * frac))|0,
		((loc.green * (1.0 - frac)) + (hic.green * frac))|0,
		((loc.blue * (1.0 - frac)) + (hic.blue * frac))|0
	    ).toSvgString();

	    if (gtype == 'HISTOGRAM') {
		var bh = (height * relScore)|0;
		y = y + (height - bh);
		height = bh;
	    }
	}
 
        var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", minPos);
        rect.setAttribute("y", y);
        rect.setAttribute("width", maxPos - minPos);
        rect.setAttribute("height", height);
	rect.setAttribute('stroke', stroke);
	rect.setAttribute('fill', fill);
	
	glyph = rect;
    }

    return glyph;
}


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


	if (label != null && label != "" && type != 'read' && type != 'cpg-meth' && type != 'cpg-unmeth') {
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