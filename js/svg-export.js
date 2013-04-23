// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// svg-export.js
//

function saveSVG(b) {
    var saveDoc = document.implementation.createDocument(NS_SVG, 'svg', null);


    var saveRoot = makeElementNS(NS_SVG, 'g', null, {
        fontFamily: 'helvetica'
    });
    saveDoc.documentElement.appendChild(saveRoot);


    var dallianceAnchor = makeElementNS(NS_SVG, 'text', 'Graphics from Dalliance ' + VERSION, {
        x: 80,
        y: 30,
        strokeWidth: 0,
        fill: 'black',
        fontSize: '12pt'
    });
    saveRoot.appendChild(dallianceAnchor);
    
    var clipRect = makeElementNS(NS_SVG, 'rect', null, {
	x: 200,
	y: 50,
	width: b.featurePanelWidth,
	height: 100000
    });
    var clip = makeElementNS(NS_SVG, 'clipPath', clipRect, {id: 'featureClip'});
    saveRoot.appendChild(clip);

    var pos = 50;
    var tierHolder = makeElementNS(NS_SVG, 'g', null, {clipPath: 'url(#featureClip)', clipRule: 'nonzero'});


    for (var ti = 0; ti < b.tiers.length; ++ti) {
        var tier = b.tiers[ti];
        if (!tier.subtiers) {
            continue;
        }
        
        for (var sti = 0; sti < tier.subtiers.length; ++sti) {
            var subtier = tier.subtiers[sti];
            
            var glyphElements = [];
            for (var gi = 0; gi < subtier.glyphs.length; ++gi) {
                var glyph = subtier.glyphs[gi];
                glyphElements.push(glyph.toSVG());
            }
            tierHolder.appendChild(makeElementNS(NS_SVG, 'g', glyphElements, {transform: 'translate(0, ' + pos + ')'}));
            pos += subtier.height + 20;
        }
    }
    saveRoot.appendChild(tierHolder);

    saveDoc.documentElement.setAttribute('width', b.featurePanelWidth + 20);
    saveDoc.documentElement.setAttribute('height', pos + 50);

    var svgBlob = new Blob([new XMLSerializer().serializeToString(saveDoc)]);
    var fr = new FileReader();
    fr.onload = function(fre) {
        window.open('data:image/svg+xml;' + fre.target.result.substring(6), 'Dalliance graphics');
    };
    fr.readAsDataURL(svgBlob);
}
