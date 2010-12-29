/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// bigwig.js: indexed binary WIG (and BED) files
//

var BIG_WIG_MAGIC = -2003829722;
var BIG_BED_MAGIC = -2021002517;

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
    // dlog('url=' + this.url + '; start=' + this.start + '; end=' + this.end);
    var req = new XMLHttpRequest();
    req.open('GET', this.url, true);
    req.overrideMimeType('text/plain; charset=x-user-defined');
    if (this.end) {
        // dlog('Range: bytes=' + this.start + '-' + this.end);
        req.setRequestHeader('Range', 'bytes=' + this.start + '-' + this.end);
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

    var udo = this.unzoomedDataOffset;
    while ((udo % 4) != 0) {
        ++udo;
    }

    this.data.slice(this.chromTreeOffset, udo - this.chromTreeOffset).fetch(function(result) {
	var bpt = bstringToBuffer(result);
	// dlog('Loaded BPT');

	var ba = new Uint8Array(bpt);
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
		    var chromId = (ba[offset+3]<<24) | (ba[offset+2]<<16) | (ba[offset+1]<<8) | (ba[offset+0]);
		    var chromSize = (ba[offset + 7]<<24) | (ba[offset+6]<<16) | (ba[offset+5]<<8) | (ba[offset+4]);
		    offset += 8;

		    // dlog(key + ':' + chromId + ',' + chromSize);
		    thisB.chromsToIDs[key] = chromId;
		    if (key.indexOf('chr') == 0) {
			thisB.chromsToIDs[key.substr(3)] = chromId;
		    }
                    thisB.idsToChroms[chromId] = key;
		}
	    }
	};
	bptReadNode(rootNodeOffset);

	callback(thisB);
    });
}

function BigWigView(bwg, cirTreeOffset, cirTreeLength, isSummary) {
    this.bwg = bwg;
    this.cirTreeOffset = cirTreeOffset;
    this.cirTreeLength = cirTreeLength;
    this.isSummary = isSummary;
}

BigWigView.prototype.readWigData = function(chrName, min, max, callback) {
    var chr = this.bwg.chromsToIDs[chrName];
    if (chr === undefined) {
        // Not an error because some .bwgs won't have data for all chromosomes.

        dlog("Couldn't find chr " + chrName);
        dlog('Chroms=' + miniJSONify(this.bwg.chromsToIDs));
        callback([]);
    } else {
        this.readWigDataById(chr, min, max, callback);
    }
}

