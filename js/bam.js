/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bam.js: indexed binary alignments
//

var BAM_MAGIC = 21840194;
var BAI_MAGIC = 21578050;

function BamFile() {
}

function Vob(b, o) {
    this.block = b;
    this.offset = o;
}

Vob.prototype.toString = function() {
    return '' + this.block + ':' + this.offset;
}

function Chunk(minv, maxv) {
    this.minv = minv; this.maxv = maxv;
}

function makeBam(data, bai, callback) {
    var bam = new BamFile();
    bam.data = data;
    bam.bai = bai;

    bam.data.slice(0, 65536).fetch(function(r) {
	if (!r) {
	    return dlog("Couldn't access BAM");
	}

	var header = bstringToBuffer(r);
	var ba = new Uint8Array(header);
	var xlen = (ba[11] << 8) | (ba[10])
	dlog('xlen=' + xlen);
	var unc = jszlib_inflate_buffer(bstringToBuffer(r.substr( 12 + xlen, 65536-12)));
	var uncba = new Uint8Array(unc);

        var magic = readInt(uncba, 0);
        var headLen = readInt(uncba, 4);
        dlog('magic=' + magic);
        dlog('headerLen=' + headLen);
        var header = '';
        for (var i = 0; i < headLen; ++i) {
            header += String.fromCharCode(uncba[i + 8]);
        }

        var nRef = readInt(uncba, headLen + 8);
        var p = headLen + 12;

        bam.chrToIndex = {};
        bam.indexToChr = [];
        for (var i = 0; i < nRef; ++i) {
            var lName = readInt(uncba, p);
            var name = '';
            for (var j = 0; j < lName-1; ++j) {
                name += String.fromCharCode(uncba[p + 4 + j]);
            }
            var lRef = readInt(uncba, p + lName + 4);
            // dlog(name + ': ' + lRef);
            bam.chrToIndex[name] = i;
            bam.indexToChr.push(name);

            p = p + 8 + lName;
        }

        if (bam.indices) {
            return callback(bam);
        }

        // var nxt = readBamRecord(uncba, p);
        // dlog('Next record at ' + nxt);
        // nxt  = readBamRecord(uncba, nxt + 4);
        // nxt  = readBamRecord(uncba, nxt + 4);
    });

    bam.bai.fetch(function(r) {   // Do we really need to fetch the whole thing? :-(
	if (!r) {
	    return dlog("Couldn't access BAI");
	}
        var header = bstringToBuffer(r);
        var uncba = new Uint8Array(header);


        var baiMagic = readInt(uncba, 0);
        var nref = readInt(uncba, 4);

        // dlog('got a BAI.  magic=' + baiMagic +'; nref=' + nref + '; size=' + uncba.length);
        bam.indices = [];

        var p = 8;
        for (var ref = 0; ref < nref; ++ref) {
            var nbin = readInt(uncba, p); p += 4;
            var totChnk = 0;
            var bindex = {};
            for (var b = 0; b < nbin; ++b) {
                var bin = readInt(uncba, p);
                var nchnk = readInt(uncba, p+4);
                p += 8;

                var chunks = [];
                for (var c = 0; c < nchnk; ++c) {
                    var cs = readVob(uncba, p);
                    var ce = readVob(uncba, p + 8);
                    chunks.push(new Chunk(cs, ce));
                    p += 16;
                }
                bindex[bin] = chunks;
                //                if (nchnk != 0 && b < 50) {
                //    dlog('bin ' + bin + ' contains ' + miniJSONify(chunks));
                // }
                totChnk += nchnk;
            }
            var nintv = readInt(uncba, p); p += 4;
            p += (nintv * 8);
            // dlog('ref=' + ref + ';nbin=' + nbin + '; nintv = ' + nintv + '; totChnk=' + totChnk);

            if (nbin > 0) {
                bam.indices[ref] = bindex;
            }                     
        }
        if (bam.chrToIndex) {
            return callback(bam);
        }
    });
}

