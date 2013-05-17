// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// feature-draw.js: new feature-tier renderer
//

function BoxGlyph(x, y, width, height, fill, stroke) {
    this.x = x;
    this.y = y;
    this._width = width;
    this._height = height;
    this.fill = fill;
    this.stroke = stroke;
}

BoxGlyph.prototype.draw = function(g) {
    var r = 1.0;

    g.beginPath();
    g.moveTo(this.x + r, this.y);
    g.lineTo(this.x + this._width - r, this.y);
    g.arcTo(this.x + this._width, this.y, this.x + this._width, this.y + r, r);
    g.lineTo(this.x + this._width, this.y + this._height - r);
    g.arcTo(this.x + this._width, this.y + this._height, this.x + this._width - r, this.y + this._height, r);
    g.lineTo(this.x + r, this.y + this._height);
    g.arcTo(this.x, this.y + this._height, this.x, this.y + this._height - r, r);
    g.lineTo(this.x, this.y + r);
    g.arcTo(this.x, this.y, this.x + r, this.y, r);
    g.closePath();

    if (this.fill) {
	g.fillStyle = this.fill;
	//g.fillRect(this.x, this.y, this._width, this._height);
	g.fill();
    }
    if (this.stroke) {
	g.strokeStyle = this.stroke;
	g.lineWidth = 0.5;
	// g.strokeRect(this.x, this.y, this._width, this._height);
	g.stroke();
    }
}

BoxGlyph.prototype.toSVG = function() {
    return makeElementNS(NS_SVG, 'rect', null,
			 {x: this.x, 
			  y: this.y, 
			  width: this._width, 
			  height: this._height,
			  stroke: this.stroke || 'none',
			  fill: this.fill || 'none'});
}

BoxGlyph.prototype.min = function() {
    return this.x;
}

BoxGlyph.prototype.max = function() {
    return this.x + this._width;
}

BoxGlyph.prototype.height = function() {
    return this.y + this._height;
}


function GroupGlyph(glyphs, connector) {
    this.glyphs = glyphs;
    this.connector = connector;
    this.h = glyphs[0].height();

    var cov = new Range(glyphs[0].min(), glyphs[0].max());
    for (g = 1; g < glyphs.length; ++g) {
	var gg = glyphs[g];
	cov = union(cov, new Range(gg.min(), gg.max()));
	this.h = Math.max(this.h, gg.height());
    }
    this.coverage = cov;
}

GroupGlyph.prototype.draw = function(g) {
    for (var i = 0; i < this.glyphs.length; ++i) {
	var gl = this.glyphs[i];
	gl.draw(g);
    }

    var ranges = this.coverage.ranges();
    for (var r = 1; r < ranges.length; ++r) {
	var gl = ranges[r];
	var last = ranges[r - 1];
	if (last && gl.min() > last.max()) {
	    var start = last.max();
	    var end = gl.min();
	    var mid = (start+end)/2
	    
	    g.beginPath();
	    if (this.connector === 'hat+') {
		g.moveTo(start, this.h/2);
		g.lineTo(mid, 0);
		g.lineTo(end, this.h/2);
	    } else if (this.connector === 'hat-') {
		g.moveTo(start, this.h/2);
		g.lineTo(mid, this.h);
		g.lineTo(end, this.h/2);
	    } else if (this.connector === 'collapsed+') {
		g.moveTo(start, this.h/2);
		g.lineTo(end, this.h/2);
		if (end - start > 4) {
		    g.moveTo(mid - 2, (this.h/2) - 5);
		    g.lineTo(mid + 2, this.h/2);
		    g.lineTo(mid - 2, (this.h/2) + 5);
		}
	    } else if (this.connector === 'collapsed-') {
		g.moveTo(start, this.h/2);
		g.lineTo(end, this.h/2);
		if (end - start > 4) {
		    g.moveTo(mid + 2, (this.h/2) - 5);
		    g.lineTo(mid - 2, this.h/2);
		    g.lineTo(mid + 2, (this.h/2) + 5);
		}
	    } else {
		g.moveTo(start, this.h/2);
		g.lineTo(end, this.h/2);
	    }
	    g.stroke();
	}
	last = gl;
    }
}

