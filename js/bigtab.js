/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// bigtab.js: indexed tab-delimited flatfiles
//

var BIGTAB_MAGIC = 0x8789F2EB;
var BPT_MAGIC    = 0x78ca8c91;
  
function BigTab(data) {
    this.data = data;
}

function connectBigTab(res, callback) {
    var bt = new BigTab(res);

    bt.data.slice(0, 512).salted().fetch(function(result) {
        if (!result) {
            return callback(null, "Couldn't access data");
        }

        var ba = new Uint8Array(result);
        var sa = new Int16Array(result);
        var la = new Uint32Array(result);

        var magic = la[0];
        if (magic != BIGTAB_MAGIC) {
            return callback(null, "Not a bigtab file, magic=0x" + magic.toString(16));
        }

        var version = sa[2];
        if (version != 1) {
            return callback(null, "Bad bigtab version " + version);
        }

        bt.uncBufSize = readInt(ba, 6);
        bt.tableCount = readShort(ba, 10);
        bt.allJoinerOffset = bwg_readOffset(ba, 12);
        bt.autoSqlOffset = bwg_readOffset(ba, 20);
        bt.indexOffset = bwg_readOffset(ba, 28);
        bt.dataOffset = bwg_readOffset(ba, 36);

        bt.index = new BigTabIndex(bt);

        return callback(bt);
    });
}

function BPTIndex(data, offset) {
    this.data = data;
    this.offset = offset;
}

BPTIndex.prototype.lookup = function(name, callback) {
    var thisB = this;

    this.data.slice(this.offset, 32).fetch(function(bpt) {
        var ba = new Uint8Array(bpt);
        var sa = new Int16Array(bpt);
        var la = new Int32Array(bpt);
        var bptMagic = la[0];
        var blockSize = la[1];
        var keySize = la[2];
        var valSize = la[3];
        var itemCount = bwg_readOffset(ba, 16);
        var rootNodeOffset = 32;

        if (bptMagic != BPT_MAGIC) {
            return callback(null, 'Not a valid BPT, magic=0x' + bptMagic.toString(16));
        }
        
        function bptReadNode(nodeOffset) {
            thisB.data.slice(nodeOffset, 4 + (blockSize * (keySize + valSize))).fetch(function(node) {
                var ba = new Uint8Array(node);
                var sa = new Uint16Array(node);
                var la = new Uint32Array(node);

                var nodeType = ba[0];
                var cnt = sa[1];

                var offset = 4;
                if (nodeType == 0) {
                    var lastChildOffset = null;
                    for (var n = 0; n < cnt; ++n) {
                        var key = '';
                        for (var ki = 0; ki < keySize; ++ki) {
                            var charCode = ba[offset++];
                            if (charCode != 0) {
                                key += String.fromCharCode(charCode);
                            }
                        }

                        var childOffset = readInt(ba, offset);
                        offset += 8;
                        
                        if (name.localeCompare(key) < 0 && lastChildOffset) {
                            bptReadNode(lastChildOffset);
                            return;
                        }
                        lastChildOffset = childOffset;
                    }
                    bptReadNode(lastChildOffset);
                } else {
                    for (var n = 0; n < cnt; ++n) {
                        var key = '';
                        for (var ki = 0; ki < keySize; ++ki) {
                            var charCode = ba[offset++];
                            if (charCode != 0) {
                                key += String.fromCharCode(charCode);
                            }
                        }

                        if (key == name) {
                            return thisB.readValue(ba, offset, valSize, callback);
                        }
                        offset += valSize;
                    }
                    return callback([]);
                }
            });
        }

        bptReadNode(thisB.offset + rootNodeOffset);
    });
}

function BigTabIndex(bt) {
    BPTIndex.call(this, bt.data, bt.indexOffset);
    this.bt = bt;
}

BigTabIndex.prototype = Object.create(BPTIndex.prototype);

BigTabIndex.prototype.readValue = function(ba, offset, valSize, callback) {
    var start = bwg_readOffset(ba, offset);
    var length = bwg_readOffset(ba, offset + 8);

    this.bt.data.slice(this.bt.dataOffset + start, length).fetchAsText(function(res) {
        if (res == null) {
            return callback(null, "Couldn't fetch payload");
        } else {
            return callback(res);
        }
    });
}

