/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// kspace.js: Manage a block of Known Space
//


function Awaited() {
    this.queue = [];
}

Awaited.prototype.provide = function(x) {
    if (this.res) {
	throw "Resource has already been provided.";
    }

    this.res = x;
    for (var i = 0; i < this.queue.length; ++i) {
	this.queue[i](x);
    }
}

Awaited.prototype.await = function(f) {
    if (this.res) {
	f(this.res);
    } else {
	this.queue.push(f);
    }
}


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

function KSCacheBaton(chr, min, max, scale, features) {
    this.chr = chr;
    this.min = min;
    this.max = max;
    this.scale = scale;
    this.features = features;
}

KSCacheBaton.prototype.toString = function() {
    return this.chr + ":" + this.min + ".." + this.max + ";scale=" + this.scale;
}

function KnownSpace(tierMap, chr, min, max, scale, parent) {
    this.tierMap = tierMap;
    this.chr = chr;
    this.min = min;
    this.max = max;
    this.scale = scale;

    this.featureCache = {};

    if (parent) {
	// try to copy stuff
    }
}

KnownSpace.prototype.bestCacheOverlapping = function(chr, min, max) {
    var baton = this.featureCache[this.tierMap[0]];
    if (baton) {
	return baton;
    } else {
	return null;
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
    var thisB = this;

    var source = tier.getSource();
    var baton = thisB.featureCache[tier];
    if (baton) {
// 	dlog('considering cached features: ' + baton);
    }
    if (baton && baton.chr === this.chr && baton.min <= this.min && baton.max >= this.max) {
	var cachedFeatures = baton.features;
	if (baton.min < this.min || baton.max > this.max) {
	    var ff = [];
	    for (var fi = 0; fi < cachedFeatures.length; ++fi) {
		var f = cachedFeatures[fi];
		if (f.min <= this.max && f.max >= this.min) {
		    ff.push(f);
		}
	    }
	    cachedFeatures = ff;
	}
	if (baton.scale < thisB.scale) {
	    cachedFeatures = downsample(cachedFeatures, thisB.scale);
	}
	tier.viewFeatures(baton.chr, Math.max(baton.min, this.min), Math.min(baton.max, this.max), baton.scale, cachedFeatures);   // FIXME change scale if downsampling

	var availableScales = source.getScales();
	if (baton.scale <= this.scale || !availableScales) {
//	    dlog('used cached features');
	    return;
	} else {
//	    dlog('used cached features (temporarily)');
	}
    }

    source.fetch(this.chr, this.min, this.max, this.scale, null, this.pool, function(status, features, scale) {
	if (!baton || (thisB.min < baton.min) || (thisB.max > baton.max)) {         // FIXME should be merging in some cases?
	    thisB.featureCache[tier] = new KSCacheBaton(thisB.chr, thisB.min, thisB.max, scale, features);
	}

	if (scale < thisB.scale) {
	    features = downsample(features, thisB.scale);
	}
	tier.viewFeatures(thisB.chr, thisB.min, thisB.max, this.scale, features);
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
	    callback(status, features, scale);
	}
    );
}


function DASSequenceSource(dasSource) {
    this.dasSource = dasSource;
}

DASSequenceSource.prototype.getScales = function() {
    return [0.1, 10];
}

DASSequenceSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    if (scale < 1) {
	this.dasSource.sequence(
            new DASSegment(chr, min, max),
            function(seqs) {
		var f = new DASFeature();
		f.segment = chr;
		f.min = min;
		f.max = max;
		f.sequence = seqs[0];
		callback(null, [f], 1);
            }
        );
    } else {
	var f = new DASFeature();
	f.segment = chr;
	f.min = min;
	f.max = max;
	f.sequence = new DASSequence(chr, min, max, null, null);
	callback(null, [f], 1000000000);
    }
}



DASFeatureSource.prototype.getScales = function() {
    return [];
}


function BWGFeatureSource(bwgURI) {
    var thisB = this;
    thisB.bwgHolder = new Awaited();
    makeBwgFromURL(bwgURI, function(bwg) {
	thisB.bwgHolder.provide(bwg);
    });
}

BWGFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    this.bwgHolder.await(function(bwg) {
	bwg.readWigData(chr, min, max, function(features) {
	    var fs = scale;
	    if (bwg.type === 'bigwig') {
		var is = (max - min) / features.length;
		if (is < fs) {
		    fs = is;
		}
	    }
	    callback(null, features, fs);
	});
    });
}

BWGFeatureSource.prototype.getScales = function() {
    var bwg = this.bwgHolder.res;
    if (bwg) {
	return null;
    } else {
	return null;
    }
}




function MappedFeatureSource(source, mapping) {
    this.source = source;
    this.mapping = mapping;
}

MappedFeatureSource.prototype.getScales = function() {
    return this.source.getScales();
}

MappedFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;

    this.mapping.sourceBlocksForRange(chr, min, max, function(mseg) {
        if (mseg.length == 0) {
            callback("No mapping available for this regions", [], scale);
        } else {
	    var seg = mseg[0];
	    thisB.source.fetch(seg.name, seg.start, seg.end, scale, types, pool, function(status, features, scale) {
		var mappedFeatures = [];
		if (features) {
		    for (var fi = 0; fi < features.length; ++fi) {
                        var f = features[fi];
			var sn = f.segment;
			if (sn.indexOf('chr') == 0) {
			    sn = sn.substr(3);
			}
                        var mmin = thisB.mapping.mapPoint(sn, f.min);
                        var mmax = thisB.mapping.mapPoint(sn, f.max);
                        if (!mmin || !mmax || mmin.seq != mmax.seq || mmin.seq != chr) {
                            // Discard feature.
                        } else {
                            f.segment = mmin.seq;
                            f.min = mmin.pos;
                            f.max = mmax.pos;
                            if (f.min > f.max) {
                                var tmp = f.max;
                                f.max = f.min;
                                f.min = tmp;
                            }
                            if (mmin.flipped) {
                                if (f.orientation == '-') {
                                    f.orientation = '+';
                                    alert(miniJSONify(f));
                                } else if (f.orientation == '+') {
                                    f.orientation = '-';
                                }
                            }
                            mappedFeatures.push(f);
                        }
                    }
		}

		callback(status, mappedFeatures, scale);
	    });
	}
    });
}

