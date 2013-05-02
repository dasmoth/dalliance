// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2012
//
// sequence-draw.js: renderers for sequence-related data
//

var baseColors = {A: 'green', C: 'blue', G: 'black', T: 'red'};

function drawSeqTier(tier, seq)
{
    var scale = tier.browser.scale, knownStart = tier.browser.viewStart - (1000/scale), knownEnd = tier.browser.viewEnd + (2000/scale), currentSeqMax = tier.browser.currentSeqMax;

    var fpw = tier.viewport.width|0; 

    tier.viewport.height = 80;

    var gc = tier.viewport.getContext('2d');
    gc.fillStyle = tier.background;
    gc.fillRect(0, 0, fpw, tier.viewport.height);

    var seqTierMax = knownEnd;
    if (currentSeqMax > 0 && currentSeqMax < knownEnd) {
        seqTierMax = currentSeqMax;
    }
    var tile = tileSizeForScale(scale);
    var pos = Math.max(0, ((knownStart / tile)|0) * tile);
    
    var origin = tier.browser.viewStart - (1000/scale);

    if (seq && seq.seq) {
	for (var p = knownStart; p <= knownEnd; ++p) {
	    if (p >= seq.start && p <= seq.end) {
		var base = seq.seq.substr(p - seq.start, 1).toUpperCase();
		var color = baseColors[base];
		if (!color) {
                    color = 'gray';
		}

		gc.fillStyle = color;

		if (scale >= 8) {
		    gc.fillText(base, (p - origin) * scale, 12);
		} else {
		    gc.fillRect((p - origin) * scale, 5, scale, 10); 
		}
	    }
	}
    } else {
	while (pos <= seqTierMax) {
	    gc.fillStyle = ((pos / tile) % 2 == 0) ? 'white' : 'black';
	    gc.strokeStyle = 'black';
	    gc.fillRect((pos - origin) * scale,
			8,
			tile*scale,
			3);
	    gc.strokeRect((pos - origin) * scale,
			  8,
			  tile*scale,
			  3);

	    gc.fillStyle = 'black';
	    gc.fillText('' + pos, ((pos - origin) * scale), 22);
	    

	    pos += tile;
	}
    }

    tier.norigin = (tier.browser.viewStart + tier.browser.viewEnd) / 2;
    tier.viewport.style.left = '-1000px';
}

function svgSeqTier(tier, seq) {
    var scale = tier.browser.scale, knownStart = tier.browser.viewStart, knownEnd = tier.browser.viewEnd, currentSeqMax = tier.browser.currentSeqMax;

    var fpw = tier.viewport.width|0; 

    var seqTierMax = knownEnd;
    if (currentSeqMax > 0 && currentSeqMax < knownEnd) {
        seqTierMax = currentSeqMax;
    }
    var tile = tileSizeForScale(scale);
    var pos = Math.max(0, ((knownStart / tile)|0) * tile);
    
    var origin = tier.browser.viewStart;

    var  g = makeElementNS(NS_SVG, 'g'); 
    if (seq && seq.seq) {
	for (var p = knownStart; p <= knownEnd; ++p) {
	    if (p >= seq.start && p <= seq.end) {
		var base = seq.seq.substr(p - seq.start, 1).toUpperCase();
		var color = baseColors[base];
		if (!color) {
                    color = 'gray';
		}


		if (scale >= 8) {
		    // gc.fillText(base, (p - origin) * scale, 12);
		    g.appendChild(
			makeElementNS(NS_SVG, 'text', base, {
			    x: (p-origin)*scale,
			    y: 15,
			    fill: color}));
		} else {
		    g.appendChild(
			makeElementNS(NS_SVG, 'rect', null, {
			    x: (p - origin)*scale,
			    y: 5,
			    width: scale,
			    height: 10,
	                    fill: color}));

		}
	    }
	}
    } else {
	while (pos <= seqTierMax) {
	    g.appendChild(
		makeElementNS(
		    NS_SVG, 'rect',
		    null,
		    {x: (pos-origin)*scale,
		     y: 8,
		     width: tile*scale,
		     height: 3,
		     fill: ((pos / tile) % 2 == 0) ? 'white' : 'black',
		     stroke: 'black'}));

	    g.appendChild(
		makeElementNS(
		    NS_SVG, 'text',
		    '' + pos,
		    {x: (pos-origin)*scale,
		     y: 28,
		     fill: 'black', stroke: 'none'}));

	    pos += tile;
	}
    }
    return g;
}
