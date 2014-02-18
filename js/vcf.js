/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// vcf.js
//

function VCFParser() {}

VCFParser.prototype.createSession = function(sink) {
    return new VCFParseSession(this, sink);
}

function VCFParseSession(parser, sink) {
    this.parser = parser;
    this.sink  = sink;
}

VCFParseSession.prototype.parse = function(line) {
    var toks = line.split('\t');
    var f = new DASFeature();
    f.segment = toks[0];
    f.id = toks[2]
    f.refAllele = toks[3];
    f.altAlleles = toks[4].split(',');
    f.min = parseInt(toks[1]);
    f.max = f.min + f.refAllele.length - 1;

    var alt = f.altAlleles[0];
    var ref = f.refAllele;
    if (alt.length > ref.length) {
        f.type = "insertion";
        if (alt.indexOf(ref) == 0) {
            f.insertion = alt.substr(ref.length);
            f.min += ref.length;
            f.max = f.min - 1; // Effectively "between" bases.
        } else {
            f.insertion = alt;
        }
    } else if (alt.length < ref.length) {
        f.type = "deletion";
    } else {
        f.type = 'substitution';
    }

    this.sink(f);
}

VCFParseSession.prototype.flush = function() {};

VCFParser.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();

    {
        var varStyle = new DASStyle();
        varStyle.glyph = '__INSERTION';
        varStyle.BUMP = 'yes';
        varStyle.LABEL = 'no';
        varStyle.FGCOLOR = 'rgb(50,80,255)';
        varStyle.BGCOLOR = '#888888';
        varStyle.STROKECOLOR = 'black';
        stylesheet.pushStyle({type: 'insertion'}, null, varStyle);
    }
    {
        var varStyle = new DASStyle();
        varStyle.glyph = 'PLIMSOLL';
        varStyle.BUMP = 'yes';
        varStyle.LABEL = 'no';
        varStyle.FGCOLOR = 'rgb(255, 60, 60)';
        varStyle.BGCOLOR = '#888888';
        varStyle.STROKECOLOR = 'black';
        stylesheet.pushStyle({type: 'deletion'}, null, varStyle);
    }
    {
        var varStyle = new DASStyle();
        varStyle.glyph = 'PLIMSOLL';
        varStyle.BUMP = 'yes';
        varStyle.LABEL = 'no';
        varStyle.FGCOLOR = 'rgb(50,80,255)';
        varStyle.BGCOLOR = '#888888';
        varStyle.STROKECOLOR = 'black';
        stylesheet.pushStyle({type: 'default'}, null, varStyle);
    }

    return callback(stylesheet);
}

VCFParser.prototype.getDefaultFIPs = function(callback) {
    var fip = function(feature, featureInfo) {
        featureInfo.add("Ref. allele", feature.refAllele);
        featureInfo.add("Alt. alleles", feature.altAlleles.join(','));
    };
    callback(fip);
}

dalliance_registerParserFactory('vcf', function() {return new VCFParser()});