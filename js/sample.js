/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// sample.js: downsampling of quantitative features
//

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
    this.lap = 0;
    this.covered = null;
}

DSBin.prototype.score = function() {
    if (this.cnt == 0) {
        return 0;
    } else if (this.hasScore) {
        return this.tot / this.cnt;
    } else {
        return this.lap / coverage(this.covered);
    }
}

DSBin.prototype.feature = function(f) {
    if (f.score) {
        this.tot += f.score;
        this.hasScore = true
    }
    var fMin = f.min|0;
    var fMax = f.max|0;
    var lMin = Math.max(this.min, fMin);
    var lMax = Math.min(this.max, fMax);
    // dlog('f.min=' + fMin + '; f.max=' + fMax + '; lMin=' + lMin + '; lMax=' + lMax + '; lap=' + (1.0 * (lMax - lMin + 1))/(fMax - fMin + 1));
    this.lap += (1.0 * (lMax - lMin + 1));
    ++this.cnt;
    var newRange = new Range(lMin, lMax);
    if (this.covered) {
        this.covered = union(this.covered, newRange);
    } else {
        this.covered = newRange;
    }
}

function downsample(features, targetRez) {
    var beforeDS = Date.now();

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
//      if (f.score) {
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
//      }
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
    // dlog('downsampled ' + features.length + ' -> ' + sampledFeatures.length + ' in ' + (afterDS - beforeDS) + 'ms');
    return sampledFeatures;
}