function SVGPath() {
    this.ops = [];
}

SVGPath.prototype.moveTo = function(x, y) {
    this.ops.push('M ' + x + ' ' + y);
}

SVGPath.prototype.lineTo = function(x, y) {
    this.ops.push('L ' + x + ' ' + y);
}

SVGPath.prototype.closePath = function() {
    this.ops.push('Z');
}

SVGPath.prototype.toPathData = function() {
    return this.ops.join(' ');
}

GroupGlyph.prototype.toSVG = function() {
    var g = makeElementNS(NS_SVG, 'g');
    for (var i = 0; i < this.glyphs.length; ++i) {
	g.appendChild(this.glyphs[i].toSVG());
    }

    var ranges = this.coverage.ranges();
    for (var r = 1; r < ranges.length; ++r) {
	var gl = ranges[r];
	var last = ranges[r - 1];
	if (last && gl.min() > last.max()) {
	    var start = last.max();
	    var end = gl.min();
	    var mid = (start+end)/2

	    var p = new SVGPath();

	    if (this.connector === 'hat+') {
		p.moveTo(start, this.h/2);
		p.lineTo(mid, 0);
		p.lineTo(end, this.h/2);
	    } else if (this.connector === 'hat-') {
		p.moveTo(start, this.h/2);
		p.lineTo(mid, this.h);
		p.lineTo(end, this.h/2);
	    } else if (this.connector === 'collapsed+') {
		p.moveTo(start, this.h/2);
		p.lineTo(end, this.h/2);
		if (end - start > 4) {
		    p.moveTo(mid - 2, (this.h/2) - 5);
		    p.lineTo(mid + 2, this.h/2);
		    p.lineTo(mid - 2, (this.h/2) + 5);
		}
	    } else if (this.connector === 'collapsed-') {
		p.moveTo(start, this.h/2);
		p.lineTo(end, this.h/2);
		if (end - start > 4) {
		    p.moveTo(mid + 2, (this.h/2) - 5);
		    p.lineTo(mid - 2, this.h/2);
		    p.lineTo(mid + 2, (this.h/2) + 5);
		}
	    } else {
		p.moveTo(start, this.h/2);
		p.lineTo(end, this.h/2);
	    }

	    var path = makeElementNS(
		NS_SVG, 'path',
		null,
		{d: p.toPathData(),
		 fill: 'none',
		 stroke: 'black',
		 strokeWidth: '1px'});
	    g.appendChild(path);
	}
    }

    return g;

    
}

GroupGlyph.prototype.min = function() {
    return this.coverage.min();
}

GroupGlyph.prototype.max = function() {
    return this.coverage.max();
}

GroupGlyph.prototype.height = function() {
    return this.h;
}


function LineGraphGlyph(points, color) {
    this.points = points;
    this.color = color;
}

LineGraphGlyph.prototype.min = function() {
    return this.points[0];
};

LineGraphGlyph.prototype.max = function() {
    return this.points[this.points.length - 2];
};

LineGraphGlyph.prototype.height = function() {
    return 50;
}

LineGraphGlyph.prototype.draw = function(g) {
    g.save();
    g.strokeStyle = this.color;
    g.lineWidth = 2;
    g.beginPath();
    for (var i = 0; i < this.points.length; i += 2) {
	var x = this.points[i];
	var y = this.points[i + 1];
	if (i == 0) {
	    g.moveTo(x, y);
	} else {
	    g.lineTo(x, y);
	}
    }
    g.stroke();
    g.restore();
}

LineGraphGlyph.prototype.toSVG = function() {
    var p = new SVGPath();
    for (var i = 0; i < this.points.length; i += 2) {
	var x = this.points[i];
	var y = this.points[i + 1];
	if (i == 0) {
	    p.moveTo(x, y);
	} else {
	    p.lineTo(x, y);
	}
    }
    
    return makeElementNS(
	NS_SVG, 'path',
	null,
	{d: p.toPathData(),
	 fill: 'none',
	 stroke: this.color,
	 strokeWidth: '2px'});
}