BamFile.prototype.blocksForRange = function(chr, min, max) {
    var refId = this.chrToIndex[chr];
    dlog('chrLookup: ' + chr + ' = ' + refId);
    if (refId === undefined) {
        return [];
    }
    var bindex = this.indices[refId] || {};

    var intBins = reg2bins(30000000,30100000);
    var intChunks = [];
    for (var b = 0; b < intBins.length; ++b) {
        var cc = bindex[intBins[b]];
        if (cc) {
            for (var c = 0; c < cc.length; ++c) {
                intChunks.push(cc[c]);
            }
        }
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

var SEQRET_DECODER = ['=', 'A', 'C', 'x', 'G', 'x', 'x', 'x', 'T', 'x', 'x', 'x', 'x', 'x', 'x', 'N'];

function readBamRecord(ba, offset) {
    var blockSize = readInt(ba, offset);
    var blockEnd = offset + blockSize; // FIXME off by 4.

    var refID = readInt(ba, offset + 4);
    var pos = readInt(ba, offset + 8);

    var bmn = readInt(ba, offset + 12);
    var bin = (bmn & 0xffff0000) >> 16;
    var mq = (bmn & 0xff00) >> 8;
    var nl = bmn & 0xff;

    var flag_nc = readInt(ba, offset + 16);
    var flag = (flag_nc & 0xffff0000) >> 16;
    var nc = flag_nc & 0xffff;
    
    var lseq = readInt(ba, offset + 20);
    
    var nextRef  = readInt(ba, offset + 24);
    var nextPos = readInt(ba, offset + 28);
    
    var tlen = readInt(ba, offset + 32);
    
    var readName = '';
    for (var j = 0; j < nl-1; ++j) {
        readName += String.fromCharCode(ba[offset + 36 + j]);
    }
    
    var p = offset + 36 + nl;
    // Skip CIGAR
    p += nc * 4;
    
    var seq = '';
    var seqBytes = (lseq + 1) >> 1;
    dlog('seqBytes = ' + seqBytes);
    for (var j = 0; j < seqBytes; ++j) {
        var sb = ba[p + j];
        seq += SEQRET_DECODER[(sb & 0xf0) >> 4];
        seq += SEQRET_DECODER[(sb & 0x0f)];
    }
    p += seqBytes;
    dlog('seq=' + seq);

    var qseq = '';
    for (var j = 0; j < lseq; ++j) {
        qseq += String.fromCharCode(ba[p + j]);
    }
    p += lseq;
    dlog('quals=' + qseq);

    dlog('refID=' + refID + '; pos=' + pos + '; bin=' + bin + '; mq=' + mq + '; name=' + readName);

    while (p < blockEnd) {
        var tag = String.fromCharCode(ba[p]) + String.fromCharCode(ba[p + 1]);
        var type = String.fromCharCode(ba[p + 2]);
        var value;

        if (type == 'A') {
            value = String.fromCharCode(ba[p + 3]);
            p += 4;
        } else if (type == 'i' || type == 'I') {
            value = readInt(ba, p + 3);
            p += 7;
        } else if (type == 'c' || type == 'C') {
            value = ba[p + 3];
            p += 4;
        } else if (type == 's' || type == 'S') {
            value = readShort(ba, p + 3);
            p += 5;
        } else if (type == 'f') {
            throw 'FIXME need floats';
        } else if (type == 'Z') {
            p += 3;
            value = '';
            for (;;) {
                var cc = ba[p++];
                if (cc == 0) {
                    break;
                } else {
                    value += String.fromCharCode(cc);
                }
            }
        } else {
            throw 'Unknown type '+ type;
        }
        dlog(tag + ':' + value);
    }

    return blockEnd;
}

function readInt(ba, offset) {
    return (ba[offset + 3] << 24) | (ba[offset + 2] << 16) | (ba[offset + 1] << 8) | (ba[offset]);
}

function readShort(ba, offset) {
    return (ba[offset + 1] << 8) | (ba[offset]);
}

function readVob(ba, offset) {
    // return '' + ba[offset+5] + ',' + (ba[offset + 4]) + ',' +  (ba[offset+3]) +',' + ba[offset+2] + ',' + ba[offset+1] + ',' + ba[offset];
    return new Vob((ba[offset+5]<<24) | (ba[offset + 4] << 16) | (ba[offset+3] << 8) |(ba[offset+2]), (ba[offset+1] << 8) | (ba[offset]));
}

//
// Binning (transliterated from SAM1.3 spec)
//

/* calculate bin given an alignment covering [beg,end) (zero-based, half-close-half-open) */
function reg2bin(beg, end)
{
    --end;
    if (beg>>14 == end>>14) return ((1<<15)-1)/7 + (beg>>14);
    if (beg>>17 == end>>17) return ((1<<12)-1)/7 + (beg>>17);
    if (beg>>20 == end>>20) return ((1<<9)-1)/7 + (beg>>20);
    if (beg>>23 == end>>23) return ((1<<6)-1)/7 + (beg>>23);
    if (beg>>26 == end>>26) return ((1<<3)-1)/7 + (beg>>26);
    return 0;
}

/* calculate the list of bins that may overlap with region [beg,end) (zero-based) */
var MAX_BIN = (((1<<18)-1)/7);
function reg2bins(beg, end) 
{
    var i = 0, k, list = [];
    --end;
    list.push(0);
    for (k = 1 + (beg>>26); k <= 1 + (end>>26); ++k) list.push(k);
    for (k = 9 + (beg>>23); k <= 9 + (end>>23); ++k) list.push(k);
    for (k = 73 + (beg>>20); k <= 73 + (end>>20); ++k) list.push(k);
    for (k = 585 + (beg>>17); k <= 585 + (end>>17); ++k) list.push(k);
    for (k = 4681 + (beg>>14); k <= 4681 + (end>>14); ++k) list.push(k);
    return list;
}