/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// chainset.js: liftover support
//

function Chainset(uri, srcTag, destTag, coords) {
    this.uri = uri;
    this.srcTag = srcTag;
    this.destTag = destTag;
    this.coords = coords;
    this.chainsBySrc = {};
    this.chainsByDest = {};
    this.postFetchQueues = {};
}

function parseCigar(cigar)
{
    var cigops = [];
    var CIGAR_REGEXP = new RegExp('([0-9]*)([MID])', 'g');
    var match;
    while ((match = CIGAR_REGEXP.exec(cigar)) != null) {
        var count = match[1];
        if (count.length == 0) {
            count = 1;
        }
        cigops.push({cnt: count|0, op: match[2]});
    }
    return cigops;
}

Chainset.prototype.fetchChainsTo = function(chr) {
    var thisCS = this;
    new DASSource(this.uri).alignments(chr, {}, function(aligns) {
        if (!thisCS.chainsByDest[chr]) {
            thisCS.chainsByDest[chr] = []; // prevent re-fetching.
        }

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

                    pusho(thisCS.chainsBySrc, chain.srcChr, chain);
                    pusho(thisCS.chainsByDest, chain.destChr, chain);
                }
            }
        }

        if (thisCS.postFetchQueues[chr]) {
            var pfq = thisCS.postFetchQueues[chr];
            for (var i = 0; i < pfq.length; ++i) {
                pfq[i]();
            }
            thisCS.postFetchQueues[chr] = null;
        }
    });
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
            return null;
        }
    }
    return null;
}

Chainset.prototype.sourceBlocksForRange = function(chr, min, max, callback) {
    if (!this.chainsByDest[chr]) {
        var fetchNeeded = !this.postFetchQueues[chr];
        var thisCS = this;
        pusho(this.postFetchQueues, chr, function() {
            thisCS.sourceBlocksForRange(chr, min, max, callback);
        });
        if (fetchNeeded) {
            this.fetchChainsTo(chr);
        }
    } else {
        var mmin = this.unmapPoint(chr, min);
        var mmax = this.unmapPoint(chr, max);
        if (!mmin || !mmax || mmin.seq != mmax.seq) {
            callback([]);
        } else {
            callback([new DASSegment(mmin.seq, mmin.pos, mmax.pos)]);
        }
    }
}
