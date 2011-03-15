/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bam.js: indexed binary alignments
//

var BAM_MAGIC = 21840194;

function BamFile() {
}

function makeBam(data, callback) {
    var bam = new BamFile();
    bam.data = data;
    bam.data.slice(0, 65536).fetch(function(r) {
	if (!r) {
	    return dlog("Couldn't access BAM");
	}

	var header = bstringToBuffer(r);
	var ba = new Uint8Array(header);
//	for (var i = 0; i < 20; ++i) {
//	   dlog('bam['+ i + '] = ' + ba[i]);
//	}
	var xlen = (ba[11] << 8) | (ba[10])
	dlog('xlen=' + xlen);
	var unc = jszlib_inflate_buffer(bstringToBuffer(r.substr( 12 + xlen, 65536-12)));
	var uncba = new Uint8Array(unc);
//	for (var i = 0; i < 20; ++i) {
//	   dlog('ubam['+ i + '] = ' + uncba[i]);
//	}

        var magic = readInt(uncba, 0);
        var headLen = readInt(uncba, 4);
        dlog('magic=' + magic);
        dlog('headerLen=' + headLen);
        var header = '';
        for (var i = 0; i < headLen; ++i) {
            header += String.fromCharCode(uncba[i + 8]);
        }
        // dlog(header);

        var nRef = readInt(uncba, headLen + 8);
        var p = headLen + 12;
        for (var i = 0; i < nRef; ++i) {
            var lName = readInt(uncba, p);
            var name = '';
            for (var j = 0; j < lName-1; ++j) {
                name += String.fromCharCode(uncba[p + 4 + j]);
            }
            var lRef = readInt(uncba, p + lName + 4);
            dlog(name + ': ' + lRef);
            p = p + 8 + lName;
        }
        var nxt = readBamRecord(uncba, p);
        dlog('Next record at ' + nxt);
        /* dlog('at nxt = ' + readInt(uncba, nxt));
        dlog('at nxt+1 = ' + readInt(uncba, nxt+1));
        dlog('at nxt+2 = ' + readInt(uncba, nxt+2));
        dlog('at nxt+3 = ' + readInt(uncba, nxt+3));
        dlog('at nxt+4 = ' + readInt(uncba, nxt+4)); */
        nxt  = readBamRecord(uncba, nxt + 4);
        nxt  = readBamRecord(uncba, nxt + 4);
    });


}

var SEQRET_DECODER = ['=', 'A', 'C', 'x', 'G', 'x', 'x', 'x', 'T', 'x', 'x', 'x', 'x', 'x', 'x', 'N'];

function readBamRecord(ba, offset) {
    var blockSize = readInt(ba, offset);
    var blockEnd = offset + blockSize;

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

function readLong(ba, offset) {
    return (ba[offset+5]<<40) | (ba[offset + 4] << 32) | (ba[offset+3] << 24) | (ba[offset+2] << 16) | (ba[offset+1] << 8) | (ba[offset]);
}