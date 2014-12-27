/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// fetchworker.js
//

"use strict";

var bin = require('./bin');
var bam = require('./bam');
var bigwig = require('./bigwig');
var encode = require('./encode');

var connections = {};

var idSeed = 0;

global.newID = function() {
    return 'cn' + (++idSeed);
}

postMessage({tag: 'init'});

self.onmessage = function(event) {
    var d = event.data;
    var command = event.data.command;
    var tag = event.data.tag;

    if (command === 'connectBAM') {
        var id = newID();

        var bamF, baiF, indexChunks;
        if (d.blob) {
            bamF = new bin.BlobFetchable(d.blob);
            baiF = new bin.BlobFetchable(d.indexBlob);
        } else {
            bamF = new bin.URLFetchable(d.uri, {credentials: d.credentials});
            baiF = new bin.URLFetchable(d.indexUri, {credentials: d.credentials});
            indexChunks = d.indexChunks;
        }

        bam.makeBam(bamF, baiF, indexChunks, function(bamObj, err) {
            if (bamObj) {
                connections[id] = new BAMWorkerFetcher(bamObj);
                postMessage({tag: tag, result: id});
            } else {
                postMessage({tag: tag, error: err || "Couldn't fetch BAM"});
            }
        });
    } else if (command === 'connectBBI') {
        var id = newID();
        var bbi;
        if (d.blob) {
            bbi = new bin.BlobFetchable(d.blob);
        } else if (d.transport == 'encode') {
            bbi = new encode.EncodeFetchable(d.uri, {credentials: d.credentials});
        } else {
            bbi = new bin.URLFetchable(d.uri, {credentials: d.credentials});
        }

        bigwig.makeBwg(bbi, function(bwg, err) {
            if (bwg) {
                connections[id] = new BBIWorkerFetcher(bwg);
                postMessage({tag: tag, result: id});
            } else {
                postMessage({tag: tag, error: err || "Couldn't fetch BBI"});
            }
        }, d.uri);
    } else if (command === 'fetch') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.fetch(d.tag, d.chr, d.min, d.max, d.zoom, d.opts);
    } else if (command === 'leap') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.leap(d.tag, d.chr, d.pos, d.dir);
    } else if (command === 'quantLeap') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.quantLeap(d.tag, d.chr, d.pos, d.dir, d.threshold, d.under);
    } else if (command === 'meta') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.meta(d.tag);
    } else if (command === 'search') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.search(d.tag, d.query, d.index);
    } else if (command === 'date') {
        return postMessage({tag: tag, result: Date.now()|0});
    } else {
        postMessage({tag: tag, error: 'Bad command ' + command});
    }
}

function BAMWorkerFetcher(bam) {
    this.bam = bam;
}

BAMWorkerFetcher.prototype.fetch = function(tag, chr, min, max, zoom, opts) {
    opts = opts || {};
    this.bam.fetch(chr, min, max, function(records, err) {
        if (records) {
            postMessage({tag: tag, result: records, time: Date.now()|0});
        } else {
            postMessage({tag: tag, error: err});
        }
    }, opts);
}

function BBIWorkerFetcher(bbi) {
    this.bbi = bbi;
}

BBIWorkerFetcher.prototype.fetch = function(tag, chr, min, max, zoom) {
    if (typeof(zoom) !== 'number')
        zoom = -1;

    var data;
    if (zoom < 0) {
        data = this.bbi.getUnzoomedView();
    } else {
        data = this.bbi.getZoomedView(zoom);
    }

    data.readWigData(chr, min, max, function(features) {
        postMessage({tag: tag, result: features});
    });
}

BBIWorkerFetcher.prototype.meta = function(tag) {
    var scales = [1];
    for (var z = 0; z < this.bbi.zoomLevels.length; ++z) {
        scales.push(this.bbi.zoomLevels[z].reduction);
    }

    var thisB = this;
    var meta = {type: this.bbi.type,
                zoomLevels: scales,
                fieldCount: this.bbi.fieldCount,
                definedFieldCount: this.bbi.definedFieldCount,
                schema: this.bbi.schema};
    if (this.bbi.type === 'bigbed') {
        this.bbi.getExtraIndices(function(ei) {
            if (ei) {
                thisB.extraIndices = ei;
                meta.extraIndices = ei.map(function(i) {return i.field});
            }
            postMessage({tag: tag, result: meta});
        });
    } else {
        postMessage({tag: tag, result: meta});
    }
}

BBIWorkerFetcher.prototype.leap = function(tag, chr, pos, dir) {
    this.bbi.getUnzoomedView().getFirstAdjacent(chr, pos, dir, function(result, err) {
        postMessage({tag: tag, result: result, error: err});
    });
}

BBIWorkerFetcher.prototype.quantLeap = function(tag, chr, pos, dir, threshold, under) {
    this.bbi.thresholdSearch(chr, pos, dir, threshold, function(result, err) {
        postMessage({tag: tag, result: result, error: err});
    });
}

BBIWorkerFetcher.prototype.search = function(tag, query, index) {
    var is = this.extraIndices[0];
    is.lookup(query, function(result, err) {
        postMessage({tag: tag, result: result, error: err});
    });
}
