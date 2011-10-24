/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-tier.js: renderers for glyphic data
//

var MIN_FEATURE_PX = 1; // FIXME: slightly higher would be nice, but requires making
                        // drawing of joined-up groups a bit smarter.   

var MIN_PADDING = 3;

var DEFAULT_SUBTIER_MAX = 25;

//
// Colour handling
//

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
    yellow: new DColour(255, 255, 0, 'yellow'),
    white: new DColour(255, 255, 255, 'white'),
    black: new DColour(0, 0, 0, 'black')
};

var COLOR_RE = new RegExp('^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$');

function dasColourForName(name) {
    var c = palette[name];
    if (!c) {
        var match = COLOR_RE.exec(name);
        if (match) {
            c = new DColour(('0x' + match[1])|0, ('0x' + match[2])|0, ('0x' + match[3])|0, name);
            palette[name] = c;
        } else {
            dlog("couldn't handle color: " + name);
            c = palette.black;
            palette[name] = c;
        }
    }
    return c;
}

// 
// Wrapper for glyph plus metrics
//

function DGlyph(glyph, min, max, height) {
    this.glyph = glyph;
    this.min = min;
    this.max = max;
    this.height = height;
    this.zindex = 0;
}

//
// Set of bumped glyphs
// 

function DSubTier() {
    this.glyphs = [];
    this.height = 0;
}

DSubTier.prototype.add = function(glyph) {
    this.glyphs.push(glyph);
    this.height = Math.max(this.height, glyph.height);
}

DSubTier.prototype.hasSpaceFor = function(glyph) {
    for (var i = 0; i < this.glyphs.length; ++i) {
        var g = this.glyphs[i];
        if (g.min <= glyph.max && g.max >= glyph.min) {
            return false;
        }
    }
    return true;
}

//
// Stylesheet handling (experimental 0.5.3 version)
//

DasTier.prototype.styleForFeature = function(f) {
    // dlog('styling ' + miniJSONify(f));

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
        return sh.style;
    }
    return maybe;
}

function drawLine(featureGroupElement, features, style, tier, y)
{
    var origin = tier.browser.origin, scale = tier.browser.scale;
    var height = style.HEIGHT || 30;
    var min = tier.dasSource.forceMin || style.MIN || tier.currentFeaturesMinScore || 0;
    var max = tier.dasSource.forceMax || style.MAX || tier.currentFeaturesMaxScore || 10;
    var yscale = ((1.0 * height) / (max - min));
    var width = style.LINEWIDTH || 1;
    var color = style.COLOR || style.COLOR1 || 'black';

    var path = document.createElementNS(NS_SVG, 'path');
    path.setAttribute("fill", "none");
    path.setAttribute('stroke', color);
    path.setAttribute("stroke-width", width);
    var pathOps = '';

    for (var fi = 0; fi < features.length; ++fi) {
        var f = features[fi];

        var px = ((((f.min|0) + (f.max|0)) / 2) - origin) * scale;
        var sc = ((f.score - (1.0*min)) * yscale)|0;
        var py = y + (height - sc);
        if (fi == 0) {
            pathOps = 'M ' + px + ' ' + py;
        } else {
            pathOps += ' L ' + px + ' ' + py;
        }       
    }
    path.setAttribute('d', pathOps);
    featureGroupElement.appendChild(path);

    var clipId = 'line_clip_' + (++clipIdSeed);
    var clip = document.createElementNS(NS_SVG, 'clipPath');
    clip.setAttribute('id', clipId);
    var clipRect = document.createElementNS(NS_SVG, 'rect');
    clipRect.setAttribute('x', -500000);
    clipRect.setAttribute('y', y - 1);
    clipRect.setAttribute('width', 1000000);
    clipRect.setAttribute('height', height + 2);
    clip.appendChild(clipRect);
    featureGroupElement.appendChild(clip);
    path.setAttribute('clip-path', 'url(#' + clipId + ')');
   
    if (!tier.isQuantitative) {
        tier.isQuantitative = true;
        tier.isLabelValid = false;
    }
    if (tier.min != min) {
        tier.min = min;
        tier.isLabelValid = false;
    }
    if (tier.max != max) {
        tier.max = max;
        tier.isLabelValid = false;
    }
    if (tier.clientMin != y|0 + height) {
        tier.clientMin = y|0 + height;
        tier.isLabelValid = false;
    }
    if (tier.clientMax != y) {
        tier.clientMax = y;
        tier.isLabelValid = false;
    }

    return height|0 + MIN_PADDING;
}

