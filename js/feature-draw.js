// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-draw.js: new feature-tier renderer
//

var MIN_PADDING = 3;

function drawFeatureTier(tier)
{
    var gc = tier.viewport.getContext('2d');

    gc.fillStyle = 'rgb(230,230,250)';           // FIXME background drawing
    gc.fillRect(0, 0, 2000, 200);

    sortFeatures(tier);

    var lh = MIN_PADDING;
    var glyphs = [];
    var specials = false;


    for (var uft in tier.ungroupedFeatures) {
        var ufl = tier.ungroupedFeatures[uft];
        // var style = styles[uft] || styles['default'];
        var style = tier.styleForFeature(ufl[0]);   // FIXME this isn't quite right...
        if (!style) continue;
        if (style.glyph == 'LINEPLOT') {
            lh += Math.max(drawLine(featureGroupElement, ufl, style, tier, lh));
            specials = true;
        } else {
            for (var pgid = 0; pgid < ufl.length; ++pgid) {
                var f = ufl[pgid];
                if (f.parts) {  // FIXME shouldn't really be needed
                    continue;
                }
                var g = glyphForFeature(f, 0, tier.styleForFeature(f), tier);
                glyphs.push(g);
            }
        }
    }



    // Merge supergroups
    
    if (tier.dasSource.collapseSuperGroups && !tier.bumped) {
        for (var sg in tier.superGroups) {
            var sgg = tier.superGroups[sg];
            tier.groups[sg].type = tier.groups[sgg[0]].type;   // HACK to make styling easier in DAS1.6
            var featsByType = {};
            for (var g = 0; g < sgg.length; ++g) {
                var gf = tier.groupedFeatures[sgg[g]];
                for (var fi = 0; fi < gf.length; ++fi) {
                    var f = gf[fi];
                    pusho(featsByType, f.type, f);
                }

                if (tier.groups[sg] && !tier.groups[sg].links || tier.groups[sg].links.length == 0) {
                    tier.groups[sg].links = tier.groups[sgg[0]].links;
                }

                delete tier.groupedFeatures[sgg[g]];  // 'cos we don't want to render the unmerged version.
            }

            for (var t in featsByType) {
                var feats = featsByType[t];
                var template = feats[0];
                var loc = null;
                for (var fi = 0; fi < feats.length; ++fi) {
                    var f = feats[fi];
                    var fl = new Range(f.min, f.max);
                    if (!loc) {
                        loc = fl;
                    } else {
                        loc = union(loc, fl);
                    }
                }
                var mergedRanges = loc.ranges();
                for (var si = 0; si < mergedRanges.length; ++si) {
                    var r = mergedRanges[si];

                    // begin coverage-counting
                    var posCoverage = ((r.max()|0) - (r.min()|0) + 1) * sgg.length;
                    var actCoverage = 0;
                    for (var fi = 0; fi < feats.length; ++fi) {
                        var f = feats[fi];
                        if ((f.min|0) <= r.max() && (f.max|0) >= r.min()) {
                            var umin = Math.max(f.min|0, r.min());
                            var umax = Math.min(f.max|0, r.max());
                            actCoverage += (umax - umin + 1);
                        }
                    }
                    var visualWeight = ((1.0 * actCoverage) / posCoverage);
                    // end coverage-counting

                    var newf = new DASFeature();
                    for (k in template) {
                        newf[k] = template[k];
                    }
                    newf.min = r.min();
                    newf.max = r.max();
                    if (newf.label && sgg.length > 1) {
                        newf.label += ' (' + sgg.length + ' vars)';
                    }
                    newf.visualWeight = ((1.0 * actCoverage) / posCoverage);
                    pusho(tier.groupedFeatures, sg, newf);
                    // supergroups are already in tier.groups.
                }
            }

            delete tier.superGroups[sg]; // Do we want this?
        }       
    }

    // Glyphify groups.

    var gl = new Array();
    for (var gid in tier.groupedFeatures) {
        gl.push(gid);
    }
    gl.sort(function(g1, g2) {
        var d = tier.groupedFeatures[g1][0].score - tier.groupedFeatures[g2][0].score;
        if (d > 0) {
            return -1;
        } else if (d == 0) {
            return 0;
        } else {
            return 1;
        }
    });

    var groupGlyphs = {};
    for (var gx = 0; gx < gl.length; ++gx) {
        var gid = gl[gx];
        var g = glyphsForGroup(tier.groupedFeatures[gid], 0, tier.groups[gid], tier,
                               (tier.dasSource.collapseSuperGroups && !tier.bumped) ? 'collapsed_gene' : 'tent');
        if (g) {
            groupGlyphs[gid] = g;
        }
    }

    for (var sg in tier.superGroups) {
        var sgg = tier.superGroups[sg];
        var sgGlyphs = [];
        var sgMin = 10000000000;
        var sgMax = -10000000000;
        for (var sgi = 0; sgi < sgg.length; ++sgi) {
            var gg = groupGlyphs[sgg[sgi]];
            groupGlyphs[sgg[sgi]] = null;
            if (gg) {
                sgGlyphs.push(gg);
                sgMin = Math.min(sgMin, gg.min);
                sgMax = Math.max(sgMax, gg.max);
            }
        }
        for (var sgi = 0; sgi < sgGlyphs.length; ++sgi) {
            var gg = sgGlyphs[sgi];
            gg.min = sgMin;
            gg.max = sgMax;
            glyphs.push(gg);
        }
    }
    for (var g in groupGlyphs) {
        var gg = groupGlyphs[g];
        if (gg) {
            glyphs.push(gg);
        }
    }

    var drawn = 0;
    for (var i = 0; i < glyphs.length; ++i) {
	var glyph = glyphs[i];
	if (glyph.min() < 1000 && glyph.max() > 0) {     // FIXME use real width!
	    glyphs[i].draw(gc);
	    ++drawn;
	}
    }
    // dlog('drawn ' + drawn + '/' + glyphs.length);
}

