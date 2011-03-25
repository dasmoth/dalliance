/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// twoBit.js: packed-binary reference sequences
//

var TWOBIT_MAGIC = 0x1a412743;

function TwoBitFile() {
}

function makeTwoBit(fetchable, cnt) {
    var tb = new TwoBitFile();
    tb.data = fetchable;

    tb.data.slice(0, 1024).fetch(function(r) {
	if (!r) {
	    return cnt(null, "Couldn't access data");
	}
	var ba = new Uint8Array(r);
	var magic = readInt(ba, 0);
	// dlog('magic=' + magic + '; expect=' + TWOBIT_MAGIC);
	if (magic != TWOBIT_MAGIC) {
	    return cnt(null, "Not a .2bit fie");
	}

	var version = readInt(ba, 4);
	if (version != 0) {
	    return cnt(null, 'Unsupported version ' + version);
	}
	
	tb.seqCount = readInt(ba, 8);
	tb.seqDict = {};
	var p = 16;
	for (var i = 0; i < tb.seqCount; ++i) {
	    var ns = ba[p++];
	    var name = '';
	    for (var j = 1; j <= ns; ++j) {
		name += String.fromCharCode(ba[p++]);
	    }
	    var offset = readInt(ba, p);
	    p += 4;
	    tb.seqDict[name] = new TwoBitSeq(tb, offset);
	}
	return cnt(tb);
    });
}

TwoBitFile.prototype.fetch = function(chr, min, max, cnt) {
    var seq = this.seqDict[chr];
    if (!seq) {
	return cnt(null, "Couldn't find " + chr);
    } else {
	seq.fetch(min, max, cnt);
    }
}

function TwoBitSeq(tbf, offset) {
    this.tbf = tbf;
    this.offset = offset;
}

TwoBitSeq.prototype.init = function(cnt) {
    if (this.seqData) {
	return cnt();
    }

    var thisB = this;
    thisB.tbf.data.slice(thisB.offset, 8).fetch(function(r1) {
	if (!r1) {
	    return cnt('Fetch failed');
	}
	var ba = new Uint8Array(r1);
	thisB.length = readInt(ba, 0);
	thisB.nBlockCnt = readInt(ba, 4);
	dlog('length=' + thisB.length + '; nBlockCnt=' + thisB.nBlockCnt);
	thisB.tbf.data.slice(thisB.offset + 8, thisB.nBlockCnt*8 + 4).fetch(function(r2) {
	    if (!r2) {
		return cnt('Fetch failed');
	    }
	    var ba = new Uint8Array(r2);
	    thisB.mBlockCnt = readInt(ba, thisB.nBlockCnt*8);
	    dlog('mBlockCnt=' + thisB.mBlockCnt);
	    var seqLength = ((thisB.length + 3)/4)|0;
	    thisB.tbf.data.slice(thisB.offset + 16 + ((thisB.nBlockCnt + thisB.mBlockCnt) * 8), seqLength).fetch(function(r3) {
		if (!r3) {
		    return cnt('Fetch failed');
		}
		thisB.seqData = new Uint8Array(r3);
		return cnt();
	    });
	});
    });
}

var TWOBIT_TABLE = ['T', 'C', 'A', 'G'];

TwoBitSeq.prototype.fetch = function(min, max, cnt) {
    var thisB = this;
    this.init(function(error) {
	if (error) {
	    return cnt(null, error);
	}

	var seqstr = '';
	for (var i = min; i < max; ++i) {
	    var bb = i >> 2;
	    var ni = i & 0x3;
	    var bv = thisB.seqData[bb];
	    var n;
	    if (ni == 0) {
		n = (bv >> 6) & 0x3;
	    } else if (ni == 1) {
		n = (bv >> 4) & 0x3;
	    } else if (ni == 2) {
		n = (bv >> 2) & 0x3;
	    } else {
		n = (bv) & 0x3;
	    }
	    seqstr += TWOBIT_TABLE[n];
	}
	return cnt(seqstr);
    });
}
