// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-draw.js: new feature-tier renderer
//

var MIN_PADDING = 3;
var DEFAULT_SUBTIER_MAX = 25;

function isDasBooleanTrue(s) {
    s = ('' + s).toLowerCase();
    return s==='yes' || s==='true';
}

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

var GLOBAL_GC;

function drawFeatureTier(tier)
{
    GLOBAL_GC = tier.viewport.getContext('2d'); // Should only be used for metrics.
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
                sgMin = Math.min(sgMin, gg.min());
                sgMax = Math.max(sgMax, gg.max());
            }
        }
        for (var sgi = 0; sgi < sgGlyphs.length; ++sgi) {
            var gg = sgGlyphs[sgi];
            glyphs.push(new PaddedGlyph(gg, sgMin, sgMax));
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

function formatQuantLabel(v) {
    var t = '' + v;
    var dot = t.indexOf('.');
    if (dot < 0) {
        return t;
    } else {
        var dotThreshold = 2;
        if (t.substring(0, 1) == '-') {
            ++dotThreshold;
        }

        if (dot >= dotThreshold) {
            return t.substring(0, dot);
        } else {
            return t.substring(0, dot + 2);
        }
    }
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
    lh += 6
    this.viewport.setAttribute('height', Math.max(lh, 50));
    this.viewport.style.left = '-1000px';
    this.holder.style.height = '' + Math.max(lh, 35) + 'px';
    this.updateHeight();
    this.drawOverlay();
    this.norigin = this.browser.viewStart;

    var gc = this.viewport.getContext('2d');
    gc.fillStyle = this.background;
    gc.fillRect(0, 0, fpw, Math.max(lh, 200));
    gc.restore();

    gc.save();
    var offset = ((this.glyphCacheOrigin - this.browser.viewStart)*this.browser.scale)+1000;
    gc.translate(offset, MIN_PADDING);
   
    for (var s = 0; s < subtiers.length; ++s) {
	var quant = null;
	var glyphs = subtiers[s].glyphs;
	for (var i = 0; i < glyphs.length; ++i) {
	    var glyph = glyphs[i];
	    if (glyph.min() < fpw-offset && glyph.max() > -offset) { 
		var glyph = glyphs[i];
		glyph.draw(gc);
		if (glyph.quant) {
		    quant = glyph.quant;
		}
	    }
	}
	gc.translate(0, subtiers[s].height + MIN_PADDING);
    }
    gc.restore();

    if (quant && this.quantOverlay) {
	this.quantOverlay.style.display = 'block';

	var h = this.viewport.height;
	this.quantOverlay.height = this.viewport.height;
	var ctx = this.quantOverlay.getContext('2d');

        ctx.fillStyle = 'white'
        ctx.globalAlpha = 0.6;
        ctx.fillRect(0, 0, 30, 20);
        ctx.fillRect(0, h-20, 30, 20);
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, 3);
        ctx.lineTo(0,3);
        ctx.lineTo(0,h-3);
        ctx.lineTo(8,h-3);
        ctx.stroke();

        ctx.fillStyle = 'black';
        ctx.fillText(formatQuantLabel(quant.max), 8, 8);
        ctx.fillText(formatQuantLabel(quant.min), 8, h-5);
    }
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
    var rawMaxPos = ((max - origin + 1) * scale);
    var maxPos = Math.max(rawMaxPos, minPos + 1);

    var height = style.HEIGHT || forceHeight || 12;;
    var requiredHeight = height = 1.0 * height;
    var bump = style.BUMP && isDasBooleanTrue(style.BUMP);

    var gg, quant;

    if (gtype === 'CROSS' || gtype === 'EX' || gtype === 'TRIANGLE' || gtype === 'DOT') {
	var stroke = style.FGCOLOR || 'black';
        var fill = style.BGCOLOR || 'none';
        var height = style.HEIGHT || forceHeight || 12;
        requiredHeight = height = 1.0 * height;

        var mid = (minPos + maxPos)/2;
        var hh = height/2;

        var mark;
        var bMinPos = minPos, bMaxPos = maxPos;

	if (gtype === 'EX') {
	    gg = new ExGlyph(mid, height, stroke);
	} else if (gtype === 'TRIANGLE') {
	    var dir = style.DIRECTION || 'N';
	    var width = style.LINEWIDTH || height;
	    gg = new TriangleGlyph(mid, height, dir, width, stroke);
	} else if (gtype === 'DOT') {
	    gg = new DotGlyph(mid, height, stroke);
	} else {
	    gg = new CrossGlyph(mid, height, stroke);
	}
    } else if (gtype === 'HISTOGRAM' || gtype === 'GRADIENT' && score !== 'undefined') {
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
	    quant = {min: smin, max: smax};
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
    } else if (gtype === 'HIDDEN') {
	gg = new PaddedGlyph(null, minPos, maxPos);
	noLabel = true;
    } else if (gtype === 'ARROW') {
	var color = style.FGCOLOR || 'purple';
	var parallel = isDasBooleanTrue(style.PARALLEL);
	var sw = isDasBooleanTrue(style.SOUTHWEST);
	var ne = isDasBooleanTrue(style.NORTHEAST);
	gg = new ArrowGlyph(minPos, maxPos, height, color, parallel, sw, ne);
    } else if (gtype === 'ANCHORED_ARROW') {
	var stroke = style.FGCOLOR || 'none';
        var fill = style.BGCOLOR || 'green';
	gg = new AArrowGlyph(minPos, maxPos, height, fill, stroke, strand);
	gg.bump = true;
    } else if (gtype === 'SPAN') {
	var stroke = style.FGCOLOR || 'black';
	gg = new SpanGlyph(minPos, maxPos, height, stroke);
    } else if (gtype === 'LINE') {
	var stroke = style.FGCOLOR || 'black';
	var lineStyle = style.STYLE || 'solid';
	gg = new LineGlyph(minPos, maxPos, height, lineStyle, strand, stroke);
    } else if (gtype === 'PRIMERS') {
	var stroke = style.FGCOLOR || 'black';
	var fill = style.BGCOLOR || 'red';
	gg = new PrimersGlyph(minPos, maxPos, height, fill, stroke);
    } else if (gtype === 'TEXT') {
	var string = style.STRING || 'text';
	var fill = style.FGCOLOR || 'black';
	gg = new TextGlyph(minPos, maxPos, height, fill, string);
    } else if (gtype === 'TOOMANY') {
	var stroke = style.FGCOLOR || 'gray';
	var fill = style.BGCOLOR || 'orange';
	gg = new TooManyGlyph(minPos, maxPos, height, fill, stroke);
    } else if (gtype === 'POINT') {
	var height = tier.forceHeight || style.HEIGHT || 30;
	var smin = tier.dasSource.forceMin || style.MIN || tier.currentFeaturesMinScore || 0;
	var smax = tier.dasSource.forceMax || style.MAX || tier.currentFeaturesMaxScore || 10;
	var yscale = ((1.0 * height) / (smax - smin));
	var sc = ((score - (1.0*smin)) * yscale)|0;
	gg = new PointGlyph((minPos + maxPos)/2, height-sc, height);
    } else if (gtype === '__SEQUENCE') {
	var refSeq = null;
	if (tier.currentSequence) {
	    var csStart = tier.currentSequence.start|0;
	    var csEnd = tier.currentSequence.end|0;
	    if (csStart < min && csEnd > max) {
		refSeq = tier.currentSequence.seq.substr(min - csStart, max - min + 1);
	    }
	}
	gg = new SequenceGlyph(minPos, maxPos, height, feature.seq, refSeq);
    } else /* default to BOX */ {
	var stroke = style.FGCOLOR || null;
	var fill = feature.override_color || style.BGCOLOR || style.COLOR1 || 'green';
	gg = new BoxGlyph(minPos, 0, (maxPos - minPos), height, fill, stroke);
	gg.bump = true;
    }

    if (isDasBooleanTrue(style.LABEL) && label && !noLabel) {
	gg = new LabelledGlyph(gg, label);
    }

    if (bump) {
	gg.bump = true;
    }

    gg.feature = feature;
    if (quant) {
	gg.quant = quant;
    }

    return gg;

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
    var origin = tier.browser.viewStart, scale = tier.browser.scale;
    var height = tier.forceHeight || style.HEIGHT || 30;
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
    var lgg = new LineGraphGlyph(points, color, height);
    lgg.quant = {min: min, max: max};
    return lgg;
}
