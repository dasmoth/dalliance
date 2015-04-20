/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// session.js
//

"use strict";

if (typeof(require) != 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var sc = require('./sourcecompare');
    var sourceDataURI = sc.sourceDataURI;
    var sourcesAreEqual = sc.sourcesAreEqual;

    var VERSION = require('./version');

    var utils = require('./utils');
    var miniJSONify = utils.miniJSONify;

    var sha1 = require('./sha1');
    var hex_sha1 = sha1.hex_sha1;
}

Browser.prototype.nukeStatus = function() {
    delete localStorage['dalliance.' + this.cookieKey + '.view-chr'];
    delete localStorage['dalliance.' + this.cookieKey + '.view-start'];
    delete localStorage['dalliance.' + this.cookieKey + '.view-end'];
    delete localStorage['dalliance.' + this.cookieKey + '.current-seq-length'];
    delete localStorage['dalliance.' + this.cookieKey + '.showing-alt-zoom'];
    delete localStorage['dalliance.' + this.cookieKey + '.saved-zoom'];

    delete localStorage['dalliance.' + this.cookieKey + '.sources'];
    delete localStorage['dalliance.' + this.cookieKey + '.hubs'];
    delete localStorage['dalliance.' + this.cookieKey + '.version'];

    delete localStorage['dalliance.' + this.cookieKey + '.reverse-scrolling'];
    delete localStorage['dalliance.' + this.cookieKey + '.reverse-key-scrolling'];
    delete localStorage['dalliance.' + this.cookieKey + '.ruler-location'];
}

Browser.prototype.storeStatus = function() {
    this.storeViewStatus();
    this.storeTierStatus();
}

Browser.prototype.storeViewStatus = function() {
    if (!this.cookieKey || this.noPersist || this.noPersistView) {
        return;
    }

    localStorage['dalliance.' + this.cookieKey + '.view-chr'] = this.chr;
    localStorage['dalliance.' + this.cookieKey + '.view-start'] = this.viewStart|0;
    localStorage['dalliance.' + this.cookieKey + '.view-end'] = this.viewEnd|0
    localStorage['dalliance.' + this.cookieKey + '.showing-alt-zoom'] = '' + this.isSnapZooming;
    localStorage['dalliance.' + this.cookieKey + '.saved-zoom'] = this.savedZoom;
    if (this.currentSeqMax) {
	   localStorage['dalliance.' + this.cookieKey + '.current-seq-length'] = this.currentSeqMax;
    }
}


Browser.prototype.storeTierStatus = function() {
    if (!this.cookieKey || this.noPersist) {
        return;
    }

    var currentSourceList = [];
    for (var t = 0; t < this.tiers.length; ++t) {
        var tt = this.tiers[t];
        var ts = tt.dasSource;
        if (!ts.noPersist) {
            currentSourceList.push({source: tt.dasSource, config: tt.config || {}});
        }
    }
    localStorage['dalliance.' + this.cookieKey + '.sources'] = JSON.stringify(currentSourceList);


    var coveredHubURLs = {};
    var currentHubList = [];
    for (var hi = 0; hi < this.hubObjects.length; ++hi) {
        var tdb = this.hubObjects[hi];
        var hc = {url: tdb.hub.url, genome: tdb.genome};
        if (tdb.credentials)
            hc.credentials = tdb.credentials;
        if (tdb.mapping)
            hc.mapping = tdb.mapping;
        coveredHubURLs[hc.url] = true;
        currentHubList.push(hc);
    }

    // Needed to handle hubs that failed to connect, or hubs that haven't
    // connected yet when we're called soon after startup.
    for (var hi = 0; hi < this.hubs.length; ++hi) {
        var hc = this.hubs[hi];
        if (typeof hc === 'string')
            hc = {url: hc};
        if (!coveredHubURLs[hc.url])
            currentHubList.push(hc);
    }

    localStorage['dalliance.' + this.cookieKey + '.hubs'] = JSON.stringify(currentHubList);

    localStorage['dalliance.' + this.cookieKey + '.reverse-scrolling'] = this.reverseScrolling;
    localStorage['dalliance.' + this.cookieKey + '.reverse-key-scrolling'] = this.reverseKeyScrolling;
    localStorage['dalliance.' + this.cookieKey + '.single-base-highlight'] = this.singleBaseHighlight;
    localStorage['dalliance.' + this.cookieKey + '.ruler-location'] = this.rulerLocation;

    localStorage['dalliance.' + this.cookieKey + '.export-ruler'] = this.exportRuler;
    localStorage['dalliance.' + this.cookieKey + '.export-highlights'] = this.exportHighlights;
    
    localStorage['dalliance.' + this.cookieKey + '.version'] = VERSION.CONFIG;
}