BigWigView.prototype.readWigDataById = function(chr, min, max, callback) {
    var thisB = this;
    if (!this.cir) {
	// dlog('No CIR yet, fetching');
        this.bwg.data.slice(this.cirTreeOffset, this.cirTreeLength).fetch(function(result) {
	    thisB.cir = bstringToBuffer(result);
	    thisB.readWigDataById(chr, min, max, callback);
	});
	return;
    }

    // dlog('Got ' + this.cir.byteLength + ' bytes of CIR');
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
		    // dlog('Got an interesting block: startBase=' + startBase + '; endBase=' + endBase + '; offset=' + blockOffset + '; size=' + blockSize);
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
		    // dlog('Need to recur: ' + blockOffset);
		    cirFobRecur(blockOffset - thisB.cirTreeOffset);
		}
		offset += 24;
	    }
	}
    };
    cirFobRecur(48);

    blocksToFetch.sort(function(b0, b1) {
        return (b0.offset|0) - (b1.offset|0);
    });

    if (blocksToFetch.length == 0) {
	callback([]);
    } else {
	var features = [];
	var createFeature = function(fmin, fmax, opts) {
            if (!opts) {
                opts = {};
            }
            
            var f = new DASFeature();
            f.segment = thisB.bwg.idsToChroms[chr];
            f.min = fmin;
            f.max = fmax;
            f.type = 'bigwig';
            
            for (k in opts) {
                f[k] = opts[k];
            }

	    features.push(f);
	};
        var maybeCreateFeature = function(fmin, fmax, opts) {
            if (fmin <= max && fmax >= min) {
                createFeature(fmin, fmax, opts);
            }
        };
	var tramp = function() {
	    if (blocksToFetch.length == 0) {
		callback(features);
		return;  // just in case...
	    } else {
		var block = blocksToFetch[0];
		if (block.data) {
                    var ba = new Uint8Array(block.data);

                    if (thisB.isSummary) {
                        var sa = new Int16Array(block.data);
		        var la = new Int32Array(block.data);
		        var fa = new Float32Array(block.data);

                        // dlog('processing summary block...')
                        var itemCount = block.data.byteLength/32;
                        // dlog('Summary itemCount=' + itemCount);
                        for (var i = 0; i < itemCount; ++i) {
                            var chromId =   la[(i*8)];
                            var start =     la[(i*8)+1];
                            var end =       la[(i*8)+2];
                            var validCnt =  la[(i*8)+3];
                            var minVal    = fa[(i*8)+4];
                            var maxVal    = fa[(i*8)+5];
                            var sumData   = fa[(i*8)+6];
                            var sumSqData = fa[(i*8)+7];

                            if (chromId == chr) {
                                maybeCreateFeature(start, end, {score: sumData/validCnt});
                            }
                        }
                    } else if (thisB.bwg.type == 'bigwig') {
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
			        maybeCreateFeature(blockStart + (i*itemStep), blockStart + (i*itemStep) + itemSpan, {score: score});
			    }
		        } else if (blockType == BIG_WIG_TYPE_VSTEP) {
			    for (var i = 0; i < itemCount; ++i) {
			        var start = la[(i*2) + 6];
			        var score = fa[(i*2) + 7];
			        maybeCreateFeature(start, start + itemSpan, {score: score});
			    }
		        } else if (blockType == BIG_WIG_TYPE_GRAPH) {
			    for (var i = 0; i < itemCount; ++i) {
			        var start = la[(i*3) + 6];
			        var end   = la[(i*3) + 7];
			        var score = fa[(i*3) + 8];
			        maybeCreateFeature(start, end, {score: score});
			    }
		        } else {
			    dlog('Currently not handling bwgType=' + blockType);
		        }
                    } else if (thisB.bwg.type == 'bigbed') {
                        var offset = 0;
                        while (offset < ba.length) {
                            var chromId = (ba[offset+3]<<24) | (ba[offset+2]<<16) | (ba[offset+1]<<8) | (ba[offset+0]);
                            var start = (ba[offset+7]<<24) | (ba[offset+6]<<16) | (ba[offset+5]<<8) | (ba[offset+4]);
                            var end = (ba[offset+11]<<24) | (ba[offset+10]<<16) | (ba[offset+9]<<8) | (ba[offset+8]);
                            offset += 12;
                            var rest = '';
                            while (true) {
                                var ch = ba[offset++];
                                if (ch != 0) {
                                    rest += String.fromCharCode(ch);
                                } else {
                                    break;
                                }
                            }

                            var featureOpts = {};

                            var bedColumns = rest.split('\t');
                            if (bedColumns.length > 0) {
                                featureOpts.label = bedColumns[0];
                            }
                            if (bedColumns.length > 1) {
                                featureOpts.score = 100; /* bedColumns[1]; */
                            }
                            if (bedColumns.length > 2) {
                                featureOpts.orientation = bedColumns[2];
                            }

                            if (bedColumns.length < 9) {
                                if (chromId == chr) {
                                    maybeCreateFeature(start, end, featureOpts);
                                }
                            } else if (chromId == chr && start <= max && end >= min) {
                                // Complex-BED?
                                // FIXME this is currently a bit of a hack to do Clever Things with ensGene.bb

                                var thickStart = bedColumns[3]|0;
                                var thickEnd   = bedColumns[4]|0;
                                var blockCount = bedColumns[6]|0;
                                var blockStarts = bedColumns[7].split(',');
                                var blockEnds = bedColumns[8].split(',');

                                featureOpts.type = 'bb-transcript'
                                var grp = new DASGroup();
                                grp.id = bedColumns[0];
                                grp.type = 'bb-transcript'
                                grp.notes = [];
                                featureOpts.groups = [grp];

                                if (bedColumns.length > 10) {
                                    var geneId = bedColumns[9];
                                    var geneName = bedColumns[10];
                                    var gg = new DASGroup();
                                    gg.id = geneId;
                                    gg.label = geneName;
                                    gg.type = 'gene';
                                    featureOpts.groups.push(gg);
                                }

                                var spans = null;
                                for (var b = 0; b < blockCount; ++b) {
                                    var bmin = blockStarts[b]|0;
                                    var bmax = blockEnds[b]|0;
                                    var span = new Range(bmin, bmax);
                                    if (spans) {
                                        spans = union(spans, span);
                                    } else {
                                        spans = span;
                                    }
                                    // dlog('bmin=' + bmin + '; bmax=' + bmax);
                                    // createFeature(bmin, bmax, featureOpts);
                                }
                                
                                var tsList = spans.ranges();
                                for (var s = 0; s < tsList.length; ++s) {
                                    var ts = tsList[s];
                                    createFeature(ts.min(), ts.max(), featureOpts);
                                }

                                var tl = intersection(spans, new Range(thickStart, thickEnd));
                                if (tl) {
                                    featureOpts.type = 'bb-translation';
                                    var tlList = tl.ranges();
                                    for (var s = 0; s < tlList.length; ++s) {
                                        var ts = tlList[s];
                                        createFeature(ts.min(), ts.max(), featureOpts);
                                    }
                                }
                            }
                        }
                    } else {
                        dlog("Don't know what to do with " + thisB.bwg.type);
                    }
		    blocksToFetch.splice(0, 1);
		    tramp();
		} else {
                    var fetchStart = block.offset;
                    var fetchSize = block.size;
                    var bi = 1;
                    while (bi < blocksToFetch.length && blocksToFetch[bi].offset == (fetchStart + fetchSize)) {
                        fetchSize += blocksToFetch[bi].size;
                        ++bi;
                    }

                    /* if (bi > 1) {
                        dlog('Aggregate fetch of ' + bi + ' blocks');
                    } */

		    thisB.bwg.data.slice(fetchStart, fetchSize).fetch(function(result) {
                        var offset = 0;
                        var bi = 0;
                        while (offset < fetchSize) {
                            var fb = blocksToFetch[bi];
                            var bresult;
			    if (thisB.bwg.uncompressBufSize > 0) {
			        bresult = JSInflate.inflate(result.substr(offset + 2, fb.size - 2));
			    } else {
                                bresult = result.substr(offset, fb.size);
                            }
			    fb.data = bstringToBuffer(bresult);

                            offset += fb.size;
                            ++bi;
                        }
			tramp();
		    });
		}
	    }
	}
	tramp();
    }
}

