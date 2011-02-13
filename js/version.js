/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// version.js
//

var VERSION = {
    CONFIG: 2,
    MAJOR:  0,
    MINOR:  6,
    MICRO:  0,
    PATCH:  '',
    BRANCH: 'pre7'
}

VERSION.toString = function() {
    var vs = '' + this.MAJOR + '.' + this.MINOR + '.' + this.MICRO;
    if (this.PATCH) {
        vs = vs + this.PATCH;
    }
    if (this.BRANCH && this.BRANCH != '') {
        vs = vs + '-' + this.BRANCH;
    }
    return vs;
}
