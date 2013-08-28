/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// thub.js: support for track-hub style registries
//

var THUB_STANZA_REGEXP = /\n\n+/;
var THUB_PARSE_REGEXP  = /(\w+) +(.+)\n?/;

function TrackHub() {
    this.genomes = {};
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

        var tracks = [];
        stanzas = trackFile.split(THUB_STANZA_REGEXP);
        for (var s = 0; s < stanzas.length; ++s) {
            var toks = stanzas[s].split(THUB_PARSE_REGEXP);
            var track = new TrackHubTrack();
            for (var l = 0; l < toks.length - 2; l += 3) {
                track[toks[l+1]] = toks[l+2];
            }
            tracks.push(track);
        }
            
        thisB._tracks = tracks;
        return callback(tracks, null);
    });
}

function connectTrackHub(hubURL, callback) {
    textXHR(hubURL, function(hubFile, err) {
        if (err) {
            return callback(null, err);
        }

        var toks = hubFile.split(THUB_PARSE_REGEXP);
        var hub = new TrackHub();
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
    source = {
        name: this.shortLabel,
        desc: this.longLabel
    };
    
    typeToks = this.type.split(/\s+/);
    if (typeToks[0] == 'bigBed') {
        source.bwgURI = this.bigDataUrl;
        return source;
    } else if (typeToks[0] == 'bigBed') {
        source.bwgURI = this.bigDataUrl;
        return source;
    } else if (typeToks[0] == 'bam') {
        source.bamURI = this.bigDataUrl;
        return source;
    } else {
        console.log('Unsupported ' + this.type);
    }
}
