/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// sample.js: downsampling of quantitative features
//

"use strict";

if (typeof(require) !== 'undefined') {
    var das = require('./das');
    var DASFeature = das.DASFeature;
}

var __DS_SCALES = [1, 2, 5];

function ds_scale(n) {
    return __DS_SCALES[n % __DS_SCALES.length] * Math.pow(10, (n / __DS_SCALES.length)|0);
}


function DSBin(scale, min, max) {
    this.scale = scale;
    this.tot = 0;
    this.cnt = 0;
    this.hasScore = false;
    this.min = min; this.max = max;
    this.features = [];
}

function _featureOrder(a, b) {
    if (a.min < b.min) {
        return -1;
    } else if (a.min > b.min) {
        return 1;
    } else if (a.max < b.max) {
        return -1;
    } else if (b.max > a.max) {
        return 1;
    } else {
        return 0;
    }
}

DSBin.prototype.score = function() {
    if (this.cnt == 0) {
        return 0;
    } else if (this.hasScore) {
        return this.tot / this.cnt;
    } else {
        var features = this.features;
        features.sort(_featureOrder);

        var maxSeen = -10000000000;
        var cov=0, lap=0;

        for (var fi = 1; fi < features.length; ++fi) {
            var f = features[fi];
            var lMin = Math.max(f.min, this.min);
            var lMax = Math.min(f.max, this.max);
            lap += (lMax - lMin + 1);

            if (lMin > maxSeen) {
                cov += lMax - lMin + 1;
                maxSeen = lMax;
            } else {
                if (lMax > maxSeen) {
                    cov += (lMax - maxSeen);
                    maxSeen = lMax;
                }
            }
        }

        if (cov > 0)
            return (1.0 * lap) / cov;
        else
            return 0;
    }
}

DSBin.prototype.feature = function(f) {
    if (f.score !== undefined) {
        this.tot += f.score;
        this.hasScore = true
    }

    ++this.cnt;
    this.features.push(f);
}

function downsample(features, targetRez) {
    var sn = 0;
    while (ds_scale(sn + 1) < targetRez) {
        ++sn;
    }
    var scale = ds_scale(sn);

    var binTots = [];
    var maxBin = -10000000000;
    var minBin = 10000000000;
    for (var fi = 0; fi < features.length; ++fi) {
        var f = features[fi];
        if (f.groups && f.groups.length > 0) {
            // Don't downsample complex features (?)
            return features;
        }

        var minLap = (f.min / scale)|0;
        var maxLap = (f.max / scale)|0;
        maxBin = Math.max(maxBin, maxLap);
        minBin = Math.min(minBin, minLap);
        for (var b = minLap; b <= maxLap; ++b) {
            var bm = binTots[b];
            if (!bm) {
                bm = new DSBin(scale, b * scale, (b + 1) * scale - 1);
                binTots[b] = bm;
            }
            bm.feature(f);
        }
    }

    var sampledFeatures = [];
    for (var b = minBin; b <= maxBin; ++b) {
        var bm = binTots[b];
        if (bm) {
            var f = new DASFeature();
            f.segment = features[0].segment;
            f.min = (b * scale) + 1;
            f.max = (b + 1) * scale;
            f.score = bm.score();
            f.type = 'density';
            sampledFeatures.push(f);
        }
    }

    var afterDS = Date.now();
    return sampledFeatures;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        downsample: downsample
    };
}
