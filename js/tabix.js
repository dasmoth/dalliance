/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// tabix.js: basic support for tabix-indexed flatfiles
//

"use strict";

var TABIX_MAGIC = 0x01494254;

if (typeof(require) !== 'undefined') {
    var spans = require('./spans');
    var Range = spans.Range;
    var union = spans.union;
    var intersection = spans.intersection;

    var bin = require('./bin');
    var readInt = bin.readInt;
    var readShort = bin.readShort;
    var readByte = bin.readByte;
    var readInt64 = bin.readInt64;
    var readFloat = bin.readFloat;

    var lh3utils = require('./lh3utils');
    var readVob = lh3utils.readVob;
    var unbgzf = lh3utils.unbgzf;
    var reg2bins = lh3utils.reg2bins;
    var Chunk = lh3utils.Chunk;
}

function TabixFile() {
}

function connectTabix(data, tbi, callback) {
    var tabix = new TabixFile();
    tabix.data = data;
    tabix.tbi = tbi;

    tabix.tbi.fetch(function(header) {   // Do we really need to fetch the whole thing? :-(
        if (!header) {
            return callback(null, "Couldn't access Tabix");
        }

        var unchead = unbgzf(header, header.byteLength);
        var uncba = new Uint8Array(unchead);
        var magic = readInt(uncba, 0);
        if (magic != TABIX_MAGIC) {
            return callback(null, 'Not a tabix index');
        }

        var nref = readInt(uncba, 4);
        tabix.format = readInt(uncba, 8);
        tabix.colSeq = readInt(uncba, 12);
        tabix.colStart = readInt(uncba, 16);
        tabix.colEnd = readInt(uncba, 20);
        tabix.meta = readInt(uncba, 24);
        tabix.skip = readInt(uncba, 28);
        var nameLength = readInt(uncba, 32);

        tabix.indices = [];

        var p = 36;
        tabix.chrToIndex = {};
        tabix.indexToChr = [];
        for (var i = 0; i < nref; ++i) {
            var name = ''

            while (true) {
                var ch = uncba[p++];
                if (ch == 0)
                    break;

                name += String.fromCharCode(ch);
            }

            tabix.chrToIndex[name] = i;
            if (name.indexOf('chr') == 0) {
                tabix.chrToIndex[name.substring(3)] = i;
            } else {
                tabix.chrToIndex['chr' + name] = i;
            }
            tabix.indexToChr.push(name);
        }

        var minBlockIndex = 1000000000;
        for (var ref = 0; ref < nref; ++ref) {
            var blockStart = p;
            var nbin = readInt(uncba, p); p += 4;
            for (var b = 0; b < nbin; ++b) {
                var bin = readInt(uncba, p);
                var nchnk = readInt(uncba, p+4);
                p += 8 + (nchnk * 16);
            }
            var nintv = readInt(uncba, p); p += 4;
            
            var q = p;
            for (var i = 0; i < nintv; ++i) {
                var v = readVob(uncba, q); q += 8;
                if (v) {
                    var bi = v.block;
                    if (v.offset > 0)
                        bi += 65536;

                    if (bi < minBlockIndex)
                        minBlockIndex = bi;
                    break;
                }
            }
            p += (nintv * 8);


            var ub = uncba;
            if (nbin > 0) {
                tabix.indices[ref] = new Uint8Array(unchead, blockStart, p - blockStart);
            }                     
        }

        tabix.headerMax = minBlockIndex;

        callback(tabix);
    }, {timeout: 5000});
}

// Copy-paste from BamFile

