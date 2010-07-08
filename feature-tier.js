// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-tier.js: renderers for glyphic data
//

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
	
    for (var uft in tier.ungroupedFeatures) {
	var ufl = tier.ungroupedFeatures[uft];
	for (var pgid = 0; pgid < ufl.length; ++pgid) {
	     lh = Math.max(lh, drawFeatureGroup(featureGroupElement, offset, new Array(ufl[pgid]), bumpMatrix, "", tier.source.renderer));
	}
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