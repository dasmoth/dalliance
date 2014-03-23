/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// bigtab.js: indexed tab-delimited flatfiles
//

"use strict";

if (typeof(module) !== 'undefined') {
    var bin = require('./bin');
    var readInt = bin.readInt;
    var readShort = bin.readShort;

    var zlib = require('jszlib');
    var jszlib_inflate_buffer = zlib.inflateBuffer;
}

// FIXME redundant...
var M1 = 256;
var M2 = 256*256;
var M3 = 256*256*256;
var M4 = 256*256*256*256;
function bwg_readOffset(ba, o) {
    var offset = ba[o] + ba[o+1]*M1 + ba[o+2]*M2 + ba[o+3]*M3 + ba[o+4]*M4;
    return offset;
}

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
        if (version != 2) {
            return callback(null, "Bad bigtab version " + version);
        }

        bt.uncBufSize = readInt(ba, 6);
        bt.autoSqlOffset = bwg_readOffset(ba, 10);
        bt.indexCount = readShort(ba, 18);
        bt.indexListOffset = bwg_readOffset(ba, 20);

        bt.data.slice(bt.indexListOffset, bt.indexCount * 20).fetch(function(ilResult) {
            if (!ilResult) {
                return callback(null, "Couldn't access index list");
            }
            var ba = new Uint8Array(ilResult);
            var indexType = readShort(ba, 0);
            var fieldCount = readShort(ba, 2);
            var offset = bwg_readOffset(ba, 4);
            var fieldId = readShort(ba, 16);

            if (indexType != 0)
                return callback(null, "Bad index, type=" + indexType);

            bt.indexOffset = offset;
            bt.index = new BigTabIndex(bt);

            return callback(bt);
        });
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
    var length = readInt(ba, offset + 8);
    var recordOffset = readInt(ba, offset + 12);

    this.bt.data.slice(start, length).fetch(function(buf) {
        if (buf == null) {
            return callback(null, "Couldn't fetch payload");
        } else {
            var unc = jszlib_inflate_buffer(buf, 2, buf.byteLength-2);
            var i = recordOffset;
            var record = '';
            var ba = new Uint8Array(unc);
            while (i < ba.length && ba[i] != 10) {
                record += String.fromCharCode(ba[i++]);
            }
            callback(record);
        }
    });
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        connectBigTab: connectBigTab
    };
}

