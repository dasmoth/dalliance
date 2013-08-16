/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// sourceadapters.js
//

DasTier.prototype.initSources = function() {
    var thisTier = this;
    var fs = new DummyFeatureSource(), ss;

    if (this.dasSource.bwgURI || this.dasSource.bwgBlob) {
        fs = new BWGFeatureSource(this.dasSource);
    } else if (this.dasSource.bamURI || this.dasSource.bamBlob) {
        fs = new BAMFeatureSource(this.dasSource);
    } else if (this.dasSource.bamblrURI) {
        fs = new BamblrFeatureSource(this.dasSource);
    } else if (this.dasSource.jbURI) {
        fs = new JBrowseFeatureSource(this.dasSource);
    } else if (this.dasSource.tier_type == 'sequence') {
        if (this.dasSource.twoBitURI) {
            ss = new TwoBitSequenceSource(this.dasSource);
        } else {
            ss = new DASSequenceSource(this.dasSource);
        }
    } else if (this.dasSource.tier_type == 'ensembl') {
        fs = new EnsemblFeatureSource(this.dasSource);
    } else {
        fs = new DASFeatureSource(this.dasSource);
    }
    
    if (this.dasSource.mapping) {
        fs = new MappedFeatureSource(fs, this.browser.chains[this.dasSource.mapping]);
    }

    this.featureSource = fs;
    this.sequenceSource = ss;
}


function DASFeatureSource(dasSource) {
    this.dasSource = dasSource;
}

DASFeatureSource.prototype.getStyleSheet = function(callback) {
    this.dasSource.stylesheet(function(stylesheet) {
	callback(stylesheet);
    }, function() {
	callback(null, "Couldn't fetch DAS stylesheet");
    });
}

DASFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    if (types && types.length == 0) {
        callback(null, [], scale);
        return;
    }

    if (!this.dasSource.uri) {
        return;
    }

    var tryMaxBins = (this.dasSource.maxbins !== false);
    var fops = {
        type: types
    };
    if (tryMaxBins) {
        fops.maxbins = 1 + (((max - min) / scale) | 0);
    }
    
    this.dasSource.features(
        new DASSegment(chr, min, max),
        fops,
        function(features, status) {
            var retScale = scale;
            if (!tryMaxBins) {
                retScale = 0.1;
            }
            callback(status, features, retScale);
        }
    );
}

DASFeatureSource.prototype.findNextFeature = this.sourceFindNextFeature = function(chr, pos, dir, callback) {
    if (this.dasSource.capabilities && arrayIndexOf(this.dasSource.capabilities, 'das1:adjacent-feature') >= 0) {
        var thisB = this;
        if (this.dasAdjLock) {
            return dlog('Already looking for a next feature, be patient!');
        }
        this.dasAdjLock = true;
        var fops = {
            adjacent: chr + ':' + (pos|0) + ':' + (dir > 0 ? 'F' : 'B')
        }
        var types = thisTier.getDesiredTypes(thisTier.browser.scale);
        if (types) {
            fops.types = types;
        }
        thisTier.dasSource.features(null, fops, function(res) {
            thisB.dasAdjLock = false;
            if (res.length > 0 && res[0] != null) {
                dlog('DAS adjacent seems to be working...');
                callback(res[0]);
            }
        });
    }
};

function DASSequenceSource(dasSource) {
    this.dasSource = dasSource;
    this.awaitedEntryPoints = new Awaited();

    var thisB = this;
    this.dasSource.entryPoints(
        function(ep) {
            thisB.awaitedEntryPoints.provide(ep);
        });
}


DASSequenceSource.prototype.fetch = function(chr, min, max, pool, callback) {
    this.dasSource.sequence(
        new DASSegment(chr, min, max),
        function(seqs) {
            if (seqs.length == 1) {
                return callback(null, seqs[0]);
            } else {
                return callback("Didn't get sequence");
            }
        }
    );
}

DASSequenceSource.prototype.getSeqInfo = function(chr, cnt) {
    this.awaitedEntryPoints.await(function(ep) {
        for (var epi = 0; epi < ep.length; ++epi) {
            if (ep[epi].name == chr) {
                return cnt({length: ep[epi].end});
            }
        }
        return cnt();
    });
}
    