function sortFeatures(tier)
{
    var ungroupedFeatures = {};
    var groupedFeatures = {};
    var groups = {};
    var superGroups = {};
    var groupsToSupers = {};
    var nonPositional = [];
    var minScore, maxScore;
    var fbid;

    var init_fbid = function() {
        fbid = {};
        for (var fi = 0; fi < tier.currentFeatures.length; ++fi) {
            var f = tier.currentFeatures[fi];
            if (f.id) {
                fbid[f.id] = f;
            }
        }
    };
    
    var superParentsOf = function(f) {
        // FIXME: should recur.
        var spids = [];
        if (f.parents) {
            for (var pi = 0; pi < f.parents.length; ++pi) {
                var pid = f.parents[pi];
                var p = fbid[pid];
                if (!p) {
                    continue;
                }
                // alert(p.type + ':' + p.typeCv);
                if (p.typeCv == 'SO:0000704') {
                    pushnew(spids, pid);
                }
            }
        }
        return spids;
    }


    for (var fi = 0; fi < tier.currentFeatures.length; ++fi) {
        // var f = eval('[' + miniJSONify(tier.currentFeatures[fi]) + ']')[0]; 
        var f = tier.currentFeatures[fi];
        if (f.parts) {
            continue;
        }

        if (!f.min || !f.max) {
            nonPositional.push(f);
            continue;
        }

        if (f.score && f.score != '.' && f.score != '-') {
            sc = 1.0 * f.score;
            if (!minScore || sc < minScore) {
                minScore = sc;
            }
            if (!maxScore || sc > maxScore) {
                maxScore = sc;
            }
        }

        var fGroups = [];
        var fSuperGroup = null;
        if (f.groups) {
            for (var gi = 0; gi < f.groups.length; ++gi) {
                var g = f.groups[gi];
                var gid = g.id;
                if (g.type == 'gene') {
                    // Like a super-grouper...
                    fSuperGroup = gid; 
                    groups[gid] = shallowCopy(g);
                } else if (g.type == 'translation') {
                    // have to ignore this to get sensible results from bj-e :-(.
                } else {
                    pusho(groupedFeatures, gid, f);
                    groups[gid] = shallowCopy(g);
                    fGroups.push(gid);
                }
            }
        }

        if (f.parents) {
            if (!fbid) {
                init_fbid();
            }
            for (var pi = 0; pi < f.parents.length; ++pi) {
                var pid = f.parents[pi];
                var p = fbid[pid];
                if (!p) {
                    // alert("couldn't find " + pid);
                    continue;
                }
                if (!p.parts) {
                    p.parts = [f];
                }
                pushnewo(groupedFeatures, pid, p);
                pusho(groupedFeatures, pid, f);
                
                if (!groups[pid]) {
                    groups[pid] = {
                        type: p.type,
                        id: p.id,
                        label: p.label || p.id
                    };
                }
                fGroups.push(pid);

                var sgs = superParentsOf(p);
                if (sgs.length > 0) {
                    fSuperGroup = sgs[0];
                    var sp = fbid[sgs[0]];
                    groups[sgs[0]] = {
                        type: sp.type,
                        id: sp.id,
                        label: sp.label || sp.id
                    };
                    if (!tier.dasSource.collapseSuperGroups) {
                        tier.dasSource.collapseSuperGroups = true;
                        tier.isLabelValid = false;
                    }
                }
            }   
        }

        if (fGroups.length == 0) {
            pusho(ungroupedFeatures, f.type, f);
        } else if (fSuperGroup) {
            for (var g = 0; g < fGroups.length; ++g) {
                var gid = fGroups[g];
                pushnewo(superGroups, fSuperGroup, gid);
                groupsToSupers[gid] = fSuperGroup;
            } 
        }       
    }

    tier.ungroupedFeatures = ungroupedFeatures;
    tier.groupedFeatures = groupedFeatures;
    tier.groups = groups;
    tier.superGroups = superGroups;
    tier.groupsToSupers = groupsToSupers;

    if (minScore) {
        if (minScore > 0) {
            minScore = 0;
        } else if (maxScore < 0) {
            maxScore = 0;
        }
        tier.currentFeaturesMinScore = minScore;
        tier.currentFeaturesMaxScore = maxScore;
    }
}

var clipIdSeed = 0;