TabixFile.prototype.blocksForRange = function(refId, min, max) {
    var index = this.indices[refId];
    if (!index) {
        return [];
    }

    var intBinsL = reg2bins(min, max);
    var intBins = [];
    for (var i = 0; i < intBinsL.length; ++i) {
        intBins[intBinsL[i]] = true;
    }
    var leafChunks = [], otherChunks = [];

    var nbin = readInt(index, 0);
    var p = 4;
    for (var b = 0; b < nbin; ++b) {
        var bin = readInt(index, p);
        var nchnk = readInt(index, p+4);
        p += 8;
        if (intBins[bin]) {
            for (var c = 0; c < nchnk; ++c) {
                var cs = readVob(index, p, true);
                var ce = readVob(index, p + 8, true);
                (bin < 4681 ? otherChunks : leafChunks).push(new Chunk(cs, ce));
                p += 16;
            }
        } else {
            p +=  (nchnk * 16);
        }
    }

    var nintv = readInt(index, p);
    var lowest = null;
    var minLin = Math.min(min>>14, nintv - 1), maxLin = Math.min(max>>14, nintv - 1);
    for (var i = minLin; i <= maxLin; ++i) {
        var lb =  readVob(index, p + 4 + (i * 8));
        if (!lb) {
            continue;
        }
        if (!lowest || lb.block < lowest.block || lb.offset < lowest.offset) {
            lowest = lb;
        }
    }
    
    var prunedOtherChunks = [];
    if (lowest != null) {
        for (var i = 0; i < otherChunks.length; ++i) {
            var chnk = otherChunks[i];
            if (chnk.maxv.block >= lowest.block && chnk.maxv.offset >= lowest.offset) {
                prunedOtherChunks.push(chnk);
            }
        }
    } 
    otherChunks = prunedOtherChunks;

    var intChunks = [];
    for (var i = 0; i < otherChunks.length; ++i) {
        intChunks.push(otherChunks[i]);
    }
    for (var i = 0; i < leafChunks.length; ++i) {
        intChunks.push(leafChunks[i]);
    }

    intChunks.sort(function(c0, c1) {
        var dif = c0.minv.block - c1.minv.block;
        if (dif != 0) {
            return dif;
        } else {
            return c0.minv.offset - c1.minv.offset;
        }
    });
    var mergedChunks = [];
    if (intChunks.length > 0) {
        var cur = intChunks[0];
        for (var i = 1; i < intChunks.length; ++i) {
            var nc = intChunks[i];
            if (nc.minv.block == cur.maxv.block /* && nc.minv.offset == cur.maxv.offset */) { // no point splitting mid-block
                cur = new Chunk(cur.minv, nc.maxv);
            } else {
                mergedChunks.push(cur);
                cur = nc;
            }
        }
        mergedChunks.push(cur);
    }

    return mergedChunks;
}

TabixFile.prototype.fetch = function(chr, min, max, callback) {
    var thisB = this;

    var chrId = this.chrToIndex[chr];
    if (chrId == undefined)
        return callback([]);

    var canonicalChr = this.indexToChr[chrId];

    var chunks;
    if (chrId === undefined) {
        chunks = [];
    } else {
        chunks = this.blocksForRange(chrId, min, max);
        if (!chunks) {
            callback(null, 'Error in index fetch');
        }
    }

    var records = [];
    var index = 0;
    var data;

    function tramp() {
        if (index >= chunks.length) {
            return callback(records);
        } else if (!data) {
            var c = chunks[index];
            var fetchMin = c.minv.block;
            var fetchMax = c.maxv.block + (1<<16); // *sigh*
            thisB.data.slice(fetchMin, fetchMax - fetchMin).fetch(function(r) {
                data = unbgzf(r, c.maxv.block - c.minv.block + 1);
                return tramp();
            });
        } else {
            var ba = new Uint8Array(data);
            thisB.readRecords(ba, chunks[index].minv.offset, records, min, max, canonicalChr);
            data = null;
            ++index;
            return tramp();
        }
    }
    tramp();
}

TabixFile.prototype.readRecords = function(ba, offset, sink, min, max, chr) {
   LINE_LOOP:
    while (true) {
        var line = '';
        while (offset < ba.length) {
            var ch = ba[offset++];
            if (ch == 10) {
                var toks = line.split('\t');

                if (toks[this.colSeq - 1] == chr) {
                    var fmin = parseInt(toks[this.colStart - 1]);
                    var fmax = fmin;
                    if (this.colEnd > 0)
                        fmax = parseInt(toks[this.colEnd - 1]);
                    if (this.format & 0x10000) ++fmin;

                    if (fmin <= max && fmax >= min)
                        sink.push(line);
                }
                continue LINE_LOOP;
            } else {
                line += String.fromCharCode(ch);
            }
        }
        return;
    }
}

TabixFile.prototype.fetchHeader = function(callback) {
    var self = this;
    var fetchPtr = 0, ptr = 0, line='';
    var lines = [];

    self.data.slice(0, self.headerMax).fetch(function(chnk) {
        if (!chnk) {
            return callback(null, "Fetch failed");
        }
        var ba = new Uint8Array(unbgzf(chnk, chnk.byteLength));
        var ptr = 0, line = '', lines = [];
        while (ptr < ba.length) {
            var ch = ba[ptr++]
            if (ch == 10) {
                if (line.charCodeAt(0) == self.meta) {
                    lines.push(line);
                    line = '';
                } else {
                    return callback(lines);
                }
            } else {
                line += String.fromCharCode(ch);
            }
        }
        callback(lines);
    });
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        connectTabix: connectTabix,
        TABIX_MAGIC: TABIX_MAGIC
    };
}
