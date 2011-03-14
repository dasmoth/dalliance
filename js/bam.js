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
    });


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