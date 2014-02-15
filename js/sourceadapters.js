/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// sourceadapters.js
//

var __dalliance_sourceAdapterFactories = {};

function dalliance_registerSourceAdapterFactory(type, factory) {
    __dalliance_sourceAdapterFactories[type] = factory;
};


(function(global) {
    var __dalliance_parserFactories = {};

    global.dalliance_registerParserFactory = function(type, factory) {
        __dalliance_parserFactories[type] = factory;
    };

    global.dalliance_makeParser = function(type) {
        if (__dalliance_parserFactories[type]) {
            return __dalliance_parserFactories[type](type);
        }
    };
}(this));



DasTier.prototype.initSources = function() {
    var thisTier = this;
    var fs = new DummyFeatureSource(), ss;

    if (this.dasSource.tier_type == 'sequence') {
        if (this.dasSource.twoBitURI) {
            ss = new TwoBitSequenceSource(this.dasSource);
        } else {
            ss = new DASSequenceSource(this.dasSource);
        }
    } else {
        fs = this.browser.createFeatureSource(this.dasSource);
    }

    this.featureSource = fs;
    this.sequenceSource = ss;

    if (this.featureSource && this.featureSource.addChangeListener) {
        this.featureSource.addChangeListener(function() {
            thisTier.browser.refreshTier(thisTier);
        });
    }

}

Browser.prototype.createFeatureSource = function(config) {
    var fs = this.sourceCache.get(config);
    if (fs) {
        return fs;
    }

    if (config.tier_type && __dalliance_sourceAdapterFactories[config.tier_type]) {
        var saf = __dalliance_sourceAdapterFactories[config.tier_type];
        fs = saf(config).features;
    } else if (config.bwgURI || config.bwgBlob) {
        fs =  new BWGFeatureSource(config);
    } else if (config.bamURI || config.bamBlob) {
        fs = new BAMFeatureSource(config);
    } else if (config.bamblrURI) {
        fs = new BamblrFeatureSource(config);
    } else if (config.jbURI) {
        fs = new JBrowseFeatureSource(config);
    } else if (config.tier_type == 'worker-bam') {
        fs = new RemoteBAMFeatureSource(config, this.fetchWorker);
    } else if (config.uri || config.features_uri) {
        fs = new DASFeatureSource(config);
    }

    if (config.overlay) {
        var sources = [];
        if (fs)
            sources.push(new CachingFeatureSource(fs));

        for (var oi = 0; oi < config.overlay.length; ++oi) {
            sources.push(this.createFeatureSource(config.overlay[oi]));
        }
        fs = new OverlayFeatureSource(sources, config);
    }

    if (config.mapping) {
        fs = new MappedFeatureSource(fs, this.chains[config.mapping]);
    }

    if (config.name && !fs.name) {
        fs.name = config.name;
    }

    if (fs != null) {
        fs = new CachingFeatureSource(fs);
        this.sourceCache.put(config, fs);
    }
    return fs;
}

function SourceCache() {
    this.sourcesByURI = {}
}

SourceCache.prototype.get = function(conf) {
    var scb = this.sourcesByURI[sourceDataURI(conf)];
    if (scb) {
        for (var si = 0; si < scb.configs.length; ++si) {
            if (sourcesAreEqual(scb.configs[si], conf)) {
                return scb.sources[si];
            }
        }
    }
}

SourceCache.prototype.put = function(conf, source) {
    var uri = sourceDataURI(conf);
    var scb = this.sourcesByURI[uri];
    if (!scb) {
        scb = {configs: [], sources: []};
        this.sourcesByURI[uri] = scb;
    }
    scb.configs.push(conf);
    scb.sources.push(source);
}

var __cfs_id_seed = 0;

function CachingFeatureSource(source) {
    var thisB = this;

    this.source = source;
    this.cfsid = 'cfs' + (++__cfs_id_seed);
    if (source.name) {
        this.name = source.name;
    }
    if (source.addChangeListener) {
        source.addChangeListener(function() {
            thisB.cfsid = 'cfs' + (++__cfs_id_seed);
        });
    }
}

