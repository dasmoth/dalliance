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


    var parser = dalliance_makeParser(source.payload);
    if (!parser) {
        throw 'Unsuported tabix payload ' + source.payload;
    } else {
        this.parser = new VCFParser();
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
            var session = thisB.parser.createSession(function(f) {features.push(f)});
            for (var ri = 0; ri < records.length; ++ri) {
                var f = session.parse(records[ri]);
            }
            session.flush();
            callback(null, features, 1000000000);
        });
    });
}


TabixFeatureSource.prototype.getStyleSheet = function(callback) {
    if (this.parser && this.parser.getStyleSheet)
        this.parser.getStyleSheet(callback)
}

TabixFeatureSource.prototype.getDefaultFIPs = function(callback) {
    if (this.parser && this.parser.getDefaultFIPs)
        this.parser.getDefaultFIPs(callback);
}


dalliance_registerSourceAdapterFactory('tabix', function(source) {
    return {features: new TabixFeatureSource(source)};
});