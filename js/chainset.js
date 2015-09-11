/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// chainset.js: liftover support
//

"use strict";

if (typeof(require) !== 'undefined') {
    var das = require('./das');
    var DASSource = das.DASSource;
    var DASSegment = das.DASSegment;

    var utils = require('./utils');
    var pusho = utils.pusho;
    var shallowCopy = utils.shallowCopy;

    var parseCigar = require('./cigar').parseCigar;

    var bin = require('./bin');
    var URLFetchable = bin.URLFetchable;

    var bbi = require('./bigwig');
    var makeBwg = bbi.makeBwg;

    var Promise = require('es6-promise').Promise;
}

function Chainset(conf, srcTag, destTag, coords) {
    if (typeof(conf) == 'string') {
        this.uri = conf;
        this.srcTag = srcTag;
        this.destTag = destTag;
        this.coords = coords;
    } else {
        this.uri = conf.uri;
        this.srcTag = conf.srcTag;
        this.destTag = conf.destTag;
        this.coords = shallowCopy(conf.coords);
        this.type = conf.type;
        this.credentials = conf.credentials;
    }

    this.chainsBySrc = {};
    this.chainsByDest = {};
    this.postFetchQueues = {};
    this.fetchedTiles = {};
    this.granularity = 1000000;  // size in bases of tile to fetch

    if (this.type == 'bigbed') {
        this.chainFetcher = new BBIChainFetcher(this.uri, this.credentials);
    } else if (this.type == 'alias') {
        this.chainFetcher = new AliasChainFetcher(conf);
    } else {
        this.chainFetcher = new DASChainFetcher(this.uri, this.srcTag, this.destTag);
    }
};

Chainset.prototype.exportConfig = function() {
    return {
        uri: this.uri,
        srcTag: this.srcTag,
        destTag: this.destTag,
        coords: this.coords,
        type: this.type,
        credentials: this.credentials
    };
}

Chainset.prototype.mapPoint = function(chr, pos) {
    var chains = this.chainsBySrc[chr] || [];
    for (var ci = 0; ci < chains.length; ++ci) {
        var c = chains[ci];
        if (pos >= c.srcMin && pos <= c.srcMax) {
            var cpos;
            if (c.srcOri == '-') {
                cpos = c.srcMax - pos;
            } else {
                cpos = pos - c.srcMin;
            }
            var blocks = c.blocks;
            for (var bi = 0; bi < blocks.length; ++bi) {
                var b = blocks[bi];
                var bSrc = b[0];
                var bDest = b[1];
                var bSize = b[2];
                if (cpos >= bSrc && cpos <= (bSrc + bSize)) {
                    var apos = cpos - bSrc;

                    var dpos;
                    if (c.destOri == '-') {
                        dpos = c.destMax - bDest - apos;
                    } else {
                        dpos = apos + bDest + c.destMin;
                    }
                    return {seq: c.destChr, pos: dpos, flipped: (c.srcOri != c.destOri)}
                }
            }
        }
    }
    return null;
}

Chainset.prototype.mapSegment = function(chr, min, max) {
    var chains = this.chainsBySrc[chr] || [];
    var mappings = [];
    for (var ci = 0; ci < chains.length; ++ci) {
        var c = chains[ci];
        if (max >= c.srcMin && min <= c.srcMax) {
            var cmin, cmax;
            if (c.srcOri == '-') {
                cmin = c.srcMax - max;
                cmax = c.srcMax - min;
            } else {
                cmin = min - c.srcMin;
                cmax = max - c.srcMin;
            }
            var blocks = c.blocks;
            for (var bi = 0; bi < blocks.length; ++bi) {
                var b = blocks[bi];
                var bSrc = b[0];
                var bDest = b[1];
                var bSize = b[2];
                if (cmax >= bSrc && cmin <= (bSrc + bSize)) {
                    var m = {
                        segment: c.destChr,
                        flipped: (c.srcOri == '-') ^ (c.destOri == '-')};

                    if (c.destOri == '-') {
                        if (cmin >= bSrc) {
                            m.max = c.destMax - bDest - cmin + bSrc;
                        } else {
                            m.max = c.destMax - bDest;
                            m.partialMax = bSrc - cmin;
                        }
                        if (cmax <= (bSrc + bSize)) {
                            m.min = c.destMax - bDest - cmax + bSrc;
                        } else {
                            m.min = c.destMax - bDest - bSize;
                            m.partialMin = cmax - bSrc - bSize;
                        }
                    } else {
                        if (cmin >= bSrc) {
                            m.min = c.destMin + bDest + cmin - bSrc;
                        } else {
                            m.min = c.destMin + bDest;
                            m.partialMin = bSrc - cmin;
                        }
                        if (cmax <= (bSrc + bSize)) {
                            m.max = c.destMin + bDest + cmax - bSrc;
                        } else {
                            m.max = c.destMin + bDest + bSize;
                            m.partialMax = cmax - bSrc - bSize;
                        }
                    }
                    mappings.push(m);
                }
            }
        }
    }
    return mappings;
}

