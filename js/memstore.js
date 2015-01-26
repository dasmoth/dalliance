/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// memstore.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var sa = require('./sourceadapters');
    var dalliance_registerSourceAdapterFactory = sa.registerSourceAdapterFactory;
    var dalliance_makeParser = sa.makeParser;
    var FeatureSourceBase = sa.FeatureSourceBase;

    var das = require('./das');
    var DASStylesheet = das.DASStylesheet;
    var DASStyle = das.DASStyle;
    var DASFeature = das.DASFeature;
    var DASGroup = das.DASGroup;

    var utils = require('./utils');
    var Awaited = utils.Awaited;
    var textXHR = utils.textXHR;
}

function MemStore() {
    this.featuresByChr = {};
    this.maxLength = 1;
    this.chrRing = null;
}

MemStore.prototype.addFeatures = function(features) {
    var dirty = {};
    for (var fi = 0; fi < features.length; ++fi) {
        var f = features[fi];
        var chr = f.segment || f.chr;
        var fa = this.featuresByChr[chr];
        if (!fa) {
            fa = [];
            this.featuresByChr[chr] = fa;
        }
        fa.push(f);
        dirty[chr] = true;

        var len = f.max - f.min + 1;
        if (len > this.maxLength)
            this.maxLength = len;
    }

    for (chr in dirty) {
        var fa = this.featuresByChr[chr];
        fa.sort(function(f1, f2) {
            var d = f1.min - f2.min;
            if (d != 0)
                return d;
            return f1.max - f2.max;
        });
    }
    this.chrRing = null;
}

MemStore.prototype._indexFor = function(fa, p) {
    var lb = 0, ub = fa.length;
    while (ub > lb) {
        var mid = ((lb + ub)/2)|0;
        if (mid >= fa.length)
            return fa.length;
        var mg = fa[mid];
        if (p < mg.min) {
            ub = mid;
        } else {
            lb = mid + 1;
        }
    }
    return ub;
}

MemStore.prototype.fetch = function(chr, min, max) {
    var fa = this.featuresByChr[chr];
    if (!fa) {
        if (chr.indexOf('chr') == 0)
            fa = this.featuresByChr[chr.substring(3)];
        else
            fa = this.featuresByChr['chr' + chr];
    }
    if (!fa)
        return [];

    var mini = Math.max(0, this._indexFor(fa, min - this.maxLength - 1));
    var maxi = Math.min(fa.length - 1, this._indexFor(fa, max));

    var res = [];
    for (var fi = mini; fi <= maxi; ++fi) {
        var f = fa[fi];
        if (f.min <= max && f.max >= min)
            res.push(f);
    }
    return res;
}

MemStore.prototype.findNextFeature = function(chr, pos, dir) {
    if (this.chrRing == null) {
        this.chrRing = [];
        for (var chr in this.featuresByChr) {
            this.chrRing.push(chr);
        }
        this.chrRing.sort();
    }

    var fa = this.featuresByChr[chr];
    if (!fa) {
        if (chr.indexOf('chr') == 0) {
            chr = chr.substring(3);
            fa = this.featuresByChr[chr];
        } else {
            chr = 'chr' + chr;
            fa = this.featuresByChr[chr];
        }
    }
    if (!fa)
        return null;

    var i = Math.max(0, Math.min(this._indexFor(fa, pos), fa.length - 1));
    if (dir > 0) {
        while (i < fa.length) {
            var f = fa[i++];
            if (f.min > pos)
                return f;
        }
        var chrInd = this.chrRing.indexOf(chr) + 1;
        if (chrInd >= this.chrRing.length)
            chrInd = 0;
        return this.findNextFeature(this.chrRing[chrInd], 0, dir);
    } else {
        while (i >= 0) {
            var f = fa[i--];
            if (f.max < pos)
                return f;
        }
        var chrInd = this.chrRing.indexOf(chr) - 1;
        if (chrInd < 0)
            chrInd = this.chrRing.length - 1;
        return this.findNextFeature(this.chrRing[chrInd], 10000000000, dir);
    }
}

function MemStoreFeatureSource(source) {
    this.source = source;
    FeatureSourceBase.call(this);
    this.storeHolder = new Awaited();
    this.parser = dalliance_makeParser(source.payload);
    if (!this.parser) {
        throw "Unsupported memstore payload: " + source.payload;
    }

    var thisB = this;
    this._load(function(resp, err) {
        if (!resp) {
            thisB.error = err || "No data"
            thisB.storeHolder.provide(null);
        } else {
            var store = new MemStore();
            var features = [];
            var lines = resp.split('\n');

            var session = thisB.parser.createSession(function(f) {features.push(f)});
            for (var li = 0; li < lines.length; ++li) {
                var line = lines[li];
                if (line.length > 0) {
                    session.parse(line);
                }
            }
            session.flush();

            store.addFeatures(features);

            thisB.storeHolder.provide(store);
        }
    });
}

MemStoreFeatureSource.prototype = Object.create(FeatureSourceBase.prototype);

MemStoreFeatureSource.prototype._load = function(callback) {
    if (this.source.blob) {
        var r = new FileReader();
        r.onloadend = function() {
            return callback(r.result, r.error);
        }
        r.readAsText(this.source.blob);
    } else {
        if (this.source.credentials)
            var opts = {credentials : this.source.credentials};
        textXHR(this.source.uri, callback, opts);
    }
}

MemStoreFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, cnt) {
    var thisB = this;
    this.storeHolder.await(function(store) {
        if (store) {
            var f = store.fetch(chr, min, max);
            return cnt(null, f, 100000000);
        } else {
            return cnt(thisB.error)
        }
    });
}

MemStoreFeatureSource.prototype.getStyleSheet = function(callback) {
    if (this.parser && this.parser.getStyleSheet)
        this.parser.getStyleSheet(callback)
}

MemStoreFeatureSource.prototype.getDefaultFIPs = function(callback) {
    if (this.parser && this.parser.getDefaultFIPs)
        this.parser.getDefaultFIPs(callback);
}

MemStoreFeatureSource.prototype.getScales = function() {
    return 100000000;
}

MemStoreFeatureSource.prototype.findNextFeature = function(chr, pos, dir, callback) {
    var thisB = this;
    this.storeHolder.await(function(store) {
        if (store) {
            return callback(store.findNextFeature(chr, pos, dir));
        } else {
            return callback(null, thisB.error);
        }
    });
}


MemStoreFeatureSource.prototype.capabilities = function() {
    var caps = {leap: true};
    return caps;
}

dalliance_registerSourceAdapterFactory('memstore', function(source) {
    return {features: new MemStoreFeatureSource(source)};
});
