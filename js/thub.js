/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// thub.js: support for track-hub style registries
//

var THUB_STANZA_REGEXP = /\n\n+/;
var THUB_PARSE_REGEXP  = /(\w+) +(.+)\n?/;

function TrackHub(url) {
    this.genomes = {};
    this.url = url;
}

function TrackHubTrack() {
}

function TrackHubDB() {
}

TrackHubDB.prototype.getTracks = function(callback) {
    var thisB = this;
    if (this._tracks) {
        return callback(this._tracks);
    } 
    
    textXHR(this.absURL, function(trackFile, err) {
        if (err) {
            return callback(null, err);
        }

        trackFile = trackFile.replace('\\\n', ' ');

        var tracks = [];
        var tracksById = {};
        stanzas = trackFile.split(THUB_STANZA_REGEXP);
        for (var s = 0; s < stanzas.length; ++s) {
            var toks = stanzas[s].split(THUB_PARSE_REGEXP);
            var track = new TrackHubTrack();
            for (var l = 0; l < toks.length - 2; l += 3) {
                track[toks[l+1]] = toks[l+2];
            }

            if (track.track && (track.type || track.container)) {
                tracks.push(track);
                tracksById[track.track] = track;
            }
        }
        
        var toplevels = [];
        for (var ti = 0; ti < tracks.length; ++ti) {
            var track = tracks[ti];
            var top = true;
            if (track.parent) {
                var parent = tracksById[track.parent];
                if (parent) {
                    if (!parent.children)
                        parent.children = [];
                    parent.children.push(track);

                    if (parent.container == 'multiWig')
                        top = false;
                }
            }
            if (top)
                toplevels.push(track);
        }
            
        thisB._tracks = toplevels;
        return callback(thisB._tracks, null);
    });
}

function connectTrackHub(hubURL, callback) {
    textXHR(hubURL, function(hubFile, err) {
        if (err) {
            return callback(null, err);
        }

        var toks = hubFile.split(THUB_PARSE_REGEXP);
        var hub = new TrackHub(hubURL);
        for (var l = 0; l < toks.length - 2; l += 3) {
            hub[toks[l+1]] = toks[l+2];
        }
        
        
        if (hub.genomesFile) {
            var genURL = relativeURL(hubURL, hub.genomesFile);
            textXHR(genURL, function(genFile, err) {
                if (err) {
                    return callback(null, err);
                }

                stanzas = genFile.split(THUB_STANZA_REGEXP);
                for (var s = 0; s < stanzas.length; ++s) {
                    var toks = stanzas[s].split(THUB_PARSE_REGEXP);
                    var gprops = new TrackHubDB();
                    for (var l = 0; l < toks.length - 2; l += 3) {
                        gprops[toks[l+1]] = toks[l+2];
                    }
                    if (gprops.genome && gprops.trackDb) {
                        gprops.absURL = relativeURL(genURL, gprops.trackDb);
                        hub.genomes[gprops.genome] = gprops;
                    }
                }

                callback(hub);
                        
            });
        } else {
            callback(null, 'No genomesFile');
        }
    })
}


TrackHubTrack.prototype.toDallianceSource = function() {
    var source = {
        name: this.shortLabel,
        desc: this.longLabel
    };

    if (this.container == 'multiWig') {
        source.merge = 'concat';
        source.overlay = [];
        var children = this.children || [];
        source.style = [];
        source.noDownsample = true;

        for (var ci = 0; ci < children.length; ++ci) {
            var ch = children[ci];
            var cs = ch.toDallianceSource()
            source.overlay.push(cs);

            if (cs.style) {
                for (var si = 0; si < cs.style.length; ++si) {
                    var style = cs.style[si];
                    style.method = ch.shortLabel;  // FIXME
                    if (this.aggregate == 'transparentOverlay')
                        style.style.ALPHA = 0.5;
                    source.style.push(style);
                }
            }
        }
        return source;

        
    } else {
        typeToks = this.type.split(/\s+/);
        if (typeToks[0] == 'bigBed') {
            source.bwgURI = this.bigDataUrl;
            return source;
        } else if (typeToks[0] == 'bigWig') {
            source.bwgURI = this.bigDataUrl;
            source.style = this.bigwigStyles();
            source.noDownsample = true;     // FIXME seems like a blunt instrument...
            
            if (this.yLineOnOff && this.yLineOnOff == 'on') {
                source.quantLeapThreshold = this.yLineMark !== undefined ? (1.0 * this.yLineMark) : 0.0;
            }

            return source;
        } else if (typeToks[0] == 'bam') {
            source.bamURI = this.bigDataUrl;
            return source;
        } else {
            console.log('Unsupported ' + this.type);
        }
    }
}

TrackHubTrack.prototype.bigwigStyles = function() {
    var min, max;
    if (typeToks.length >= 3) {
        min = 1.0 * typeToks[1];
        max = 1.0 * typeToks[2];
    }

    var height;
    if (this.maxHeightPixels) {
        var mhpToks = this.maxHeightPixels.split(/:/);
        if (mhpToks.length == 3) {
            height = mhpToks[1] | 0;
        } else {
            console.log('maxHeightPixels should be of the form max:default:min');
        }
    }
    
    var gtype = 'bars';
    if (this.graphTypeDefault) {
        gtype = this.graphTypeDefault;
    }
    
    var color = 'black';
    var altColor = null;
    if (this.color) {
        color = 'rgb(' + this.color + ')';
    }
    if (this.altColor) {
        altColor = 'rgb(' + this.altColor + ')';
    }
    
    var stylesheet = new DASStylesheet();
    var wigStyle = new DASStyle();
    if (gtype == 'points') {
        wigStyle.glyph = 'POINT';
    } else {
        wigStyle.glyph = 'HISTOGRAM';
    }

    if (altColor) {
        wigStyle.COLOR1 = color;
        wigStyle.COLOR2 = altColor;
    } else {
        wigStyle.BGCOLOR = color;
    }
    wigStyle.HEIGHT = height || 30;
    if (min || max) {
        wigStyle.MIN = min;
        wigStyle.MAX = max;
    }
    stylesheet.pushStyle({type: 'default'}, null, wigStyle);
    return stylesheet.styles;
}
