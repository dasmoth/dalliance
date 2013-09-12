/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// overlay.js: featuresources composed from multiple underlying sources
//

function OverlayFeatureSource(sources, opts) {
    this.sources = sources;
    this.opts = opts || {};

    if (opts.merge == 'concat') {
        this.merge = OverlayFeatureSource_merge_concat;
    } else {
        this.merge = OverlayFeatureSource_merge_byKey;
    }
}

OverlayFeatureSource.prototype.getScales = function() {
    return this.sources[0].getScales();
}

OverlayFeatureSource.prototype.getStyleSheet = function(callback) {
    return this.sources[0].getStyleSheet(callback);
}

OverlayFeatureSource.prototype.capabilities = function() {
    var s0 = this.sources[0];
    if (s0.capabilities) 
        return s0.capabilities();
    return {};
}

OverlayFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var baton = new OverlayBaton(this, callback, this.sources.length);
    for (var si = 0; si < this.sources.length; ++si) {
	this.fetchN(baton, si, chr, min, max, scale, types, pool);
    }
}

OverlayFeatureSource.prototype.fetchN = function(baton, si, chr, min, max, scale, types, pool) {
    this.sources[si].fetch(chr, min, max, scale, types, pool, function(status, features, scale) {
	return baton.completed(si, status, features, scale);
    });
}

OverlayFeatureSource.prototype.quantFindNextFeature = function(chr, pos, dir, threshold, callback) {
    return this.sources[0].quantFindNextFeature(chr, pos, dir, threshold, callback);
}

OverlayFeatureSource.prototype.findNextFeature = function(chr, pos, dir, callback) {
    return this.sources[0].findNextFeature(chr, pos, dir, callback);
}

function OverlayBaton(source, callback, count) {
    this.source = source;
    this.callback = callback;
    this.count = count;

    this.returnCount = 0;
    this.statusCount = 0;
    this.returns = [];
    this.features = []
    this.statuses = [];
    this.scale = null;
}

OverlayBaton.prototype.completed = function(index, status, features, scale) {
    if (this.scale == null || index == 0) 
	this.scale = scale;

    if (this.returns[index])
	throw 'Multiple returns for source ' + index;

    this.returns[index] = true;
    this.returnCount++;

    this.features[index] = features;

    if (status) {
	this.statuses[index] = status;
	this.statusCount++;
    }


    if (this.returnCount == this.count) {
	if (this.statusCount > 0) {
	    var message = '';
	    for (var si = 0; si < this.count; ++si) {
		var s = this.statuses[si];
		if (s != 0) {
		    if (message.length > 0) 
			message += ', ';
		    message += s;
		}
	    }
	    return this.callback(message, null, this.scale);
	} else {
	    this.callback(null, this.source.merge(this.features), this.scale);
	}
    }
}

OverlayFeatureSource.prototype.keyForFeature = function(feature) {
    return '' + feature.min + '..' + feature.max;
}

function OverlayFeatureSource_merge_byKey(featureSets) {
    var om = {};
    var of = featureSets[1];
    for (var fi = 0; fi < of.length; ++fi) {
	om[this.keyForFeature(of[fi])] = of[fi];
    }

    var mf = [];
    var fl = featureSets[0];
    for (var fi = 0; fi < fl.length; ++fi) {
	var f = fl[fi];
	of = om[this.keyForFeature(f)]
	if (of) {
	    if (of.id)
		f.id = of.id;
	    if (of.label) 
		f.label = of.label;
	}
	mf.push(f);
    }
    return mf;
}

function OverlayFeatureSource_merge_concat(featureSets) {
    var features = [];
    for (var fsi = 0; fsi < featureSets.length; ++fsi) {
        var fs = featureSets[fsi];
        var name = this.sources[fsi].name;
        for (var fi = 0; fi < fs.length; ++fi) {
            var f = fs[fi];
            f.method = name;
            features.push(f);
        }
    }
    return features;
}