function drawFeatureTier(tier)
{
    sortFeatures(tier);
    tier.placard = null;
    tier.isQuantitative = false;         // gets reset later if we have any HISTOGRAMs.

    var featureGroupElement = tier.viewport;
    while (featureGroupElement.childNodes.length > 0) {
        featureGroupElement.removeChild(featureGroupElement.firstChild);
    }
    featureGroupElement.appendChild(tier.background);
    drawGuidelines(tier, featureGroupElement);
        
    var lh = MIN_PADDING;
    var glyphs = [];
    var specials = false;

    // Glyphify ungrouped.
        
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

    var unbumpedST = new DSubTier();
    var bumpedSTs = [];
    var hasBumpedFeatures = false;
    var subtierMax = tier.dasSource.subtierMax || DEFAULT_SUBTIER_MAX;
    
  GLYPH_LOOP:
    for (var i = 0; i < glyphs.length; ++i) {
        var g = glyphs[i];
        g = labelGlyph(tier, g, featureGroupElement);
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
                var st = new DSubTier();
                st.add(g);
                bumpedSTs.push(st);
            }
        } else {
            unbumpedST.add(g);
        }
    }

    tier.hasBumpedFeatures = hasBumpedFeatures;

    if (unbumpedST.glyphs.length > 0) {
        bumpedSTs = [unbumpedST].concat(bumpedSTs);
    }

    var stBoundaries = [];
    if (specials) {
        stBoundaries.push(lh);
    } 
    for (var bsi = 0; bsi < bumpedSTs.length; ++bsi) {
        var st = bumpedSTs[bsi];
        var stg = st.glyphs;
        stg = stg.sort(function(g1, g2) {
            return g1.zindex - g2.zindex;
        });

	for (var i = 0; i < stg.length; ++i) {
	    var g = stg[i];
	    if (g.glyph) {
                gypos = lh;
                if (g.height < st.height) {
                    gypos += (st.height - g.height);
                }
		g.glyph.setAttribute('transform', 'translate(0, ' + gypos + ')');
                g.glyph.setAttribute('cursor', 'pointer');
                featureGroupElement.appendChild(g.glyph);
            }
        }
        
        if (g.quant) {
            tier.isLabelValid = false;    // FIXME
            tier.isQuantitative = true;
            tier.min = g.quant.min;
            tier.max = g.quant.max;
            tier.clientMin = lh + st.height;
            tier.clientMax = lh;
        }

        lh += st.height + MIN_PADDING;
        stBoundaries.push(lh);
    }

    lh = Math.max(tier.browser.minTierHeight, lh); // for sanity's sake.
    if (stBoundaries.length < 2) {
        var bumped = false;
        var minHeight = lh;
        
        var ss = tier.stylesheet;
        if (ss) {
            var ssScale = zoomForScale(tier.browser.scale);
            for (var si = 0; si < ss.styles.length; ++si) {
                var sh = ss.styles[si];
                if (!sh.zoom || sh.zoom == ssScale) {
                    var s = sh.style;
                     if (s.bump) {
                         bumped = true;
                     }
                    if (s.height && (4.0 + s.height) > minHeight) {
                        minHeight = (4.0 + s.height);
                    }
                }
            }
            if (bumped) {
                lh = 2 * minHeight;
            }
        }
    }                   

    tier.wantedLayoutHeight = lh;
    if (!tier.layoutWasDone || tier.browser.autoSizeTiers) {
        tier.layoutHeight = lh;
        if (glyphs.length > 0 || specials) {
            tier.layoutWasDone = true;
        }
        tier.placard = null;
    } else {
        if (tier.layoutHeight != lh) {
            var spandPlacard = document.createElementNS(NS_SVG, 'g');
            var frame = document.createElementNS(NS_SVG, 'rect');
            frame.setAttribute('x', 0);
            frame.setAttribute('y', -20);
            frame.setAttribute('width', tier.browser.featurePanelWidth);
            frame.setAttribute('height', 20);
            frame.setAttribute('stroke', 'red');
            frame.setAttribute('stroke-width', 1);
            frame.setAttribute('fill', 'white');
            spandPlacard.appendChild(frame);
            var spand = document.createElementNS(NS_SVG, 'text');
            spand.setAttribute('stroke', 'none');
            spand.setAttribute('fill', 'red');
            spand.setAttribute('font-family', 'helvetica');
            spand.setAttribute('font-size', '10pt');

            if (tier.layoutHeight < lh) { 
                var dispST = 0;
                while ((tier.layoutHeight - 20) >= stBoundaries[dispST]) { // NB allowance for placard!
                    ++dispST;
                }
                spand.appendChild(document.createTextNode('Show ' + (stBoundaries.length - dispST) + ' more'));
            } else {
                spand.appendChild(document.createTextNode('Show less'));
            }
            
            spand.setAttribute('x', 80);
            spand.setAttribute('y', -6);
            spandPlacard.appendChild(spand);
            var arrow = document.createElementNS(NS_SVG, 'path');
            arrow.setAttribute('fill', 'red');
            arrow.setAttribute('stroke', 'none');
            if (tier.layoutHeight < lh) {
                arrow.setAttribute('d', 'M ' +  30 + ' ' + -16 +
                                   ' L ' + 42 + ' ' + -16 +
                                   ' L ' + 36 + ' ' + -4 + ' Z');
            } else {
                arrow.setAttribute('d', 'M ' +  30 + ' ' + -4 +
                                   ' L ' + 42 + ' ' + -4 +
                                   ' L ' + 36 + ' ' + -16 + ' Z');
            }
            spandPlacard.appendChild(arrow);
            
            spandPlacard.addEventListener('mousedown', function(ev) {
                tier.layoutHeight = tier.wantedLayoutHeight;
                tier.placard = null;
                tier.clipTier();
                tier.browser.arrangeTiers();
            }, false);

            var dismiss = document.createElementNS(NS_SVG, 'text');
            dismiss.setAttribute('stroke', 'none');
            dismiss.setAttribute('fill', 'red');
            dismiss.setAttribute('font-family', 'helvetica');
            dismiss.setAttribute('font-size', '10pt');
            dismiss.appendChild(document.createTextNode("(Auto grow-shrink)"));
            dismiss.setAttribute('x', 750);
            dismiss.setAttribute('y', -6);
            dismiss.addEventListener('mousedown', function(ev) {
                ev.preventDefault(); ev.stopPropagation();
                tier.browser.autoSizeTiers = true;
                tier.browser.refresh();
            }, false);
            spandPlacard.appendChild(dismiss);

            tier.placard = spandPlacard;
        } 
    }

    var statusMsg = tier.error || tier.status;
    if (statusMsg != null) {
        var statusPlacard = document.createElementNS(NS_SVG, 'g');
        var frame = document.createElementNS(NS_SVG, 'rect');
        frame.setAttribute('x', 0);
        frame.setAttribute('y', -20);
        frame.setAttribute('width', tier.browser.featurePanelWidth);
        frame.setAttribute('height', 20);
        frame.setAttribute('stroke', 'red');
        frame.setAttribute('stroke-width', 1);
        frame.setAttribute('fill', 'white');
        statusPlacard.appendChild(frame);
        var status = document.createElementNS(NS_SVG, 'text');
        status.setAttribute('stroke', 'none');
        status.setAttribute('fill', 'red');
        status.setAttribute('font-family', 'helvetica');
        status.setAttribute('font-size', '10pt');
        status.setAttribute('x', 25);
        status.setAttribute('y', -6);
        status.appendChild(document.createTextNode(statusMsg));

        if (tier.error) {
            var dismiss = document.createElementNS(NS_SVG, 'text');
            dismiss.setAttribute('stroke', 'none');
            dismiss.setAttribute('fill', 'red');
            dismiss.setAttribute('font-family', 'helvetica');
            dismiss.setAttribute('font-size', '10pt');
            dismiss.appendChild(document.createTextNode("(Remove track)"));
            dismiss.setAttribute('x', 800);
            dismiss.setAttribute('y', -6);
            dismiss.addEventListener('mousedown', function(ev) {
                ev.preventDefault(); ev.stopPropagation();
                // dlog('Remove');
                tier.browser.removeTier(tier);
            }, false);
            statusPlacard.appendChild(dismiss);
        }

        statusPlacard.appendChild(status);
        tier.placard = statusPlacard;
    }

    tier.clipTier();
            
    tier.scale = 1;
}