Browser.prototype.restoreStatus = function() {
    if (this.noPersist)
        return;
    
    var storedConfigVersion = localStorage['dalliance.' + this.cookieKey + '.version'];
    if (storedConfigVersion) {
        storedConfigVersion = storedConfigVersion|0;
    } else {
        storedConfigVersion = -100;
    }
    if (VERSION.CONFIG != storedConfigVersion) {
        return;
    }

    var storedConfigHash = localStorage['dalliance.' + this.cookieKey + '.configHash'] || '';
    var pageConfigHash = hex_sha1(miniJSONify({sources: this.sources, hubs: this.hubs}));
    if (pageConfigHash != storedConfigHash) {
        localStorage['dalliance.' + this.cookieKey + '.configHash'] = pageConfigHash;
        return;
    }

    var defaultSourcesByURI = {};
    for (var si = 0; si < this.sources.length; ++si) {
        var source = this.sources[si];
        if (!source)
            continue;

        var uri = sourceDataURI(source);
        var ul = defaultSourcesByURI[uri];
        if (!ul)
            defaultSourcesByURI[uri] = ul = [];
        ul.push(source);
        
    }

    if (!this.noPersistView) {
        var qChr = localStorage['dalliance.' + this.cookieKey + '.view-chr'];
        var qMin = localStorage['dalliance.' + this.cookieKey + '.view-start']|0;
        var qMax = localStorage['dalliance.' + this.cookieKey + '.view-end']|0;
        if (qChr && qMin && qMax) {
        	this.chr = qChr;
        	this.viewStart = qMin;
        	this.viewEnd = qMax;
        	
        	var csm = localStorage['dalliance.' + this.cookieKey + '.current-seq-length'];
        	if (csm) {
        	    this.currentSeqMax = csm|0;
        	}

            this.isSnapZooming = (localStorage['dalliance.' + this.cookieKey + '.showing-alt-zoom']) == 'true';

            var sz = parseFloat(localStorage['dalliance.' + this.cookieKey + '.saved-zoom']);
            if (typeof sz === 'number' && !isNaN(sz)) {
                this.savedZoom = sz;
            }
        }
    }

    var rs = localStorage['dalliance.' + this.cookieKey + '.reverse-scrolling'];
    this.reverseScrolling = (rs && rs == 'true');
    var rks = localStorage['dalliance.' + this.cookieKey + '.reverse-key-scrolling'];
    this.reverseKeyScrolling = (rks && rks == 'true');
    var sbh = localStorage['dalliance.' + this.cookieKey + '.single-base-highlight'];
    this.singleBaseHighlight = (sbh && sbh == 'true');
 
    var rl = localStorage['dalliance.' + this.cookieKey + '.ruler-location'];
    if (rl)
        this.rulerLocation = rl;

    var x = localStorage['dalliance.' + this.cookieKey + '.export-ruler'];
    if (x)
        this.exportRuler = (x === 'true');
    var x = localStorage['dalliance.' + this.cookieKey + '.export-highlights'];
    if (x)
        this.exportHighlights = (x === 'true');

    var sourceStr = localStorage['dalliance.' + this.cookieKey + '.sources'];
    if (sourceStr) {
	    var storedSources = JSON.parse(sourceStr);
        this.sources = [];
        this.restoredConfigs = [];
        for (var si = 0; si < storedSources.length; ++si) {
            var source = this.sources[si] = storedSources[si].source;
            this.restoredConfigs[si] = storedSources[si].config;
            var uri = sourceDataURI(source);
            var ul = defaultSourcesByURI[uri] || [];
            for (var osi = 0; osi < ul.length; ++osi) {    
                var oldSource = ul[osi];
                if (sourcesAreEqual(source, oldSource)) {
                    for (var k in oldSource) {
                        if (oldSource.hasOwnProperty(k) && 
                            (typeof(oldSource[k]) === 'function' || oldSource[k] instanceof Blob))
                        {
                            source[k] = oldSource[k];
                        }
                    }
                }
            }
        }
    }

    var hubStr = localStorage['dalliance.' + this.cookieKey + '.hubs'];
    if (hubStr) {
        this.hubs = JSON.parse(hubStr);
    }

    return true;
}

Browser.prototype.reset = function() {
    for (var i = this.tiers.length - 1; i >= 0; --i) {
       this.removeTier({index: i}, true);
    }
    for (var i = 0; i < this.defaultSources.length; ++i) {
        var s = this.defaultSources[i];
        if (!s.disabled) 
            this.addTier(this.defaultSources[i]);
    }

    this.highlights.splice(0, this.highlights.length);

    this.setLocation(this.defaultChr, this.defaultStart, this.defaultEnd);
}
