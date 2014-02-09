/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// memstore.js
//

function MemStore() {
    var featuresByChr = {};
    var maxLength = 1;
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

    var mini = this._indexFor(fa, min - this.maxLength - 1);
    var maxi = this._indexFor(fa, max);

    var res = [];
    for (var fi = mini; fi <= maxi; ++fi) {
        var f = fa[fi];
        if (f.min <= max && f.max >= min)
            res.push(f);
    }
    return res;
}