function TwoBitSequenceSource(source) {
    var thisB = this;
    this.source = source;
    this.twoBit = new Awaited();
    makeTwoBit(new URLFetchable(source.twoBitURI), function(tb, error) {
        if (error) {
            dlog(error);
        } else {
            thisB.twoBit.provide(tb);
        }
    });
}

TwoBitSequenceSource.prototype.fetch = function(chr, min, max, pool, callback) {
        this.twoBit.await(function(tb) {
            tb.fetch(chr, min, max,
                     function(seq, err) {
                         if (err) {
                             return callback(err, null);
                         } else {
                             var sequence = new DASSequence(chr, min, max, 'DNA', seq);
                             return callback(null, sequence);
                         }
                     })
        });
}

TwoBitSequenceSource.prototype.getSeqInfo = function(chr, cnt) {
    this.twoBit.await(function(tb) {
        var seq = tb.getSeq(chr);
        if (seq) {
            tb.getSeq(chr).length(function(l) {
                cnt({length: l});
            });
        } else {
            cnt();
        }
    });
}

DASFeatureSource.prototype.getScales = function() {
    return [];
}

var bwg_preflights = {};

function BWGFeatureSource(bwgSource) {
    var thisB = this;
    this.bwgSource = this.opts = bwgSource;    
    thisB.bwgHolder = new Awaited();

    if (this.opts.preflight) {
        var pfs = bwg_preflights[this.opts.preflight];
        if (!pfs) {
            pfs = new Awaited();
            bwg_preflights[this.opts.preflight] = pfs;

            var req = new XMLHttpRequest();
            req.onreadystatechange = function() {
                if (req.readyState == 4) {
                    if (req.status == 200) {
                        pfs.provide('success');
                    } else {
                        pfs.provide('failure');
                    }
                }
            };
            req.open('get', this.opts.preflight + '?' + hex_sha1('salt' + Date.now()), true);    // Instead, ensure we always preflight a unique URI.
            if (this.opts.credentials) {
                req.withCredentials = true;
            }
            req.send('');
        }
        pfs.await(function(status) {
            if (status === 'success') {
                thisB.init();
            }
        });
    } else {
        thisB.init();
    }
}

BWGFeatureSource.prototype.init = function() {
    var thisB = this;
    var make, arg;
    if (this.bwgSource.bwgURI) {
        make = makeBwgFromURL;
        arg = this.bwgSource.bwgURI;
    } else {
        make = makeBwgFromFile;
        arg = this.bwgSource.bwgBlob;
    }

    make(arg, function(bwg) {
        thisB.bwgHolder.provide(bwg);
    }, this.opts.credentials);
}

BWGFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;
    this.bwgHolder.await(function(bwg) {
        if (bwg == null) {
            return callback("Can't access binary file", null, null);
        }

        // dlog('bwg: ' + bwg.name + '; want scale: ' + scale);
        var data;
        // dlog(miniJSONify(types));
        var wantDensity = !types || types.length == 0 || arrayIndexOf(types, 'density') >= 0;
/*        if (wantDensity) {
            dlog('want density; scale=' + scale);
        } */
        if (thisB.opts.clientBin) {
            wantDensity = false;
        }
        if (bwg.type == 'bigwig' || wantDensity || (typeof thisB.opts.forceReduction !== 'undefined')) {
            var zoom = -1;
            for (var z = 0; z < bwg.zoomLevels.length; ++z) {
                if (bwg.zoomLevels[z].reduction <= scale) {
                    zoom = z;
                } else {
                    break;
                }
            }
            if (typeof thisB.opts.forceReduction !== 'undefined') {
                zoom = thisB.opts.forceReduction;
            }
           // dlog('selected zoom: ' + zoom);
            if (zoom < 0) {
                data = bwg.getUnzoomedView();
            } else {
                data = bwg.getZoomedView(zoom);
            }
        } else {
            data = bwg.getUnzoomedView();
        }
        data.readWigData(chr, min, max, function(features) {
            var fs = 1000000000;
            if (bwg.type === 'bigwig') {
                var is = (max - min) / features.length / 2;
                if (is < fs) {
                    fs = is;
                }
            }
            if (thisB.opts.link) {
                for (var fi = 0; fi < features.length; ++fi) {
                    var f = features[fi];
                    if (f.label) {
                        f.links = [new DASLink('Link', thisB.opts.link.replace(/\$\$/, f.label))];
                    }
                }
            }
            callback(null, features, fs);
        });
    });
}

