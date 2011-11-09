/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// kspace.js: Manage a block of Known Space
//


function FetchPool() {
    this.reqs = [];
}

FetchPool.prototype.addRequest = function(xhr) {
    this.reqs.push(xhr);
}

FetchPool.prototype.abortAll = function() {
    for (var i = 0; i < this.reqs.length; ++i) {
        this.reqs[i].abort();
    }
}

function KSCacheBaton(chr, min, max, scale, features, status) {
    this.chr = chr;
    this.min = min;
    this.max = max;
    this.scale = scale;
    this.features = features || [];
    this.status = status;
}

KSCacheBaton.prototype.toString = function() {
    return this.chr + ":" + this.min + ".." + this.max + ";scale=" + this.scale;
}

function KnownSpace(tierMap, chr, min, max, scale, seqSource) {
    this.tierMap = tierMap;
    this.chr = chr;
    this.min = min;
    this.max = max;
    this.scale = scale;
    this.seqSource = seqSource || new DummySequenceSource();

    this.featureCache = {};
}

KnownSpace.prototype.bestCacheOverlapping = function(chr, min, max) {
    var baton = this.featureCache[this.tierMap[0]];
    if (baton) {
        return baton;
    } else {
        return null;
    }
}

KnownSpace.prototype.viewFeatures = function(chr, min, max, scale) {
    // dlog('viewFeatures(' + chr + ', ' + min + ', ' + max + ', ' + scale +')');
    if (scale != scale) {
        throw "viewFeatures called with silly scale";
    }

    if (chr != this.chr) {
        throw "Can't extend Known Space to a new chromosome";
    }
    this.min = min;
    this.max = max;
    this.scale = scale;

    if (this.pool) {
        this.pool.abortAll();
    }
    this.pool = new FetchPool();
    this.awaitedSeq = new Awaited();
    this.seqWasFetched = false;
    
    this.startFetchesForTiers(this.tierMap);
}
    
function filterFeatures(features, min, max) {
    var ff = [];
    featuresByGroup = {};

    for (var fi = 0; fi < features.length; ++fi) {
        var f = features[fi];
        if (!f.min || !f.max) {
            ff.push(f);
        } else if (f.groups && f.groups.length > 0) {
            pusho(featuresByGroup, f.groups[0].id, f);
        } else if (f.min <= max && f.max >= min) {
            ff.push(f);
        }
    }

    for (var gid in featuresByGroup) {
        var gf = featuresByGroup[gid];
        var gmin = 100000000000, gmax = -100000000000;
        for (var fi = 0; fi < gf.length; ++fi) {
            var f = gf[fi];
            gmin = Math.min(gmin, f.min);
            gmax = Math.max(gmax, f.max);
        }
        if (gmin <= max || gmax >= min) {
            for (var fi = 0; fi < gf.length; ++fi) {
                ff.push(gf[fi]);
            }
        }
    }

    return ff;
}

KnownSpace.prototype.invalidate = function(tier) {
    this.featureCache[tier] = null;
    this.startFetchesForTiers([tier]);
}

KnownSpace.prototype.startFetchesForTiers = function(tiers) {
    var thisB = this;

    var awaitedSeq = this.awaitedSeq;
    var needSeq = false;

    for (var t = 0; t < tiers.length; ++t) {
        if (this.startFetchesFor(tiers[t], awaitedSeq)) {
            needSeq = true;
        }
    }

    if (needSeq && !this.seqWasFetched) {
        this.seqWasFetched = true;
        // dlog('needSeq ' + this.chr + ':' + this.min + '..' + this.max);
        var smin = this.min, smax = this.max;

        if (this.cs) {
            if (this.cs.start <= smin && this.cs.end >= smax) {
                var cachedSeq;
                if (this.cs.start == smin && this.cs.end == smax) {
                    cachedSeq = this.cs;
                } else {
                    cachedSeq = new DASSequence(this.cs.name, smin, smax, this.cs.alphabet, 
                                                this.cs.seq.substring(smin - this.cs.start, smax + 1 - this.cs.start));
                }
                return awaitedSeq.provide(cachedSeq);
            }
        }
        
        this.seqSource.fetch(this.chr, smin, smax, this.pool, function(err, seq) {
            if (seq) {
                if (!thisB.cs || (smin <= thisB.cs.start && smax >= thisB.cs.end) || 
                    (smin >= thisB.cs.end) || (smax <= thisB.cs.start) || 
                    ((smax - smin) > (thisB.cs.end - thisB.cs.start))) 
                {
                    thisB.cs = seq;
                }
                awaitedSeq.provide(seq);
            } else {
                dlog('Noseq: ' + miniJSONify(err));
            }
        });
    } 
}

