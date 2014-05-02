/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// trix.js: UCSC-style free text indices
//

"use strict";

function connectTrix(ix, ixx, callback) {
    ixx.fetchAsText(function(ixxData) {
        if (!ixxData) 
            return callback(null, "Couldn't fetch index-index");

        var toks = ixxData.split(/(.+)([0-9A-F]{10})\n/);

        var keys = [];
        var offsets = [];
        for (var ti = 1; ti < toks.length; ti += 3) {
            keys.push(toks[ti]);
            offsets.push(parseInt(toks[ti+1], 16));
        }

        return callback(new TrixIndex(keys, offsets, ix));
    });
}

function TrixIndex(keys, offsets, ix) {
    this.keys = keys;
    this.offsets = offsets;
    this.ix = ix;
}

TrixIndex.prototype.lookup = function(query, callback) {
    var ixslice;

    var qtag = (query + '     ').substring(0,5).toLowerCase();
    for (var i = 0; i < this.keys.length; ++i) {
        if (qtag.localeCompare(this.keys[i]) < 0) {
            ixslice = this.ix.slice(this.offsets[i - 1], this.offsets[i] - this.offsets[i - 1]);
            break;
        }
    }

    if (!ixslice) {
        ixslice = this.ix.slice(this.offsets[this.offsets.length - 1]);
    }

    ixslice.fetchAsText(function(ist) {
        var lines = ist.split('\n');
        for (var li = 0; li < lines.length; ++li) {
            if (lines[li].indexOf(query.toLowerCase() + ' ') == 0) {
                return callback(lines[li].split(' '));
            }
        }
        return callback(null);
    });
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        connectTrix: connectTrix
    };
}