// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// svg-export.js
//

Browser.prototype.saveSVG = function() {
    var b = this;
    var saveDoc = document.implementation.createDocument(NS_SVG, 'svg', null);

    var saveRoot = makeElementNS(NS_SVG, 'g', null, {
        fontFamily: 'helvetica',
        fontSize: '8pt'
    });
    saveDoc.documentElement.appendChild(saveRoot);

    var margin = 200;

    var dallianceAnchor = makeElementNS(NS_SVG, 'a',
       makeElementNS(NS_SVG, 'text', 'Graphics from Dalliance ' + VERSION, {
           x: (b.featurePanelWidth + margin + 20)/2,
           y: 30,
           strokeWidth: 0,
           fill: 'black',
           fontSize: '12pt',
	       textAnchor: 'middle',
	       fill: 'blue'
       }));
    dallianceAnchor.setAttribute('xmlns:xlink', NS_XLINK);
    dallianceAnchor.setAttribute('xlink:href', 'http://www.biodalliance.org/');
  
    saveRoot.appendChild(dallianceAnchor);
    
    var clipRect = makeElementNS(NS_SVG, 'rect', null, {
    	x: margin,
    	y: 50,
    	width: b.featurePanelWidth,
    	height: 100000
    });
    var clip = makeElementNS(NS_SVG, 'clipPath', clipRect, {id: 'featureClip'});
    saveRoot.appendChild(clip);

    var pos = 70;
    var tierHolder = makeElementNS(NS_SVG, 'g', null, {});

    for (var ti = 0; ti < b.tiers.length; ++ti) {
        var tier = b.tiers[ti];
    	var tierSVG = makeElementNS(NS_SVG, 'g', null, {clipPath: 'url(#featureClip)', clipRule: 'nonzero'});
    	var tierLabels = makeElementNS(NS_SVG, 'g');
    	var tierTopPos = pos;

    	var tierBackground = makeElementNS(NS_SVG, 'rect', null, {x: 0, y: tierTopPos, width: '10000', height: 50, fill: tier.background});
    	tierSVG.appendChild(tierBackground);

    	if (tier.dasSource.tier_type === 'sequence') {
    	    var seqTrack = svgSeqTier(tier, tier.currentSequence);
    	    
    	    tierSVG.appendChild(makeElementNS(NS_SVG, 'g', seqTrack, {transform: 'translate(' + (margin) + ', ' + pos + ')'}));
    	    pos += 80;
    	} else {
            if (!tier.subtiers) {
    		   continue;
            }
    	
    	    var offset = ((tier.glyphCacheOrigin - b.viewStart) * b.scale);
            var hasQuant = false;
            for (var sti = 0; sti < tier.subtiers.length; ++sti) {
        		var subtier = tier.subtiers[sti];
                    
        		var glyphElements = [];
        		for (var gi = 0; gi < subtier.glyphs.length; ++gi) {
                    var glyph = subtier.glyphs[gi];
                    glyphElements.push(glyph.toSVG());
        		}

    		    tierSVG.appendChild(makeElementNS(NS_SVG, 'g', glyphElements, {transform: 'translate(' + (margin+offset) + ', ' + pos + ')'}));

        		if (subtier.quant) {
                    hasQuant = true;
        		    var q = subtier.quant;
                    var h = subtier.height;

                    var numTics = 2;
                    if (h > 40) {
                        numTics = 1 + ((h/20) | 0);
                    }
                    var ticSpacing = h / (numTics - 1);
                    var ticInterval = (q.max - q.min) / (numTics - 1);

        		    var path = new SVGPath();
        		    path.moveTo(margin + 5, pos);
        		    path.lineTo(margin, pos);
        		    path.lineTo(margin, pos + subtier.height);
        		    path.lineTo(margin + 5, pos + subtier.height);
                    for (var t = 1; t < numTics-1; ++t) {
                        var ty = t*ticSpacing;
                        path.moveTo(margin, pos + ty);
                        path.lineTo(margin+3, pos + ty);
                    }

        		    tierLabels.appendChild(makeElementNS(NS_SVG, 'path', null, {d: path.toPathData(), fill: 'none', stroke: 'black', strokeWidth: '2px'}));
        		    tierLabels.appendChild(makeElementNS(NS_SVG, 'text', formatQuantLabel(q.max), {x: margin - 3, y: pos + 7, textAnchor: 'end'}));
        		    tierLabels.appendChild(makeElementNS(NS_SVG, 'text', formatQuantLabel(q.min), {x: margin - 3, y: pos +  subtier.height, textAnchor: 'end'}));
                    for (var t = 1; t < numTics-1; ++t) {
                        var ty = t*ticSpacing;
                        tierLabels.appendChild(makeElementNS(NS_SVG, 'text', formatQuantLabel((1.0*q.max) - (t*ticInterval)), 
                            {x: margin - 3, y: pos +  ty + 3, textAnchor: 'end'}));
                    }
        		}

    		    pos += subtier.height + 3;
            }
    	    pos += 10;
    	}

    	tierLabels.appendChild(
    	    makeElementNS(
    		NS_SVG, 'text',
    		tier.dasSource.name,
    		{x: margin - (hasQuant ? 20 : 12), y: (pos+tierTopPos+5)/2, fontSize: '12pt', textAnchor: 'end'}));

    	
    	tierBackground.setAttribute('height', pos - tierTopPos);
    	tierHolder.appendChild(makeElementNS(NS_SVG, 'g', [tierSVG, tierLabels]));
    }

    var highlights = this.highlights || [];
    for (var hi = 0; hi < highlights.length; ++hi) {
        var h = highlights[hi];
        if (h.chr == this.chr && h.min < this.viewEnd && h.max > this.viewStart) {
            var tmin = (Math.max(h.min, this.viewStart) - this.viewStart) * this.scale;
            var tmax = (Math.min(h.max, this.viewEnd) - this.viewStart) * this.scale;

            tierHolder.appendChild(makeElementNS(NS_SVG, 'rect', null, {x: margin + tmin, y: 70, width: (tmax-tmin), height: pos-70,
                                                                  stroke: 'none', fill: 'red', fillOpacity: 0.3}));
        }
    }

    saveRoot.appendChild(tierHolder);
    saveDoc.documentElement.setAttribute('width', b.featurePanelWidth + 20 + margin);
    saveDoc.documentElement.setAttribute('height', pos + 50);

    var svgBlob = new Blob([new XMLSerializer().serializeToString(saveDoc)]);
    var fr = new FileReader();
    fr.onload = function(fre) {
        window.open('data:image/svg+xml;' + fre.target.result.substring(6), 'Dalliance graphics', 'width=' + ( b.featurePanelWidth + 20 + margin + 'px'));
    };
    fr.readAsDataURL(svgBlob);
}