function LabelledGlyph(glyph, text) {
    this.glyph = glyph;
    this.text = text;
    this.textLen = GLOBAL_GC.measureText(text).width + 10;
    this.bump = glyph.bump;
}

LabelledGlyph.prototype.toSVG = function() {
    return makeElementNS(NS_SVG, 'g',
        [this.glyph.toSVG(),
         makeElementNS(NS_SVG, 'text', this.text, {x: this.glyph.min(), y: this.glyph.height() + 15})]);
}

LabelledGlyph.prototype.min = function() {
    return this.glyph.min();
}

LabelledGlyph.prototype.max = function() {
    return Math.max(this.glyph.max(), (1.0*this.glyph.min()) + this.textLen);
}

LabelledGlyph.prototype.height = function() {
    return this.glyph.height() + 20;
}

LabelledGlyph.prototype.draw = function(g) {
    this.glyph.draw(g);
    g.fillStyle = 'black';
    g.fillText(this.text, this.glyph.min(), this.glyph.height() + 15);
}



function CrossGlyph(x, height, stroke) {
    this._x = x;
    this._height = height;
    this._stroke = stroke;
}

CrossGlyph.prototype.draw = function(g) {
    var hh = this._height/2;
    
    g.beginPath();
    g.moveTo(this._x, 0);
    g.lineTo(this._x, this._height);
    g.moveTo(this._x - hh, hh);
    g.lineTo(this._x + hh, hh);

    g.strokeStyle = this._stroke;
    g.lineWidth = 1;

    g.stroke();
}

CrossGlyph.prototype.toSVG = function() {
    var hh = this._height/2;

    var g = new SVGPath();
    g.moveTo(this._x, 0);
    g.lineTo(this._x, this._height);
    g.moveTo(this._x - hh, hh);
    g.lineTo(this._x + hh, hh);
    
    return makeElementNS(
	NS_SVG, 'path',
	null,
	{d: g.toPathData(),
	 fill: 'none',
	 stroke: this._stroke,
	 strokeWidth: '1px'});
}

CrossGlyph.prototype.min = function() {
    return this._x - this._height/2;
}

CrossGlyph.prototype.max = function() {
    return this._x + this._height/2;
}

CrossGlyph.prototype.height = function() {
    return this._height;
}

function ExGlyph(x, height, stroke) {
    this._x = x;
    this._height = height;
    this._stroke = stroke;
}

ExGlyph.prototype.draw = function(g) {
    var hh = this._height/2;
    
    g.beginPath();
    g.moveTo(this._x - hh, 0);
    g.lineTo(this._x + hh, this._height);
    g.moveTo(this._x - hh, this._height);
    g.lineTo(this._x + hh, 0);

    g.strokeStyle = this._stroke;
    g.lineWidth = 1;

    g.stroke();
}

ExGlyph.prototype.toSVG = function() {
    var hh = this._height/2;

    var g = new SVGPath();
    g.moveTo(this._x - hh, 0);
    g.lineTo(this._x + hh, this._height);
    g.moveTo(this._x - hh, this._height);
    g.lineTo(this._x + hh, 0);
    
    return makeElementNS(
	NS_SVG, 'path',
	null,
	{d: g.toPathData(),
	 fill: 'none',
	 stroke: this._stroke,
	 strokeWidth: '1px'});
}

ExGlyph.prototype.min = function() {
    return this._x - this._height/2;
}

ExGlyph.prototype.max = function() {
    return this._x + this._height/2;
}

ExGlyph.prototype.height = function() {
    return this._height;
}

function TriangleGlyph(x, height, dir, width, stroke) {
    this._x = x;
    this._height = height;
    this._dir = dir;
    this._width = width;
    this._stroke = stroke;
}

