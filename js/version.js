/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// version.js
//

var VERSION = {
    CONFIG: 4,
    MAJOR:  0,
    MINOR:  11,
    MICRO:  1,
    PATCH:  '',
    BRANCH: 'dev'
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
