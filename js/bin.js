/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bin.js general binary data support
//

function BlobFetchable(b) {
    this.blob = b;
}

BlobFetchable.prototype.slice = function(start, length) {
    var b;

    if (this.blob.slice) {
        if (length) {
            b = this.blob.slice(start, start + length);
        } else {
            b = this.blob.slice(start);
        }
    } else {
        if (length) {
            b = this.blob.webkitSlice(start, start + length);
        } else {
            b = this.blob.webkitSlice(start);
        }
    }
    return new BlobFetchable(b);
}

BlobFetchable.prototype.salted = function() {return this;}

if (typeof(FileReader) == 'function') {
    // console.log('defining async BlobFetchable.fetch');

    BlobFetchable.prototype.fetch = function(callback) {
        var reader = new FileReader();
        reader.onloadend = function(ev) {
            callback(bstringToBuffer(reader.result));
        };
        reader.readAsBinaryString(this.blob);
    }

} else {
    // if (console && console.log)
    //    console.log('defining sync BlobFetchable.fetch');

    BlobFetchable.prototype.fetch = function(callback) {
        var reader = new FileReaderSync();
        try {
            var res = reader.readAsArrayBuffer(this.blob);
            callback(res);
        } catch (e) {
            callback(null, e);
        }
    }
}

function URLFetchable(url, start, end, opts) {
    if (!opts) {
        if (typeof start === 'object') {
            opts = start;
            start = undefined;
        } else {
            opts = {};
        }
    }

    this.url = url;
    this.start = start || 0;
    if (end) {
        this.end = end;
    }
    this.opts = opts;
}

URLFetchable.prototype.slice = function(s, l) {
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
    return new URLFetchable(this.url, ns, ne, this.opts);
}

var seed=0;
var isSafari = navigator.userAgent.indexOf('Safari') >= 0 && navigator.userAgent.indexOf('Chrome') < 0 ;

URLFetchable.prototype.fetchAsText = function(callback) {
    var req = new XMLHttpRequest();
    var length;
    var url = this.url;
    if (isSafari || this.opts.salt) {
        url = saltURL(url);
        url = url + '?salt=' + b64_sha1('' + Date.now() + ',' + (++seed));
    }
    req.open('GET', url, true);

    if (this.end) {
        if (this.end - this.start > 100000000) {
            throw 'Monster fetch!';
        }
        req.setRequestHeader('Range', 'bytes=' + this.start + '-' + this.end);
        length = this.end - this.start + 1;
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
    if (this.opts.credentials) {
        req.withCredentials = true;
    }
    req.send('');
}

URLFetchable.prototype.salted = function() {
    var o = shallowCopy(this.opts);
    o.salt = true;
    return new URLFetchable(this.url, this.start, this.end, o);
}

URLFetchable.prototype.fetch = function(callback, attempt, truncatedLength) {
    var thisB = this;

    attempt = attempt || 1;
    if (attempt > 3) {
        return callback(null);
    }

    var req = new XMLHttpRequest();
    var length;
    var url = this.url;
    if (isSafari || this.opts.salt) {
        url = url + '?salt=' + b64_sha1('' + Date.now() + ',' + (++seed));
    }
    req.open('GET', url, true);
    req.overrideMimeType('text/plain; charset=x-user-defined');
    if (this.end) {
        if (this.end - this.start > 100000000) {
            throw 'Monster fetch!';
        }
        req.setRequestHeader('Range', 'bytes=' + this.start + '-' + this.end);
        length = this.end - this.start + 1;
    }
    req.responseType = 'arraybuffer';
    req.onreadystatechange = function() {
        if (req.readyState == 4) {
            if (req.status == 200 || req.status == 206) {
                if (req.response) {
                    var bl = req.response.byteLength;
                    if (length && length != bl && (!truncatedLength || bl != truncatedLength)) {
                        return thisB.fetch(callback, attempt + 1, bl);
                    } else {
                        return callback(req.response);
                    }
                } else if (req.mozResponseArrayBuffer) {
                    return callback(req.mozResponseArrayBuffer);
                } else {
                    var r = req.responseText;
                    if (length && length != r.length && (!truncatedLength || r.length != truncatedLength)) {
                        return thisB.fetch(callback, attempt + 1, r.length);
                    } else {
                        return callback(bstringToBuffer(req.responseText));
                    }
                }
            } else {
                return thisB.fetch(callback, attempt + 1);
            }
        }
    };
    if (this.opts.credentials) {
        req.withCredentials = true;
    }
    req.send('');
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