TriangleGlyph.prototype.drawPath = function(g) {
    var hh = this._height/2;
    var hw = this._width/2;

    if (this._dir === 'S') {
	g.moveTo(this._x, this._height);
	g.lineTo(this._x - hw, 0);
	g.lineTo(this._x + hw, 0);
    } else if (this._dir === 'W') {
	g.moveTo(this._x + hw, hh);
	g.lineTo(this._x - hw, 0);
	g.lineTo(this._x - hw, this._height);
    } else if (this._dir === 'E') {
	g.moveTo(this._x - hw, hh);
	g.lineTo(this._x + hw, 0);
	g.lineTo(this._x + hw, this._height);
    } else {
	g.moveTo(this._x , 0);
	g.lineTo(this._x + hw, this._height);
	g.lineTo(this._x - hw, this._height);
    }

    g.closePath();
}

TriangleGlyph.prototype.draw = function(g) {
    g.beginPath();
    this.drawPath(g);
    g.fillStyle = this._stroke;
    g.fill();
}

TriangleGlyph.prototype.toSVG = function() {


    var g = new SVGPath();
    this.drawPath(g);
    
    return makeElementNS(
	NS_SVG, 'path',
	null,
	{d: g.toPathData(),
	 fill: this._stroke});
}

TriangleGlyph.prototype.min = function() {
    return this._x - this._height/2;
}

TriangleGlyph.prototype.max = function() {
    return this._x + this._height/2;
}

TriangleGlyph.prototype.height = function() {
    return this._height;
}




function DotGlyph(x, height, stroke) {
    this._x = x;
    this._height = height;
    this._stroke = stroke;
}

DotGlyph.prototype.draw = function(g) {
    var hh = this._height/2;
    g.fillStyle = this._stroke;
    g.beginPath();
    g.arc(this._x, hh, hh, 0, 6.29);
    g.fill();
}

DotGlyph.prototype.toSVG = function() {
    var hh = this._height/2;
    return makeElementNS(
	NS_SVG, 'circle',
	null,
	{cx: this._x, cy: hh, r: hh,
	 fill: this._stroke,
	 strokeWidth: '1px'});
}

DotGlyph.prototype.min = function() {
    return this._x - this._height/2;
}

DotGlyph.prototype.max = function() {
    return this._x + this._height/2;
}

DotGlyph.prototype.height = function() {
    return this._height;
}


function PaddedGlyph(glyph, minp, maxp) {
    this.glyph = glyph;
    this._min = minp;
    this._max = maxp;
    if (glyph) {
	this.bump = glyph.bump;
    }
}

PaddedGlyph.prototype.draw = function(g) {
    if (this.glyph) 
	this.glyph.draw(g);
}

PaddedGlyph.prototype.toSVG = function() {
    if (this.glyph) {
	return this.glyph.toSVG();
    } else {
	return makeElementNS(NS_SVG, 'g');
    }
}

PaddedGlyph.prototype.min = function() {
    return this._min;
}

PaddedGlyph.prototype.max = function() {
    return this._max;
}

PaddedGlyph.prototype.height = function() {
    if (this.glyph) {
	return this.glyph.height();
    } else {
	return 1;
    }
}


function AArrowGlyph(min, max, height, fill, stroke, ori) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._fill = fill;
    this._stroke = stroke;
    this._ori = ori;
}

AArrowGlyph.prototype.min = function() {
    return this._min;
}

AArrowGlyph.prototype.max = function() {
    return this._max;
}

AArrowGlyph.prototype.height = function() {
    return this._height;
}

AArrowGlyph.prototype.makePath = function(g) {
    var maxPos = this._max;
    var minPos = this._min;
    var height = this._height;
    var lInset = 0;
    var rInset = 0;
    var minLength = this._height + 2;
    var instep = 0.333333 * this._height;
    var y = 0;

    if (this._ori) {
	if (this._ori === '+') {
	    rInset = 0.5 * this._height;
	} else if (this._ori === '-') {
	    lInset = 0.5 * this._height;
	}
    }

    if (maxPos - minPos < minLength) {
        minPos = (maxPos + minPos - minLength) / 2;
        maxPos = minPos + minLength;
    }

    g.moveTo(minPos + lInset, y+instep);
    g.lineTo(maxPos - rInset, y+instep);
    g.lineTo(maxPos - rInset, y);
    g.lineTo(maxPos, y + this._height/2);
    g.lineTo(maxPos - rInset, y+height);
    g.lineTo(maxPos - rInset, y+instep+instep);
    g.lineTo(minPos + lInset, y+instep+instep);
    g.lineTo(minPos + lInset, y+height);
    g.lineTo(minPos, y+height/2);
    g.lineTo(minPos + lInset, y);
    g.lineTo(minPos + lInset, y+instep);
}