KnownSpace.prototype.startFetchesFor = function(tier, awaitedSeq) {
    var thisB = this;

    var source = tier.getSource() || new DummyFeatureSource();
    var needsSeq = tier.needsSequence(this.scale);
    var baton = thisB.featureCache[tier];
    var wantedTypes = tier.getDesiredTypes(this.scale);
    if (wantedTypes === undefined) {
//         dlog('skipping because wantedTypes is undef');
        return false;
    }
    if (baton) {
//      dlog('considering cached features: ' + baton);
    }
    if (baton && baton.chr === this.chr && baton.min <= this.min && baton.max >= this.max) {
        var cachedFeatures = baton.features;
        if (baton.min < this.min || baton.max > this.max) {
            cachedFeatures = filterFeatures(cachedFeatures, this.min, this.max);
        }
        
        // dlog('cached scale=' + baton.scale + '; wanted scale=' + thisB.scale);
//      if ((baton.scale < (thisB.scale/2) && cachedFeatures.length > 200) || (wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0) ) {
//          cachedFeatures = downsample(cachedFeatures, thisB.scale);
//      }
        // dlog('Provisioning ' + tier.toString() + ' with ' + cachedFeatures.length + ' features from cache');
//      tier.viewFeatures(baton.chr, Math.max(baton.min, this.min), Math.min(baton.max, this.max), baton.scale, cachedFeatures);   // FIXME change scale if downsampling

        thisB.provision(tier, baton.chr, Math.max(baton.min, this.min), Math.min(baton.max, this.max), baton.scale, wantedTypes, cachedFeatures, baton.status, needsSeq ? awaitedSeq : null);

        var availableScales = source.getScales();
        if (baton.scale <= this.scale || !availableScales) {
//          dlog('used cached features');
            return needsSeq;
        } else {
//          dlog('used cached features (temporarily)');
        }
    }

    source.fetch(this.chr, this.min, this.max, this.scale, wantedTypes, this.pool, function(status, features, scale) {
        if (!baton || (thisB.min < baton.min) || (thisB.max > baton.max)) {         // FIXME should be merging in some cases?
            thisB.featureCache[tier] = new KSCacheBaton(thisB.chr, thisB.min, thisB.max, scale, features, status);
        }

        //if ((scale < (thisB.scale/2) && features.length > 200) || (wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0) ) {
        //    features = downsample(features, thisB.scale);
        //}
        // dlog('Provisioning ' + tier.toString() + ' with fresh features');
        //tier.viewFeatures(thisB.chr, thisB.min, thisB.max, this.scale, features);
        thisB.provision(tier, thisB.chr, thisB.min, thisB.max, thisB.scale, wantedTypes, features, status, needsSeq ? awaitedSeq : null);
    });
    return needsSeq;
}

KnownSpace.prototype.provision = function(tier, chr, min, max, actualScale, wantedTypes, features, status, awaitedSeq) {
    if (status) {
        tier.updateStatus(status);
    } else {
        var mayDownsample = false;
        var src = tier.getSource();
        while (MappedFeatureSource.prototype.isPrototypeOf(src)) {
            dlog('Skipping up...');
            src = src.source;
        }
        if (BWGFeatureSource.prototype.isPrototypeOf(src) || BAMFeatureSource.prototype.isPrototypeOf(src)) {
            mayDownsample = true;
        }

        if ((actualScale < (this.scale/2) && features.length > 200) || 
            (mayDownsample && wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0))
        {
            features = downsample(features, this.scale);
        }

        if (awaitedSeq) {
            awaitedSeq.await(function(seq) {
                tier.viewFeatures(chr, min, max, actualScale, features, seq);
            });
        } else {
            tier.viewFeatures(chr, min, max, actualScale, features);
        }
    }
}


function DASFeatureSource(dasSource) {
    this.dasSource = dasSource;
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

function DASSequenceSource(dasSource) {
    this.dasSource = dasSource;
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


DASFeatureSource.prototype.getScales = function() {
    return [];
}

var bwg_preflights = {};

function BWGFeatureSource(bwgSource, opts) {
    var thisB = this;
    this.bwgSource = bwgSource;
    this.opts = opts || {};
    
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
            // req.setRequestHeader('cache-control', 'no-cache');    /* Doesn't work, not an allowed request header in CORS */
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
            // if (bwg.type === 'bigwig') {
                var is = (max - min) / features.length / 2;
                if (is < fs) {
                    fs = is;
                }
            // }
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

function BAMFeatureSource(bamSource, opts) {
    var thisB = this;
    this.bamSource = bamSource;
    this.opts = opts || {};
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

function MappedFeatureSource(source, mapping) {
    this.source = source;
    this.mapping = mapping;
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

function DummySequenceSource() {
}

DummySequenceSource.prototype.fetch = function(chr, min, max, pool, cnt) {
    return cnt(null, null);
}
