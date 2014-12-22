/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// encode.js: interface for ENCODE DCC services
//

"use strict";

if (typeof(require) !== 'undefined') {
    var Promise = require('es6-promise').Promise;
}

function lookupEncodeURI(uri) {
    if (uri.indexOf('?') < 0)
        uri = uri + '?soft=true';

    return new Promise(function(accept, reject) {
        var req = new XMLHttpRequest();
        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status >= 300) {
                    reject('Error code ' + req.status);
                } else {
                    var resp = JSON.parse(req.response);
                    accept(resp.location);
                }
            }
        };
    
        req.open('GET', uri, true);
        req.setRequestHeader('Accept', 'application/json');
        req.responseType = 'text';
        req.send('');
    });
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        lookupEncodeURI: lookupEncodeURI
    };
}