AArrowGlyph.prototype.draw = function(g) {
    g.beginPath();
    this.makePath(g);

    if (this._fill) {
	g.fillStyle = this._fill;
	g.fill();
    } 
    if (this._stroke) {
	g.strokeStyle = this._stroke;
	g.stroke();
    }
}

AArrowGlyph.prototype.toSVG = function() {
    var g = new SVGPath();
    this.makePath(g);
    
    return makeElementNS(
	NS_SVG, 'path',
	null,
	{d: g.toPathData(),
	 fill: this._fill || 'none',
	 stroke: this._stroke || 'none'});
}

function SpanGlyph(min, max, height, stroke) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._stroke = stroke;
}

SpanGlyph.prototype.min = function() {return this._min};
SpanGlyph.prototype.max = function() {return this._max};
SpanGlyph.prototype.height = function() {return this._height};


SpanGlyph.prototype.drawPath = function(g) {
    var minPos = this._min, maxPos = this._max;
    var height = this._height, hh = height/2;
    g.moveTo(minPos, hh);
    g.lineTo(maxPos, hh);
    g.moveTo(minPos, 0);
    g.lineTo(minPos, height);
    g.moveTo(maxPos, 0);
    g.lineTo(maxPos, height);
}


SpanGlyph.prototype.draw = function(g) {
    g.beginPath();
    this.drawPath(g);
    g.strokeStyle = this._stroke;
    g.stroke();
}

SpanGlyph.prototype.toSVG = function() {
    var g = new SVGPath();
    this.drawPath(g);
    
    return makeElementNS(
	NS_SVG, 'path',
	null,
	{d: g.toPathData(),
	 stroke: this._stroke || 'none'});
}




function LineGlyph(min, max, height, style, strand, stroke) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._style = style;
    this._strand = strand;
    this._stroke = stroke;
}

LineGlyph.prototype.min = function() {return this._min};
LineGlyph.prototype.max = function() {return this._max};
LineGlyph.prototype.height = function() {return this._height};

LineGlyph.prototype.drawPath = function(g) {
    var minPos = this._min, maxPos = this._max;
    var height = this._height, hh = height/2;

    if (this._style === 'hat') {
	g.moveTo(minPos, hh);
	g.lineTo((minPos + maxPos)/2, this._strand === '-' ? height : 0);
	g.lineTo(maxPos, hh);
    } else {
	g.moveTo(minPos, hh);
	g.lineTo(maxPos, hh);
    }
}


LineGlyph.prototype.draw = function(g) {
    g.beginPath();
    this.drawPath(g);
    g.strokeStyle = this._stroke;
    if (this._style === 'dashed' && g.setLineDash) {
	g.save();
	g.setLineDash([3]);
	g.stroke();
	g.restore();
    } else {
	g.stroke();
    }
}

LineGlyph.prototype.toSVG = function() {
    var g = new SVGPath();
    this.drawPath(g);
    
    var opts = {d: g.toPathData(),
	    stroke: this._stroke || 'none'};
    if (this._style === 'dashed') {
	opts['strokeDasharray'] = '3';
    }

    return makeElementNS(
	NS_SVG, 'path',
	null, opts
    );
}





function PrimersGlyph(min, max, height, fill, stroke) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._fill = fill;
    this._stroke = stroke;
}

PrimersGlyph.prototype.min = function() {return this._min};
PrimersGlyph.prototype.max = function() {return this._max};
PrimersGlyph.prototype.height = function() {return this._height};


