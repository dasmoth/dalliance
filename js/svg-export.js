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

    var dallianceAnchor = makeElementNS(NS_SVG, 'text', 'Graphics from Dalliance ' + VERSION, {
        x: (b.featurePanelWidth + margin + 20)/2,
        y: 30,
        strokeWidth: 0,
        fill: 'black',
        fontSize: '12pt',
	textAnchor: 'middle'
    });
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
    var tierHolder = makeElementNS(NS_SVG, 'g', null, {clipPath: 'url(#featureClip)', clipRule: 'nonzero'});


    for (var ti = 0; ti < b.tiers.length; ++ti) {
        var tier = b.tiers[ti];
	var tierSVG = makeElementNS(NS_SVG, 'g');
	var tierTopPos = pos;

	saveRoot.appendChild(
	    makeElementNS(
		NS_SVG, 'text',
		tier.dasSource.name,
		{x: 20, y: pos + 15}));


	if (tier.dasSource.tier_type === 'sequence') {
	    var seqTrack = svgSeqTier(tier, tier.currentSequence);
	    
	    tierSVG.appendChild(makeElementNS(NS_SVG, 'g', seqTrack, {transform: 'translate(' + (margin) + ', ' + pos + ')'}));
	    pos += 80;
	} else {
            if (!tier.subtiers) {
		continue;
            }
	
	    var offset = ((tier.glyphCacheOrigin - b.viewStart) * b.scale);
            for (var sti = 0; sti < tier.subtiers.length; ++sti) {
		var subtier = tier.subtiers[sti];
            
		var glyphElements = [];
		for (var gi = 0; gi < subtier.glyphs.length; ++gi) {
                    var glyph = subtier.glyphs[gi];
                    glyphElements.push(glyph.toSVG());
		}
		tierSVG.appendChild(makeElementNS(NS_SVG, 'g', glyphElements, {transform: 'translate(' + (margin+offset) + ', ' + pos + ')'}));
		pos += subtier.height + 3;
            }
	    pos += 10;
	}
	tierHolder.appendChild(makeElementNS(NS_SVG, 'rect', null, {x: 0, y: tierTopPos, width: '10000', height: pos-tierTopPos, fill: tier.background}));
	tierHolder.appendChild(tierSVG);
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
