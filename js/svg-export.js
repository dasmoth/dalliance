// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// svg-export.js
//

Browser.prototype.openExportPanel = function(tier) {
    var b = this;
    if (this.uiMode === 'export') {
        this.hideToolPanel();
        this.setUiMode('none');
    } else {
        var exportForm = makeElement('div', null, {className: 'tier-edit'}, {display: 'flex', justifyContent: 'space-between', paddingTop: '3px', paddingBottom: '3px', borderTop: '1px solid black', borderBottom: '1px solid black'});
        exportForm.appendChild(makeElement('p', 'Export current view as SVG'));

        var exportHighlightsToggle = makeElement('input', null, {type: 'checkbox', checked: this.exportHighlights});
        exportHighlightsToggle.addEventListener('change', function(ev) {
            b.exportHighlights = exportHighlightsToggle.checked;
            b.storeStatus();
        }, false);
        var exportRulerToggle = makeElement('input', null, {type: 'checkbox', checked: this.exportRuler});
        exportRulerToggle.addEventListener('change', function(ev) {
            b.exportRuler = exportRulerToggle.checked;
            b.storeStatus();
        }, false);

        var exportButton = makeElement('button', 'Export', {className: 'btn btn-primary'});
        exportButton.addEventListener('click', function(ev) {
            removeChildren(exportContent);

            var blobURL = URL.createObjectURL(b.makeSVG({highlights: exportHighlightsToggle.checked,
                                                     ruler: exportRulerToggle.checked ? b.rulerLocation : 'none'}));

            var downloadLink = makeElement('a', '[Download]', {
                href: blobURL,
                download: 'dalliance-view.svg',
                type: 'image/svg+xml'
            });

            var previewLink = makeElement('a', '[Preview in browser]', {
                href: blobURL,
                type: 'image/svg+xml',
                target: '_new'
            });

            exportContent.appendChild(makeElement('p', ['SVG created: ', downloadLink, previewLink]));
        }, false);

        b.addViewListener(function() {
            removeChildren(exportContent);
        });
        b.addTierListener(function() {
            removeChildren(exportContent);
        });

        var exportContent = makeElement('p', '');

        var exportOptsTable = makeElement('table',
            [makeElement('tr',
                [makeElement('th', 'Include highlights', {}, {width: '200px', textAlign: 'right'}),
                 makeElement('td', exportHighlightsToggle)]),
             makeElement('tr',
                [makeElement('th', 'Include vertical guideline'),
                 makeElement('td', exportRulerToggle)])
            ]);

        exportForm.appendChild(exportOptsTable);
        exportForm.appendChild(exportButton);
        exportForm.appendChild(exportContent);

        if (this.uiMode !== 'none')
            this.hideToolPanel();
        this.browserHolder.insertBefore(exportForm, this.svgHolder);
        this.activeToolPanel = exportForm;

        this.setUiMode('export');
    }
}

Browser.prototype.makeSVG = function(opts) {
    opts = opts || {};

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

        var labelName;
        if (typeof tier.config.name === 'string')
            labelName = tier.config.name;
        else
            labelName = tier.dasSource.name;
    	tierLabels.appendChild(
    	    makeElementNS(
    		NS_SVG, 'text',
    		labelName,
    		{x: margin - (hasQuant ? 20 : 12), y: (pos+tierTopPos+5)/2, fontSize: '12pt', textAnchor: 'end'}));

    	
    	tierBackground.setAttribute('height', pos - tierTopPos);
    	tierHolder.appendChild(makeElementNS(NS_SVG, 'g', [tierSVG, tierLabels]));
    }

    if (opts.highlights) {
        var highlights = this.highlights || [];
        for (var hi = 0; hi < highlights.length; ++hi) {
            var h = highlights[hi];
            if ((h.chr == this.chr || h.chr == ('chr' + this.chr)) && h.min < this.viewEnd && h.max > this.viewStart) {
                var tmin = (Math.max(h.min, this.viewStart) - this.viewStart) * this.scale;
                var tmax = (Math.min(h.max, this.viewEnd) - this.viewStart) * this.scale;

                tierHolder.appendChild(makeElementNS(NS_SVG, 'rect', null, {x: margin + tmin, y: 70, width: (tmax-tmin), height: pos-70,
                                                                      stroke: 'none', fill: this.defaultHighlightFill, fillOpacity: this.defaultHighlightAlpha}));
            }
        }
    }

    var rulerPos = -1; 
    if (opts.ruler == 'center') {
        rulerPos = margin + ((this.viewEnd - this.viewStart + 1)*this.scale) / 2;
    } else if (opts.ruler == 'left') {
        rulerPos = margin;
    } else if (opts.ruler == 'right') {
        rulerPos = margin + ((this.viewEnd - this.viewStart + 1)*this.scale);
    }
    if (rulerPos >= 0) {
        tierHolder.appendChild(makeElementNS(NS_SVG, 'line', null, {x1: rulerPos, y1: 70, x2: rulerPos, y2: pos,
                                                              stroke: 'blue'}));
    }

    saveRoot.appendChild(tierHolder);
    saveDoc.documentElement.setAttribute('width', b.featurePanelWidth + 20 + margin);
    saveDoc.documentElement.setAttribute('height', pos + 50);

    var svgBlob = new Blob([new XMLSerializer().serializeToString(saveDoc)], {type: 'image/svg+xml'});
    return svgBlob;

    /*
    var fr = new FileReader();
    fr.onload = function(fre) {
        window.open('data:image/svg+xml;' + fre.target.result.substring(6), 'Dalliance graphics', 'width=' + ( b.featurePanelWidth + 20 + margin + 'px'));
    };
    fr.readAsDataURL(svgBlob); */
}
