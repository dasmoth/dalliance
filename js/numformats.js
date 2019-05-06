/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

//
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// numformats.js
//

function formatLongInt(n) {
    return (n|0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatQuantLabel(v) {
    return ( ( typeof v === "string" ) ? parseFloat( v ) : v ).toPrecision( 1 );
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        formatLongInt: formatLongInt,
        formatQuantLabel: formatQuantLabel
    };
}
