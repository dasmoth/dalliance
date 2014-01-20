/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tabix-source.js
//


function TabixFeatureSource(source) {
    FeatureSourceBase.call(this);
    this.readiness = 'Connecting';
    this.source = source;

    this.tabixHolder = new Awaited();
    var thisB = this;

    if (source.payload == 'vcf') {
        this.parser = new VCFParser();
    } else {
        throw 'Unsuported tabix payload ' + source.payload;
    }

    var data, index;
    if (this.source.blob) {
        data = new BlobFetchable(this.source.blob);
        index = new BlobFetchable(this.source.indexBlob);
    } else {
        data = new URLFetchable(this.source.uri, {credentials: this.source.credentials});
        index = new URLFetchable(this.source.indexURI || (this.source.uri + '.tbi'), {credentials: this.source.credentials});
    }
    connectTabix(data, index, function(tabix, err) {
        thisB.tabixHolder.provide(tabix);
        thisB.readiness = null
        thisB.notifyReadiness();
    });
}

TabixFeatureSource.prototype = Object.create(FeatureSourceBase.prototype);

TabixFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;
    
    thisB.busy++;
    thisB.notifyActivity();
    
    this.tabixHolder.await(function(tabix) {
        tabix.fetch(chr, min, max, function(records, error) {
            thisB.busy--;
            thisB.notifyActivity();

            var features = [];
            for (var ri = 0; ri < records.length; ++ri) {
                var f = thisB.parser.parse(records[ri]);
                if (f)
                    features.push(f);
            }

            callback(null, features, 1000000000);
        });
    });
}

TabixFeatureSource.prototype.getDefaultFIPs = function(callback) {
    if (this.parser && this.parser.getDefaultFIPs)
        this.parser.getDefaultFIPs(callback);
}


TabixFeatureSource.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();

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

function VCFParser() {}

VCFParser.prototype.parse = function(line) {
    var toks = line.split('\t');
    var f = new DASFeature();
    f.segment = toks[0];
    f.id = toks[2]
    f.refAllele = toks[3];
    f.altAlleles = toks[4].split(',');
    f.min = parseInt(toks[1]);
    f.max = f.min + f.refAllele.length - 1;
    f.type = 'vcf';
    return f;
}

VCFParser.prototype.getDefaultFIPs = function(callback) {
    var fip = function(feature, featureInfo) {
        featureInfo.add("Ref. allele", feature.refAllele);
        featureInfo.add("Alt. alleles", feature.altAlleles.join(','));
    };
    callback(fip);
}


dalliance_registerSourceAdapterFactory('tabix', function(source) {
    return {features: new TabixFeatureSource(source)};
});