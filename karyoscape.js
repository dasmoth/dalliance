/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// karyoscape.js
//

function Karyoscape(dsn)
{
    this.dsn = dsn;
    this.svg = makeElementNS(NS_SVG, 'g');
    this.width = 250;
}

Karyoscape.prototype.update = function(chr, start, end) {
    this.start = start;
    this.end = end;
    if (!this.chr || chr != this.chr) {
	this.chr = chr;
	removeChildren(svg);

	var kscape = this;
	this.dsn.features(
	    new DASSegment(chr),
	    {type: 'karyotype'},
	    function(karyos) {
		kscape.karyos = karyos;
		kscape.redraw();
	    }
	);
    } else {
	this.setThumb();
    }
}

var karyo_palette = {
    gneg: 'white',
    gpos25: 'rgb(200,200,200)',
    gpos33: 'rgb(180,180,180)',
    gpos50: 'rgb(128,128,128)',
    gpos66: 'rgb(100,100,100)',
    gpos75: 'rgb(64,64,64)',
    gpos100: 'rgb(0,0,0)',
    gvar: 'rgb(100,100,100)',
    acen: 'rgb(100,100,100)',
    stalk: 'rgb(100,100,100)'
};

Karyoscape.prototype.redraw = function() {
    removeChildren(this.svg);
    this.karyos = this.karyos.sort(function(k1, k2) {
        return (k1.min|0) - (k2.min|0);
    });
    var chrLen = this.karyos[this.karyos.length - 1].max;
    this.chrLen = chrLen;
    var bandspans = null;
    for (var i = 0; i < this.karyos.length; ++i) {
	var k = this.karyos[i];
	var bmin = ((1.0 * k.min) / chrLen) * this.width;
	var bmax = ((1.0 * k.max) / chrLen) * this.width;
	var col = karyo_palette[k.label];
	if (!col) {
	    // alert("don't understand " + k.label);
	} else {
	    var band = makeElementNS(NS_SVG, 'rect', null, {
		x: bmin,
		y: (k.label == 'stalk' || k.label == 'acen' ? 5 : 0),
		width: (bmax - bmin),
		height: (k.label == 'stalk' || k.label == 'acen'? 5 : 15),
		stroke: 'none',
		fill: col
	    });
	    if (k.label.substring(0, 1) == 'g') {
		var br = new Range(k.min, k.max);
		if (bandspans == null) {
		    bandspans = br;
		} else {
		    bandspans = union(bandspans, br);
		}
	    }
	    makeTooltip(band, k.id);
	    this.svg.appendChild(band);
	}
    }
    this.svg.appendChild(makeElementNS(NS_SVG, 'line', null, {
	x1: 0, y1: 0, x2: 0, y1: 15,
	stroke: 'black', strokeWidth: 2
    }));
    this.svg.appendChild(makeElementNS(NS_SVG, 'line', null, {
	x1: this.width, y1: 0, x2: this.width, y1: 15,
	stroke: 'black', strokeWidth: 2
    }));		    
    if (bandspans) {
	var r = bandspans.ranges();
	for (var ri = 0; ri < r.length; ++ri) {
	    var rr = r[ri];
	    var bmin = ((1.0 * rr.min()) / chrLen) * this.width;
	    var bmax = ((1.0 * rr.max()) / chrLen) * this.width;
	    this.svg.appendChild(makeElementNS(NS_SVG, 'line', null, {
		x1: bmin, y1: 0, x2: bmax, y2: 0,
		stroke: 'black', strokeWidth: 2
	    }));
	    this.svg.appendChild(makeElementNS(NS_SVG, 'line', null, {
		x1: bmin, y1: 15, x2: bmax, y2: 15,
		stroke: 'black', strokeWidth: 2
	    }));
	}
    }

    this.thumb = makeElementNS(NS_SVG, 'rect', null, {
	x: 50, y: -5, width: 8, height: 25,
	fill: 'blue', fillOpacity: 0.5, stroke: 'none'
    });
    this.svg.appendChild(this.thumb);
    this.setThumb();

    var thisKaryo = this;
    var sliderDeltaX;

    var moveHandler = function(ev) {
	ev.stopPropagation(); ev.preventDefault();
	var sliderX = Math.max(-4, Math.min(ev.clientX + sliderDeltaX, thisKaryo.width - 4));
	thisKaryo.thumb.setAttribute('x', sliderX);
//	if (thisSlider.onchange) {
//	    thisSlider.onchange(value, false);
//	}
    }
    var upHandler = function(ev) {
    	ev.stopPropagation(); ev.preventDefault();
	if (thisKaryo.onchange) {
	    thisKaryo.onchange((1.0 * ((thisKaryo.thumb.getAttribute('x')|0) + 4)) / thisKaryo.width, true);
	}
	document.removeEventListener('mousemove', moveHandler, true);
	document.removeEventListener('mouseup', upHandler, true);
    }
    

    this.thumb.addEventListener('mousedown', function(ev) {
	ev.stopPropagation(); ev.preventDefault();
	sliderDeltaX = thisKaryo.thumb.getAttribute('x') - ev.clientX;
	document.addEventListener('mousemove', moveHandler, true);
	document.addEventListener('mouseup', upHandler, true);
    }, false);
    
}

Karyoscape.prototype.setThumb = function() {
    var pos = ((this.start|0) + (this.end|0)) / 2
    var gpos = ((1.0 * pos)/this.chrLen) * this.width;
    this.thumb.setAttribute('x', gpos - 4);
}
	    

