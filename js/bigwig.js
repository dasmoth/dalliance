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

    this.data.slice(this.chromTreeOffset, udo - this.chromTreeOffset).fetch(function(bpt) {
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

BED_COLOR_REGEXP = new RegExp("^[0-9]+,[0-9]+,[0-9]+");

BigWigView.prototype.readWigData = function(chrName, min, max, callback) {
    var chr = this.bwg.chromsToIDs[chrName];
    if (chr === undefined) {
        // Not an error because some .bwgs won't have data for all chromosomes.

        // dlog("Couldn't find chr " + chrName);
        // dlog('Chroms=' + miniJSONify(this.bwg.chromsToIDs));
        return callback([]);
    } else {
        this.readWigDataById(chr, min, max, callback);
    }
}

BigWigView.prototype.readWigDataById = function(chr, min, max, callback) {
    var thisB = this;
    if (!this.cirHeader) {
        // dlog('No CIR yet, fetching');
        this.bwg.data.slice(this.cirTreeOffset, 48).fetch(function(result) {
            thisB.cirHeader = result;
            var la = new Int32Array(thisB.cirHeader);
            thisB.cirBlockSize = la[1];
            thisB.readWigDataById(chr, min, max, callback);
        });
        return;
    }

    var blocksToFetch = [];
    var outstanding = 0;

    var beforeBWG = Date.now();

    var cirFobRecur = function(offset, level) {
        outstanding += offset.length;

        var maxCirBlockSpan = 4 +  (thisB.cirBlockSize * 32);   // Upper bound on size, based on a completely full leaf node.
        var spans;
        for (var i = 0; i < offset.length; ++i) {
            var blockSpan = new Range(offset[i], Math.min(offset[i] + maxCirBlockSpan, thisB.cirTreeOffset + thisB.cirTreeLength));
            spans = spans ? union(spans, blockSpan) : blockSpan;
        }
        
        var fetchRanges = spans.ranges();
        // dlog('fetchRanges: ' + fetchRanges);
        for (var r = 0; r < fetchRanges.length; ++r) {
            var fr = fetchRanges[r];
            cirFobStartFetch(offset, fr, level);
        }
    }

    var cirFobStartFetch = function(offset, fr, level, attempts) {
        var length = fr.max() - fr.min();
        // dlog('fetching ' + fr.min() + '-' + fr.max() + ' (' + (fr.max() - fr.min()) + ')');
        thisB.bwg.data.slice(fr.min(), fr.max() - fr.min()).fetch(function(resultBuffer) {
            for (var i = 0; i < offset.length; ++i) {
                if (fr.contains(offset[i])) {
                    cirFobRecur2(resultBuffer, offset[i] - fr.min(), level);
                    --outstanding;
                    if (outstanding == 0) {
                        cirCompleted();
                    }
                }
            }
        });
    }

    var cirFobRecur2 = function(cirBlockData, offset, level) {
        var ba = new Int8Array(cirBlockData);
        var sa = new Int16Array(cirBlockData);
        var la = new Int32Array(cirBlockData);

        var isLeaf = ba[offset];
        var cnt = sa[offset/2 + 1];
        // dlog('cir level=' + level + '; cnt=' + cnt);
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
            var recurOffsets = [];
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
                    recurOffsets.push(blockOffset);
                }
                offset += 24;
            }
            if (recurOffsets.length > 0) {
                cirFobRecur(recurOffsets, level + 1);
            }
        }
    };
    

    var cirCompleted = function() {
        blocksToFetch.sort(function(b0, b1) {
            return (b0.offset|0) - (b1.offset|0);
        });

        if (blocksToFetch.length == 0) {
            callback([]);
        } else {
            var features = [];
            var createFeature = function(fmin, fmax, opts) {
                // dlog('createFeature(' + fmin +', ' + fmax + ')');

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
                    var afterBWG = Date.now();
                    // dlog('BWG fetch took ' + (afterBWG - beforeBWG) + 'ms');
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

                            var itemCount = block.data.byteLength/32;
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
                                    var summaryOpts = {type: 'bigwig', score: sumData/validCnt};
                                    if (thisB.bwg.type == 'bigbed') {
                                        summaryOpts.type = 'density';
                                    }
                                    maybeCreateFeature(start, end, summaryOpts);
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

                            // dlog('processing bigwig block, type=' + blockType + '; count=' + itemCount);
                            
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
                                    var start = la[(i*3) + 6] + 1;
                                    var end   = la[(i*3) + 7];
                                    var score = fa[(i*3) + 8];
                                    if (start > end) {
                                        start = end;
                                    }
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
                                    featureOpts.score = stringToInt(bedColumns[1]);
                                }
                                if (bedColumns.length > 2) {
                                    featureOpts.orientation = bedColumns[2];
                                }
                                if (bedColumns.length > 5) {
                                    var color = bedColumns[5];
                                    if (BED_COLOR_REGEXP.test(color)) {
                                        featureOpts.override_color = 'rgb(' + color + ')';
                                    }
                                }

                                if (bedColumns.length < 9) {
                                    if (chromId == chr) {
                                        maybeCreateFeature(start + 1, end, featureOpts);
                                    }
                                } else if (chromId == chr && start <= max && end >= min) {
                                    // Complex-BED?
                                    // FIXME this is currently a bit of a hack to do Clever Things with ensGene.bb

                                    var thickStart = bedColumns[3]|0;
                                    var thickEnd   = bedColumns[4]|0;
                                    var blockCount = bedColumns[6]|0;
                                    var blockSizes = bedColumns[7].split(',');
                                    var blockStarts = bedColumns[8].split(',');
                                    
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
                                        var bmin = (blockStarts[b]|0) + start;
                                        var bmax = bmin + (blockSizes[b]|0);
                                        var span = new Range(bmin, bmax);
                                        if (spans) {
                                            spans = union(spans, span);
                                        } else {
                                            spans = span;
                                        }
                                    }
                                    
                                    var tsList = spans.ranges();
                                    for (var s = 0; s < tsList.length; ++s) {
                                        var ts = tsList[s];
                                        createFeature(ts.min() + 1, ts.max(), featureOpts);
                                    }

                                    if (thickEnd > thickStart) {
                                        var tl = intersection(spans, new Range(thickStart, thickEnd));
                                        if (tl) {
                                            featureOpts.type = 'bb-translation';
                                            var tlList = tl.ranges();
                                            for (var s = 0; s < tlList.length; ++s) {
                                                var ts = tlList[s];
                                                createFeature(ts.min() + 1, ts.max(), featureOpts);
                                            }
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

                        thisB.bwg.data.slice(fetchStart, fetchSize).fetch(function(result) {
                            var offset = 0;
                            var bi = 0;
                            while (offset < fetchSize) {
                                var fb = blocksToFetch[bi];
                            
                                var data;
                                if (thisB.bwg.uncompressBufSize > 0) {
                                    // var beforeInf = Date.now();
                                    data = jszlib_inflate_buffer(result, offset + 2, fb.size - 2);
                                    // var afterInf = Date.now();
                                    // dlog('inflate: ' + (afterInf - beforeInf) + 'ms');
                                } else {
                                    var tmp = new Uint8Array(fb.size);    // FIXME is this really the best we can do?
                                    arrayCopy(new Uint8Array(result, offset, fb.size), 0, tmp, 0, fb.size);
                                    data = tmp.buffer;
                                }
                                fb.data = data;
                                
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

    cirFobRecur([thisB.cirTreeOffset + 48], 1);
}

//
// nasty cut/paste, should roll back in!
//

BigWigView.prototype.getFirstAdjacent = function(chrName, pos, dir, callback) {
    var chr = this.bwg.chromsToIDs[chrName];
    if (chr === undefined) {
        // Not an error because some .bwgs won't have data for all chromosomes.

        // dlog("Couldn't find chr " + chrName);
        // dlog('Chroms=' + miniJSONify(this.bwg.chromsToIDs));
        return callback([]);
    } else {
        this.getFirstAdjacentById(chr, pos, dir, callback);
    }
}

BigWigView.prototype.getFirstAdjacentById = function(chr, pos, dir, callback) {
    var thisB = this;
    if (!this.cirHeader) {
        // dlog('No CIR yet, fetching');
        this.bwg.data.slice(this.cirTreeOffset, 48).fetch(function(result) {
            thisB.cirHeader = result;
            var la = new Int32Array(thisB.cirHeader);
            thisB.cirBlockSize = la[1];
            thisB.readWigDataById(chr, min, max, callback);
        });
        return;
    }

    var blockToFetch = null;
    var bestBlockChr = -1;
    var bestBlockOffset = -1;

    var outstanding = 0;

    var beforeBWG = Date.now();

    var cirFobRecur = function(offset, level) {
        outstanding += offset.length;

        var maxCirBlockSpan = 4 +  (thisB.cirBlockSize * 32);   // Upper bound on size, based on a completely full leaf node.
        var spans;
        for (var i = 0; i < offset.length; ++i) {
            var blockSpan = new Range(offset[i], Math.min(offset[i] + maxCirBlockSpan, thisB.cirTreeOffset + thisB.cirTreeLength));
            spans = spans ? union(spans, blockSpan) : blockSpan;
        }
        
        var fetchRanges = spans.ranges();
        // dlog('fetchRanges: ' + fetchRanges);
        for (var r = 0; r < fetchRanges.length; ++r) {
            var fr = fetchRanges[r];
            cirFobStartFetch(offset, fr, level);
        }
    }

    var cirFobStartFetch = function(offset, fr, level, attempts) {
        var length = fr.max() - fr.min();
        // dlog('fetching ' + fr.min() + '-' + fr.max() + ' (' + (fr.max() - fr.min()) + ')');
        thisB.bwg.data.slice(fr.min(), fr.max() - fr.min()).fetch(function(result) {
            var resultBuffer = result;

// This is now handled in URLFetchable instead.
//
//            if (resultBuffer.byteLength != length) {           
//                dlog("Didn't get expected size: " + resultBuffer.byteLength + " != " + length);
//                return cirFobStartFetch(offset, fr, level, attempts + 1);
//            }


            for (var i = 0; i < offset.length; ++i) {
                if (fr.contains(offset[i])) {
                    cirFobRecur2(resultBuffer, offset[i] - fr.min(), level);
                    --outstanding;
                    if (outstanding == 0) {
                        cirCompleted();
                    }
                }
            }
        });
    }

    var cirFobRecur2 = function(cirBlockData, offset, level) {
        var ba = new Int8Array(cirBlockData);
        var sa = new Int16Array(cirBlockData);
        var la = new Int32Array(cirBlockData);

        var isLeaf = ba[offset];
        var cnt = sa[offset/2 + 1];
        // dlog('cir level=' + level + '; cnt=' + cnt);
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
                // dlog('startChrom=' + startChrom);
                if ((dir < 0 && ((startChrom < chr || (startChrom == chr && startBase <= pos)))) ||
                    (dir > 0 && ((endChrom > chr || (endChrom == chr && endBase >= pos)))))
                {
                    // dlog('Got an interesting block: startBase=' + startChrom + ':' + startBase + '; endBase=' + endChrom + ':' + endBase + '; offset=' + blockOffset + '; size=' + blockSize);
                    if (/_random/.exec(thisB.bwg.idsToChroms[startChrom])) {
                        // dlog('skipping random: ' + thisB.bwg.idsToChroms[startChrom]);
                    } else if (blockToFetch == null || ((dir < 0) && (endChrom > bestBlockChr || (endChrom == bestBlockChr && endBase > bestBlockOffset)) ||
                                                 (dir > 0) && (startChrom < bestBlockChr || (startChrom == bestBlockChr && startBase < bestBlockOffset))))
                    {
                        //                        dlog('best is: startBase=' + startChrom + ':' + startBase + '; endBase=' + endChrom + ':' + endBase + '; offset=' + blockOffset + '; size=' + blockSize);
                        blockToFetch = {offset: blockOffset, size: blockSize};
                        bestBlockOffset = (dir < 0) ? endBase : startBase;
                        bestBlockChr = (dir < 0) ? endChrom : startChrom;
                    }
                }
                offset += 32;
            }
        } else {
            var bestRecur = -1;
            var bestPos = -1;
            var bestChr = -1;
            for (var i = 0; i < cnt; ++i) {
                var lo = offset/4;
                var startChrom = la[lo];
                var startBase = la[lo + 1];
                var endChrom = la[lo + 2];
                var endBase = la[lo + 3];
                var blockOffset = (la[lo + 4]<<32) | (la[lo + 5]);
                // dlog('startChrom=' + startChrom);
                if ((dir < 0 && ((startChrom < chr || (startChrom == chr && startBase <= pos)) &&
                                 (endChrom   >= chr))) ||
                     (dir > 0 && ((endChrom > chr || (endChrom == chr && endBase >= pos)) &&
                                  (startChrom <= chr))))
                {
                    // dlog('Got an interesting block: startBase=' + startChrom + ':' + startBase + '; endBase=' + endChrom + ':' + endBase + '; offset=' + blockOffset + '; size=' + blockSize);
                    if (bestRecur < 0 || endBase > bestPos) {
                        bestRecur = blockOffset;
                        bestPos = (dir < 0) ? endBase : startBase;
                        bestChr = (dir < 0) ? endChrom : startChrom;
                    }
                }
                offset += 24;
            }
            if (bestRecur >= 0) {
                cirFobRecur([bestRecur], level + 1);
            }
        }
    };
    

    var cirCompleted = function() {
        if (blockToFetch == null) {
            return dlog('got nothing');
        } 
        var blocksToFetch = [blockToFetch];

        blocksToFetch.sort(function(b0, b1) {
            return (b0.offset|0) - (b1.offset|0);
        });

        if (blocksToFetch.length == 0) {
            callback([]);
        } else {
            var bestFeature = null;
            var bestChr = -1;
            var bestPos = -1;
            var createFeature = function(chrx, fmin, fmax, opts) {
//                dlog('createFeature(' + fmin +', ' + fmax + ')');

                if (!opts) {
                    opts = {};
                }
            
                var f = new DASFeature();
                f.segment = thisB.bwg.idsToChroms[chrx];
                f.min = fmin;
                f.max = fmax;
                f.type = 'bigwig';
                
                for (k in opts) {
                    f[k] = opts[k];
                }
                
                if (bestFeature == null || ((dir < 0) && (chrx > bestChr || fmax > bestPos)) || ((dir > 0) && (chrx < bestChr || fmin < bestPos))) {
                    bestFeature = f;
                    bestPos = (dir < 0) ? fmax : fmin;
                    bestChr = chrx;
                }
            };
            var maybeCreateFeature = function(chrx, fmin, fmax, opts) {
//                dlog('maybeCreateFeature(' + thisB.bwg.idsToChroms[chrx] + ',' + fmin + ',' + fmax + ')');
                if ((dir < 0 && (chrx < chr || fmax < pos)) || (dir > 0 && (chrx > chr || fmin > pos))) {
                //                if (fmin <= max && fmax >= min) {
                    createFeature(chrx, fmin, fmax, opts);
                    //}
                }
            };
            var tramp = function() {
                if (blocksToFetch.length == 0) {
                    var afterBWG = Date.now();
                    // dlog('BWG fetch took ' + (afterBWG - beforeBWG) + 'ms');
                    callback([bestFeature]);
                    return;  // just in case...
                } else {
                    var block = blocksToFetch[0];
                    if (block.data) {
                        var ba = new Uint8Array(block.data);

                        if (thisB.isSummary) {
                            var sa = new Int16Array(block.data);
                            var la = new Int32Array(block.data);
                            var fa = new Float32Array(block.data);

                            var itemCount = block.data.byteLength/32;
                            for (var i = 0; i < itemCount; ++i) {
                                var chromId =   la[(i*8)];
                                var start =     la[(i*8)+1];
                                var end =       la[(i*8)+2];
                                var validCnt =  la[(i*8)+3];
                                var minVal    = fa[(i*8)+4];
                                var maxVal    = fa[(i*8)+5];
                                var sumData   = fa[(i*8)+6];
                                var sumSqData = fa[(i*8)+7];
                                
                                var summaryOpts = {type: 'bigwig', score: sumData/validCnt};
                                if (thisB.bwg.type == 'bigbed') {
                                    summaryOpts.type = 'density';
                                }
                                maybeCreateFeature(chromId, start, end, summaryOpts);
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

                            // dlog('processing bigwig block, type=' + blockType + '; count=' + itemCount);
                            
                            if (blockType == BIG_WIG_TYPE_FSTEP) {
                                for (var i = 0; i < itemCount; ++i) {
                                    var score = fa[i + 6];
                                    maybeCreateFeature(chromId, blockStart + (i*itemStep), blockStart + (i*itemStep) + itemSpan, {score: score});
                                }
                            } else if (blockType == BIG_WIG_TYPE_VSTEP) {
                                for (var i = 0; i < itemCount; ++i) {
                                    var start = la[(i*2) + 6];
                                    var score = fa[(i*2) + 7];
                                    maybeCreateFeature(start, start + itemSpan, {score: score});
                                }
                            } else if (blockType == BIG_WIG_TYPE_GRAPH) {
                                for (var i = 0; i < itemCount; ++i) {
                                    var start = la[(i*3) + 6] + 1;
                                    var end   = la[(i*3) + 7];
                                    var score = fa[(i*3) + 8];
                                    if (start > end) {
                                        start = end;
                                    }
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

                                maybeCreateFeature(chromId, start + 1, end, featureOpts);
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

                        thisB.bwg.data.slice(fetchStart, fetchSize).fetch(function(result) {
                            var offset = 0;
                            var bi = 0;
                            while (offset < fetchSize) {
                                var fb = blocksToFetch[bi];
                            
                                var data;
                                if (thisB.bwg.uncompressBufSize > 0) {
                                    // var beforeInf = Date.now()
                                    data = jszlib_inflate_buffer(result, offset + 2, fb.size - 2);
                                    // var afterInf = Date.now();
                                    // dlog('inflate: ' + (afterInf - beforeInf) + 'ms');
                                } else {
                                    var tmp = new Uint8Array(fb.size);    // FIXME is this really the best we can do?
                                    arrayCopy(new Uint8Array(result, offset, fb.size), 0, tmp, 0, fb.size);
                                    data = tmp.buffer;
                                }
                                fb.data = data;
                                
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

    cirFobRecur([thisB.cirTreeOffset + 48], 1);
}

//
// end cut/paste
//






BigWig.prototype.readWigData = function(chrName, min, max, callback) {
    this.getUnzoomedView().readWigData(chrName, min, max, callback);
}

BigWig.prototype.getUnzoomedView = function() {
    if (!this.unzoomedView) {
        var cirLen = 4000;
        var nzl = this.zoomLevels[0];
        if (nzl) {
            cirLen = this.zoomLevels[0].dataOffset - this.unzoomedIndexOffset;
        }
        this.unzoomedView = new BigWigView(this, this.unzoomedIndexOffset, cirLen, false);
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


function makeBwgFromURL(url, callback, creds) {
    makeBwg(new URLFetchable(url, {credentials: creds}), callback, url);
}

function makeBwgFromFile(file, callback) {
    makeBwg(new BlobFetchable(file), callback, 'file');
}

function makeBwg(data, callback, name) {
    var bwg = new BigWig();
    bwg.data = data;
    bwg.name = name;
    bwg.data.slice(0, 512).fetch(function(result) {
        if (!result) {
            return callback(null, "Couldn't fetch file");
        }

        var header = result;
        var sa = new Int16Array(header);
        var la = new Int32Array(header);
        if (la[0] == BIG_WIG_MAGIC) {
            bwg.type = 'bigwig';
        } else if (la[0] == BIG_BED_MAGIC) {
            bwg.type = 'bigbed';
        } else {
            callback(null, "Not a supported format");
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
         
        // dlog('bigType: ' + bwg.type);
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
//          dlog('zoom(' + zl + '): reduction=' + zlReduction + '; data=' + zlData + '; index=' + zlIndex);
            bwg.zoomLevels.push({reduction: zlReduction, dataOffset: zlData, indexOffset: zlIndex});
        }

        bwg.readChromTree(function() {
            return callback(bwg);
        });
    });
}