function glyphsForGroup(features, y, groupElement, tier, connectorType) {
    var gstyle = tier.styleForFeature(groupElement);

    var glyphs = [];
    for (var i = 0; i < features.length; ++i) {
	var f = features[i];
	var style = tier.styleForFeature(f);
        if (!style) {
            continue;
        }
        if (f.parts) {  // FIXME shouldn't really be needed
            continue;
        }

	var g = glyphForFeature(f, 0, style, tier /* ,consHeight */);
	if (g) {
	    glyphs.push(g);
	}
    }
    return new GroupGlyph(glyphs);
}

function glyphForFeature(feature, y, style, tier, forceHeight)
{
    var scale = tier.browser.scale, origin = tier.browser.viewStart;
    var gtype = style.glyph || 'BOX';
    var glyph;

    var min = feature.min;
    var max = feature.max;
    var type = feature.type;
    var strand = feature.orientation;
    var score = feature.score;
    var label = feature.label;

    var minPos = (min - origin) * scale;
    var maxPos = ((max - origin + 1) * scale);

    var height = style.HEIGHT || forceHeight || 12;;
    var requiredHeight = height = 1.0 * height;
    var quant;

    if (gtype === 'HISTOGRAM' && score !== 'undefined') {
	var smin = tier.dasSource.forceMin || style.MIN || tier.currentFeaturesMinScore;
        var smax = tier.dasSource.forceMax || style.MAX || tier.currentFeaturesMaxScore;

        if (!smax) {
            if (smin < 0) {
                smax = 0;
            } else {
                smax = 10;
            }
        }
        if (!smin) {
            smin = 0;
        }

        if ((1.0 * score) < (1.0 *smin)) {
            score = smin;
        }
        if ((1.0 * score) > (1.0 * smax)) {
            score = smax;
        }
        var relScore = ((1.0 * score) - smin) / (smax-smin);

	var stroke = style.FGCOLOR || null;
	var fill = feature.override_color || style.BGCOLOR || style.COLOR1 || 'green';
	
	var relOrigin = (-1.0 * smin) / (smax - smin);
        if (relScore >= relOrigin) {
            height = Math.max(1, (relScore - relOrigin) * requiredHeight);
            y = y + ((1.0 - relOrigin) * requiredHeight) - height;
        } else {
            height = Math.max(1, (relOrigin - relScore) * requiredHeight);
            y = y + ((1.0 - relOrigin) * requiredHeight);
        }
	return new BoxGlyph(minPos, 5 + (requiredHeight - height), (maxPos - minPos), height,fill, stroke);
    } else if (gtype === 'GRADIENT' && score !== 'undefined') {
	var smin = tier.dasSource.forceMin || style.MIN || tier.currentFeaturesMinScore;
        var smax = tier.dasSource.forceMax || style.MAX || tier.currentFeaturesMaxScore;

        if (!smax) {
            if (smin < 0) {
                smax = 0;
            } else {
                smax = 10;
            }
        }
        if (!smin) {
            smin = 0;
        }

        if ((1.0 * score) < (1.0 *smin)) {
            score = smin;
        }
        if ((1.0 * score) > (1.0 * smax)) {
            score = smax;
        }
        var relScore = ((1.0 * score) - smin) / (smax-smin);

	var stroke = style.FGCOLOR || null;
	var fill = feature.override_color || style.BGCOLOR || style.COLOR1 || 'green';

	if (style.COLOR2) {
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
        } 

	return new BoxGlyph(minPos, 10, (maxPos - minPos), 20, fill, stroke);
    } else /* default to BOX */ {
	var stroke = style.FGCOLOR || null;
	var fill = feature.override_color || style.BGCOLOR || style.COLOR1 || 'green';
	return new BoxGlyph(minPos, 10, (maxPos - minPos), 20, fill, stroke);
    }

}

