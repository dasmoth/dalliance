/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2015
//
// sourcecompare.js
//


function sourceDataURI(conf) {
    if (conf.uri) {
        return conf.uri;
    } else if (conf.blob) {
        return 'file:' + conf.blob.name;
    } else if (conf.bwgBlob) {
        return 'file:' + conf.bwgBlob.name;
    } else if (conf.bamBlob) {
        return 'file:' + conf.bamBlob.name;
    } else if (conf.twoBitBlob) {
        return 'file:' + conf.twoBitBlob.name;
    }

    return conf.bwgURI || conf.bamURI || conf.jbURI || conf.twoBitURI || 'https://www.biodalliance.org/magic/no_uri';
}

function sourceStyleURI(conf) {
    if (conf.stylesheet_uri)
        return conf.stylesheet_uri;
    else if (conf.tier_type == 'sequence' || conf.twoBitURI || conf.twoBitBlob)
        return 'https://www.biodalliance.org/magic/sequence'
    else
        return sourceDataURI(conf);
}

function sourcesAreEqualModuloStyle(a, b) {
    if (sourceDataURI(a) != sourceDataURI(b))
        return false;

    if (a.mapping != b.mapping)
        return false;

    if (a.tier_type != b.tier_type)
        return false;

    if (a.overlay) {
        if (!b.overlay || b.overlay.length != a.overlay.length)
            return false;
        for (var oi = 0; oi < a.overlay.length; ++oi) {
            if (!sourcesAreEqualModuloStyle(a.overlay[oi], b.overlay[oi]))
                return false;
        }
    } else {
        if (b.overlay)
            return false;
    }

    return true;
}

function sourcesAreEqual(a, b) {
    if (sourceDataURI(a) != sourceDataURI(b) ||
        sourceStyleURI(a) != sourceStyleURI(b))
        return false;

    if (a.mapping != b.mapping)
        return false;

    if (a.tier_type != b.tier_type)
        return false;

    if (a.overlay) {
        if (!b.overlay || b.overlay.length != a.overlay.length)
            return false;
        for (var oi = 0; oi < a.overlay.length; ++oi) {
            if (!sourcesAreEqual(a.overlay[oi], b.overlay[oi]))
                return false;
        }
    } else {
        if (b.overlay)
            return false;
    }

    return true;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        sourcesAreEqual: sourcesAreEqual,
        sourcesAreEqualModuloStyle: sourcesAreEqualModuloStyle,
        sourceDataURI: sourceDataURI,
        sourceStyleURI: sourceStyleURI
    };
}