CachingFeatureSource.prototype.addReadinessListener = function(listener) {
    if (this.source.addReadinessListener)
        return this.source.addReadinessListener(listener);
    else
        listener(null);
}

CachingFeatureSource.prototype.search = function(query, callback) {
    if (this.source.search)
        return this.source.search(query, callback);
}

CachingFeatureSource.prototype.getDefaultFIPs = function(callback) {
    if (this.source.getDefaultFIPs)
        return this.source.getDefaultFIPs(callback); 
}

CachingFeatureSource.prototype.getStyleSheet = function(callback) {
    this.source.getStyleSheet(callback);
}

CachingFeatureSource.prototype.getScales = function() {
    return this.source.getScales();
}

CachingFeatureSource.prototype.addActivityListener = function(l) {
    if (this.source.addActivityListener) {
        this.source.addActivityListener(l);
    }
}

CachingFeatureSource.prototype.addChangeListener = function(l) {
    if (this.source.addChangeListener)
        this.source.addChangeListener(l);
}

CachingFeatureSource.prototype.findNextFeature = function(chr, pos, dir, callback) {
    this.source.findNextFeature(chr, pos, dir, callback);
}

CachingFeatureSource.prototype.quantFindNextFeature = function(chr, pos, dir, threshold, callback) {
    this.source.quantFindNextFeature(chr, pos, dir, threshold, callback);
}

CachingFeatureSource.prototype.capabilities = function() {
    if (this.source.capabilities) {
        return this.source.capabilities();
    } else {
        return {};
    }
}

CachingFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    if (pool == null) {
        throw 'pool is null...';
    }

    var awaitedFeatures = pool.awaitedFeatures[this.cfsid];
    if (!awaitedFeatures) {
        var awaitedFeatures = new Awaited();
        pool.awaitedFeatures[this.cfsid] = awaitedFeatures;
        this.source.fetch(chr, min, max, scale, types, pool, function(status, features, scale) {
            if (!awaitedFeatures.res)
                awaitedFeatures.provide({status: status, features: features, scale: scale});
        });
    } 

    awaitedFeatures.await(function(af) {
        callback(af.status, af.features, af.scale);
    });
}
    
function FeatureSourceBase() {
    this.busy = 0;
    this.activityListeners = [];
    this.readinessListeners = [];
    this.readiness = null;
}

FeatureSourceBase.prototype.addReadinessListener = function(listener) {
    this.readinessListeners.push(listener);
    listener(this.readiness);
}

FeatureSourceBase.prototype.notifyReadiness = function() {
    for (var li = 0; li < this.readinessListeners.length; ++li) {
        try {
            this.readinessListeners[li](this.readiness);
        } catch (e) {
            console.log(e);
        }
    }
}

FeatureSourceBase.prototype.addActivityListener = function(listener) {
    this.activityListeners.push(listener);
}

FeatureSourceBase.prototype.notifyActivity = function() {
    for (var li = 0; li < this.activityListeners.length; ++li) {
        try {
            this.activityListeners[li](this.busy);
        } catch (e) {
            console.log(e);
        }
    }
}

FeatureSourceBase.prototype.getScales = function() {
    return null;
}

FeatureSourceBase.prototype.fetch = function(chr, min, max, scale, types, pool, cnt) {
    return cnt(null, [], 1000000000);
}

FeatureSourceBase.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();
    var defStyle = new DASStyle();
    defStyle.glyph = 'BOX';
    defStyle.BGCOLOR = 'blue';
    defStyle.FGCOLOR = 'black';
    stylesheet.pushStyle({type: 'default'}, null, defStyle);
    return callback(stylesheet);
}



function DASFeatureSource(dasSource) {
    this.dasSource = dasSource;
    this.busy = 0;
    this.activityListeners = [];
}

DASFeatureSource.prototype.addActivityListener = function(listener) {
    this.activityListeners.push(listener);
}