Chainset.prototype.unmapPoint = function(chr, pos) {
    var chains = this.chainsByDest[chr] || [];
    for (var ci = 0; ci < chains.length; ++ci) {
        var c = chains[ci];
        if (pos >= c.destMin && pos <= c.destMax) {
            var cpos;
            if (c.srcOri == '-') {
                cpos = c.destMax - pos;
            } else {
                cpos = pos - c.destMin;
            }    
            
            var blocks = c.blocks;
            for (var bi = 0; bi < blocks.length; ++bi) {
                var b = blocks[bi];
                var bSrc = b[0];
                var bDest = b[1];
                var bSize = b[2];

                if (cpos >= bDest && cpos <= (bDest + bSize)) {
                    var apos = cpos - bDest;

                    var dpos = apos + bSrc + c.srcMin;
                    var dpos;
                    if (c.destOri == '-') {
                        dpos = c.srcMax - bSrc - apos;
                    } else {
                        dpos = apos + bSrc + c.srcMin;
                    }
                    return {seq: c.srcChr, pos: dpos, flipped: (c.srcOri != c.destOri)}
                }
            }
            // return null;
        }
    }
    return null;
}

Chainset.prototype.sourceBlocksForRange = function(chr, min, max, callback) {
    var STATE_PENDING = 1;
    var STATE_FETCHED = 2;

    var thisCS = this;
    var minTile = (min/this.granularity)|0;
    var maxTile = (max/this.granularity)|0;

    var needsNewOrPending = false;
    var needsNewFetch = false;
    for (var t = minTile; t <= maxTile; ++t) {
        var tn = chr + '_' + t;
        if (this.fetchedTiles[tn] != STATE_FETCHED) {
            needsNewOrPending = true;
            if (this.fetchedTiles[tn] != STATE_PENDING) {
                this.fetchedTiles[tn] = STATE_PENDING;
                needsNewFetch = true;
            }
        }
    }

    if (needsNewOrPending) {
        if (!this.postFetchQueues[chr]) {
            this.chainFetcher.fetchChains(
                chr, 
                minTile * this.granularity, 
                (maxTile+1) * this.granularity - 1)
              .then(function(chains) {
                if (!thisCS.chainsByDest)
                    thisCS.chainsByDest[chr] = [];
                for (var ci = 0; ci < chains.length; ++ci) {
                    var chain = chains[ci];

                    {
                        var cbs = thisCS.chainsBySrc[chain.srcChr];
                        if (!cbs) {
                            thisCS.chainsBySrc[chain.srcChr] = [chain];
                        } else {
                            var present = false;
                            for (var oci = 0; oci < cbs.length; ++oci) {
                                var oc = cbs[oci];
                                if (oc.srcMin == chain.srcMin && oc.srcMax == chain.srcMax) {
                                    present = true;
                                    break;
                                }
                            }
                            if (!present)
                                cbs.push(chain);
                        }
                    }

                    {
                        var cbd = thisCS.chainsByDest[chain.destChr];
                        if (!cbd) {
                            thisCS.chainsByDest[chain.destChr] = [chain];
                        } else {
                            var present = false;
                            for (var oci = 0; oci < cbd.length; ++oci) {
                                var oc = cbd[oci];
                                if (oc.destMin == chain.destMin && oc.destMax == chain.destMax) {
                                    present = true;
                                    break;
                                }
                            }
                            if (!present)
                                cbd.push(chain);
                        }
                    }
                }
                for (var t = minTile; t <= maxTile; ++t) {
                    var tn = chr + '_' + t;
                    thisCS.fetchedTiles[tn] = STATE_FETCHED;
                }
                if (thisCS.postFetchQueues[chr]) {
                    var pfq = thisCS.postFetchQueues[chr];
                    for (var i = 0; i < pfq.length; ++i) {
                        pfq[i]();
                    }
                    thisCS.postFetchQueues[chr] = null;
                }
              }).catch(function (err) {
                console.log(err);
              });   
        }

        pusho(this.postFetchQueues, chr, function() {
            // Will either succeed if the tiles that are needed have already been fetched,
            // or queue up a new fetch.

            thisCS.sourceBlocksForRange(chr, min, max, callback);
        });
    } else {
        var srcBlocks = [];
        var chains = this.chainsByDest[chr] || [];
        for (var ci = 0; ci < chains.length; ++ci) {
            var c = chains[ci];
            if (min <= c.destMax && max >= c.destMin) {
                var cmin, cmax;
                if (c.srcOri == '-') {
                    cmin = c.destMax - max;
                    cmax = c.destMax - min;
                } else {
                    cmin = min - c.destMin;
                    cmax = max - c.destMin;
                }

                var blocks = c.blocks;
                for (var bi = 0; bi < blocks.length; ++bi) {
                    var b = blocks[bi];
                    var bSrc = b[0];
                    var bDest = b[1];
                    var bSize = b[2];

                    if (cmax >= bDest && cmin <= (bDest + bSize)) {
                        var amin = Math.max(cmin, bDest) - bDest;
                        var amax = Math.min(cmax, bDest + bSize) - bDest;

                        if (c.destOri == '-') {
                            srcBlocks.push(new DASSegment(c.srcChr, c.srcMax - bSrc - amax, c.srcMax - bSrc - amin));
                        } else {
                            srcBlocks.push(new DASSegment(c.srcChr, c.srcMin + amin + bSrc, c.srcMin + amax + bSrc));
                        }
                    }
                }
            }
        }
        callback(srcBlocks);
    }
}

