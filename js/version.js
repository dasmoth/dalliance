/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// version.js
//

"use strict";

var VERSION = {
    CONFIG: 5,
    MAJOR:  0,
    MINOR:  13,
    MICRO:  6,
    PATCH:  'a',
    BRANCH: 'dev'
};

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

if (typeof(module) !== 'undefined') {
    module.exports = VERSION;
}
