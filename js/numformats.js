/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// memstore.js
//

function formatLongInt(n) {
    return (n|0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatQuantLabel(v) {
    var t = '' + v;
    var dot = t.indexOf('.');
    if (dot < 0) {
        return t;
    } else {
        var dotThreshold = 2;
        if (t.substring(0, 1) == '-') {
            ++dotThreshold;
        }

        if (dot >= dotThreshold) {
            return t.substring(0, dot);
        } else {
            return t.substring(0, dot + 2);
        }
    }
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        formatLongInt: formatLongInt,
        formatQuantLabel: formatQuantLabel
    };
}