BigWig.prototype.readWigData = function(chrName, min, max, callback) {
    this.getUnzoomedView().readWigData(chrName, min, max, callback);
}

BigWig.prototype.getUnzoomedView = function() {
    if (!this.unzoomedView) {
        this.unzoomedView = new BigWigView(this, this.unzoomedIndexOffset, this.zoomLevels[0].dataOffset - this.unzoomedIndexOffset, false);
    }
    return this.unzoomedView;
}

BigWig.prototype.getZoomedView = function(z) {
    var zh = this.zoomLevels[z];
    if (!zh.view) {
        zh.view = new BigWigView(this, zh.indexOffset, this.zoomLevels[z + 1].dataOffset - zh.indexOffset, true);
    }
    return zh.view;
}


function makeBwgFromURL(url, callback) {
    makeBwg(new URLFetchable(url), callback);
}

function makeBwgFromFile(file, callback) {
    makeBwg(new BlobFetchable(file), callback);
}

function makeBwg(data, callback) {
    // dlog('makeBwg');
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

        var header = bstringToBuffer(result);
	var sa = new Int16Array(header);
	var la = new Int32Array(header);
	if (la[0] == BIG_WIG_MAGIC) {
            bwg.type = 'bigwig';
        } else if (la[0] == BIG_BED_MAGIC) {
            bwg.type = 'bigbed';
        } else {
	    dlog('Invalid magic=' + la[0]);
	    return;
	}
//        dlog('magic okay');

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
         
        dlog('bigType: ' + bwg.type);
	// dlog('chromTree at: ' + bwg.chromTreeOffset);
	// dlog('uncompress: ' + bwg.uncompressBufSize);
	// dlog('data at: ' + bwg.unzoomedDataOffset);
	// dlog('index at: ' + bwg.unzoomedIndexOffset);
        // dlog('field count: ' + bwg.fieldCount);
        // dlog('defined count: ' + bwg.definedFieldCount);

	bwg.zoomLevels = [];
	for (var zl = 0; zl < bwg.numZoomLevels; ++zl) {
	    var zlReduction = la[zl*6 + 16]
	    var zlData = (la[zl*6 + 18]<<32)|(la[zl*6 + 19]);
	    var zlIndex = (la[zl*6 + 20]<<32)|(la[zl*6 + 21]);
	    // dlog('zoom(' + zl + '): reduction=' + zlReduction + '; data=' + zlData + '; index=' + zlIndex);
	    bwg.zoomLevels.push({reduction: zlReduction, dataOffset: zlData, indexOffset: zlIndex});
	}

	bwg.readChromTree(function() {
            callback(bwg);
	});
    });
}