BWGFeatureSource.prototype.quantFindNextFeature = function(chr, pos, dir, threshold, callback) {
    var beforeQFNF = Date.now()|0;
    this.bwgHolder.res.thresholdSearch(chr, pos, dir, threshold, function(a, b) {
        var afterQFNF = Date.now()|0;
        console.log('QFNF took ' + (afterQFNF - beforeQFNF) + 'ms');
        return callback(a, b);
    });
}

BWGFeatureSource.prototype.findNextFeature = function(chr, pos, dir, callback) {
    this.bwgHolder.res.getUnzoomedView().getFirstAdjacent(chr, pos, dir, function(res) {
        if (res.length > 0 && res[0] != null) {
            callback(res[0]);
        }
    });
}

BWGFeatureSource.prototype.getScales = function() {
    var bwg = this.bwgHolder.res;
    if (bwg /* && bwg.type == 'bigwig' */) {
        var scales = [1];  // Can we be smarter about inferring baseline scale?
        for (var z = 0; z < bwg.zoomLevels.length; ++z) {
            scales.push(bwg.zoomLevels[z].reduction);
        }
        return scales;
    } else {
        return null;
    }
}

BWGFeatureSource.prototype.getStyleSheet = function(callback) {
    this.bwgHolder.await(function(bwg) {
        if (!bwg) {
            return callback(null, 'bbi error');
        }

	/* What to do about this...?
        if (thisTier.dasSource.collapseSuperGroups === undefined) {
            if (bwg.definedFieldCount == 12 && bwg.fieldCount >= 14) {
                thisTier.dasSource.collapseSuperGroups = true;
                thisTier.bumped = false;
            }
        }*/

	var stylesheet = new DASStylesheet();
        if (bwg.type == 'bigbed') {
            var wigStyle = new DASStyle();
            wigStyle.glyph = 'BOX';
            wigStyle.FGCOLOR = 'black';
            wigStyle.BGCOLOR = 'blue'
            wigStyle.HEIGHT = 8;
            wigStyle.BUMP = true;
            wigStyle.LABEL = true;
            wigStyle.ZINDEX = 20;
            stylesheet.pushStyle({type: 'bigwig'}, null, wigStyle);
	    
            wigStyle.glyph = 'BOX';
            wigStyle.FGCOLOR = 'black';
            wigStyle.BGCOLOR = 'red'
            wigStyle.HEIGHT = 10;
            wigStyle.BUMP = true;
            wigStyle.ZINDEX = 20;
            stylesheet.pushStyle({type: 'bb-translation'}, null, wigStyle);
                    
            var tsStyle = new DASStyle();
            tsStyle.glyph = 'BOX';
            tsStyle.FGCOLOR = 'black';
            tsStyle.BGCOLOR = 'white';
            tsStyle.HEIGHT = 10;
            tsStyle.ZINDEX = 10;
            tsStyle.BUMP = true;
            tsStyle.LABEL = true;
            stylesheet.pushStyle({type: 'bb-transcript'}, null, tsStyle);

            var densStyle = new DASStyle();
            densStyle.glyph = 'HISTOGRAM';
            densStyle.COLOR1 = 'white';
            densStyle.COLOR2 = 'black';
            densStyle.HEIGHT=30;
            stylesheet.pushStyle({type: 'density'}, null, densStyle);
        } else {
            var wigStyle = new DASStyle();
            wigStyle.glyph = 'HISTOGRAM';
            wigStyle.COLOR1 = 'white';
            wigStyle.COLOR2 = 'black';
            wigStyle.HEIGHT=30;
            stylesheet.pushStyle({type: 'default'}, null, wigStyle);
        }

	return callback(stylesheet);
    });
}

function BamblrFeatureSource(bamblrSource) {
    this.bamblr = bamblrSource.bamblrURI;
}

BamblrFeatureSource.prototype.getScales = function() {
    return [];
}