DasTier.prototype.clipTier = function() {
    var featureGroupElement = this.viewport;

    this.background.setAttribute("height", this.layoutHeight);

    var clipId = 'tier_clip_' + (++clipIdSeed);
    var clip = document.createElementNS(NS_SVG, 'clipPath');
    clip.setAttribute('id', clipId);
    var clipRect = document.createElementNS(NS_SVG, 'rect');
    clipRect.setAttribute('x', -500000);
    clipRect.setAttribute('y', 0);
    clipRect.setAttribute('width', 1000000);
    clipRect.setAttribute('height', this.layoutHeight);
    clip.appendChild(clipRect);
    featureGroupElement.appendChild(clip);
    featureGroupElement.setAttribute('clip-path', 'url(#' + clipId + ')');
}

function glyphsForGroup(features, y, groupElement, tier, connectorType) {
    var scale = tier.browser.scale, origin = tier.browser.origin;
    var height=1;
    var label;
    var links = null;
    var notes = null;
    var spans = null;
    var strand = null;
    var quant = null;
    var consHeight;
    var gstyle = tier.styleForFeature(groupElement);
    

    for (var i = 0; i < features.length; ++i) {
        var feature = features[i];
        // var style = stylesheet[feature.type] || stylesheet['default'];
        var style = tier.styleForFeature(feature);
        if (!style) {
            continue;
        }
        if (style.HEIGHT) {
            if (!consHeight) {
                consHeight = style.HEIGHT|0;
            } else {
                consHeight = Math.max(consHeight, style.HEIGHT|0);
            }
        }
    }
  
    var glyphGroup = document.createElementNS(NS_SVG, 'g');
    var glyphChildren = [];
    glyphGroup.dalliance_group = groupElement;
    var featureDGlyphs = [];
    for (var i = 0; i < features.length; ++i) {
        var feature = features[i];
        if (feature.orientation && strand==null) {
            strand = feature.orientation;
        }
        if (feature.notes && notes==null) {
            notes = feature.notes;
        }
        if (feature.links && links==null) {
            links = feature.links;
        }
        // var style = stylesheet[feature.type] || stylesheet['default'];
        var style = tier.styleForFeature(feature);
        if (!style) {
            continue;
        }
        if (feature.parts) {  // FIXME shouldn't really be needed
            continue;
        }
        var glyph = glyphForFeature(feature, y, style, tier, consHeight);
        if (glyph && glyph.glyph) {
            featureDGlyphs.push(glyph);
        }
    }
    if (featureDGlyphs.length == 0) {
        return null;
    }

    featureDGlyphs = featureDGlyphs.sort(function(g1, g2) {
        return g1.zindex - g2.zindex;
    });
    
    for (var i = 0; i < featureDGlyphs.length; ++i) {
        var glyph = featureDGlyphs[i];
        glyph.glyph.dalliance_group = groupElement;
        // glyphGroup.appendChild(glyph.glyph);
        glyphChildren.push(glyph.glyph);
        var gspan = new Range(glyph.min, glyph.max);
        if (spans == null) {
            spans = gspan;
        } else {
            spans = union(spans, gspan);
        }
        height = Math.max(height, glyph.height);
        if (!label && glyph.label) {
            label = glyph.label;
        }
        if (glyph.quant) {
            quant = glyph.quant;
        }
    }

    if (spans) {
        var blockList = spans.ranges();
        for (var i = 1; i < blockList.length; ++i) {
            var lmin = ((blockList[i - 1].max() + 1 - origin) * scale);
            var lmax = (blockList[i].min() - origin) * scale;

            var path;
            if (connectorType == 'collapsed_gene') {
                path = document.createElementNS(NS_SVG, 'path');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', 'black');
                path.setAttribute('stroke-width', '1');
                
                var hh = height/2;
                var pathops = "M " + lmin + " " + (y + hh) + " L " + lmax + " " + (y + hh);
                if (lmax - lmin > 8) {
                    var lmid = (0.5*lmax) + (0.5*lmin);
                    if (strand == '+') {
                        pathops += ' M ' + (lmid - 2) + ' ' + (y+hh-4) +
                            ' L ' + (lmid + 2) + ' ' + (y+hh) +
                            ' L ' + (lmid - 2) + ' ' + (y+hh+4); 
                    } else if (strand == '-') {
                        pathops += ' M ' + (lmid + 2) + ' ' + (y+hh-4) +
                            ' L ' + (lmid - 2) + ' ' + (y+hh) +
                            ' L ' + (lmid + 2) + ' ' + (y+hh+4); 
                    }
                }
                path.setAttribute('d', pathops);
            } else {
                path = document.createElementNS(NS_SVG, 'path');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', 'black');
                path.setAttribute('stroke-width', '1');
                
                var vee = true;
                if (gstyle && gstyle.STYLE && gstyle.STYLE != 'hat') {
                    vee = false;
                }

                var hh;
                if (quant) {
                    hh = height;  // HACK to give ensembl-like behaviour for grouped histograms.
                } else {
                    hh = height/2;
                }
                if (vee && (strand == "+" || strand == "-")) {
                    var lmid = (lmin + lmax) / 2;
                    var lmidy = (strand == "-") ? y + 12 : y;
                    path.setAttribute("d", "M " + lmin + " " + (y + hh) + " L " + lmid + " " + lmidy + " L " + lmax + " " + (y + hh));
                } else {
                    path.setAttribute("d", "M " + lmin + " " + (y + hh) + " L " + lmax + " " + (y + hh));
                }
            }
            glyphGroup.appendChild(path);
        }
    }

    for (var i = 0; i < glyphChildren.length; ++i) {
        glyphGroup.appendChild(glyphChildren[i]);
    }

    groupElement.segment = features[0].segment;
    groupElement.min = spans.min();
    groupElement.max = spans.max();
    if (notes && (!groupElement.notes || groupElement.notes.length==0)) {
        groupElement.notes = notes;
    }

    var dg = new DGlyph(glyphGroup, spans.min(), spans.max(), height);
    dg.strand = strand;
    dg.bump = true; // grouped features always bumped.
    // alert(miniJSONify(gstyle));
    if (label || (gstyle && (gstyle.LABEL || gstyle.LABELS))) {  // HACK, LABELS should work.
        dg.label = groupElement.label || label;
        var sg = tier.groupsToSupers[groupElement.id];
        if (sg && tier.superGroups[sg]) {    // workaround case where group and supergroup IDs match.
            if (groupElement.id != tier.superGroups[sg][0]) {
                dg.label = null;
            }
        }
    }
    if (quant) {
        dg.quant = quant;
    }
    return dg;
}

