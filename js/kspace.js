/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// kspace.js: Manage a block of Known Space
//




function FetchPool() {
    this.reqs = [];
}

FetchPool.prototype.addRequest = function(xhr) {
    this.reqs.push(xhr);
}

FetchPool.prototype.abortAll = function() {
    for (var i = 0; i < this.reqs.length; ++i) {
	this.reqs[i].abort();
    }
}




function KnownSpace(tierMap, chr, min, max, scale, parent) {
    this.tierMap = tierMap;
    this.chr = chr;
    this.min = min;
    this.max = max;
    this.scale = scale;

    this.features = {};

    if (parent) {
	// try to copy stuff
    }
}

KnownSpace.prototype.viewFeatures = function(chr, min, max, scale) {
    if (chr != this.chr) {
	throw "Can't extend Known Space to a new chromosome";
    }
    this.min = min;
    this.max = max;
    this.scale = scale;

    if (this.pool) {
	this.pool.abortAll();
    }
    this.pool = new FetchPool();

    for (var t = 0; t < this.tierMap.length; ++t) {
	this.startFetchesFor(this.tierMap[t]);
    }
}
    

KnownSpace.prototype.startFetchesFor = function(tier) {
    tier.getSource().fetch(this.chr, this.min, this.max, this.scale, null, this.pool, function(status, features, scale) {
	tier.viewFeatures(this.chr, this.min, this.max, this.scale, features);
    });
}


function DASFeatureSource(dasSource) {
    this.dasSource = dasSource;
}

DASFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    if (!this.dasSource.uri) {
	return;
    }

    var maxBins = 1 + (((max - min) / scale) | 0);
    this.dasSource.features(
	new DASSegment(chr, min, max),
	{type: types, maxbins: maxBins},
	function(features, status) {
	    // dlog('fetchStatus: ' + status);
	    // dlog('features: ' + miniJSONify(features));
	    callback(status, features, scale);
	}
    );
}

DASFeatureSource.prototype.getScales = function() {
    return [];
}


function BWGFeatureSource(bwgURI) {
    var thisB = this;
    makeBwgFromURL(bwgURI, function(bwg) {
	dlog('bwgReady');
	thisB.bwg = bwg;
    });
}

BWGFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    dlog('bwgtry');
    if (!this.bwg) {
	return;
    }
    dlog('bwgfetch');
    this.bwg.readWigData(chr, min, max, function(features) {
	callback(null, features, scale);
    });
}




function MappedFeatureSource(source, mapping) {
}