BamblrFeatureSource.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();

    var densStyle = new DASStyle();
    densStyle.glyph = 'HISTOGRAM';
    densStyle.COLOR1 = 'black';
    densStyle.COLOR2 = 'red';
    densStyle.HEIGHT=30;
    stylesheet.pushStyle({type: 'default'}, null, densStyle);

    return callback(stylesheet);
}

BamblrFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var rez = scale|0;
    if (rez < 1) {
        rez = 1;
    }
    var url = this.bamblr + '?seq=' + chr + '&min=' + min + '&max=' + max + '&rez=' + rez;
    new URLFetchable(url).fetch(function(data) {
        if (data == null) {
            dlog('failing bamblr');
            return;
        } else {
            var id = new Int32Array(data);
            var features = [];
            for (var ri = 0; ri < id.length; ++ri) {
                var f = new DASFeature();
                f.min = min + (ri * rez)
                f.max = f.min + rez - 1;
                f.segment = chr;
                f.type = 'bamblr';
                f.score = id[ri];
                features.push(f);
            }
            callback(null, features, rez);
            return;
        }
    });
}

function BAMFeatureSource(bamSource) {
    var thisB = this;
    this.bamSource = bamSource;
    this.opts = {credentials: bamSource.credentials, preflight: bamSource.preflight};
    this.bamHolder = new Awaited();
    
    if (this.opts.preflight) {
        var pfs = bwg_preflights[this.opts.preflight];
        if (!pfs) {
            pfs = new Awaited();
            bwg_preflights[this.opts.preflight] = pfs;

            var req = new XMLHttpRequest();
            req.onreadystatechange = function() {
                if (req.readyState == 4) {
                    if (req.status == 200) {
                        pfs.provide('success');
                    } else {
                        pfs.provide('failure');
                    }
                }
            };
            // req.setRequestHeader('cache-control', 'no-cache');    /* Doesn't work, not an allowed request header in CORS */
            req.open('get', this.opts.preflight + '?' + hex_sha1('salt' + Date.now()), true);    // Instead, ensure we always preflight a unique URI.
            if (this.opts.credentials) {
                req.withCredentials = 'true';
            }
            req.send('');
        }
        pfs.await(function(status) {
            if (status === 'success') {
                thisB.init();
            }
        });
    } else {
        thisB.init();
    }
}

BAMFeatureSource.prototype.init = function() {
    var thisB = this;
    var bamF, baiF;
    if (this.bamSource.bamBlob) {
        bamF = new BlobFetchable(this.bamSource.bamBlob);
        baiF = new BlobFetchable(this.bamSource.baiBlob);
    } else {
        bamF = new URLFetchable(this.bamSource.bamURI, {credentials: this.opts.credentials});
        baiF = new URLFetchable(this.bamSource.baiURI || (this.bamSource.bamURI + '.bai'), {credentials: this.opts.credentials});
    }
    makeBam(bamF, baiF, function(bam) {
        thisB.bamHolder.provide(bam);
    });
}

BAMFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;
    this.bamHolder.await(function(bam) {
        bam.fetch(chr, min, max, function(bamRecords, error) {
            if (error) {
                callback(error, null, null);
            } else {
                var features = [];
                for (var ri = 0; ri < bamRecords.length; ++ri) {
                    var r = bamRecords[ri];
                    var f = new DASFeature();
                    f.min = r.pos + 1;
                    f.max = r.pos + r.seq.length;
                    f.segment = r.segment;
                    f.type = 'bam';
                    f.id = r.readName;
                    f.notes = ['Sequence=' + r.seq, 'CIGAR=' + r.cigar, 'MQ=' + r.mq];
                    f.seq = r.seq;
                    features.push(f);
                }
                callback(null, features, 1000000000);
            }
        });
    });
}

BAMFeatureSource.prototype.getScales = function() {
    return 1000000000;
}