function glyphForFeature(feature, y, style, tier, forceHeight)
{
    var scale = tier.browser.scale, origin = tier.browser.origin;
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

    var requiredHeight;
    var quant;

    if (gtype == 'HIDDEN' || feature.parts) {
        glyph = null;
    } else if (gtype == 'CROSS' || gtype == 'EX' || gtype == 'SPAN' || gtype == 'LINE' || gtype == 'DOT' || gtype == 'TRIANGLE') {
        var stroke = style.FGCOLOR || 'black';
        var fill = style.BGCOLOR || 'none';
        var height = style.HEIGHT || forceHeight || 12;
        requiredHeight = height = 1.0 * height;

        var mid = (minPos + maxPos)/2;
        var hh = height/2;

        var mark;
        var bMinPos = minPos, bMaxPos = maxPos;

        if (gtype == 'CROSS') {
            mark = document.createElementNS(NS_SVG, 'path');
            mark.setAttribute('fill', 'none');
            mark.setAttribute('stroke', stroke);
            mark.setAttribute('stroke-width', 1);
            mark.setAttribute('d', 'M ' + (mid-hh) + ' ' + (y+hh) + 
                              ' L ' + (mid+hh) + ' ' + (y+hh) + 
                              ' M ' + mid + ' ' + y +
                              ' L ' + mid + ' ' + (y+height));
            bMinPos = Math.min(minPos, mid-hh);
            bMaxPos = Math.max(maxPos, mid+hh);
        } else if (gtype == 'EX') {
            mark = document.createElementNS(NS_SVG, 'path');
            mark.setAttribute('fill', 'none');
            mark.setAttribute('stroke', stroke);
            mark.setAttribute('stroke-width', 1);
            mark.setAttribute('d', 'M ' + (mid-hh) + ' ' + (y) + 
                              ' L ' + (mid+hh) + ' ' + (y+height) + 
                              ' M ' + (mid+hh) + ' ' + (y) +
                              ' L ' + (mid-hh) + ' ' + (y+height));  
            bMinPos = Math.min(minPos, mid-hh);
            bMaxPos = Math.max(maxPos, mid+hh);
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
        } else if (gtype == 'LINE') {
            var lstyle = style.STYLE || 'solid';
            mark = document.createElementNS(NS_SVG, 'path');
            mark.setAttribute('fill', 'none');
            mark.setAttribute('stroke', stroke);
            mark.setAttribute('stroke-width', 1);
            if (lstyle == 'hat') {
                var dip = 0;
                if (feature.orientation == '-') {
                    dip = height;
                }
                mark.setAttribute('d', 'M ' + minPos + ' ' + (y+hh) +
                                  ' L ' + ((maxPos + minPos) / 2) + ' ' + (y+dip) +
                                  ' L ' + maxPos + ' ' + (y+hh));
            } else {
                mark.setAttribute('d', 'M ' + minPos + ' ' + (y+hh) +
                                  ' L ' + maxPos + ' ' + (y+hh));
            }
            if (lstyle == 'dashed') {
                mark.setAttribute('stroke-dasharray', '3');
            }
        } else if (gtype == 'DOT') {
            mark = document.createElementNS(NS_SVG, 'circle');
            mark.setAttribute('fill', stroke);   // yes, really...
            mark.setAttribute('stroke', 'none');
            mark.setAttribute('cx', mid);
            mark.setAttribute('cy', (y+hh));
            mark.setAttribute('r', hh);
            bMinPos = Math.min(minPos, mid-hh);
            bMaxPos = Math.max(maxPos, mid+hh);
        }  else if (gtype == 'TRIANGLE') {
            var dir = style.DIRECTION || 'N';
            if (dir === 'FORWARD') {
                if (strand === '-') {
                    dir = 'W';
                } else {
                    dir = 'E';
                }
            } else if (dir === 'REVERSE') {
                if (strand === '-') {
                    dir = 'E';
                } else {
                    dir = 'W';
                }
            }
            var width = style.LINEWIDTH || height;
            halfHeight = 0.5 * height;
            halfWidth = 0.5 * width;
            mark = document.createElementNS(NS_SVG, 'path');
            if (dir == 'E') {
            mark.setAttribute('d', 'M ' + (mid - halfWidth) + ' ' + 0 + 
                              ' L ' + (mid - halfWidth) + ' ' + height +
                              ' L ' + (mid + halfWidth) + ' ' + halfHeight + ' Z');
            } else if (dir == 'W') {
                mark.setAttribute('d', 'M ' + (mid + halfWidth) + ' ' + 0 + 
                                  ' L ' + (mid + halfWidth) + ' ' + height +
                                  ' L ' + (mid - halfWidth) + ' ' + halfHeight + ' Z');
            } else if (dir == 'S') {
                mark.setAttribute('d', 'M ' + (mid + halfWidth) + ' ' + 0 + 
                                  ' L ' + (mid - halfWidth) + ' ' + 0 +
                                  ' L ' + mid + ' ' + height + ' Z');
            } else {
                mark.setAttribute('d', 'M ' + (mid + halfWidth) + ' ' + height + 
                                  ' L ' + (mid - halfWidth) + ' ' + height +
                                  ' L ' + mid + ' ' + 0 + ' Z');
            }
            bMinPos = Math.min(minPos, mid-halfWidth);
            bMaxPos = Math.max(maxPos, mid+halfWidth);
            mark.setAttribute('fill', stroke);
            mark.setAttribute('stroke', 'none');
        }

        glyph = document.createElementNS(NS_SVG, 'g');
        if (fill == 'none' || bMinPos < minPos || bMaxPos > maxPos) {
            var bg = document.createElementNS(NS_SVG, 'rect');
            bg.setAttribute('x', bMinPos);
            bg.setAttribute('y', y);
            bg.setAttribute('width', bMaxPos - bMinPos);
            bg.setAttribute('height', height);
            bg.setAttribute('stroke', 'none');
            bg.setAttribute('fill', 'none');
            bg.setAttribute('pointer-events', 'all');
            glyph.appendChild(bg);
        }
        if (fill != 'none') {
            var bg = document.createElementNS(NS_SVG, 'rect');
            bg.setAttribute('x', minPos);
            bg.setAttribute('y', y);
            bg.setAttribute('width', maxPos - minPos);
            bg.setAttribute('height', height);
            bg.setAttribute('stroke', 'none');
            bg.setAttribute('fill', fill);
            bg.setAttribute('pointer-events', 'all');
            glyph.appendChild(bg);
        }
        glyph.appendChild(mark);
/*
        if (bMinPos < minPos) {
            min = bMinPos/scale + origin;
        } 
        if (bMaxPos > maxPos) {
            max = (bMaxPos-1)/scale + origin;
        } */
    } else if (gtype == 'PRIMERS') {
        var arrowColor = style.FGCOLOR || 'red';
        var lineColor = style.BGCOLOR || 'black';
        var height = style.HEIGHT || forceHeight || 12;
        requiredHeight = height = 1.0 * height;

        var mid = (minPos + maxPos)/2;
        var hh = height/2;

        var glyph = document.createElementNS(NS_SVG, 'g');
        var line = document.createElementNS(NS_SVG, 'path');
        line.setAttribute('stroke', lineColor);
        line.setAttribute('fill', 'none');
        line.setAttribute('d', 'M ' + minPos + ' ' + (height/2) + ' L ' + maxPos + ' ' + (height/2));
        glyph.appendChild(line);

        var trigs = document.createElementNS(NS_SVG, 'path');
        trigs.setAttribute('stroke', 'none');
        trigs.setAttribute('fill', 'arrowColor');
        trigs.setAttribute('d', 'M ' + minPos + ' ' + 0 + ' L ' + minPos + ' ' + height + ' L ' + (minPos + height) + ' ' + (height/2) + ' Z ' +
                                'M ' + maxPos + ' ' + 0 + ' L ' + maxPos + ' ' + height + ' L ' + (maxPos - height) + ' ' + (height/2) + ' Z');
        glyph.appendChild(trigs);
    } else if (gtype == 'ARROW') {
        var parallel = style.PARALLEL ? style.PARALLEL == 'yes' : true;
        var ne = style.NORTHEAST && style.NORTHEAST == 'yes';
        var sw = style.SOUTHWEST && style.SOUTHWEST == 'yes';

        var stroke = style.FGCOLOR || 'none';
        var fill = style.BGCOLOR || 'green';
        var height = style.HEIGHT || forceHeight || 12;
        requiredHeight = height = 1.0 * height;
        var headInset = parallel ? 0.5 *height : 0.25 * height;
        var midPos = (maxPos + minPos)/2;
        var instep = parallel ? 0.25 * height : 0.4 * height;
        
        if (parallel) {
            if (ne && (maxPos - midPos < height)) {
                maxPos = midPos + height;
            }
            if (sw && (midPos - minPos < height)) {
                minPos = midPos - height;
            }
        } else {
            if (maxPos - minPos < (0.75 * height)) {
                minPos = midPos - (0.375 * height);
                maxPos = midPos + (0.375 * height);
            }
        }

        var path = document.createElementNS(NS_SVG, 'path');
        path.setAttribute('fill', fill);
        path.setAttribute('stroke', stroke);
        if (stroke != 'none') {
            path.setAttribute('stroke-width', 1);
        }

        var pathops;
        if (parallel) {
            pathops = 'M ' + midPos + ' ' + instep;
            if (ne) {
                pathops += ' L ' + (maxPos - headInset) + ' ' + instep + 
                    ' L ' + (maxPos - headInset) + ' 0' +
                    ' L ' + maxPos + ' ' + (height/2) +
                    ' L ' + (maxPos - headInset) + ' ' + height +
                    ' L ' + (maxPos - headInset) + ' ' + (height - instep);
            } else {
                pathops += ' L ' + maxPos + ' ' + instep +
                    ' L ' + maxPos + ' ' + (height - instep);
            }
            if (sw) {
                pathops += ' L ' + (minPos + headInset) + ' ' + (height-instep) +
                    ' L ' + (minPos + headInset) + ' ' + height + 
                    ' L ' + minPos + ' ' + (height/2) +
                    ' L ' + (minPos + headInset) + ' ' + ' 0' +
                    ' L ' + (minPos + headInset) + ' ' + instep;
            } else {
                pathops += ' L ' + minPos + ' ' + (height-instep) +
                    ' L ' + minPos + ' ' + instep;
            }
            pathops += ' Z';
        } else {
            pathops = 'M ' + (minPos + instep) + ' ' + (height/2);
            if (ne) {
                pathops += ' L ' + (minPos + instep) + ' ' + headInset +
                    ' L ' + minPos + ' ' + headInset +
                    ' L ' + midPos + ' 0' +
                    ' L ' + maxPos + ' ' + headInset +
                    ' L ' + (maxPos - instep) + ' ' + headInset;
            } else {
                pathops += ' L ' + (minPos + instep) + ' 0' +
                    ' L ' + (maxPos - instep) + ' 0';
            }
            if (sw) {
                pathops += ' L ' + (maxPos - instep) + ' ' + (height - headInset) +
                    ' L ' + maxPos + ' ' + (height - headInset) +
                    ' L ' + midPos + ' ' + height + 
                    ' L ' + minPos + ' ' + (height - headInset) +
                    ' L ' + (minPos + instep) + ' ' + (height - headInset);
            } else {
                pathops += ' L ' + (maxPos - instep) + ' ' + height +
                    ' L ' + (minPos + instep) + ' ' + height;
            }
            pathops += ' Z';
        }
        path.setAttribute('d', pathops);

        glyph = path;
    } else if (gtype == 'ANCHORED_ARROW') {
        var stroke = style.FGCOLOR || 'none';
        var fill = style.BGCOLOR || 'green';
        var height = style.HEIGHT || forceHeight || 12;
        requiredHeight = height = 1.0 * height;
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
    } else if (gtype == 'TEXT') {
        var textFill = style.FGCOLOR || 'none';
        var bgFill = style.BGCOLOR || 'none';
        var height = style.HEIGHT || forceHeight || 12;
        var tstring = style.STRING;
        requiredHeight = height;
        if (!tstring) {
            glyph = null;
        } else {
            var txt = makeElementNS(NS_SVG, 'text', tstring, {
                stroke: 'none',
                fill: textFill
            });
            tier.viewport.appendChild(txt);
            var bbox = txt.getBBox();
            tier.viewport.removeChild(txt);
            txt.setAttribute('x', (minPos + maxPos - bbox.width)/2);
            txt.setAttribute('y', height - 2);

            if (bgFill == 'none') {
                glyph = txt;
            } else {
                glyph = makeElementNS(NS_SVG, 'g', [
                    makeElementNS(NS_SVG, 'rect', null, {
                        x: minPos,
                        y: 0,
                        width: (maxPos - minPos),
                        height: height,
                        fill: bgFill,
                        stroke: 'none'
                    }),
                    txt]);
            }

            if (bbox.width > (maxPos - minPos)) {
                var tMinPos = (minPos + maxPos - bbox.width)/2;
                var tMaxPos = minPos + bbox.width;
                min = ((tMinPos/scale)|0) + origin;
                max = ((tMaxPos/scale)|0) + origin;
            }
        }
    } else {
        // BOX plus other rectangular stuff
        // Also handles HISTOGRAM, GRADIENT, and TOOMANY.
    
        var stroke = style.FGCOLOR || 'none';
        var fill = feature.override_color || style.BGCOLOR || style.COLOR1 || 'green';
        var height = style.HEIGHT || forceHeight || 12;
        requiredHeight = height = 1.0 * height;

        if (style.WIDTH) {
            var w = style.WIDTH|0;
            minPos = (maxPos + minPos - w) / 2;
            maxPos = minPos + w;
        } else if (maxPos - minPos < MIN_FEATURE_PX) {
            minPos = (maxPos + minPos - MIN_FEATURE_PX) / 2;
            maxPos = minPos + MIN_FEATURE_PX;
        }

        if ((gtype == 'HISTOGRAM' || gtype == 'GRADIENT') && score !== 'undefined') {
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

            if (gtype == 'HISTOGRAM') {
                if (true) {
                    var relOrigin = (-1.0 * smin) / (smax - smin);
                    if (relScore >= relOrigin) {
                        height = Math.max(1, (relScore - relOrigin) * requiredHeight);
                        y = y + ((1.0 - relOrigin) * requiredHeight) - height;
                    } else {
                        height = Math.max(1, (relOrigin - relScore) * requiredHeight);
                        y = y + ((1.0 - relOrigin) * requiredHeight);
                    }
                } else {
                    // old impl
                    height = relScore * height;
                    y = y + (requiredHeight - height);
                }
                
                quant = {
                    min: smin,
                    max: smax
                };
            }

            minPos -= 0.25
            maxPos += 0.25;   // Fudge factor to mitigate pixel-jitter.
        }
 
        // dlog('min=' + min + '; max=' + max + '; minPos=' + minPos + '; maxPos=' + maxPos);

        var rect = document.createElementNS(NS_SVG, 'rect');
        rect.setAttribute('x', minPos);
        rect.setAttribute('y', y);
        rect.setAttribute('width', maxPos - minPos);
        rect.setAttribute('height', height);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', 1);
        rect.setAttribute('fill', fill);
        
        if (feature.visualWeight && feature.visualWeight < 1.0) {
            rect.setAttribute('fill-opacity', feature.visualWeight);
            if (stroke != 'none') {
                rect.setAttribute('stroke-opacity', feature.visualWeight);
            }
        }
        
        if (gtype == 'TOOMANY') {
            var bits = [rect];
            for (var i = 3; i < height; i += 3) {
                bits.push(makeElementNS(NS_SVG, 'line', null, {
                    x1: minPos,
                    y1: i,
                    x2: maxPos,
                    y2: i,
                    stroke: stroke,
                    strokeWidth: 0.5
                }));
            }
            glyph = makeElementNS(NS_SVG, 'g', bits);
        } else if (feature.seq && scale >= 1) {
            var refSeq;
            if (tier.currentSequence) {
                refSeq = tier.currentSequence;
            } else {
            }

            var seq  = feature.seq.toUpperCase();
            var gg = [];
            for (var i = 0; i < seq.length; ++i) {
                var base = seq.substr(i, 1);
                var color = null;
                // var color = baseColors[base];
                if (refSeq && refSeq.seq && refSeq.start <= min && refSeq.end >= max) {
                    var refBase = refSeq.seq.substr((min|0) + (i|0) - (refSeq.start|0), 1).toUpperCase();
                    if (refBase !== base) {
                        color = 'red';
                    }
                }

                if (!color) {
                    color = 'gray';
                }

                if (scale >= 8) {
                    var labelText = document.createElementNS(NS_SVG, 'text');
                    labelText.setAttribute("x", minPos + i*scale);
                    labelText.setAttribute("y",  12);
                    labelText.setAttribute('stroke', 'none');
                    labelText.setAttribute('fill', color);
                    labelText.appendChild(document.createTextNode(base));
                    gg.push(labelText);
                    requiredHeight = 14;
                } else {
                    var br = document.createElementNS(NS_SVG, 'rect');
                    br.setAttribute('x', minPos + i*scale);
                    br.setAttribute('y', y);
                    br.setAttribute('height', height);
                    br.setAttribute('width', scale);
                    br.setAttribute('fill', color);
                    br.setAttribute('stroke', 'none');
                    gg.push(br);
                }
            }

            if (scale >= 8) {
                min -= 1;
                max += 1;
            } else {
                min = Math.floor(min - (1 / scale))|0;
                max = Math.ceil(max + (1/scale))|0;
            }
            
            glyph = makeElementNS(NS_SVG, 'g', gg);
        } else {
            glyph = rect;
        }
    }

    if (glyph) {
        glyph.dalliance_feature = feature;
    }
    var dg = new DGlyph(glyph, min, max, requiredHeight);
    if (style.LABEL && (feature.label || feature.id)) {
        dg.label = feature.label || feature.id;
    }
    if (style.BUMP) {
        dg.bump = true;
    }
    dg.strand = feature.orientation || '0';
    if (quant) {
        dg.quant = quant;
    }
    dg.zindex = style.ZINDEX || 0;

    return dg;
}

