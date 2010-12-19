/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// bigwig.js: indexed binary WIG files
//

var BIG_WIG_MAGIC = -2003829722;

var BIG_WIG_TYPE_GRAPH = 1;
var BIG_WIG_TYPE_VSTEP = 2;
var BIG_WIG_TYPE_FSTEP = 3;

function BlobFetchable(b) {
    this.blob = b;
}

BlobFetchable.prototype.slice = function(start, length) {
    var b;
    if (length) {
        b = this.blob.slice(start, length);
    } else {
        b = this.blob.slice(start);
    }
    return new BlobFetchable(b);
}

BlobFetchable.prototype.fetch = function(callback) {
    var reader = new FileReader();
    reader.onloadend = function(ev) {
        callback(reader.result);
    };
    reader.readAsBinaryString(this.blob);
}

function URLFetchable(url, start, end) {
    this.url = url;
    this.start = start || 0;
    if (end) {
        this.end = end;
    }
}

URLFetchable.prototype.slice = function(s, l) {
    var ns = this.start, ne = this.end;
    if (ns && s) {
        ns = ns + s;
    } else {
        ns = s || ns;
    }
    if (l && ns) {
        ne = ns + l - 1;
    } else {
        ne = ne || l - 1;
    }
    return new URLFetchable(this.url, ns, ne);
}

URLFetchable.prototype.fetch = function(callback) {
    dlog('url=' + this.url + '; start=' + this.start + '; end=' + this.end);
    var req = new XMLHttpRequest();
    req.open('GET', this.url, true);
    req.overrideMimeType('text/plain; charset=x-user-defined');
    if (this.end) {
        dlog('Range: bytes=' + this.start + '-' + this.end);
        req.setRequestHeader('Range', 'bytes=' + this.start + '-' + this.end);
        // req.setRequestHeader('X-Blibble', 'bar');
    }
    req.onreadystatechange = function() {
        if (req.readyState == 4) {
            if (req.status == 200 || req.status == 206) {
                callback(req.responseText);
            } else {
                dlog('HTTP status = ' + req.status);
            }
        }
    };
    req.send('');
}


function dlog(msg) {
    var logHolder = document.getElementById('log');
    if (logHolder) {
	logHolder.appendChild(makeElement('p', msg));
    }
}

function bstringToBuffer(result) {
    var ba = new Int8Array(result.length);
    for (var i = 0; i < ba.length; ++i) {
        ba[i] = result.charCodeAt(i);
    }
    return ba.buffer;
}
    
function BigWig() {
}

BigWig.prototype.readChromTree = function(callback) {
    var thisB = this;
    this.chromsToIDs = {};
    this.idsToChroms = {};

    this.data.slice(this.chromTreeOffset, this.unzoomedDataOffset - this.chromTreeOffset).fetch(function(result) {
	var bpt = bstringToBuffer(result);
	dlog('Loaded BPT');

	var ba = new Int8Array(bpt);
	var sa = new Int16Array(bpt);
	var la = new Int32Array(bpt);
	var bptMagic = la[0];
	var blockSize = la[1];
	var keySize = la[2];
	var valSize = la[3];
	var itemCount = (la[4] << 32) | (la[5]);
	var rootNodeOffset = 32;
	
	// dlog('blockSize=' + blockSize + '    keySize=' + keySize + '   valSize=' + valSize + '    itemCount=' + itemCount);

	var bptReadNode = function(offset) {
	    var nodeType = ba[offset];
	    var cnt = sa[(offset/2) + 1];
	    // dlog('ReadNode: ' + offset + '     type=' + nodeType + '   count=' + cnt);
	    offset += 4;
	    for (var n = 0; n < cnt; ++n) {
		if (nodeType == 0) {
		    offset += keySize;
		    var childOffset = (la[offset/4] << 32) | (la[offset/4 + 1]);
		    offset += 8;
		    childOffset -= thisB.chromTreeOffset;
		    bptReadNode(childOffset);
		} else {
		    var key = '';
		    for (var ki = 0; ki < keySize; ++ki) {
			var charCode = ba[offset++];
			if (charCode != 0) {
			    key += String.fromCharCode(charCode);
			}
		    }
		    var chromId = la[offset/4];
		    var chromSize = la[offset/4 + 1];
		    offset += 8;

		    // dlog(key + ':' + chromId + ',' + chromSize);
		    thisB.chromsToIDs[key] = chromId;
		    if (key.indexOf('chr') == 0) {
			thisB.chromsToIDs[key.substr(3)] = chromId;
		    }
		}
	    }
	};
	bptReadNode(rootNodeOffset);

	callback(thisB);
    });
}

