// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-draw.js: new feature-tier renderer
//

var MIN_PADDING = 3;
var DEFAULT_SUBTIER_MAX = 25;

function SubTier() {
    this.glyphs = [];
    this.height = 0;
}

SubTier.prototype.add = function(glyph) {
    this.glyphs.push(glyph);
    this.height = Math.max(this.height, glyph.height());
}

SubTier.prototype.hasSpaceFor = function(glyph) {
    for (var i = 0; i < this.glyphs.length; ++i) {
        var g = this.glyphs[i];
        if (g.min() <= glyph.max() && g.max() >= glyph.min()) {
            return false;
        }
    }
    return true;
}


function drawFeatureTier(tier)
{
    sortFeatures(tier);

    var glyphs = [];
    var specials = false;

    for (var uft in tier.ungroupedFeatures) {
        var ufl = tier.ungroupedFeatures[uft];
        // var style = styles[uft] || styles['default'];
        var style = tier.styleForFeature(ufl[0]);   // FIXME this isn't quite right...
        if (!style) continue;
        if (style.glyph == 'LINEPLOT') {
            glyphs.push(makeLineGlyph(ufl, style, tier));
            specials = true;
        } else {
            for (var pgid = 0; pgid < ufl.length; ++pgid) {
                var f = ufl[pgid];
                if (f.parts) {  // FIXME shouldn't really be needed
                    continue;
                }
                var g = glyphForFeature(f, 0, tier.styleForFeature(f), tier);
		g.feature = f;
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
	    g.group = tier.groups[gid];
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

    // Bumping

    var unbumpedST = new SubTier();
    var bumpedSTs = [];
    var hasBumpedFeatures = false;
    var subtierMax = tier.dasSource.subtierMax || DEFAULT_SUBTIER_MAX;
    
  GLYPH_LOOP:
    for (var i = 0; i < glyphs.length; ++i) {
        var g = glyphs[i];
        // g = labelGlyph(tier, g, featureGroupElement);
        if (g.bump) {
            hasBumpedFeatures = true;
        }
        if (g.bump && (tier.bumped || tier.dasSource.collapseSuperGroups)) {       // kind-of nasty.  supergroup collapsing is different from "normal" unbumping
            for (var sti = 0; sti < bumpedSTs.length;  ++sti) {
                var st = bumpedSTs[sti];
                if (st.hasSpaceFor(g)) {
                    st.add(g);
                    continue GLYPH_LOOP;
                }
            }
            if (bumpedSTs.length >= subtierMax) {
                tier.status = 'Too many overlapping features, truncating at ' + subtierMax;
            } else {
                var st = new SubTier();
                st.add(g);
                bumpedSTs.push(st);
            }
        } else {
            unbumpedST.add(g);
        }
    }

    if (unbumpedST.glyphs.length > 0) {
        bumpedSTs = [unbumpedST].concat(bumpedSTs);
    }


    tier.subtiers = bumpedSTs;
    tier.glyphCacheOrigin = tier.browser.viewStart;
}

DasTier.prototype.paint = function() {
    var subtiers = this.subtiers;
    if (!subtiers) {
	return;
    }

    var fpw = this.viewport.width|0; // this.browser.featurePanelWidth;

    var lh = MIN_PADDING;
    for (var s = 0; s < subtiers.length; ++s) {
	lh = lh + subtiers[s].height + MIN_PADDING;
    }
    this.viewport.setAttribute('height', Math.max(lh, 200));
    this.viewport.style.left = '-1000px';
    this.holder.style.height = '' + Math.max(lh,35) + 'px';
    this.norigin = (this.browser.viewStart + this.browser.viewEnd)/2;

    var gc = this.viewport.getContext('2d');
    gc.fillStyle = this.background;
    gc.fillRect(0, 0, fpw, Math.max(lh, 200));
    gc.restore();

    gc.save();
    var offset = ((this.glyphCacheOrigin - this.browser.viewStart)*this.browser.scale)+1000;
    gc.translate(offset, MIN_PADDING);
   
    for (var s = 0; s < subtiers.length; ++s) {
	var glyphs = subtiers[s].glyphs;
	var drawn = 0;
	for (var i = 0; i < glyphs.length; ++i) {
	    var glyph = glyphs[i];
	    if (glyph.min() < fpw-offset && glyph.max() > -offset) { 
		glyphs[i].draw(gc);
		++drawn;
	    }
	}
	// dlog('drawn ' + drawn + '/' + glyphs.length);
	gc.translate(0, subtiers[s].height + MIN_PADDING);
    }
    gc.restore();
}

function glyphsForGroup(features, y, groupElement, tier, connectorType) {
    var gstyle = tier.styleForFeature(groupElement);
    var label;

    var glyphs = [];
    var strand = null;
    for (var i = 0; i < features.length; ++i) {
	var f = features[i];
	if (f.orientation && strand==null) {
            strand = f.orientation;
        }
	 if (!label && f.label) {
            label = f.label;
        }

	var style = tier.styleForFeature(f);
        if (!style) {
            continue;
        }
        if (f.parts) {  // FIXME shouldn't really be needed
            continue;
        }

	var g = glyphForFeature(f, 0, style, tier, null, true);
	if (g) {
	    glyphs.push(g);
	}
    }
    
    var connector = 'flat';
    if (tier.dasSource.collapseSuperGroups && !tier.bumped) {
	if (strand === '+') {
	    connector = 'collapsed+';
	} else if (strand === '-') {
	    connector = 'collapsed-';
	}
    } else {
	if (strand === '+') {
	    connector = 'hat+';
	} else if (strand === '-') {
	    connector = 'hat-';
	}
    }

    var labelText = null;
    if (label || (gstyle && (gstyle.LABEL || gstyle.LABELS))) {  // HACK, LABELS should work.
        labelText = groupElement.label || label;
        var sg = tier.groupsToSupers[groupElement.id];
        if (sg && tier.superGroups[sg]) {    // workaround case where group and supergroup IDs match.
            //if (groupElement.id != tier.superGroups[sg][0]) {
            //    dg.label = null;
            // }
        }
    }

    var gg = new GroupGlyph(glyphs, connector);
    if (labelText) {
	if (strand === '+') {
	    labelText = '>' + labelText;
	} else if (strand === '-') {
	    labelText = '<' + labelText;
	}
	gg = new LabelledGlyph(gg, labelText);
    }
    gg.bump = true;
    return gg;
}

function glyphForFeature(feature, y, style, tier, forceHeight, noLabel)
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

    var gg;
    if (gtype === 'HISTOGRAM' || gtype === 'GRADIENT' && score !== 'undefined') {
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
	var relOrigin = (-1.0 * smin) / (smax - smin);

	if (gtype === 'HISTOGRAM') {
	    if (relScore >= relOrigin) {
		height = Math.max(1, (relScore - relOrigin) * requiredHeight);
		y = y + ((1.0 - relOrigin) * requiredHeight) - height;
	    } else {
		height = Math.max(1, (relOrigin - relScore) * requiredHeight);
		y = y + ((1.0 - relOrigin) * requiredHeight);
	    }
	}

	var stroke = style.FGCOLOR || null;
	var fill = feature.override_color || style.BGCOLOR || style.COLOR1 || 'green';

	if (style.COLOR2) {
	    var grad = style._gradient;
	    if (!grad) {
		grad = makeGradient(50, style.COLOR1, style.COLOR2, style.COLOR3);
		style._gradient = grad;
	    }

	    var step = (relScore*grad.length)|0;
	    if (step < 0) step = 0;
	    if (step >= grad.length) step = grad.length - 1;
	    fill = grad[step];
        } 

	gg = new BoxGlyph(minPos, y, (maxPos - minPos), height,fill, stroke);
    } else /* default to BOX */ {
	var stroke = style.FGCOLOR || null;
	var fill = feature.override_color || style.BGCOLOR || style.COLOR1 || 'green';
	gg = new BoxGlyph(minPos, 0, (maxPos - minPos), height, fill, stroke);
	gg.bump = true;
    }

    if (style.LABEL && label && !noLabel) {
	gg = new LabelledGlyph(gg, label);
    }
    return gg;

}

function BoxGlyph(x, y, width, height, fill, stroke) {
    this.x = x;
    this.y = y;
    this._width = width;
    this._height = height;
    this.fill = fill;
    this.stroke = stroke;
}

BoxGlyph.prototype.draw = function(g) {
    var r = 1.0;

    g.beginPath();
    g.moveTo(this.x + r, this.y);
    g.lineTo(this.x + this._width - r, this.y);
    g.arcTo(this.x + this._width, this.y, this.x + this._width, this.y + r, r);
    g.lineTo(this.x + this._width, this.y + this._height - r);
    g.arcTo(this.x + this._width, this.y + this._height, this.x + this._width - r, this.y + this._height, r);
    g.lineTo(this.x + r, this.y + this._height);
    g.arcTo(this.x, this.y + this._height, this.x, this.y + this._height - r, r);
    g.lineTo(this.x, this.y + r);
    g.arcTo(this.x, this.y, this.x + r, this.y, r);
    g.closePath();

    if (this.fill) {
	g.fillStyle = this.fill;
	//g.fillRect(this.x, this.y, this._width, this._height);
	g.fill();
    }
    if (this.stroke) {
	g.strokeStyle = this.stroke;
	g.lineWidth = 0.5;
	// g.strokeRect(this.x, this.y, this._width, this._height);
	g.stroke();
    }
}

BoxGlyph.prototype.min = function() {
    return this.x;
}

BoxGlyph.prototype.max = function() {
    return this.x + this._width;
}

BoxGlyph.prototype.height = function() {
    return this.y + this._height;
}


function GroupGlyph(glyphs, connector) {
    this.glyphs = glyphs;
    this.connector = connector;
    this.h = glyphs[0].height();

    var cov = new Range(glyphs[0].min(), glyphs[0].max());
    for (g = 1; g < glyphs.length; ++g) {
	var gg = glyphs[g];
	cov = union(cov, new Range(gg.min(), gg.max()));
	this.h = Math.max(this.h, gg.height());
    }
    this.coverage = cov;
}

GroupGlyph.prototype.draw = function(g) {
    for (var i = 0; i < this.glyphs.length; ++i) {
	var gl = this.glyphs[i];
	gl.draw(g);
    }

    var ranges = this.coverage.ranges();
    for (var r = 1; r < ranges.length; ++r) {
	var gl = ranges[r];
	var last = ranges[r - 1];
	if (last && gl.min() > last.max()) {
	    var start = last.max();
	    var end = gl.min();
	    var mid = (start+end)/2
	    
	    g.beginPath();
	    if (this.connector === 'hat+') {
		g.moveTo(start, this.h/2);
		g.lineTo(mid, 0);
		g.lineTo(end, this.h/2);
	    } else if (this.connector === 'hat-') {
		g.moveTo(start, this.h/2);
		g.lineTo(mid, this.h);
		g.lineTo(end, this.h/2);
	    } else if (this.connector === 'collapsed+') {
		g.moveTo(start, this.h/2);
		g.lineTo(end, this.h/2);
		if (end - start > 4) {
		    g.moveTo(mid - 2, (this.h/2) - 5);
		    g.lineTo(mid + 2, this.h/2);
		    g.lineTo(mid - 2, (this.h/2) + 5);
		}
	    } else if (this.connector === 'collapsed-') {
		g.moveTo(start, this.h/2);
		g.lineTo(end, this.h/2);
		if (end - start > 4) {
		    g.moveTo(mid + 2, (this.h/2) - 5);
		    g.lineTo(mid - 2, this.h/2);
		    g.lineTo(mid + 2, (this.h/2) + 5);
		}
	    } else {
		g.moveTo(start, this.h/2);
		g.lineTo(end, this.h/2);
	    }
	    g.stroke();
	}
	last = gl;
    }
}

GroupGlyph.prototype.min = function() {
    return this.coverage.min();
}

GroupGlyph.prototype.max = function() {
    return this.coverage.max();
}

GroupGlyph.prototype.height = function() {
    return this.h;
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

	var labelRE = sh._labelRE;
	if (!labelRE) {
	    labelRE = new RegExp('^' + sh.label + '$');
	    sh._labelRE = labelRE;
	}
        if (sh.label && !(labelRE.test(f.label))) {
            continue;
        }
	var methodRE = sh._methodRE;
	if (!methodRE) {
	    methodRE = new RegExp('^' + sh.method + '$');
	    sh._methodRE = methodRE;
	}
        if (sh.method && !(methodRE.test(f.method))) {
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

function makeLineGlyph(features, style, tier) {
    // return new BoxGlyph(-1000, 5, 3000, 15, 'red', 'black');
    var origin = tier.browser.viewStart, scale = tier.browser.scale;
    var height = style.HEIGHT || 30;
    var min = tier.dasSource.forceMin || style.MIN || tier.currentFeaturesMinScore || 0;
    var max = tier.dasSource.forceMax || style.MAX || tier.currentFeaturesMaxScore || 10;
    var yscale = ((1.0 * height) / (max - min));
    var width = style.LINEWIDTH || 1;
    var color = style.FGCOLOR || style.COLOR1 || 'black';

    var points = [];
    for (var fi = 0; fi < features.length; ++fi) {
        var f = features[fi];

        var px = ((((f.min|0) + (f.max|0)) / 2) - origin) * scale;
        var sc = ((f.score - (1.0*min)) * yscale)|0;
        var py = (height - sc);  // FIXME y???
        points.push(px);
	points.push(py);
    }
    var lgg = new LineGraphGlyph(points, color);
    return lgg;
}

function LineGraphGlyph(points, color) {
    this.points = points;
    this.color = color;
}

LineGraphGlyph.prototype.min = function() {
    return this.points[0];
};

LineGraphGlyph.prototype.max = function() {
    return this.points[this.points.length - 2];
};

LineGraphGlyph.prototype.height = function() {
    return 50;
}

LineGraphGlyph.prototype.draw = function(g) {
    g.save();
    g.strokeStyle = this.color;
    g.lineWidth = 2;
    g.beginPath();
    for (var i = 0; i < this.points.length; i += 2) {
	var x = this.points[i];
	var y = this.points[i + 1];
	if (i == 0) {
	    g.moveTo(x, y);
	} else {
	    g.lineTo(x, y);
	}
    }
    g.stroke();
    g.restore();
}

function LabelledGlyph(glyph, text) {
    this.glyph = glyph;
    this.text = text;
}

LabelledGlyph.prototype.min = function() {
    return this.glyph.min();
}

LabelledGlyph.prototype.max = function() {
    return this.glyph.max();
}

LabelledGlyph.prototype.height = function() {
    return this.glyph.height() + 20;
}

LabelledGlyph.prototype.draw = function(g) {
    this.glyph.draw(g);
    g.fillStyle = 'black';
    g.fillText(this.text, this.glyph.min(), this.glyph.height() + 15);
}
