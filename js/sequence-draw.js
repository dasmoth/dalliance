// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2012
//
// sequence-draw.js: renderers for sequence-related data
//

function drawSeqTier(tier, seq)
{
    var scale = tier.browser.scale, knownStart = tier.browser.viewStart - (1000/scale), knownEnd = tier.browser.viewEnd + (2000/scale), currentSeqMax = tier.browser.currentSeqMax;

    var fpw = tier.viewport.width|0; 

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

    tier.norigin = (tier.browser.viewStart + tier.browser.viewEnd) / 2;
    tier.viewport.style.left = '-1000px';
}