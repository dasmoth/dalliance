// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// glyphs.js: components which know how to draw themselves
//

function BoxGlyph(x, y, width, height, fill, stroke, alpha, radius) {
    this.x = x;
    this.y = y;
    this._width = width;
    this._height = height;
    this.fill = fill;
    this.stroke = stroke;
    this._alpha = alpha;
    this._radius = radius || 0;
}

BoxGlyph.prototype.draw = function(g) {
    var r = this._radius;

    g.beginPath();

    if (r > 0) {
        g.moveTo(this.x + r, this.y);
        g.lineTo(this.x + this._width - r, this.y);
        g.arcTo(this.x + this._width, this.y, this.x + this._width, this.y + r, r);
        g.lineTo(this.x + this._width, this.y + this._height - r);
        g.arcTo(this.x + this._width, this.y + this._height, this.x + this._width - r, this.y + this._height, r);
        g.lineTo(this.x + r, this.y + this._height);
        g.arcTo(this.x, this.y + this._height, this.x, this.y + this._height - r, r);
        g.lineTo(this.x, this.y + r);
        g.arcTo(this.x, this.y, this.x + r, this.y, r);
    } else {
        g.lineJoin = 'miter';
        g.lineCap = 'square';
        g.moveTo(this.x, this.y);
        g.lineTo(this.x + this._width, this.y);
        g.lineTo(this.x + this._width, this.y + this._height);
        g.lineTo(this.x, this.y + this._height);
        g.lineTo(this.x, this.y);
    }

    g.closePath();

    if (this._alpha != null) {
        g.save();
        g.globalAlpha = this._alpha;
    }
    
    if (this.fill) {
        g.fillStyle = this.fill;
        g.fill();
    }
    if (this.stroke) {
        g.strokeStyle = this.stroke;
        g.lineWidth = 0.5;
        g.stroke();
    }

    if (this._alpha != null) {
        g.restore();
    }
}

BoxGlyph.prototype.toSVG = function() {
    var s = makeElementNS(NS_SVG, 'rect', null,
                         {x: this.x, 
                          y: this.y, 
                          width: this._width, 
                          height: this._height,
                          stroke: this.stroke || 'none',
                          strokeWidth: 0.5,
                          fill: this.fill || 'none'});
    if (this._alpha != null) {
        s.setAttribute('opacity', this._alpha);
    }

    return s;
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
                 strokeWidth: 0.5});
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


function LineGraphGlyph(points, color, height) {
    this.points = points;
    this.color = color;
    this._height = height || 50;
}

LineGraphGlyph.prototype.min = function() {
    return this.points[0];
};

LineGraphGlyph.prototype.max = function() {
    return this.points[this.points.length - 2];
};