function BoxGlyph(x, y, width, height, fill, stroke) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.fill = fill;
    this.stroke = stroke;
}

BoxGlyph.prototype.draw = function(g) {
    if (this.fill) {
	g.fillStyle = this.fill;
	g.fillRect(this.x, this.y, this.width, this.height);
    }
    if (this.stroke) {
	g.strokeStyle = this.stroke;
	g.strokeRect(this.x, this.y, this.width, this.height);
    }
}

BoxGlyph.prototype.min = function() {
    return this.x;
}

BoxGlyph.prototype.max = function() {
    return this.x + this.width;
}


function GroupGlyph(glyphs, connector) {
    this.glyphs = glyphs;
    this.glyphs.sort(function(g1, g2) {
	return g1.min() - g2.min();
    });
    this.connector = connector;
}

GroupGlyph.prototype.draw = function(g) {
    var last = null;
    for (var i = 0; i < this.glyphs.length; ++i) {
	var gl = this.glyphs[i];
	gl.draw(g);
	if (last && gl.min() > last.max()) {
	    var start = last.max();
	    var end = gl.min();
	    var mid = (start+end)/2
	    
	    g.beginPath();
	    g.moveTo(start, 20);
	    g.lineTo(mid, 5);
	    g.lineTo(end, 20);
	    g.stroke();
	}
	last = gl;
    }
}

GroupGlyph.prototype.min = function() {
    return this.glyphs[0].min();
}

GroupGlyph.prototype.max = function() {
    // FIXME: optimize or cache?
    
    var m = -10000000;
    for (var i = 0; i < this.glyphs.length; ++i) {
	var glm = this.glyphs[i].max();
	if (glm > m) {
	    m = glm;
	}
    }
    return m;
}
	
    

DasTier.prototype.styleForFeature = function(f) {
    var cs = f._cachedStyle;
    if (cs) {
	return cs;
    }

    var ssScale = zoomForScale(this.browser.scale);

    if (!this.stylesheet) {
        return null;
    }

    var maybe = null;
    var ss = this.stylesheet.styles;
    for (var si = 0; si < ss.length; ++si) {
        var sh = ss[si];
        if (sh.zoom && sh.zoom != ssScale) {
            continue;
        }
        if (sh.label && !(new RegExp('^' + sh.label + '$').test(f.label))) {
            continue;
        }
        if (sh.method && !(new RegExp('^' + sh.method + '$').test(f.method))) {
            continue;
        }
        if (sh.type) {
            if (sh.type == 'default') {
                if (!maybe) {
                    maybe = sh.style;
                }
                continue;
            } else if (sh.type != f.type) {
                continue;
            }
        }
        // perfect match.
	f._cachedStyle = sh.style;
        return sh.style;
    }
    f._cachedStyle = maybe;
    return maybe;
}