BAMFeatureSource.prototype.getStyleSheet = function(callback) {
    this.bamHolder.await(function(bam) {
	var stylesheet = new DASStylesheet();
                
        var densStyle = new DASStyle();
        densStyle.glyph = 'HISTOGRAM';
        densStyle.COLOR1 = 'black';
        densStyle.COLOR2 = 'red';
        densStyle.HEIGHT=30;
        stylesheet.pushStyle({type: 'density'}, 'low', densStyle);
        stylesheet.pushStyle({type: 'density'}, 'medium', densStyle);

        var wigStyle = new DASStyle();
        wigStyle.glyph = '__SEQUENCE';
        wigStyle.FGCOLOR = 'black';
        wigStyle.BGCOLOR = 'blue'
        wigStyle.HEIGHT = 8;
        wigStyle.BUMP = true;
        wigStyle.LABEL = false;
        wigStyle.ZINDEX = 20;
        stylesheet.pushStyle({type: 'bam'}, 'high', wigStyle);
	//                thisTier.stylesheet.pushStyle({type: 'bam'}, 'medium', wigStyle);

	return callback(stylesheet);
    });
}

function MappedFeatureSource(source, mapping) {
    this.source = source;
    this.mapping = mapping;
}

MappedFeatureSource.prototype.getStyleSheet = function(callback) {
    return this.source.getStyleSheet(callback);
}

MappedFeatureSource.prototype.getScales = function() {
    return this.source.getScales();
}

MappedFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;

    this.mapping.sourceBlocksForRange(chr, min, max, function(mseg) {
        if (mseg.length == 0) {
            callback("No mapping available for this regions", [], scale);
        } else {
            var seg = mseg[0];
            thisB.source.fetch(seg.name, seg.start, seg.end, scale, types, pool, function(status, features, fscale) {
                var mappedFeatures = [];
                if (features) {
                    for (var fi = 0; fi < features.length; ++fi) {
                        var f = features[fi];
                        var sn = f.segment;
                        if (sn.indexOf('chr') == 0) {
                            sn = sn.substr(3);
                        }
                        var mmin = thisB.mapping.mapPoint(sn, f.min);
                        var mmax = thisB.mapping.mapPoint(sn, f.max);
                        if (!mmin || !mmax || mmin.seq != mmax.seq || mmin.seq != chr) {
                            // Discard feature.
                            // dlog('discarding ' + miniJSONify(f));
                            if (f.parts && f.parts.length > 0) {    // FIXME: Ugly hack to make ASTD source map properly.
                                 mappedFeatures.push(f);
                            }
                        } else {
                            f.segment = mmin.seq;
                            f.min = mmin.pos;
                            f.max = mmax.pos;
                            if (f.min > f.max) {
                                var tmp = f.max;
                                f.max = f.min;
                                f.min = tmp;
                            }
                            if (mmin.flipped) {
                                if (f.orientation == '-') {
                                    f.orientation = '+';
                                } else if (f.orientation == '+') {
                                    f.orientation = '-';
                                }
                            }
                            mappedFeatures.push(f);
                        }
                    }
                }

                callback(status, mappedFeatures, fscale);
            });
        }
    });
}

function DummyFeatureSource() {
}

DummyFeatureSource.prototype.getScales = function() {
    return null;
}

DummyFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, cnt) {
    return cnt(null, [], 1000000000);
}

DummyFeatureSource.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();
    var defStyle = new DASStyle();
    defStyle.glyph = 'BOX';
    defStyle.BGCOLOR = 'blue';
    defStyle.FGCOLOR = 'black';
    stylesheet.pushStyle({type: 'default'}, null, defStyle);
    return callback(stylesheet);
}

function DummySequenceSource() {
}

DummySequenceSource.prototype.fetch = function(chr, min, max, pool, cnt) {
    return cnt(null, null);
}

function JBrowseFeatureSource(source) {
    this.store = new JBrowseStore(source.jbURI, source.jbQuery);
}

JBrowseFeatureSource.prototype.getScales = function() {
    return null;
}

JBrowseFeatureSource.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();
    var wigStyle = new DASStyle();
    wigStyle.glyph = 'BOX';
    wigStyle.FGCOLOR = 'black';
    wigStyle.BGCOLOR = 'green'
    wigStyle.HEIGHT = 8;
    wigStyle.BUMP = true;
    wigStyle.LABEL = true;
    wigStyle.ZINDEX = 20;
    stylesheet.pushStyle({type: 'default'}, null, wigStyle);

    return callback(stylesheet);
}

JBrowseFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    if (types && types.length == 0) {
        callback(null, [], scale);
        return;
    }
    
    var fops = {};

    this.store.features(
        new DASSegment(chr, min, max),
        fops,
        function(features, status) {
            callback(status, features, 100000);
        }
    );
}


