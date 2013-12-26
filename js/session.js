/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// session.js
//

Browser.prototype.nukeStatus = function() {
    delete localStorage['dalliance.' + this.cookieKey + '.view-chr'];
    delete localStorage['dalliance.' + this.cookieKey + '.view-start'];
    delete localStorage['dalliance.' + this.cookieKey + '.view-end'];
    delete localStorage['dalliance.' + this.cookieKey + '.sources'];
    delete localStorage['dalliance.' + this.cookieKey + '.hubs'];
    delete localStorage['dalliance.' + this.cookieKey + '.version'];

    delete localStorage['dalliance.' + this.cookieKey + '.reverse-scrolling'];
    delete localStorage['dalliance.' + this.cookieKey + '.ruler-location'];
}

Browser.prototype.storeStatus = function() {
    this.storeViewStatus();
    this.storeTierStatus();
}

Browser.prototype.storeViewStatus = function() {
    if (!this.cookieKey || this.noPersist) {
        return;
    }

    localStorage['dalliance.' + this.cookieKey + '.view-chr'] = this.chr;
    localStorage['dalliance.' + this.cookieKey + '.view-start'] = this.viewStart|0;
    localStorage['dalliance.' + this.cookieKey + '.view-end'] = this.viewEnd|0
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
        var ts = this.tiers[t].dasSource;
        if (!ts.noPersist) {
            currentSourceList.push(this.tiers[t].dasSource);
        }
    }
    localStorage['dalliance.' + this.cookieKey + '.sources'] = JSON.stringify(currentSourceList);
    localStorage['dalliance.' + this.cookieKey + '.hubs'] = JSON.stringify(this.hubs);
    localStorage['dalliance.' + this.cookieKey + '.reverse-scrolling'] = this.reverseScrolling;
    localStorage['dalliance.' + this.cookieKey + '.ruler-location'] = this.rulerLocation;
    
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
        var uri = sourceDataURI(source);
        var ul = defaultSourcesByURI[uri];
        if (!ul)
            defaultSourcesByURI[uri] = ul = [];
        ul.push(source);
        
    }

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
    }
    var rs = localStorage['dalliance.' + this.cookieKey + '.reverse-scrolling'];
    this.reverseScrolling = (rs && rs == 'true');

    var rl = localStorage['dalliance.' + this.cookieKey + '.ruler-location'];
    if (rl)
        this.rulerLocation = rl;

    var sourceStr = localStorage['dalliance.' + this.cookieKey + '.sources'];
    if (sourceStr) {
	    this.sources = JSON.parse(sourceStr);
        for (var si = 0; si < this.sources.length; ++si) {
            var source = this.sources[si];
            var uri = sourceDataURI(source);
            var ul = defaultSourcesByURI[uri] || [];
            for (var osi = 0; osi < ul.length; ++osi) {    
                var oldSource = ul[osi];
                if (sourcesAreEqual(source, oldSource)) {
                    if (oldSource.featureInfoPlugin) {
                        source.featureInfoPlugin = oldSource.featureInfoPlugin;
                    }
                }
            }
        }
    }

    var hubStr = localStorage['dalliance.' + this.cookieKey + '.hubs'];
    if (hubStr) {
        this.hubs = JSON.parse(hubStr);
    }
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

    this.setLocation(this.defaultChr, this.defaultStart, this.defaultEnd);
}