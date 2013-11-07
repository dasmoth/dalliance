// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2012
//
// sequence-draw.js: renderers for sequence-related data
//

var MIN_TILE = 100;
var rulerTileColors = ['black', 'white'];
var baseColors = {A: 'green', C: 'blue', G: 'black', T: 'red'};
var steps = [1,2,5];


function tileSizeForScale(scale, min)
{
    if (!min) {
        min = MIN_TILE;
    }

    function ts(p) {
        return steps[p % steps.length] * Math.pow(10, (p / steps.length)|0);
    }
    var pow = steps.length;
    while (scale * ts(pow) < min) {
        ++pow;
    }
    return ts(pow);
}

function drawSeqTier(tier, seq)
{
	var retina = tier.browser.retina && window.devicePixelRatio > 1;
    var scale = tier.browser.scale, knownStart = tier.browser.viewStart - (1000/scale)|0, knownEnd = tier.browser.viewEnd + (2000/scale), currentSeqMax = tier.browser.currentSeqMax;

	var desiredWidth = tier.browser.featurePanelWidth + 2000;
    if (retina) {
        desiredWidth *= 2;
    }
    var fpw = tier.viewport.width|0; // this.browser.featurePanelWidth;
    if (fpw < desiredWidth - 50) {
        tier.viewport.width = fpw = desiredWidth;
    }

    var height = 50;
    if (seq && seq.seq) {
		height += 25;
    }

    var canvasHeight = height;
    if (retina) 
    	canvasHeight *= 2;

    tier.viewport.height = canvasHeight;
    tier.viewport.style.height = '' + height + 'px';
    tier.viewport.style.width = retina ? ('' + (fpw/2) + 'px') : ('' + fpw + 'px');
    tier.holder.style.height = '' + height + 'px'
    tier.updateHeight();

    var gc = tier.viewport.getContext('2d');
    gc.clearRect(0, 0, fpw, tier.viewport.height);
    if (retina) {
        gc.scale(2, 2);
    }
    gc.translate(1000,0);


    var seqTierMax = knownEnd;
    if (currentSeqMax > 0 && currentSeqMax < knownEnd) {
        seqTierMax = currentSeqMax;
    }
    var tile = tileSizeForScale(scale);
    var pos = Math.max(0, ((knownStart / tile)|0) * tile);
    
    var origin = tier.browser.viewStart;

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
		gc.fillText(formatLongInt(pos), ((pos - origin) * scale), 22);
		

		pos += tile;
    }

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
				    gc.fillText(base, (p - origin) * scale, 52);
				} else {
				    gc.fillRect((p - origin) * scale, 42, scale, 12); 
				}
		    }
		}
    } 

    tier.norigin = tier.browser.viewStart;
    tier.viewport.style.left = '-1000px';
}

function svgSeqTier(tier, seq) {
    var scale = tier.browser.scale, knownStart = tier.browser.viewStart - (1000/scale)|0, knownEnd = tier.browser.viewEnd + (2000/scale), currentSeqMax = tier.browser.currentSeqMax;

    var fpw = tier.viewport.width|0; 

    var seqTierMax = knownEnd;
    if (currentSeqMax > 0 && currentSeqMax < knownEnd) {
        seqTierMax = currentSeqMax;
    }
    var tile = tileSizeForScale(scale);
    var pos = Math.max(0, ((knownStart / tile)|0) * tile);
    
    var origin = tier.browser.viewStart;

    var  g = makeElementNS(NS_SVG, 'g', [], {fontSize: '8pt'}); 
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
		formatLongInt(pos),
		{x: (pos-origin)*scale,
		 y: 28,
		 fill: 'black', stroke: 'none'}));
	
	pos += tile;
    }

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
			    y: 52,
			    fill: color}));
		} else {
		    g.appendChild(
			makeElementNS(NS_SVG, 'rect', null, {
			    x: (p - origin)*scale,
			    y: 42,
			    width: scale,
			    height: 12,
	                    fill: color}));

		}
	    }
	}
    } 

    return g;
}