function DASChainFetcher(uri, srcTag, destTag) {
    this.source = new DASSource(uri);
    this.srcTag = srcTag;
    this.destTag =destTag;
}

DASChainFetcher.prototype.fetchChains = function(chr, _min, _max) {
    var thisCS = this;

    return new Promise(function(resolve, reject) {
        thisCS.source.alignments(chr, {}, function(aligns) {
            var chains = [];

            for (var ai = 0; ai < aligns.length; ++ai) {
                var aln = aligns[ai];
                for (var bi = 0; bi < aln.blocks.length; ++bi) {
                    var block = aln.blocks[bi];
                    var srcSeg, destSeg;
                    for (var si = 0; si < block.segments.length; ++si) {
                        var seg = block.segments[si];
                        var obj = aln.objects[seg.object];
                        if (obj.dbSource === thisCS.srcTag) {
                            srcSeg = seg;
                        } else if (obj.dbSource === thisCS.destTag) {
                            destSeg = seg;
                        }
                    }
                    if (srcSeg && destSeg) {
                        var chain = {
                            srcChr:     aln.objects[srcSeg.object].accession,
                            srcMin:     srcSeg.min|0,
                            srcMax:     srcSeg.max|0,
                            srcOri:     srcSeg.strand,
                            destChr:    aln.objects[destSeg.object].accession,
                            destMin:    destSeg.min|0,
                            destMax:    destSeg.max|0,
                            destOri:    destSeg.strand,
                            blocks:     []
                        }

                        var srcops = parseCigar(srcSeg.cigar), destops = parseCigar(destSeg.cigar);

                        var srcOffset = 0, destOffset = 0;
                        var srci = 0, desti = 0;
                        while (srci < srcops.length && desti < destops.length) {
                            if (srcops[srci].op == 'M' && destops[desti].op == 'M') {
                                var blockLen = Math.min(srcops[srci].cnt, destops[desti].cnt);
                                chain.blocks.push([srcOffset, destOffset, blockLen]);
                                if (srcops[srci].cnt == blockLen) {
                                    ++srci;
                                } else {
                                    srcops[srci].cnt -= blockLen;
                                }
                                if (destops[desti].cnt == blockLen) {
                                    ++desti;
                                } else {
                                    destops[desti] -= blockLen;
                                }
                                srcOffset += blockLen;
                                destOffset += blockLen;
                            } else if (srcops[srci].op == 'I') {
                                destOffset += srcops[srci++].cnt;
                            } else if (destops[desti].op == 'I') {
                                srcOffset += destops[desti++].cnt;
                            }
                        }

                        chains.push(chain);
                    }
                }
            }
            resolve(chains);
        });
    });
}