PrimersGlyph.prototype.drawStemPath = function(g) {
    var minPos = this._min, maxPos = this._max;
    var height = this._height, hh = height/2;
    g.moveTo(minPos, hh);
    g.lineTo(maxPos, hh);
}

PrimersGlyph.prototype.drawTrigsPath = function(g) {
    var minPos = this._min, maxPos = this._max;
    var height = this._height, hh = height/2;
    g.moveTo(minPos, 0);
    g.lineTo(minPos + height, hh);
    g.lineTo(minPos, height);
    g.lineTo(minPos, 0);
    g.moveTo(maxPos, 0);
    g.lineTo(maxPos - height, hh);
    g.lineTo(maxPos, height);
    g.lineTo(maxPos, 0);
}


PrimersGlyph.prototype.draw = function(g) {
    g.beginPath();
    this.drawStemPath(g);
    g.strokeStyle = this._stroke;
    g.stroke();
    g.beginPath();
    this.drawTrigsPath(g);
    g.fillStyle = this._fill;
    g.fill();
}

PrimersGlyph.prototype.toSVG = function() {
    var s = new SVGPath();
    this.drawStemPath(s);
    var t = new SVGPath();
    this.drawTrigsPath(t);
    
    return makeElementNS(
	NS_SVG, 'g',
	[makeElementNS(
	    NS_SVG, 'path',
	    null,
	    {d: s.toPathData(),
	     stroke: this._stroke || 'none'}),
	 makeElementNS(
	     NS_SVG, 'path',
	     null,
	     {d: t.toPathData(),
	      fill: this._fill || 'none'})]);
}

function ArrowGlyph(min, max, height, color, parallel, sw, ne) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._color = color;
    this._parallel = parallel;
    this._sw = sw;
    this._ne = ne;
}

ArrowGlyph.prototype.min = function() {return this._min};
ArrowGlyph.prototype.max = function() {return this._max};
ArrowGlyph.prototype.height = function() {return this._height};

ArrowGlyph.prototype.drawPath = function(g) {
    var min = this._min, max = this._max, height = this._height;
    
    if (this._parallel) {
	var hh = height/2;
	var instep = 0.4 * height;
	if (this._sw) {
	    g.moveTo(min + hh, height-instep);
	    g.lineTo(min + hh, height);
	    g.lineTo(min, hh);
	    g.lineTo(min + hh, 0);
	    g.lineTo(min + hh, instep);
	} else {
	    g.moveTo(min, height-instep);
	    g.lineTo(min, instep);
	}
	if (this._ne) {
	    g.lineTo(max - hh, instep);
	    g.lineTo(max - hh, 0);
	    g.lineTo(max, hh);
	    g.lineTo(max - hh, height);
	    g.lineTo(max - hh, height - instep);
	} else {
	    g.lineTo(max, instep);
	    g.lineTo(max, height-instep);
	}
	g.closePath();
    } else {
	var mid = (min+max)/2;
	var instep = 0.4*(max-min);
	var th = height/3;

	if (this._ne) {
	    g.moveTo(min + instep, th);
	    g.lineTo(min, th);
	    g.lineTo(mid, 0);
	    g.lineTo(max, th);
	    g.lineTo(max - instep, th);
	} else {
	    g.moveTo(min+instep, 0);
	    g.lineTo(max-instep, 0);
	}
	if (this._sw) {
	    g.lineTo(max - instep, height-th);
	    g.lineTo(max, height-th);
	    g.lineTo(mid, height);
	    g.lineTo(min, height-th)
	    g.lineTo(min + instep, height-th);
	} else {
	    g.lineTo(max - instep, height);
	    g.lineTo(min + instep, height);
	}
	g.closePath();
    }
}

ArrowGlyph.prototype.draw = function(g) {
    g.beginPath();
    this.drawPath(g);
    g.fillStyle = this._color;
    g.fill();
}

ArrowGlyph.prototype.toSVG = function() {
    var g = new SVGPath();
    this.drawPath(g);
    
    return makeElementNS(
	NS_SVG, 'path',
	null,
	{d: g.toPathData(),
	 fill: this._color});
}
