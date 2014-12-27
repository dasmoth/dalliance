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

function lookupEncodeURI(uri, json) {
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
                    accept(json ? resp : resp.location);
                }
            }
        };
    
        req.open('GET', uri, true);
        req.setRequestHeader('Accept', 'application/json');
        req.responseType = 'text';
        req.send('');
    });
}

function EncodeURLHolder(url) {
    this.rawurl = url;
}

EncodeURLHolder.prototype.getURLPromise = function() {
    if (this.urlPromise && this.urlPromiseValidity > Date.now()) {
        return this.urlPromise;
    } else {
        this.urlPromise = lookupEncodeURI(this.rawurl, true).then(function(resp) {
            return resp.location;
        });
        this.urlPromiseValidity = Date.now() + (12 * 3600 * 1000);
        return this.urlPromise;
    }
}

function EncodeFetchable(url, start, end, opts) {
    if (!opts) {
        if (typeof start === 'object') {
            opts = start;
            start = undefined;
        } else {
            opts = {};
        }
    }

    this.url = (typeof url === 'string' ? new EncodeURLHolder(url) : url);
    this.start = start || 0;
    if (end) {
        this.end = end;
    }
    this.opts = opts;
}



EncodeFetchable.prototype.slice = function(s, l) {
    if (s < 0) {
        throw 'Bad slice ' + s;
    }

    var ns = this.start, ne = this.end;
    if (ns && s) {
        ns = ns + s;
    } else {
        ns = s || ns;
    }
    if (l && ns) {
        ne = ns + l - 1;
    } else {
        ne = ne || l - 1;
    }
    return new EncodeFetchable(this.url, ns, ne, this.opts);
}

EncodeFetchable.prototype.fetchAsText = function(callback) {
    var self = this;
    var req = new XMLHttpRequest();
    var length;
    self.url.getURLPromise().then(function(url) {
        req.open('GET', url, true);

        if (self.end) {
            if (self.end - self.start > 100000000) {
                throw 'Monster fetch!';
            }
            req.setRequestHeader('Range', 'bytes=' + self.start + '-' + self.end);
            length = self.end - self.start + 1;
        }

        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status == 200 || req.status == 206) {
                    return callback(req.responseText);
                } else {
                    return callback(null);
                }
            }
        };
        if (self.opts.credentials) {
            req.withCredentials = true;
        }
        req.send('');
    }).catch(function(err) {
        console.log(err);
        return callback(null);
    });
}

EncodeFetchable.prototype.salted = function() {
    return this;
}

EncodeFetchable.prototype.fetch = function(callback, attempt, truncatedLength) {
    var self = this;

    attempt = attempt || 1;
    if (attempt > 3) {
        return callback(null);
    }

    self.url.getURLPromise().then(function (url) {
        var req = new XMLHttpRequest();
        var length;
        req.open('GET', url, true);
        req.overrideMimeType('text/plain; charset=x-user-defined');
        if (self.end) {
            if (self.end - self.start > 100000000) {
                throw 'Monster fetch!';
            }
            req.setRequestHeader('Range', 'bytes=' + self.start + '-' + self.end);
            length = self.end - self.start + 1;
        }
        req.responseType = 'arraybuffer';
        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status == 200 || req.status == 206) {
                    if (req.response) {
                        var bl = req.response.byteLength;
                        if (length && length != bl && (!truncatedLength || bl != truncatedLength)) {
                            return self.fetch(callback, attempt + 1, bl);
                        } else {
                            return callback(req.response);
                        }
                    } else if (req.mozResponseArrayBuffer) {
                        return callback(req.mozResponseArrayBuffer);
                    } else {
                        var r = req.responseText;
                        if (length && length != r.length && (!truncatedLength || r.length != truncatedLength)) {
                            return self.fetch(callback, attempt + 1, r.length);
                        } else {
                            return callback(bstringToBuffer(req.responseText));
                        }
                    }
                } else {
                    return self.fetch(callback, attempt + 1);
                }
            }
        };
        if (self.opts.credentials) {
            req.withCredentials = true;
        }
        req.send('');
    }).catch(function(err) {
        console.log(err);
    });
}

function bstringToBuffer(result) {
    if (!result) {
        return null;
    }

    var ba = new Uint8Array(result.length);
    for (var i = 0; i < ba.length; ++i) {
        ba[i] = result.charCodeAt(i);
    }
    return ba.buffer;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        lookupEncodeURI: lookupEncodeURI,
        EncodeFetchable: EncodeFetchable
    };
}
