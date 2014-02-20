/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// bedwig.js
//

function BedWigParser(type) {
    this.type = type;
}

BedWigParser.prototype.createSession = function(sink) {
    if (this.type == 'wig')
        return new WigParseSession(this, sink);
    else
        return new BedParseSession(this, sink);
}

var __KV_REGEXP=/([^=]+)=(.+)/;
var __SPACE_REGEXP=/\s/;


function BedParseSession(parser, sink) {
    this.parser = parser;
    this.sink = sink;
}

BedParseSession.prototype.parse = function(line) {
    var toks = line.split(__SPACE_REGEXP);
    if (toks.length < 3)
        return;

    var f = {segment: toks[0], 
             min: parseInt(toks[1]) + 1, 
             max: parseInt(toks[2]),
             type: 'bigwig'};

    if (toks.length > 3 && toks[3] !== '.') {
        f.label = toks[3];
    }

    if (toks.length > 4) {
        f.score = parseFloat(toks[4])
    }

    if (toks.length > 5) {
        f.orientation = toks[5];
    }

    if (toks.length > 8) {
        var color = toks[8];
        if (BED_COLOR_REGEXP.test(color)) {
            f.itemRgb = 'rgb(' + color + ')';
        }
    }

    this.sink(f);
}

BedParseSession.prototype.flush = function() {};

function WigParseSession(parser, sink) {
    this.parser = parser;
    this.sink = sink;
    this.wigState = null;
}

WigParseSession.prototype.parse = function(line) {
    var toks = line.split(__SPACE_REGEXP);

    if (toks[0] == 'fixedStep') {
        this.wigState = 'fixedStep';
        this.chr = this.pos = this.step = null;
        this.span = 1;

        for (var ti = 1; ti < toks.length; ++ti) {
            var m = __KV_REGEXP.exec(toks[ti]);
            if (m) {
                if (m[1] == 'chrom') {
                    this.chr = m[2];
                } else if (m[1] == 'start') {
                    this.pos = parseInt(m[2]);
                } else if (m[1] == 'step') {
                    this.step = parseInt(m[2]);
                } else if (m[1] == 'span') {
                    this.span = parseInt(m[2]);
                }
            }
        }
    } else if (toks[0] == 'variableStep') {
        this.wigState = 'variableStep';
        this.chr = null;
        this.span = 1;

        for (var ti = 1; ti < toks.length; ++ti) {
            var m = __KV_REGEXP.exec(toks[ti]);
            if (m[1] == 'chrom') {
                this.chr = m[2];
            } else if (m[1] == 'span') {
                this.span = parseInt(m[2]);
            }
        }
    } else {
        if (!this.wigState) {
            if (toks.length < 4)
                return;

            var f = {segment: toks[0], 
                     min: parseInt(toks[1]) + 1, 
                     max: parseInt(toks[2]),
                     score: parseFloat(toks[3])};

            this.sink(f);
        } else if (this.wigState == 'fixedStep') {
            if (toks.length != 1)
                return;
            var score = parseFloat(toks[0]);
            var f = {segment: this.chr, min: this.pos, max: this.pos + this.span - 1, score: score};
            this.pos += this.step;
            this.sink(f);
        } else if (this.wigState == 'variableStep') {
            if (toks.length != 2)
                return;
            var pos = parseInt(toks[0]);
            var score = parseFloat(toks[1]);
            var f = {segment: this.chr, min: pos, max: pos + this.span - 1, score: score};
            this.sink(f);
        }
    }
}

WigParseSession.prototype.flush = function() {};

BedWigParser.prototype.getStyleSheet = function(callback) {
    var thisB = this;
    var stylesheet = new DASStylesheet();

    if (this.type == 'wig') {
        var wigStyle = new DASStyle();
        wigStyle.glyph = 'HISTOGRAM';
        wigStyle.BGCOLOR = 'blue';
        wigStyle.HEIGHT=30;
        stylesheet.pushStyle({type: 'default'}, null, wigStyle);
    } else {
        var wigStyle = new DASStyle();
        wigStyle.glyph = 'BOX';
        wigStyle.FGCOLOR = 'black';
        wigStyle.BGCOLOR = 'blue'
        wigStyle.HEIGHT = 8;
        wigStyle.BUMP = true;
        wigStyle.LABEL = true;
        wigStyle.ZINDEX = 20;
        stylesheet.pushStyle({type: 'default'}, null, wigStyle);

        var wigStyle = new DASStyle();
        wigStyle.glyph = 'BOX';
        wigStyle.FGCOLOR = 'black';
        wigStyle.BGCOLOR = 'red'
        wigStyle.HEIGHT = 10;
        wigStyle.BUMP = true;
        wigStyle.ZINDEX = 20;
        stylesheet.pushStyle({type: 'bb-translation'}, null, wigStyle);
                
        var tsStyle = new DASStyle();
        tsStyle.glyph = 'BOX';
        tsStyle.FGCOLOR = 'black';
        tsStyle.BGCOLOR = 'white';
        tsStyle.HEIGHT = 10;
        tsStyle.ZINDEX = 10;
        tsStyle.BUMP = true;
        tsStyle.LABEL = true;
        stylesheet.pushStyle({type: 'bb-transcript'}, null, tsStyle);

        var densStyle = new DASStyle();
        densStyle.glyph = 'HISTOGRAM';
        densStyle.COLOR1 = 'white';
        densStyle.COLOR2 = 'black';
        densStyle.HEIGHT=30;
        stylesheet.pushStyle({type: 'density'}, null, densStyle);
    }

    return callback(stylesheet);
}

dalliance_registerParserFactory('bed', function(t) {return new BedWigParser(t)});
dalliance_registerParserFactory('wig', function(t) {return new BedWigParser(t)});