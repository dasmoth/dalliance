/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tabix-source.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var sa = require('./sourceadapters');
    var dalliance_registerSourceAdapterFactory = sa.registerSourceAdapterFactory;
    var dalliance_makeParser = sa.makeParser;
    var FeatureSourceBase = sa.FeatureSourceBase;

    var bin = require('./bin');
    var URLFetchable = bin.URLFetchable;
    var BlobFetchable = bin.BlobFetchable;

    var utils = require('./utils');
    var Awaited = utils.Awaited;

    var connectTabix = require('./tabix').connectTabix;
}

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
        this.parser = parser;
    }

    var data, index;
    if (this.source.blob) {
        data = new BlobFetchable(this.source.blob);
        index = new BlobFetchable(this.source.indexBlob);
    } else {
        data = new URLFetchable(this.source.uri, {credentials: this.source.credentials, resolver: this.source.resolver});
        index = new URLFetchable(this.source.indexURI || (this.source.uri + '.tbi'), 
                                 {credentials: this.source.credentials, resolver: this.source.resolver});
    }
    connectTabix(data, index, function(tabix, err) {
        thisB.tabixHolder.provide(tabix);
        tabix.fetchHeader(function(lines, err) {
            if (lines) {
                var session = parser.createSession(function() { /* Null sink because we shouldn't get records */ });
                for (var li = 0; li < lines.length; ++li) {
                    session.parse(lines[li]);
                }
                session.flush();
            }
        });
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