function BBIChainFetcher(uri, credentials) {
    var self = this;
    this.uri = uri;
    this.credentials = credentials;

    this.bwg = new Promise(function(resolve, reject) {
        makeBwg(new URLFetchable(self.uri, {credentials: self.credentials, 
                                            resolver: self.resolver}), 
          function(bwg, err) {
            if (bwg) {
                resolve(bwg);
            } else {
                reject(err);
            }
          });
    });

    this.bwg.then(function(bwg, err) {
        if (err)
            console.log(err);
    });
}

function pi(x) {
    return parseInt(x);
}

function cleanChr(c) {
    if (c.indexOf('chr') == 0)
        return c.substr(3);
    else
        return c;
}

function bbiFeatureToChain(feature) {
    var chain = {
        srcChr:     cleanChr(feature.srcChrom),
        srcMin:     parseInt(feature.srcStart),
        srcMax:     parseInt(feature.srcEnd),
        srcOri:     feature.srcOri,
        destChr:    cleanChr(feature.segment),
        destMin:    feature.min - 1,     // Convert back from bigbed parser
        destMax:    feature.max,
        destOri:    feature.ori,
        blocks:     []
    };
    var srcStarts = feature.srcStarts.split(',').map(pi);
    var destStarts = feature.destStarts.split(',').map(pi);
    var blockLengths = feature.blockLens.split(',').map(pi);
    for (var bi = 0; bi < srcStarts.length; ++bi) {
        chain.blocks.push([srcStarts[bi], destStarts[bi], blockLengths[bi]]);
    }

    return chain;
}

BBIChainFetcher.prototype.fetchChains = function(chr, min, max) {
    return this.bwg.then(function(bwg, err) {
        if (!bwg)
            throw Error("No BWG");

        return new Promise(function(resolve, reject) {
            bwg.getUnzoomedView().readWigData(chr, min, max, function(feats) {
                resolve(feats.map(bbiFeatureToChain));
            });
        });
    });
};

function AliasChainFetcher(conf) {
    this.conf = conf;
    this.forwardAliases = {};
    var sa = conf.sequenceAliases || [];
    for (var ai = 0; ai < sa.length; ++ai) {
        var al = sa[ai];
        if (al.length < 2)
            continue;

        var fa = [];
        for (var i = 0; i < al.length - 1; ++i)
            fa.push(al[i]);
        this.forwardAliases[al[al.length - 1]] = fa;
    }
}

AliasChainFetcher.prototype.fetchChains = function(chr, min, max) {
    var resp = [];
    var fa = this.forwardAliases[chr] || [];
    for (var i = 0; i < fa.length; ++i) {
        resp.push(
            {
                srcChr:         fa[i],
                srcMin:         1,
                srcMax:         1000000000,
                srcOri:         '+',
                destChr:        chr,
                destMin:        1,
                destMax:        1000000000,
                destOri:        '+',
                blocks: [[1, 1, 1000000000]]
            });
    }

    return Promise.resolve(resp);
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        Chainset: Chainset
    };
}
