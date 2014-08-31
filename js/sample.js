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

    var parseCigar = require('./cigar').parseCigar;

    var shallowCopy = require('./utils').shallowCopy;
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

/** Data structure to store information for
a base position:

pos: position of the base.
*/
function BaseBin(pos) {

    this._pos = pos;
    this._bases = {};
    this._totalCount = 0;
}

/** Keep record for incidence of a base,
with related qual score and strand for a position.

Params
    base: base (e.g A, T, G, C, N) observed at position.
    qual: numeric quality score.
    strand: '+' or '-'.
*/
BaseBin.prototype.recordBase = function(base, qual, strand) {
    if (!this._bases[base]) {
        var strandComposition = {'+': 0, '-': 0};
        strandComposition[strand]++;
        this._bases[base] = {
            cnt: 1,
            totalQual: qual,
            strandCnt: strandComposition
        };
    } else {
        var baseComposition = this._bases[base];
        baseComposition.cnt++;
        baseComposition.totalQual += qual;
        baseComposition.strandCnt[strand]++;
    }
    this._totalCount++;
};

/** Returns count of total number of bases observed at position */
BaseBin.prototype.totalCount = function() {return this._totalCount;};

/** Returns the base position */
BaseBin.prototype.pos = function() {return this._pos;};

/** Creates a list of tag, info pairs in the form
[tag]=[info] for each base, for use in feature-popup */
BaseBin.prototype.infoList = function() {
    var info = [];
    var totalCount = this._totalCount;
    var totalCountStr = "Depth=" + totalCount.toString();
    info.push(totalCountStr);
    for (var base in this._bases) {
        var baseComposition = this._bases[base];
        var baseCnt = baseComposition.cnt;
        var basePercentage = (baseCnt * 100 / totalCount); 
        var plusStrandCnt = baseComposition.strandCnt['+'];
        var minusStrandCnt = baseComposition.strandCnt['-'];
        var meanQual = baseComposition.totalQual/baseCnt;

        var baseInfoString = [base, '=', baseCnt, ' (', basePercentage.toFixed(0), '%, ',
                              plusStrandCnt, ' +, ', minusStrandCnt, ' -, Qual: ', meanQual.toFixed(0), ')'];
        info.push(baseInfoString.join(''));
    }
    return info;
};

/** Return a list of objects for creating a
histogram showing composition of different bases at a
given location.

Current implementation is hacky: the logic involves
overlaying BoxGlyphs on top of each other, thus the score
is not meaningful, but only used to manipulate height.

Params:
  ref: reference base at position
  threshold: value between 0 and 1 representing min allele frequency
              below which the allele will be ignored in histogram.
              (interpreted as noise)
              Similar to 'allele threshold' parameter in IGV

Returns a list of objects containing 2 properties
    base: such as A, T, G, C, N, - (del)
    score: a numeric score for determining height of histogram
The list is ordered such that a preceeding object always have a
score >= the current object, and the ref base will be the last item.

Example: There are 50 T's and 40 A's (total depth = 90)
at a base where ref=A. The function will return
[T: 90, A: 40]. When creating a histogram with overlap,
this will give an appearance of 40 A's (bottom) and 50 T's (top):
#######
#  T  #
#  T  #
#  T  #
#  T  #
#  T  #
#######
#  A  #
#  A  #
#  A  #
#  A  #
#######
*/
BaseBin.prototype.baseScoreList = function(ref, threshold) {
    var baseScoreList = [];
    var totalCount = this._totalCount;
    var minCount = threshold * totalCount;
    for (var base in this._bases) {
        var baseCount = this._bases[base].cnt;
        if (baseCount < minCount || base == ref)
            continue;
        var baseScorePair = {base: base, score: totalCount};
        baseScoreList.push(baseScorePair);
        totalCount -= baseCount;
    }
    baseScoreList.push({base: ref, score: totalCount});
    return baseScoreList;
};

/** Generates an aligned read from the raw sequence of a BAM record
using given cigar string.

Params:
  rawseq: unaligned read sequence from Bam record
  rawquals: unaligned read quals from Bam record
  cigar: Bam cigar string from Bam record

Returns an object with 2 properties:
  seq: string containing aligned read
  quals: string containing printable-character representation
         of sequencing quality score
*/
function alignSeqUsingCigar(rawseq, rawquals, cigar) {
    var ops = parseCigar(cigar);
    var seq = [];
    var quals = [];
    var cursor = 0;
    for (var ci = 0; ci < ops.length; ++ci) {
        var co = ops[ci];
        if (co.op == 'M') {
            seq.push(rawseq.substr(cursor, co.cnt));
            quals.push(rawquals.substr(cursor, co.cnt));
            cursor += co.cnt;
        } else if (co.op == 'D') {
            for (var oi = 0; oi < co.cnt; ++oi) {
                seq.push('-');
                quals.push('Z');
            }
        } else if (co.op == 'I') {
            cursor += co.cnt;
        } else if (co.op == 'S') {
            cursor += co.cnt;
        } else {
            console.log('unknown cigop' + co.op);
        }
    }
    var processedSeq = {seq: seq.join(''), quals: quals.join('')};
    return processedSeq;
}

