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

BedWigParser.prototype.parse = function(line) {
    var toks = line.split('\t');
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
    return f;
}

BedWigParser.prototype.getStyleSheet = function(callback) {
    var thisB = this;

    var stylesheet = new DASStylesheet();
    var wigStyle = new DASStyle();
    wigStyle.glyph = 'BOX';
    wigStyle.FGCOLOR = 'black';
    wigStyle.BGCOLOR = 'blue'
    wigStyle.HEIGHT = 8;
    wigStyle.BUMP = true;
    wigStyle.LABEL = true;
    wigStyle.ZINDEX = 20;
    stylesheet.pushStyle({type: 'bigwig'}, null, wigStyle);

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

    return callback(stylesheet);
}

dalliance_registerParserFactory('bed', function(t) {return new BedWigParser(t)});