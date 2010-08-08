/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// chainset.js: liftover support
//

function Chainset(uri) {
    this.uri = uri;
    this.chainsBySrc = {};
    this.chainsByDest = {};
}


Chainset.prototype.fetchChainsTo = function(chr) {
    var uri = this.uri + 'chr' + chr + '.json';
    alert('fetching chains: ' + uri);
    var req = new XMLHttpRequest();
    req.open('get', uri, false);
    req.send();
    var chains = eval(req.responseText);

    for (var i = 0; i < chains.length; ++i) {
        var c = chains[i];
        pusho(this.chainsBySrc, c.srcChr, c);
        pusho(this.chainsByDest, c.destChr, c);
    }

    if (!this.chainsByDest[chr]) {
        this.chainsByDest[chr] = [];    // FIXME: currently needed to prevent duplicate fetches if no chains are available.
    }
}

Chainset.prototype.mapPoint = function(chr, pos) {
    var chains = this.chainsBySrc[chr] || [];
    for (var ci = 0; ci < chains.length; ++ci) {
        var c = chains[ci];
        if (pos >= c.srcMin && pos <= c.srcMax) {
            var cpos = pos - c.srcMin;
            var blocks = c.blocks;
            for (var bi = 0; bi < blocks.length; ++bi) {
                var b = blocks[bi];
                var bSrc = b[0];
                var bDest = b[1];
                var bSize = b[2];
                if (cpos >= bSrc && cpos <= (bSrc + bSize)) {
                    var apos = cpos - bSrc;

                    var dpos = apos + bDest + c.destMin;
                    return {seq: c.destChr, pos: dpos}
                }
            }
            return null;
        }
    }
    return null;
}

Chainset.prototype.unmapPoint = function(chr, pos) {
    var chains = this.chainsByDest[chr] || [];
    for (var ci = 0; ci < chains.length; ++ci) {
        var c = chains[ci];
        if (pos >= c.destMin && pos <= c.destMax) {
            var cpos = pos - c.destMin;
            var blocks = c.blocks;
            for (var bi = 0; bi < blocks.length; ++bi) {
                var b = blocks[bi];
                var bSrc = b[0];
                var bDest = b[1];
                var bSize = b[2];
                if (cpos >= bDest && cpos <= (bDest + bSize)) {
                    var apos = cpos - bDest;

                    var dpos = apos + bSrc + c.srcMin;
                    return {seq: c.srcChr, pos: dpos}
                }
            }
            return null;
        }
    }
    return null;
}

Chainset.prototype.sourceBlocksForRange = function(chr, min, max) {
    if (!this.chainsByDest[chr]) {
        this.fetchChainsTo(chr);
    }

    var mmin = this.unmapPoint(chr, min);
    var mmax = this.unmapPoint(chr, max);
    if (!mmin || !mmax || mmin.seq != mmax.seq) {
        return [];
    } else {
        return [new DASSegment(mmin.seq, mmin.pos, mmax.pos)];
    }
}
