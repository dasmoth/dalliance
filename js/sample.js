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


function DSBin() {
    this.tot = 0;
    this.cnt = 0;
}

DSBin.prototype.score = function() {
    if (this.cnt == 0) {
	return 0;
    } else {
	return this.tot / this.cnt;
    }
}

DSBin.prototype.feature = function(f) {
    this.tot += f.score;
    this.cnt += 1;
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
	if (f.score) {
	    var minLap = (f.min / scale)|0;
	    var maxLap = (f.max / scale)|0;
	    maxBin = Math.max(maxBin, maxLap);
	    minBin = Math.min(minBin, minLap);
	    for (var b = minLap; b <= maxLap; ++b) {
		var bm = binTots[b];
		if (!bm) {
		    bm = new DSBin();
		    binTots[b] = bm;
		}
		bm.feature(f);
	    }
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
            f.type = 'sampler';
	    sampledFeatures.push(f);
	}
    }
    dlog('downsampled ' + features.length + ' -> ' + sampledFeatures.length);
    return sampledFeatures;
}