/** Constructs the reference sequence for a given window.

Params
    currentSequence: DasSequence object containing ref sequence
                     in current browser view.
    min, max: min and max position for window.

Returns a string containing the refseq, padded with 'N' where sequence is not
    available.
*/
function getRefSeq(currentSequence, min, max) {
    var refSeq = [];
    if (currentSequence) {
        var csStart = currentSequence.start|0;
        var csEnd = currentSequence.end|0;
        if (csStart <= max && csEnd >= min) {
            var sfMin = Math.max(min, csStart);
            var sfMax = Math.min(max, csEnd);

            for (var i = 0; i < sfMin - min; i++)
                refSeq.push('N');
            refSeq.push(currentSequence.seq.substr(sfMin - csStart, sfMax - sfMin + 1));
            for (var i = 0; i < max - sfMax; i++)
                refSeq.push('N');
        }
    }
    return refSeq.join('');
}

/** Constructs features necessary for a coverage track showing
base composition for BAM reads

Params
    features: a list of features from BAM records.
    currentRefSeq: a DASSequence object containing reference sequence.
    baseColors: an object mapping base to desired colors.

Returns a list of features of type base-coverage.
*/
function getBaseCoverage(features, currentRefSeq, baseColors) {
    var minBin = null;
    var maxBin = null;

    var allBins = [];

    // Populate BaseBins
    for (var fi = 0; fi < features.length; ++fi) {
        var f = features[fi];
        if (f.groups && f.groups.length > 0) {
            // Don't downsample complex features
            return features;
        }
        var processedSeq = alignSeqUsingCigar(f.seq, f.quals, f.cigar);
        var seq = processedSeq.seq;
        var quals = processedSeq.quals;
        var strand = f.orientation;
        var minForFeature = f.min || 0;
        var maxForFeature = f.max || 0;
        var ind = 0;

        for (var b = minForFeature; b <= maxForFeature; ++b) {
            var bm = allBins[b];
            if (!bm) {
                bm = new BaseBin(b);
                allBins[b] = bm;
            }
            var base = seq.charAt(ind);
            var qual = quals.charCodeAt(ind) - 33; // Generate numeric qual score
            bm.recordBase(base, qual, strand);
            ind++;
        }

        if (!minBin)
            minBin = minForFeature;
        else
            minBin = Math.min(minBin, minForFeature);
        if (!maxBin)
            maxBin = maxForFeature;
        else
            maxBin = Math.max(maxBin, maxForFeature);
    }

    // Generate coverage features
    var refSeq = getRefSeq(currentRefSeq, minBin, maxBin);
    var baseFeatures = [];
    var ind = 0;
    for (var b = minBin; b <= maxBin; ++b) {
        var bm = allBins[b];
        if (bm) {
            var f = new DASFeature();
            f.segment = features[0].segment;
            f.min = bm.pos();
            f.max = f.min;
            f.notes = [];
            f.notes = f.notes.concat(bm.infoList());
            f.type = 'base-coverage';
            f.suppressScore = true;
            if (refSeq) {
                var refBase = refSeq.charAt(ind);
                var refString = 'Ref=' + refBase;
                f.notes.unshift(refString);
                var baseScoreList = bm.baseScoreList(refBase, 0.2);
                // TODO: shift 0.2 threshold to a config parameter
                for (var i = 0; i < baseScoreList.length; i++) {
                    var base = baseScoreList[i].base;
                    var score = baseScoreList[i].score;
                    var fBase = shallowCopy(f);
                    fBase.score = score;
                    // Color by baseColor when mismatch occurs
                    // otherwise, BoxGlyph to COLOR1 in style
                    if (baseScoreList.length > 1 || base != refBase)
                        fBase.itemRgb = baseColors[base];

                    baseFeatures.push(fBase);
                }
            } else {
                // No refSeq, only show coverage height.
                baseFeatures.push(f);
            }
        }
        ind ++;
    }
    return baseFeatures;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        downsample: downsample,
        getBaseCoverage: getBaseCoverage
    };
}