function labelGlyph(tier, dglyph, featureTier) {
    var scale = tier.browser.scale, origin = tier.browser.origin;
    if (tier.dasSource.labels !== false) {
        if (dglyph.glyph && dglyph.label) {
            var label = dglyph.label;
            var labelText = document.createElementNS(NS_SVG, 'text');
            labelText.setAttribute('x', (dglyph.min - origin) * scale);
            labelText.setAttribute('y', dglyph.height + 15);
            labelText.setAttribute('stroke-width', 0);
            labelText.setAttribute('fill', 'black');
            labelText.setAttribute('class', 'label-text');
            labelText.setAttribute('font-family', 'helvetica');
            labelText.setAttribute('font-size', '10pt');
            if (dglyph.strand == '+') {
                label = label + '>';
            } else if (dglyph.strand == '-') {
                label = '<' + label;
            }
            labelText.appendChild(document.createTextNode(label));

            featureTier.appendChild(labelText);
            var width = labelText.getBBox().width;
            featureTier.removeChild(labelText);

            var g;
            if (dglyph.glyph.localName == 'g') {
                g = dglyph.glyph;
            } else {
                g = document.createElementNS(NS_SVG, 'g');
                g.appendChild(dglyph.glyph);
            }
            g.appendChild(labelText);
            dglyph.glyph = g;
            dglyph.height = dglyph.height + 20;
            
            var textMax = (dglyph.min|0) + ((width + 10) / scale)
            if (textMax > dglyph.max) {
                var adj = (textMax - dglyph.max)/2;
                var nmin = ((dglyph.min - adj - origin) * scale) + 5;
                labelText.setAttribute('x', nmin)
                dglyph.min = ((nmin/scale)+origin)|0;
                dglyph.max = (textMax-adj)|0;
            } else {
                // Mark as a candidate for label-jiggling

                labelText.jiggleMin = (dglyph.min - origin) * scale;
                labelText.jiggleMax = ((dglyph.max - origin) * scale) - width;
            }
        }
    }
    return dglyph;
}
