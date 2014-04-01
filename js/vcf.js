/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// vcf.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var sa = require('./sourceadapters');
    var dalliance_registerParserFactory = sa.registerParserFactory;

    var das = require('./das');
    var DASStylesheet = das.DASStylesheet;
    var DASStyle = das.DASStyle;
    var DASFeature = das.DASFeature;
    var DASGroup = das.DASGroup;
}

function VCFParser() {
    this.info = [];
}

var VCF_INFO_RE = /([^;=]+)(=([^;]+))?;?/;
var VCF_INFO_HEADER = /##INFO=<([^>]+)>/;
var VCF_INFO_HEADER_TOK = /([^,=]+)=([^,]+|"[^"]+"),?/

VCFParser.prototype.createSession = function(sink) {
    return new VCFParseSession(this, sink);
}

function VCFParseSession(parser, sink) {
    this.parser = parser;
    this.sink  = sink;
}

VCFParseSession.prototype.parse = function(line) {
    if (line.length == 0)
        return;
    if (line[0] == '#') {
        if (line.length > 1 && line[1] == '#') {
            var m = VCF_INFO_HEADER.exec(line);
            if (m) {
                var toks = m[1].split(VCF_INFO_HEADER_TOK);
                var id = null, desc = null;
                for (var ti = 0; ti < toks.length - 1; ti += 3) {
                    var key = toks[ti + 1];
                    var value = toks[ti + 2].replace(/"/g, '');
                    if (key == 'ID') {
                        id = value;
                    } else if (key == 'Description') {
                        desc = value;
                    }
                }
                if (id && desc) {
                    this.parser.info.push(
                        {id: id,
                         desc: desc}
                    );
                }
            }
            return;
        } else {
            return;
        }
    }

    var toks = line.split('\t');
    var f = new DASFeature();
    f.segment = toks[0];
    f.id = toks[2]
    f.refAllele = toks[3];
    f.altAlleles = toks[4].split(',');
    f.min = parseInt(toks[1]);
    f.max = f.min + f.refAllele.length - 1;

    var infoToks = toks[7].split(VCF_INFO_RE);
    f.info = {};
    for (var ti = 0; ti < infoToks.length; ti += 4) {
        f.info[infoToks[ti + 1]] = infoToks[ti + 3];
    }


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
    var self = this;
    var fip = function(feature, featureInfo) {
        featureInfo.add("Ref. allele", feature.refAllele);
        featureInfo.add("Alt. alleles", feature.altAlleles.join(','));

        if (feature.info) {
            for (var ii = 0; ii < self.info.length; ++ii) {
                var info = self.info[ii];
                var val = feature.info[info.id];
                if (val !== undefined) {
                    featureInfo.add(info.desc, val);
                }
            }
        }
    };
    callback(fip);
}

dalliance_registerParserFactory('vcf', function() {return new VCFParser()});