LineGraphGlyph.prototype.height = function() {
    return this._height;
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

function LabelledGlyph(glyph, text, unmeasured, anchor, align, font) {
    this.glyph = glyph;
    this.text = text;
    this.anchor = anchor || 'left';
    this.align = align || 'below';
    if (font) {
        this.font = font;
    }
    if (this.font) {
        GLOBAL_GC.save();
        GLOBAL_GC.font = this.font;
    }
    var metrics = GLOBAL_GC.measureText(text);
    if (this.font) {
        GLOBAL_GC.restore();
    }
    this.textLen = metrics.width;
    this.textHeight = 5;
    this.bump = glyph.bump;
    this.measured = !unmeasured;
}

LabelledGlyph.prototype.toSVG = function() {
    var child = this.glyph.toSVG();
    var opts = {};
    
    if (this.align == 'above') {
        child = makeElementNS(NS_SVG, 'g', child, {transform: "translate(0, " + (this.textHeight|0 + 2) + ")"});
        opts.y = this.textHeight;
    } else {
        opts.y = this.glyph.height() + 15;
    }

    if (this.font) {
        opts.fontSize  = 7;
    }

    if ('center' == this.anchor) {
        opts.x = (this.glyph.min() + this.glyph.max() - this.textLen) / 2;
    } else {
        opts.x = this.glyph.min();
    }

    return makeElementNS(NS_SVG, 'g',
        [child,
         makeElementNS(NS_SVG, 'text', this.text, opts)]);
}

LabelledGlyph.prototype.min = function() {
    return this.glyph.min();
}

LabelledGlyph.prototype.max = function() {
    if (this.measured)
        return Math.max(this.glyph.max(), (1.0*this.glyph.min()) + this.textLen + 10);
    else
        return this.glyph.max();
}

LabelledGlyph.prototype.height = function() {
    var h = this.glyph.height();
    if (this.measured) {
        if (this.align == 'above') {
            h += this.textHeight + 2;
        } else {
            h += 20;
        }
    }
    return h;
}

LabelledGlyph.prototype.draw = function(g) {
    if (this.align == 'above') {
        g.save();
        g.translate(0, this.textHeight + 2);
    }
    this.glyph.draw(g);
    if (this.align == 'above') {
        g.restore();
    }

    g.fillStyle = 'black';
    if (this.font) {
        g.save();
        g.font = this.font;
    }
    var p;
    if ('center' == this.anchor) {
        p = (this.glyph.min() + this.glyph.max() - this.textLen) / 2;
    } else {
        p = this.glyph.min();
    }
    g.fillText(this.text, p, this.align == 'above' ? this.textHeight : this.glyph.height() + 15);
    if (this.font) {
        g.restore();
    }
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

function PathGlyphBase(stroke, fill) {
    this._stroke = stroke;
    this._fill = fill;
}

PathGlyphBase.prototype.draw = function(g) {
    g.beginPath();
    this.drawPath(g);

    if (this._fill) {
        g.fillStyle = this._fill;
        g.fill();
    }
    if (this._stroke) {
        g.strokeStyle = this._stroke;
        g.stroke();
    }
}

PathGlyphBase.prototype.toSVG = function() {
    var g = new SVGPath();
    this.drawPath(g);
    
    return makeElementNS(
        NS_SVG, 'path',
        null,
        {d: g.toPathData(),
         fill: this._fill || 'none',
         stroke: this._stroke || 'none'});
}

PathGlyphBase.prototype.drawPath = function(g) {
    throw 'drawPath method on PathGlyphBase must be overridden';
}

function TriangleGlyph(x, height, dir, width, fill, stroke) {
    PathGlyphBase.call(this, stroke, fill);

    this._x = x;
    this._height = height;
    this._dir = dir;
    this._width = width;
}

TriangleGlyph.prototype = Object.create(PathGlyphBase.prototype);

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

TriangleGlyph.prototype.min = function() {
    return this._x - this._height/2;
}

TriangleGlyph.prototype.max = function() {
    return this._x + this._height/2;
}

TriangleGlyph.prototype.height = function() {
    return this._height;
}




function DotGlyph(x, height, fill, stroke) {
    this._x = x;
    this._height = height;
    this._fill = fill;
    this._stroke = stroke;
}

DotGlyph.prototype.draw = function(g) {
    var hh = this._height/2;
    g.fillStyle = this._stroke;
    g.beginPath();
    g.arc(this._x, hh, hh, 0, 6.29);

    if (this._fill) {
        g.fillStyle = this._fill;
        g.fill();
    }

    if (this._stroke) {
        g.strokeStyle = this._stroke;
        g.stroke();
    }
}

DotGlyph.prototype.toSVG = function() {
    var hh = this._height/2;
    return makeElementNS(
        NS_SVG, 'circle',
        null,
        {cx: this._x, cy: hh, r: hh,
         fill: this._fill || 'none',
         stroke: this._stroke || 'none',
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
    PathGlyphBase.call(this, stroke, fill);
    this._min = min;
    this._max = max;
    this._height = height;
    this._ori = ori;
}

AArrowGlyph.prototype = Object.create(PathGlyphBase.prototype);

AArrowGlyph.prototype.min = function() {
    return this._min;
}

AArrowGlyph.prototype.max = function() {
    return this._max;
}

AArrowGlyph.prototype.height = function() {
    return this._height;
}

AArrowGlyph.prototype.drawPath = function(g) {
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

function SpanGlyph(min, max, height, stroke) {
    PathGlyphBase.call(this, stroke, null);
    this._min = min;
    this._max = max;
    this._height = height;
}

SpanGlyph.prototype = Object.create(PathGlyphBase.prototype);

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
    PathGlyphBase.call(this, null, color);
    this._min = min;
    this._max = max;
    this._height = height;
    this._color = color;
    this._parallel = parallel;
    this._sw = sw;
    this._ne = ne;
}

ArrowGlyph.prototype = Object.create(PathGlyphBase.prototype);

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


function TooManyGlyph(min, max, height, fill, stroke) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._fill = fill;
    this._stroke = stroke;
}

TooManyGlyph.prototype.min = function() {return this._min};
TooManyGlyph.prototype.max = function() {return this._max};
TooManyGlyph.prototype.height = function() {return this._height};

TooManyGlyph.prototype.toSVG = function() {
    return makeElementNS(NS_SVG, 'rect', null,
                         {x: this._min, 
                          y: 0, 
                          width: this._max - this._min, 
                          height: this._height,
                          stroke: this._stroke || 'none',
                          fill: this._fill || 'none'});
}

TooManyGlyph.prototype.draw = function(g) {
    if (this._fill) {
        g.fillStyle = this._fill;
        g.fillRect(this._min, 0, this._max - this._min, this._height);
    }
    if (this._stroke) {
        g.strokeStyle = this._stroke;
        g.strokeRect(this._min, 0, this._max - this._min, this._height);
        g.beginPath();
        for (var n = 2; n < this._height; n += 3) {
            g.moveTo(this._min, n);
            g.lineTo(this._max, n);
        }
        g.stroke();
    }
}

function TextGlyph(min, max, height, fill, string) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._fill = fill;
    this._string = string;
    this._textLen = GLOBAL_GC.measureText(string).width;
}

TextGlyph.prototype.min = function() {return this._min};
TextGlyph.prototype.max = function() {return Math.max(this._max, this._min + this._textLen)};
TextGlyph.prototype.height = function() {return this._height};

TextGlyph.prototype.draw = function(g) {
    g.fillStyle = this._fill;
    g.fillText(this._string, this._min, this._height - 4);
}

TextGlyph.prototype.toSVG = function() {
    return makeElementNS(NS_SVG, 'text', this._string, {x: this._min, y: this._height - 4});
}



function SequenceGlyph(min, max, height, seq, ref, scheme, quals) {
    this._min = min;
    this._max = max;
    this._height = height;
    this._seq = seq;
    this._ref = ref;
    this._scheme = scheme;
    this._quals = quals;
}

SequenceGlyph.prototype.min = function() {return this._min};
SequenceGlyph.prototype.max = function() {return this._max};
SequenceGlyph.prototype.height = function() {return this._height};


SequenceGlyph.prototype.alphaForQual = function(qual) {
    return 0.1 + 0.9*Math.max(0.0, Math.min((1.0 * qual) / 30.0, 1.0));
}

SequenceGlyph.prototype.draw = function(gc) {
    var seq = this._seq;
    var scale = (this._max - this._min + 1) / this._seq.length;

    for (var p = 0; p < seq.length; ++p) {
        var base = seq.substr(p, 1).toUpperCase();
        var color = baseColors[base];
        if (!color) {
            color = 'gray';
        }

        if (this._scheme === 'mismatch' && this._ref) {
            var refbase = this._ref.substr(p, 1).toUpperCase();
            if (refbase === 'N') {
                color = 'gray';
            } else if (refbase === base) {
                color = 'black';
            } else {
                color = 'red';
            }
        }

        gc.fillStyle = color;

        if (this._quals) {
            var qc = this._quals.charCodeAt(p) - 33;
            gc.save();
            gc.globalAlpha = this.alphaForQual(qc);
        }

        if (scale >= 8) {
            gc.fillText(base, this._min + p*scale, 8);
        } else {
            gc.fillRect(this._min + p*scale, 0, scale, this._height);
        }

        if (this._quals) {
            gc.restore();
        }
    }
}

SequenceGlyph.prototype.toSVG = function() {
    var seq = this._seq;
    var scale = (this._max - this._min + 1) / this._seq.length;
    var  g = makeElementNS(NS_SVG, 'g'); 

    for (var p = 0; p < seq.length; ++p) {
        var base = seq.substr(p, 1).toUpperCase();
        var color = baseColors[base];
        if (!color) {
            color = 'gray';
        }

        if (this._scheme === 'mismatch' && this._ref) {
            var refbase = this._ref.substr(p, 1).toUpperCase();
            if (refbase === 'N') {
                color = 'gray';
            } else if (refbase === base) {
                color = 'black';
            } else {
                color = 'red';
            }
        }

        var alpha = 1.0;
        if (this._quals) {
            var qc = this._quals.charCodeAt(p) - 33;
            alpha = this.alphaForQual(qc);
        }

        if (scale >= 8) {
            g.appendChild(
                    makeElementNS(NS_SVG, 'text', base, {
                        x: this._min + p*scale,
                        y: 8,
                        fill: color,
                        fillOpacity: alpha}));
        } else {
            g.appendChild(
                    makeElementNS(NS_SVG, 'rect', null, {
                        x:this._min + p*scale,
                        y: 0,
                        width: scale,
                        height: this._height,
                        fill: color,
                        fillOpacity: alpha}));

        }
    }

    return g;
}


function TranslatedGlyph(glyph, x, y, height) {
    this.glyph = glyph;
    this._height = height;
    this._x = x;
    this._y = y;
}

TranslatedGlyph.prototype.height = function() {
    if (this._height) {
        return this._height;
    } else {
        return this.glyph.height() + this._y;
    }
}

TranslatedGlyph.prototype.min = function() {
    return this.glyph.min() + this._x;
}

TranslatedGlyph.prototype.max = function() {
    return this.glyph.max() + this._x;
}

TranslatedGlyph.prototype.minY = function() {
    return this._y;
}

TranslatedGlyph.prototype.maxY = function() {
    return this._y + this.glyph.height();
}

TranslatedGlyph.prototype.draw = function(g) {
    g.save();
    g.translate(this._x, this._y);
    this.glyph.draw(g);
    g.restore();
}

TranslatedGlyph.prototype.toSVG = function() {
    var s =  this.glyph.toSVG();
    s.setAttribute('transform', 'translate(' + this._x + ',' + this._y + ')');
    return s;
}

function PointGlyph(x, y, height, fill) {
    this._x = x;
    this._y = y;
    this._height = height;
    this._fill = fill;
}

PointGlyph.prototype.min = function() {
    return this._x - 2;
}

PointGlyph.prototype.max = function() {
    return this._x + 2;
}

PointGlyph.prototype.height = function() {
    return this._height;
}

PointGlyph.prototype.draw = function(g) {
    g.save();
    g.globalAlpha = 0.3;
    g.fillStyle = this._fill;
    g.beginPath();
    g.arc(this._x, this._y, 1.5, 0, 6.29);
    g.fill();
    g.restore();
}

PointGlyph.prototype.toSVG = function() {
    return makeElementNS(
        NS_SVG, 'circle',
        null,
        {cx: this._x, cy: this._y, r: 2,
         fill: this._fill,
         stroke: 'none'});
}


function GridGlyph(height) {
    this._height = height || 50;
}

GridGlyph.prototype.notSelectable = true;

GridGlyph.prototype.min = function() {
    return -100000;
};

GridGlyph.prototype.max = function() {
    return 100000;
};

GridGlyph.prototype.height = function() {
    return this._height;
}

GridGlyph.prototype.draw = function(g) {
    g.save();
    g.strokeStyle = 'black'
    g.lineWidth = 0.1;

    g.beginPath();
    for (var y = 0; y <= this._height; y += 10) {
        g.moveTo(-5000, y);
        g.lineTo(5000, y);
    }
    g.stroke();
    g.restore();
}

GridGlyph.prototype.toSVG = function() {
    var p = new SVGPath();
    for (var y = 0; y <= this._height; y += 10) {
        p.moveTo(-5000, y);
        p.lineTo(5000, y);
    }
    
    return makeElementNS(
        NS_SVG, 'path',
        null,
        {d: p.toPathData(),
         fill: 'none',
         stroke: 'black',
         strokeWidth: '0.1px'});
}

function StarGlyph(x, r, points, fill, stroke) {
    PathGlyphBase.call(this, stroke, fill);
    this._x = x;
    this._r = r;
    this._points = points;
}

StarGlyph.prototype = Object.create(PathGlyphBase.prototype);

StarGlyph.prototype.min = function() {
    return this._x - this._r;
}

StarGlyph.prototype.max = function() {
    return this._x + this._r;
}

StarGlyph.prototype.height = function() {
    return 2 * this._r;
}

StarGlyph.prototype.drawPath = function(g) {
    var midX = this._x, midY = this._r, r = this._r;
    for (var p = 0; p < this._points; ++p) {
        var theta = (p * 6.28) / this._points;
        var px = midX + r*Math.sin(theta);
        var py = midY - r*Math.cos(theta);
        if (p == 0) {
            g.moveTo(px, py);
        } else {
            g.lineTo(px, py);
        }
        theta = ((p+0.5) * 6.28) / this._points;
        px = midX + 0.4*r*Math.sin(theta);
        py = midY - 0.4*r*Math.cos(theta);
        g.lineTo(px, py);
    }
    g.closePath();
}

function PlimsollGlyph(x, height, overhang, fill, stroke) {
    this._x = x;
    this._height = height;
    this._overhang = overhang;
    this._fill = fill;
    this._stroke = stroke;
}

PlimsollGlyph.prototype.draw = function(g) {
    var hh = this._height/2;
    g.fillStyle = this._stroke;
    g.beginPath();
    g.arc(this._x, hh, hh - this._overhang, 0, 6.29);
    g.moveTo(this._x, 0);
    g.lineTo(this._x, this._height);

    if (this._fill) {
        g.fillStyle = this._fill;
        g.fill();
    }

    if (this._stroke) {
        g.strokeStyle = this._stroke;
        g.stroke();
    }
}

PlimsollGlyph.prototype.toSVG = function() {
    var hh = this._height/2;
    return makeElementNS(NS_SVG, 'g', 
        [makeElementNS(NS_SVG, 'circle', null, {cx: this._x, cy: hh, r: hh - this._overhang}),
         makeElementNS(NS_SVG, 'line', null, {x1: this._x, y1: 0, x2: this._x, y2: this._height})],
        {fill: this._fill || 'none',
         stroke: this._stroke || 'none',
         strokeWidth: '1px'});
}

PlimsollGlyph.prototype.min = function() {
    return this._x - this._height/2;
}

PlimsollGlyph.prototype.max = function() {
    return this._x + this._height/2;
}

PlimsollGlyph.prototype.height = function() {
    return this._height;
}