DASFeatureSource.prototype.notifyActivity = function() {
    for (var li = 0; li < this.activityListeners.length; ++li) {
        try {
            this.activityListeners[li](this.busy);
        } catch (e) {
            console.log(e);
        }
    }
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

    if (!this.dasSource.uri && !this.dasSource.features_uri) {
        // FIXME should this be making an error callback???
        return;
    }

    if (this.dasSource.dasStaticFeatures && this.cachedStaticFeatures) {
        return callback(null, this.cachedStaticFeatures, this.cachedStaticScale);
    }

    var tryMaxBins = (this.dasSource.maxbins !== false);
    var fops = {
        type: types
    };
    if (tryMaxBins) {
        fops.maxbins = 1 + (((max - min) / scale) | 0);
    }
    
    var thisB = this;
    thisB.busy++;
    thisB.notifyActivity();

    this.dasSource.features(
        new DASSegment(chr, min, max),
        fops,
        function(features, status) {
            
            thisB.busy--;
            thisB.notifyActivity();

            var retScale = scale;
            if (!tryMaxBins) {
                retScale = 0.1;
            }
            if (!status && thisB.dasSource.dasStaticFeatures) {
                thisB.cachedStaticFeatures = features;
                thisB.cachedStaticScale = retScale;
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
    FeatureSourceBase.call(this);

    var thisB = this;
    this.readiness = 'Connecting';
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

BWGFeatureSource.prototype = Object.create(FeatureSourceBase.prototype);

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

    make(arg, function(bwg, err) {
        if (err) {
            thisB.error = err;
            thisB.readiness = null;
            thisB.notifyReadiness();
            thisB.bwgHolder.provide(null);
        } else {
            thisB.bwgHolder.provide(bwg);
            thisB.readiness = null;
            thisB.notifyReadiness();
            if (bwg.type == 'bigbed') {
                bwg.getExtraIndices(function(ei) {
                    thisB.extraIndices = ei;
                });
            }
        }
    }, this.opts.credentials);
}

BWGFeatureSource.prototype.capabilities = function() {
    var caps = {leap: true};
    if (this.bwgHolder.res && this.bwgHolder.res.type == 'bigwig')
        caps.quantLeap = true;
    if (this.extraIndices && this.extraIndices.length > 0) {
        caps.search = [];
        for (var eii = 0; eii < this.extraIndices.length; ++eii) {
            caps.search.push(this.extraIndices[eii].field);
        }
    }
    return caps;
}

BWGFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;
    this.bwgHolder.await(function(bwg) {
        if (bwg == null) {
            return callback(thisB.error || "Can't access binary file", null, null);
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
        
        thisB.busy++;
        thisB.notifyActivity();
        data.readWigData(chr, min, max, function(features) {
            thisB.busy--;
            thisB.notifyActivity();

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
    // var beforeQFNF = Date.now()|0;
    var thisB = this;
    thisB.busy++;
    thisB.notifyActivity();
    this.bwgHolder.res.thresholdSearch(chr, pos, dir, threshold, function(a, b) {
        thisB.busy--;
        thisB.notifyActivity();
        // var afterQFNF = Date.now()|0;
        // console.log('QFNF took ' + (afterQFNF - beforeQFNF) + 'ms');
        return callback(a, b);
    });
}

BWGFeatureSource.prototype.findNextFeature = function(chr, pos, dir, callback) {
    var thisB = this;
    thisB.busy++;
    thisB.notifyActivity();
    this.bwgHolder.res.getUnzoomedView().getFirstAdjacent(chr, pos, dir, function(res) {
        thisB.busy--;
        thisB.notifyActivity();
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

BWGFeatureSource.prototype.search = function(query, callback) {
    if (!this.extraIndices || this.extraIndices.length == 0) {
        return callback(null, 'No indices available');
    }

    var index = this.extraIndices[0];
    return index.lookup(query, callback);
}

BWGFeatureSource.prototype.getDefaultFIPs = function(callback) {
    if (this.opts.noExtraFeatureInfo)
        return true;

    this.bwgHolder.await(function(bwg) {
        if (!bwg) return;

        if (bwg.schema && bwg.definedFieldCount < bwg.schema.fields.length) {
            var fip = function(feature, featureInfo) {
                for (var fi = bwg.definedFieldCount; fi < bwg.schema.fields.length; ++fi) {
                    var f = bwg.schema.fields[fi];
                    featureInfo.add(f.comment, feature[f.name]);
                }
            };

            callback(fip);
        } else {
            // No need to do anything.
        }
    });
}

BWGFeatureSource.prototype.getStyleSheet = function(callback) {
    var thisB = this;

    this.bwgHolder.await(function(bwg) {
        if (!bwg) {
            return callback(null, 'bbi error');
        }

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

        if (bwg.definedFieldCount == 12 && bwg.fieldCount >= 14) {
            stylesheet.geneHint = true;
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
    FeatureSourceBase.call(this);

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

BAMFeatureSource.prototype = Object.create(FeatureSourceBase.prototype);

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
    makeBam(bamF, baiF, function(bam, err) {
        thisB.readiness = null;
        thisB.notifyReadiness();

        if (bam) {
            thisB.bamHolder.provide(bam);
        } else {
            thisB.error = err;
            thisB.bamHolder.provide(null);
        }
    });
}

BAMFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;
    
    thisB.busy++;
    thisB.notifyActivity();
    
    this.bamHolder.await(function(bam) {
        if (!bam) {
            thisB.busy--;
            thisB.notifyActivity();
            return callback(thisB.error || "Couldn't fetch BAM");
        }

        bam.fetch(chr, min, max, function(bamRecords, error) {
            thisB.busy--;
            thisB.notifyActivity();

            if (error) {
                callback(error, null, null);
            } else {
                var features = [];
                for (var ri = 0; ri < bamRecords.length; ++ri) {
                    var r = bamRecords[ri];

                    if (r.flag & 0x4)
                        continue; 
                    
                    var len = r.seq.length;
                    if (r.cigar) {
                        len = 0;
                        var ops = parseCigar(r.cigar);
                        for (var ci = 0; ci < ops.length; ++ci) {
                            var co = ops[ci];
                            if (co.op == 'M' || co.op == 'D')
                                len += co.cnt;
                        }
                    }

                    var f = new DASFeature();
                    f.min = r.pos + 1;
                    f.max = r.pos + len;
                    f.segment = r.segment;
                    f.type = 'bam';
                    f.id = r.readName;
                    f.notes = ['Sequence=' + r.seq, 'CIGAR=' + r.cigar, 'MQ=' + r.mq];
                    f.cigar = r.cigar;
                    f.seq = r.seq;
                    f.quals = r.quals;
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




function RemoteBAMFeatureSource(bamSource, worker) {
    FeatureSourceBase.call(this);

    var thisB = this;
    this.bamSource = bamSource;
    this.worker = worker;
    this.opts = {credentials: bamSource.credentials, preflight: bamSource.preflight};
    this.keyHolder = new Awaited();
    
    this.init();
}

RemoteBAMFeatureSource.prototype = Object.create(FeatureSourceBase.prototype);

RemoteBAMFeatureSource.prototype.init = function() {
    var thisB = this;
    var uri = this.bamSource.uri;
    var indexUri = this.bamSource.indexUri || this.bamSouce.uri + '.bai';

    this.worker.postCommand({command: 'connectBAM', uri: uri, indexUri: indexUri}, function(result, err) {
        thisB.readiness = null;
        thisB.notifyReadiness();

        if (result) {
            thisB.keyHolder.provide(result);
        } else {
            thisB.error = err;
            thisB.keyHolder.provide(null);
        }
    }); 
}

RemoteBAMFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;
    
    thisB.busy++;
    thisB.notifyActivity();
    
    this.keyHolder.await(function(key) {
        if (!key) {
            thisB.busy--;
            thisB.notifyActivity();
            return callback(thisB.error || "Couldn't fetch BAM");
        }

        thisB.worker.postCommand({command: 'fetch', connection: key, chr: chr, min: min, max: max}, function(bamRecords, error) {
            thisB.busy--;
            thisB.notifyActivity();

            if (error) {
                callback(error, null, null);
            } else {
                var features = [];
                for (var ri = 0; ri < bamRecords.length; ++ri) {
                    var r = bamRecords[ri];

                    if (r.flag & 0x4)
                        continue; 
                    
                    var len = r.seq.length;
                    if (r.cigar) {
                        len = 0;
                        var ops = parseCigar(r.cigar);
                        for (var ci = 0; ci < ops.length; ++ci) {
                            var co = ops[ci];
                            if (co.op == 'M' || co.op == 'D')
                                len += co.cnt;
                        }
                    }

                    var f = new DASFeature();
                    f.min = r.pos + 1;
                    f.max = r.pos + len;
                    f.segment = r.segment;
                    f.type = 'bam';
                    f.id = r.readName;
                    f.notes = ['Sequence=' + r.seq, 'CIGAR=' + r.cigar, 'MQ=' + r.mq];
                    f.cigar = r.cigar;
                    f.seq = r.seq;
                    f.quals = r.quals;
                    features.push(f);
                }
                callback(null, features, 1000000000);
            }
        });
    });
}

RemoteBAMFeatureSource.prototype.getScales = function() {
    return 1000000000;
}

RemoteBAMFeatureSource.prototype.getStyleSheet = function(callback) {
    this.keyHolder.await(function(bam) {
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
    
    this.activityListeners = [];
    this.busy = 0;
}

MappedFeatureSource.prototype.addActivityListener = function(listener) {
    this.activityListeners.push(listener);
}

MappedFeatureSource.prototype.notifyActivity = function() {
    for (var li = 0; li < this.activityListeners.length; ++li) {
        try {
            this.activityListeners[li](this.busy);
        } catch (e) {
            console.log(e);
        }
    }
}


MappedFeatureSource.prototype.getStyleSheet = function(callback) {
    return this.source.getStyleSheet(callback);
}

MappedFeatureSource.prototype.getScales = function() {
    return this.source.getScales();
}

MappedFeatureSource.prototype.simplifySegments = function(segs, minGap) {
    if (segs.length == 0) return segs;

    segs.sort(function(s1, s2) {
        var d = s1.name - s2.name;
        if (d)
            return d;
        d = s1.start - s2.start;
        if (d)
            return d;
        return s1.end - s2.end;   // Should never come to this...?
    });

    var ssegs = [];
    var currentSeg = segs[0];
    for (var si = 0; si < segs.length; ++si) {
        var ns = segs[si];

        // console.log(ns.name + ' ' + ns.start + ' ' + ns.end);
        if (ns.name != currentSeg.name || ns.start > (currentSeg.end + minGap)) {
            ssegs.push(currentSeg);
            currentSeg = ns;
        } else {
            currentSeg = new DASSegment(currentSeg.name, Math.min(currentSeg.start, ns.start), Math.max(currentSeg.end, ns.end));
        }
    }
    ssegs.push(currentSeg);
    return ssegs;
}

MappedFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;

    thisB.busy++;
    thisB.notifyActivity();

    this.mapping.sourceBlocksForRange(chr, min, max, function(mseg) {
        if (mseg.length == 0) {
            thisB.busy--;
            thisB.notifyActivity();

            callback("No mapping available for this regions", [], scale);
        } else {
            mseg = thisB.simplifySegments(mseg, 500);

            var segLen = 0;
            var seg;

            for (var si = 0; si < mseg.length; ++si) {
                var ss = mseg[si];
                var sl = ss.end - ss.start + 1;
                if (sl > segLen) {
                    segLen = sl; seg = ss;
                }
            }

            thisB.source.fetch(seg.name, seg.start, seg.end, scale, types, pool, function(status, features, fscale) {
                thisB.busy--;
                thisB.notifyActivity();

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

function sourceAdapterIsCapable(s, cap) {
    if (!s.capabilities)
        return false;
    else return s.capabilities()[cap];
}
