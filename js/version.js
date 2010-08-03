/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// version.js
//

var VERSION = {
    MAJOR: 0,
    MINOR: 4,
    MICRO: 0
}

VERSION.toString = function() {
    return '' + this.MAJOR + '.' + this.MINOR + '.' + this.MICRO;
}
