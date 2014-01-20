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
    this.activityListeners = [];
    this.readinessListeners = [];
    this.changeListeners = [];
    this.business = [];
    this.readiness = [];

    for (var i = 0; i < this.sources.length; ++i) {
        this.initN(i);
    }

    if (opts.merge == 'concat') {
        this.merge = OverlayFeatureSource_merge_concat;
    } else {
        this.merge = OverlayFeatureSource_merge_byKey;
    }
}

OverlayFeatureSource.prototype.initN = function(n) {
    var s = this.sources[n];
    var thisB = this;
    this.business[n] = 0;

    if (s.addActivityListener) {
        s.addActivityListener(function(b) {
            thisB.business[n] = b;
            thisB.notifyActivity();
        });
    }
    if (s.addChangeListener) {
        s.addChangeListener(function() {
            thisB.notifyChange();
        });
    }
    if (s.addReadinessListener) {
        s.addReadinessListener(function(r) {
            thisB.readiness[n] = r;
            thisB.notifyReadiness();
        });
    }
}

OverlayFeatureSource.prototype.addReadinessListener = function(l) {
    this.readinessListeners.push(l);
    this.notifyReadinessListener(l);
}

OverlayFeatureSource.prototype.notifyReadiness = function() {
    for (var i = 0; i < this.readinessListeners.length; ++i) {
        this.notifyReadinessListener(this.readinessListeners[i]);
    }
}

OverlayFeatureSource.prototype.notifyReadinessListener = function(l) {
    var r = null;
    for (var i = 0; i < this.readiness.length; ++i) {
        if (this.readiness[i] != null) {
            r = this.readiness[i]; break;
        }
    }
    try {
        l(r);
    } catch (e) {
        console.log(e);
    }
}

OverlayFeatureSource.prototype.addActivityListener = function(l) {
    this.activityListeners.push(l);
}

OverlayFeatureSource.prototype.notifyActivity = function() {
    var busy = 0;
    for (var i = 0; i < this.business.length; ++i) {
        busy += this.business[i];
    }

    for (var li = 0; li < this.activityListeners.length; ++li) {
        try {
            this.activityListeners[li](busy);
        } catch (e) {
            console.log(e);
        }
    }
}

OverlayFeatureSource.prototype.addChangeListener = function(listener) {
    this.changeListeners.push(listener);
}

OverlayFeatureSource.prototype.notifyChange = function() {
    for (var li = 0; li < this.changeListeners.length; ++li) {
        try {
            this.changeListeners[li](this.busy);
        } catch (e) {
            console.log(e);
        }
    }
}

OverlayFeatureSource.prototype.getScales = function() {
    return this.sources[0].getScales();
}

OverlayFeatureSource.prototype.getStyleSheet = function(callback) {
    return this.sources[0].getStyleSheet(callback);
}

OverlayFeatureSource.prototype.capabilities = function() {
    var caps = {};
    var s0 = this.sources[0];
    if (s0.capabilities) 
        caps = shallowCopy(s0.capabilities());

    for (var i = 1; i < this.sources.length; ++i) {
        var si = this.sources[i];
        if (si.capabilities) {
            var co = si.capabilities();
            if (co.search) {
                caps.search = co.search;
            }
        }
    }

    return caps;
}

OverlayFeatureSource.prototype.search = function(query, callback) {
    for (var i = 0; i < this.sources.length; ++i) {
        if (sourceAdapterIsCapable(this.sources[i], 'search')) {
            return this.sources[i].search(query, callback);
        }
    }
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
        		if (s) {
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

OverlayFeatureSource.prototype.getDefaultFIPs = function(callback) {
    for (var si = 0; si < this.sources.length; ++si) {
        var s = this.sources[si];
        if (s.getDefaultFIPs)
            s.getDefaultFIPs(callback);
    }
}

OverlayFeatureSource.prototype.keyForFeature = function(feature) {
    return '' + feature.min + '..' + feature.max;
}

function OverlayFeatureSource_merge_byKey(featureSets) {
    var omaps = [];

    for (var fsi = 1; fsi < featureSets.length; ++fsi) {
        var om = {};
        var of = featureSets[fsi];
        for (var fi = 0; fi < of.length; ++fi) {
    	   om[this.keyForFeature(of[fi])] = of[fi];
        }
        omaps.push(om);
    }


    var mf = [];
    var fl = featureSets[0];
    for (var fi = 0; fi < fl.length; ++fi) {
    	var f = fl[fi];

        for (var oi = 0; oi < omaps.length; ++oi) {
            var om = omaps[oi];
        	of = om[this.keyForFeature(f)]
        	if (of) {
                for (var k in of) {
                    if (k === 'score') {
                        f.score2 = of.score;
                    } else if (k === 'min' || k === 'max' || k === 'segment' || k === '_cachedStyle') {
                        // do nothing
                    } else {
                        f[k] = of[k];
                    }
                }
        	}
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