BigWig.prototype.readCirHeader = function(callback) {
    var thisB = this;
    this.data.slice(this.unzoomedIndexOffset, 48).fetch(function(result) {
	var cir = bstringToBuffer(result);
	var ba = new Int8Array(cir);
	var la = new Int32Array(cir);
	var magic = la[0];
	thisB.cirBlockSize = la[1];
	thisB.cirItemCount = (la[2] << 32)|(la[3]);
	thisB.cirStartChromIx = la[4];
	thisB.cirStartBase = la[5];
	thisB.cirEndChromIx = la[6];
	thisB.cirEndBase = la[7];
	thisB.cirFileSize = (la[8]<<32)|(la[9]);
	thisB.cirItemsPerSlot = la[10];

	dlog('Read CIR header.  magic=' + magic + '   size=' + thisB.cirFileSize);
	callback(thisB);
    });
}

BigWig.prototype.readWigData = function(chr, min, max, callback) {
    var thisB = this;
    if (!this.cir) {
	dlog('No CIR yet, fetching');
	this.data.slice(this.unzoomedIndexOffset, this.zoomLevels[0].dataOffset - this.unzoomedIndexOffset).fetch(function(result) {
	    thisB.cir = bstringToBuffer(result);
	    thisB.readWigData(chr, min, max, callback);
	});
	return;
    }

    dlog('Got ' + this.cir.byteLength + ' bytes of CIR');
    var ba = new Int8Array(this.cir);
    var sa = new Int16Array(this.cir);
    var la = new Int32Array(this.cir);

    var blocksToFetch = [];

    var cirFobRecur = function(offset) {
	var isLeaf = ba[offset];
	var cnt = sa[offset/2 + 1];
	offset += 4;

	if (isLeaf != 0) {
	    for (var i = 0; i < cnt; ++i) {
		var lo = offset/4;
		var startChrom = la[lo];
		var startBase = la[lo + 1];
		var endChrom = la[lo + 2];
		var endBase = la[lo + 3];
		var blockOffset = (la[lo + 4]<<32) | (la[lo + 5]);
		var blockSize = (la[lo + 6]<<32) | (la[lo + 7]);
		if ((startChrom < chr || (startChrom == chr && startBase <= max)) &&
		    (endChrom   > chr || (endChrom == chr && endBase >= min)))
		{
		    dlog('Got an interesting block: startBase=' + startBase + '; endBase=' + endBase + '; offset=' + blockOffset + '; size=' + blockSize);
		    blocksToFetch.push({offset: blockOffset, size: blockSize});
		}
		offset += 32;
	    }
	} else {
	    for (var i = 0; i < cnt; ++i) {
		var lo = offset/4;
		var startChrom = la[lo];
		var startBase = la[lo + 1];
		var endChrom = la[lo + 2];
		var endBase = la[lo + 3];
		var blockOffset = (la[lo + 4]<<32) | (la[lo + 5]);
		if ((startChrom < chr || (startChrom == chr && startBase <= max)) &&
		    (endChrom   > chr || (endChrom == chr && endBase >= min)))
		{
		    dlog('Need to recur: ' + blockOffset);
		    cirFobRecur(blockOffset - thisB.unzoomedIndexOffset);
		}
		offset += 24;
	    }
	}
    };
    cirFobRecur(48);
    if (blocksToFetch.length == 0) {
	callback([]);
    } else {
	var features = [];
	var maybeCreateFeature = function(fmin, fmax, score) {
	    if (fmin <= max && fmax >= min) {
		features.push({min: fmin, max: fmax, score: score});
	    }
	};
	var tramp = function() {
	    if (blocksToFetch.length == 0) {
		callback(features);
		return;  // just in case...
	    } else {
		var block = blocksToFetch[0];
		if (block.data) {
		    var ba = new Int8Array(block.data);
		    var sa = new Int16Array(block.data);
		    var la = new Int32Array(block.data);
		    var fa = new Float32Array(block.data);
		    
		    var chromId = la[0];
		    var blockStart = la[1];
		    var blockEnd = la[2];
		    var itemStep = la[3];
		    var itemSpan = la[4];
		    var blockType = ba[20];
		    var itemCount = sa[11];

		    if (blockType == BIG_WIG_TYPE_FSTEP) {
			for (var i = 0; i < itemCount; ++i) {
			    var score = fa[i + 6];
			    maybeCreateFeature(blockStart + (i*itemStep), blockStart + (i*itemStep) + itemSpan, score);
			}
		    } else if (blockType == BIG_WIG_TYPE_VSTEP) {
			for (var i = 0; i < itemCount; ++i) {
			    var start = la[(i*2) + 6];
			    var score = fa[(i*2) + 7];
			    maybeCreateFeature(start, start + itemSpan, score);
			}
		    } else if (blockType == BIG_WIG_TYPE_GRAPH) {
			for (var i = 0; i < itemCount; ++i) {
			    var start = la[(i*3) + 6];
			    var end   = la[(i*3) + 7];
			    var score = fa[(i*3) + 8];
			    maybeCreateFeature(start, end, score);
			}
		    } else {
			dlog('Currently not handling bwgType=' + blockType);
		    }
		    blocksToFetch.splice(0, 1);
		    tramp();
		} else {
		    thisB.data.slice(block.offset, block.size).fetch(function(result) {
			if (thisB.uncompressBufSize > 0) {
			    // dlog('first few bytes of compressed block: ' + result.charCodeAt(0) + ',' + result.charCodeAt(1)); 
			    dlog('inflating ' + result.length);
			    result = JSInflate.inflate(result.substr(2));
			    dlog('inflated ' + result.length);
			}
			block.data = bstringToBuffer(result);
			tramp();
		    });
		}
	    }
	}
	tramp();
    }
}

