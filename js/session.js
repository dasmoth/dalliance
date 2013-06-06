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
    delete localStorage['dalliance.' + this.cookieKey + '.version'];
}

Browser.prototype.storeStatus = function() {
    if (!this.cookieKey || this.noPersist) {
        return;
    }

    localStorage['dalliance.' + this.cookieKey + '.view-chr'] = this.chr;
    localStorage['dalliance.' + this.cookieKey + '.view-start'] = this.viewStart|0;
    localStorage['dalliance.' + this.cookieKey + '.view-end'] = this.viewEnd|0
    if (this.currentSeqMax) {
	localStorage['dalliance.' + this.cookieKey + '.current-seq-length'] = this.currentSeqMax;
    }

    var currentSourceList = [];
    for (var t = 0; t < this.tiers.length; ++t) {
        var ts = this.tiers[t].dasSource;
        if (!ts.noPersist) {
            currentSourceList.push(this.tiers[t].dasSource);
        }
    }
    localStorage['dalliance.' + this.cookieKey + '.sources'] = JSON.stringify(currentSourceList);
    localStorage['dalliance.' + this.cookieKey + '.version'] = VERSION.CONFIG;
}

Browser.prototype.restoreStatus = function() {
    var storedConfigVersion = localStorage['dalliance.' + this.cookieKey + '.version'];
    if (storedConfigVersion) {
        storedConfigVersion = storedConfigVersion|0;
    } else {
        storedConfigVersion = -100;
    }
    if (VERSION.CONFIG != storedConfigVersion) {
        return;
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

    var sourceStr = localStorage['dalliance.' + this.cookieKey + '.sources'];
    if (sourceStr) {
	this.sources = JSON.parse(sourceStr);
    }
}