function handle() {
    makeBwgFromURL('http://localhost/msh10h.bw', function(bwg) {
        bwg.readWigData(0, 30000000, 30010000, function(features) {
	    dlog(miniJSONify(features));
	});
    });
    return false;
}

function makeBwgFromURL(url, callback) {
    makeBwg(new URLFetchable(url), callback);
}

function makeBwgFromFile(file, callback) {
    makeBwg(new BlobFetchable(file), callback);
}

function makeBwg(data, callback) {
    var bwg = new BigWig();
    bwg.data = data;
     bwg.data.slice(0, 512).fetch(function(result) {

/*
        dlog('Loadend: status=' + bwgHeadReader.readyState + ' error=' + bwgHeadReader.error);
        if (bwgHeadReader.error) {
            dlog('errorCode=' + bwgHeadReader.error.code);
            dlog('errorMessage=' + bwgHeadReader.error.getMessage());
        }

*/

        dlog('File size=' + result.length);
        var header = bstringToBuffer(result);
	var sa = new Int16Array(header);
	var la = new Int32Array(header);
	if (la[0] != BIG_WIG_MAGIC) {
	    dlog('Invalid magic=' + la[0]);
	    return;
	}
        dlog('magic okay');

	bwg.version = sa[2];             // 4
	bwg.numZoomLevels = sa[3];       // 6
	bwg.chromTreeOffset = (la[2] << 32) | (la[3]);     // 8
	bwg.unzoomedDataOffset = (la[4] << 32) | (la[5]);  // 16
        bwg.unzoomedIndexOffset = (la[6] << 32) | (la[7]); // 24
        bwg.fieldCount = sa[16];         // 32
        bwg.definedFieldCount = sa[17];  // 34
        bwg.asOffset = (la[9] << 32) | (la[10]);    // 36 (unaligned longlong)
        bwg.totalSummaryOffset = (la[11] << 32) | (la[12]);    // 44 (unaligned longlong)
        bwg.uncompressBufSize = la[13];  // 52

	dlog('chromTree at: ' + bwg.chromTreeOffset);
        dlog('fieldCount: ' + bwg.fieldCount);
	dlog('uncompress: ' + bwg.uncompressBufSize);
	dlog('data at: ' + bwg.unzoomedDataOffset);
	dlog('index at: ' + bwg.unzoomedIndexOffset);

	bwg.zoomLevels = [];
	for (var zl = 0; zl < bwg.numZoomLevels; ++zl) {
	    var zlReduction = la[zl*6 + 16]
	    var zlData = (la[zl*6 + 18]<<32)|(la[zl*6 + 19]);
	    var zlIndex = (la[zl*6 + 20]<<32)|(la[zl*6 + 21]);
	    // dlog('zoom(' + zl + '): reduction=' + zlReduction + '; data=' + zlData + '; index=' + zlIndex);
	    bwg.zoomLevels.push({reduction: zlReduction, dataOffset: zlData, indexOffset: zlIndex});
	}

	bwg.readChromTree(function() {
	    bwg.readCirHeader(function() {
		dlog("BWG is armed and ready");
                callback(bwg);
	    });
	});

	
    });
}
