/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// sourceadapters.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var tier = require('./tier');
    var DasTier = tier.DasTier;

    var utils = require('./utils')
    var Awaited = utils.Awaited;
    var arrayIndexOf = utils.arrayIndexOf;
    var shallowCopy = utils.shallowCopy;
    var resolveUrlToPage = utils.resolveUrlToPage;

    var das = require('./das');
    var DASStylesheet = das.DASStylesheet;
    var DASStyle = das.DASStyle;
    var DASSource = das.DASSource;
    var DASSegment = das.DASSegment;
    var DASFeature = das.DASFeature;
    var DASSequence = das.DASSequence;
    var DASLink = das.DASLink;

    var bin = require('./bin');
    var URLFetchable = bin.URLFetchable;
    var BlobFetchable = bin.BlobFetchable;

    var twoBit = require('./twoBit');
    var makeTwoBit = twoBit.makeTwoBit;

    var bbi = require('./bigwig');
    var makeBwg = bbi.makeBwg;

    var bam = require('./bam');
    var makeBam = bam.makeBam;
    var BamFlags = bam.BamFlags;

    var spans = require('./spans');
    var Range = spans.Range;
    var union = spans.union;

    var parseCigar = require('./cigar').parseCigar;

    var OverlayFeatureSource = require('./overlay').OverlayFeatureSource;

    var JBrowseStore = require('./jbjson').JBrowseStore;

    var Chainset = require('./chainset').Chainset;

    var style = require('./style');
    var StyleFilterSet = style.StyleFilterSet;

    var EncodeFetchable = require('./encode').EncodeFetchable;
}

var __dalliance_sourceAdapterFactories = {};

function dalliance_registerSourceAdapterFactory(type, factory) {
    __dalliance_sourceAdapterFactories[type] = factory;
};


var __dalliance_parserFactories = {};

function dalliance_registerParserFactory(type, factory) {
    __dalliance_parserFactories[type] = factory;
};

function dalliance_makeParser(type) {
    if (__dalliance_parserFactories[type]) {
        return __dalliance_parserFactories[type](type);
    }
};


DasTier.prototype.initSources = function() {
    var thisTier = this;

    var sources = this.browser.createSources(this.dasSource);
    this.featureSource = sources.features || new DummyFeatureSource();
    this.sequenceSource = sources.sequence;

    if (this.featureSource && this.featureSource.addChangeListener) {
        this.featureSource.addChangeListener(function() {
            thisTier.browser.refreshTier(thisTier);
        });
    }
}

Browser.prototype.createSources = function(config) {
    var sources = this.sourceCache.get(config);
    if (sources)
        return sources;

    var fs, ss;

    if (config.tier_type == 'sequence' || config.twoBitURI || config.twoBitBlob) {
        if (config.twoBitURI || config.twoBitBlob) {
            ss = new TwoBitSequenceSource(config);
        } else {
            ss = new DASSequenceSource(config);
        }
    } else if (config.tier_type && __dalliance_sourceAdapterFactories[config.tier_type]) {
        var saf = __dalliance_sourceAdapterFactories[config.tier_type];
        var ns = saf(config);
        fs = ns.features;
        ss = ns.sequence;
    } else if (config.bwgURI || config.bwgBlob) {
        var worker = this.getWorker();
        if (worker)
            fs = new RemoteBWGFeatureSource(config, worker);
        else
            fs = new BWGFeatureSource(config);
    } else if (config.bamURI || config.bamBlob) {
        var worker = this.getWorker();
        if (worker)
            fs = new RemoteBAMFeatureSource(config, worker);
        else
            fs = new BAMFeatureSource(config);
    } else if (config.jbURI) {
        fs = new JBrowseFeatureSource(config);
    } else if (config.uri || config.features_uri) {
        fs = new DASFeatureSource(config);
    }

    if (config.overlay) {
        var sources = [];
        if (fs)
            sources.push(new CachingFeatureSource(fs));

        for (var oi = 0; oi < config.overlay.length; ++oi) {
            var cs = this.createSources(config.overlay[oi]);
            if (cs && cs.features)
                sources.push(cs.features);
        }
        fs = new OverlayFeatureSource(sources, config);
    }

    if (config.sequenceAliases) {
        fs = new MappedFeatureSource(fs, new Chainset({type: 'alias', sequenceAliases: config.sequenceAliases}));
    }

    if (config.mapping) {
        fs = new MappedFeatureSource(fs, this.chains[config.mapping]);
    }

    if (config.name && fs && !fs.name) {
        fs.name = config.name;
    }

    if (fs != null) {
        fs = new CachingFeatureSource(fs);
    }

    if (fs != null || ss != null) {
        sources = {
            features: fs,
            sequence: ss
        };
        this.sourceCache.put(config, sources);
    }

    return sources;
}

DasTier.prototype.fetchStylesheet = function(cb) {
    var ssSource;
    // Somewhat ugly workaround for the special case of DAS sources...
    if (this.dasSource.stylesheet_uri || (
        !this.dasSource.tier_type &&
        !this.dasSource.bwgURI &&
        !this.dasSource.bwgBlob &&
        !this.dasSource.bamURI &&
        !this.dasSource.bamBlob &&
        !this.dasSource.twoBitURI &&
        !this.dasSource.twoBitBlob &&
        !this.dasSource.jbURI &&
        !this.dasSource.overlay))
    {
        ssSource = new DASFeatureSource(this.dasSource);
    } else {
        ssSource = this.getSource();
    }
    ssSource.getStyleSheet(cb);
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

CachingFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback, styleFilters) {
    if (!pool) {
        throw Error('Fetch pool is null');
    }

    var self = this;
    var cacheKey = this.cfsid;

    var awaitedFeatures = pool.awaitedFeatures[cacheKey];
    if (awaitedFeatures && awaitedFeatures.started) {
        if (awaitedFeatures.styleFilters.doesNotContain(styleFilters)) {
            // console.log('Fetch already started with wrong parameters, skipping cache.');
            self.source.fetch(chr, min, max, scale, types, pool, callback, styleFilters);
            return;
        }
    } else if (awaitedFeatures) {
        awaitedFeatures.styleFilters.addAll(styleFilters);
    } else {
        awaitedFeatures = new Awaited();
        awaitedFeatures.styleFilters = styleFilters;
        pool.awaitedFeatures[cacheKey] = awaitedFeatures;

        pool.requestsIssued.then(function() {
            awaitedFeatures.started = true;
            self.source.fetch(
                chr, 
                min, 
                max, 
                scale, 
                awaitedFeatures.styleFilters.typeList(), 
                pool, 
                function(status, features, scale, coverage) {
                    if (!awaitedFeatures.res)
                        awaitedFeatures.provide({status: status, features: features, scale: scale, coverage: coverage});
                }, 
                awaitedFeatures.styleFilters);
        }).catch(function(err) {
            console.log(err);
        });
    } 

    awaitedFeatures.await(function(af) {
        callback(af.status, af.features, af.scale, af.coverage);
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
    this.dasSource = new DASSource(dasSource);
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
            return console.log('Already looking for a next feature, be patient!');
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
                callback(res[0]);
            }
        });
    }
};

function DASSequenceSource(dasSource) {
    this.dasSource = new DASSource(dasSource);
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
    var data;
    if (source.twoBitURI) {
        data = new URLFetchable(source.twoBitURI);
    } else if (source.twoBitBlob) {
        data = new BlobFetchable(source.twoBitBlob);
    } else {
        throw Error("No twoBitURI or twoBitBlob parameter");
    }

    makeTwoBit(data, function(tb, error) {
        if (error) {
            console.log(error);
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
    var arg;

    var uri = this.bwgSource.uri || this.bwgSource.bwgURI;
    if (uri) {
        if (this.bwgSource.transport === 'encode') {
            arg = new EncodeFetchable(uri, {credentials: this.opts.credentials});
        } else {
            arg = new URLFetchable(uri, {credentials: this.opts.credentials});
        }
    } else {
        arg = new BlobFetchable(this.bwgSource.bwgBlob);
    }

    makeBwg(arg, function(bwg, err) {
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
    });
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

        var data;
        var wantDensity = !types || types.length == 0 || arrayIndexOf(types, 'density') >= 0;
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
                for (var hi = 0; hi < featureInfo.hit.length; ++hi) {
                    if (featureInfo.hit[hi].isSuperGroup)
                        return;
                }
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
            stylesheet.pushStyle({type: 'translation'}, null, wigStyle);
                    
            var tsStyle = new DASStyle();
            tsStyle.glyph = 'BOX';
            tsStyle.FGCOLOR = 'black';
            tsStyle.BGCOLOR = 'white';
            tsStyle.HEIGHT = 10;
            tsStyle.ZINDEX = 10;
            tsStyle.BUMP = true;
            tsStyle.LABEL = true;
            stylesheet.pushStyle({type: 'transcript'}, null, tsStyle);

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

function RemoteBWGFeatureSource(bwgSource, worker) {
    FeatureSourceBase.call(this);

    var thisB = this;
    this.worker = worker;
    this.readiness = 'Connecting';
    this.bwgSource = this.opts = bwgSource;
    this.keyHolder = new Awaited();

    this.init();
}

RemoteBWGFeatureSource.prototype = Object.create(FeatureSourceBase.prototype);

RemoteBWGFeatureSource.prototype.init = function() {
    var thisB = this;
    var uri = this.uri || this.bwgSource.uri || this.bwgSource.bwgURI;
    var blob = this.bwgSource.blob || this.bwgSource.bwgBlob;

    var cnt = function(key, err) {
        thisB.readiness = null;
        thisB.notifyReadiness();

        if (key) {
            thisB.worker.postCommand({command: 'meta', connection: key}, function(meta, err) {
                if (err) {
                    thisB.error = err;
                    thisB.keyHolder.provide(null);
                } else {
                    thisB.meta = meta;
                    thisB.keyHolder.provide(key);
                }
            });
        } else {
            thisB.error = err;
            thisB.keyHolder.provide(null);
        }
    };

    if (blob) {
        this.worker.postCommand({command: 'connectBBI', blob: blob}, cnt);
    } else {
        this.worker.postCommand({
            command: 'connectBBI', 
            uri: resolveUrlToPage(uri), 
            transport: this.bwgSource.transport,
            credentials: this.bwgSource.credentials}, 
          cnt); 
    }
}

RemoteBWGFeatureSource.prototype.capabilities = function() {
    var caps = {leap: true};

    if (this.meta && this.meta.type == 'bigwig')
        caps.quantLeap = true;
    if (this.meta && this.meta.extraIndices && this.meta.extraIndices.length > 0) {
        caps.search = [];
        for (var eii = 0; eii < this.meta.extraIndices.length; ++eii) {
            caps.search.push(this.meta.extraIndices[eii].field);
        }
    }
    return caps;
}

RemoteBWGFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var thisB = this;

    thisB.busy++;
    thisB.notifyActivity();

    this.keyHolder.await(function(key) {
        if (!key) {
            thisB.busy--;
            thisB.notifyActivity();
            return callback(thisB.error || "Can't access binary file", null, null);
        }

        var zoom = -1;
        var wantDensity = !types || types.length == 0 || arrayIndexOf(types, 'density') >= 0;
        if (thisB.opts.clientBin) {
            wantDensity = false;
        }
        if (thisB.meta.type == 'bigwig' || wantDensity || (typeof thisB.opts.forceReduction !== 'undefined')) {
            for (var z = 1; z < thisB.meta.zoomLevels.length; ++z) {
                if (thisB.meta.zoomLevels[z] <= scale) {
                    zoom = z - 1; // Scales returned in metadata start at 1, unlike "real" zoom levels.
                } else {
                    break;
                }
            }
            if (typeof thisB.opts.forceReduction !== 'undefined') {
                zoom = thisB.opts.forceReduction;
            }
        }
        
        thisB.worker.postCommand({command: 'fetch', connection: key, chr: chr, min: min, max: max, zoom: zoom}, function(features, error) {
            thisB.busy--;
            thisB.notifyActivity();

            var fs = 1000000000;
            if (thisB.meta.type === 'bigwig') {
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
            callback(error, features, fs);
        });
    });
}


RemoteBWGFeatureSource.prototype.quantFindNextFeature = function(chr, pos, dir, threshold, callback) {
    var thisB = this;
    this.busy++;
    this.notifyActivity();
    this.worker.postCommand({command: 'quantLeap', connection: this.keyHolder.res, chr: chr, pos: pos, dir: dir, threshold: threshold, under: false}, function(result, err) {
        console.log(result, err);
        thisB.busy--;
        thisB.notifyActivity();
        return callback(result, err);
    });
}

RemoteBWGFeatureSource.prototype.findNextFeature = function(chr, pos, dir, callback) {
    var thisB = this;
    this.busy++;
    this.notifyActivity();
    this.worker.postCommand({command: 'leap', connection: this.keyHolder.res, chr: chr, pos: pos, dir: dir}, function(result, err) {
        thisB.busy--;
        thisB.notifyActivity();
        if (result.length > 0 && result[0] != null) {
            callback(result[0]);
        }
    });
}

RemoteBWGFeatureSource.prototype.getScales = function() {
    var meta = this.meta;
    if (meta) {
        return meta.zoomLevels;
    } else {
        return null;
    }
}

RemoteBWGFeatureSource.prototype.search = function(query, callback) {
    if (!this.meta.extraIndices || this.meta.extraIndices.length == 0) {
        return callback(null, 'No indices available');
    }

    var thisB = this;
    this.busy++;
    this.notifyActivity();
    var index = this.meta.extraIndices[0];
    this.worker.postCommand({command: 'search', connection: this.keyHolder.res, query: query, index: index}, function(result, err) {
        thisB.busy--;
        thisB.notifyActivity();

        callback(result, err);
    });
}

RemoteBWGFeatureSource.prototype.getDefaultFIPs = function(callback) {
    if (this.opts.noExtraFeatureInfo)
        return true;

    var thisB = this;
    this.keyHolder.await(function(key) {
        var bwg = thisB.meta;
        if (!bwg) return;

        if (bwg.schema && bwg.definedFieldCount < bwg.schema.fields.length) {
            var fip = function(feature, featureInfo) {
                for (var hi = 0; hi < featureInfo.hit.length; ++hi) {
                    if (featureInfo.hit[hi].isSuperGroup)
                        return;
                }
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

RemoteBWGFeatureSource.prototype.getStyleSheet = function(callback) {
    var thisB = this;

    this.keyHolder.await(function(key) {
        var bwg = thisB.meta;
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
            stylesheet.pushStyle({type: 'translation'}, null, wigStyle);
                    
            var tsStyle = new DASStyle();
            tsStyle.glyph = 'BOX';
            tsStyle.FGCOLOR = 'black';
            tsStyle.BGCOLOR = 'white';
            tsStyle.HEIGHT = 10;
            tsStyle.ZINDEX = 10;
            tsStyle.BUMP = true;
            tsStyle.LABEL = true;
            stylesheet.pushStyle({type: 'transcript'}, null, tsStyle);

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

function bamRecordToFeature(r, group) {
    if (r.flag & BamFlags.SEGMENT_UNMAPPED)
        return; 
    
    var len;
    if (r.seq)
        len = r.seq.length;
    else 
        len = r.seqLength;
    
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
    f.notes = [/* 'Sequence=' + r.seq, 'CIGAR=' + r.cigar, */ 'MQ=' + r.mq];
    f.cigar = r.cigar;
    f.seq = r.seq;
    f.quals = r.quals;
    f.orientation = (r.flag & BamFlags.REVERSE_COMPLEMENT) ? '-' : '+';
    f.bamRecord = r;

    if (group && (r.flag & BamFlags.MULTIPLE_SEGMENTS)) {
        f.groups = [{id: r.readName, 
                     type: 'readpair'}];
    }

    return f;
}

function BAMFeatureSource(bamSource) {
    FeatureSourceBase.call(this);

    var thisB = this;
    this.bamSource = bamSource;
    this.opts = {credentials: bamSource.credentials, preflight: bamSource.preflight, bamGroup: bamSource.bamGroup};
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
    makeBam(bamF, baiF, null, function(bam, err) {
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
    var light = types && (types.length == 1) && (types[0] == 'density');

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

                    var f = bamRecordToFeature(r, thisB.opts.bamGroup);
                    if (f)
                        features.push(f);
                }
                callback(null, features, 1000000000);
            }
        }, {light: light});
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

	    return callback(stylesheet);
    });
}


function RemoteBAMFeatureSource(bamSource, worker) {
    FeatureSourceBase.call(this);

    var thisB = this;
    this.bamSource = bamSource;
    this.worker = worker;
    this.opts = {credentials: bamSource.credentials, preflight: bamSource.preflight, bamGroup: bamSource.bamGroup};
    this.keyHolder = new Awaited();
    
    this.init();
}

RemoteBAMFeatureSource.prototype = Object.create(FeatureSourceBase.prototype);

RemoteBAMFeatureSource.prototype.init = function() {    var thisB = this;
    var uri = this.bamSource.uri || this.bamSource.bamURI;
    var indexUri = this.bamSource.indexUri || this.bamSource.baiURI || uri + '.bai';

    var blob = this.bamSource.bamBlob || this.bamSource.blob;
    var indexBlob = this.bamSource.baiBlob || this.bamSource.indexBlob;

    var cnt = function(result, err) {
        thisB.readiness = null;
        thisB.notifyReadiness();

        if (result) {
            thisB.keyHolder.provide(result);
        } else {
            thisB.error = err;
            thisB.keyHolder.provide(null);
        }
    };

    if (blob) {
        this.worker.postCommand({command: 'connectBAM', blob: blob, indexBlob: indexBlob}, cnt);
    } else {
        this.worker.postCommand({
            command: 'connectBAM', 
            uri: resolveUrlToPage(uri), 
            indexUri: resolveUrlToPage(indexUri),
            credentials: this.bamSource.credentials,
            indexChunks: this.bamSource.indexChunks},
          cnt); 
    }
}

RemoteBAMFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    var light = types && (types.length == 1) && (types[0] == 'density');
    var thisB = this;
    
    thisB.busy++;
    thisB.notifyActivity();
    
    this.keyHolder.await(function(key) {
        if (!key) {
            thisB.busy--;
            thisB.notifyActivity();
            return callback(thisB.error || "Couldn't fetch BAM");
        }

        thisB.worker.postCommand({command: 'fetch', connection: key, chr: chr, min: min, max: max, opts: {light: light}}, function(bamRecords, error) {
            // console.log('retrieved ' + bamRecords.length + ' via worker.');

            thisB.busy--;
            thisB.notifyActivity();

            if (error) {
                callback(error, null, null);
            } else {
                var features = [];
                for (var ri = 0; ri < bamRecords.length; ++ri) {
                    var r = bamRecords[ri];
                    var f = bamRecordToFeature(r, thisB.opts.bamGroup);
                    if (f)
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

MappedFeatureSource.prototype.getDefaultFIPs = function(callback) {
    if (this.source.getDefaultFIPs)
        return this.source.getDefaultFIPs(callback);
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

MappedFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback, styleFilters) {
    var thisB = this;
    var fetchLength = max - min + 1;

    thisB.busy++;
    thisB.notifyActivity();

    this.mapping.sourceBlocksForRange(chr, min, max, function(mseg) {
        if (mseg.length == 0) {
            thisB.busy--;
            thisB.notifyActivity();

            callback("No mapping available for this regions", [], scale);
        } else {
            mseg = thisB.simplifySegments(mseg, Math.max(100, 0.05 * fetchLength));

            var mappedFeatures = [];
            var mappedLoc = null;
            var count = mseg.length;
            var finalStatus;

            mseg.map(function(seg) {
                thisB.source.fetch(seg.name, seg.start, seg.end, scale, types, pool, function(status, features, fscale) {
                    if (status && !finalStatus)
                        finalStatus = status;

                    if (features) {
                        for (var fi = 0; fi < features.length; ++fi) {
                            var f = features[fi];
                            var sn = f.segment;
                            if (sn.indexOf('chr') == 0) {
                                sn = sn.substr(3);
                            }

                            var mappings = thisB.mapping.mapSegment(sn, f.min, f.max);

                            if (mappings.length == 0) {
                                if (f.parts && f.parts.length > 0) {
                                     mappedFeatures.push(f);
                                }
                            } else {
                                for (var mi = 0; mi < mappings.length; ++mi) {
                                    var m = mappings[mi];
                                    var mf = shallowCopy(f);
                                    mf.segment = m.segment;
                                    mf.min = m.min;
                                    mf.max = m.max;
                                    if (m.partialMin)
                                        mf.partialMin = m.partialMin;
                                    if (m.partialMax)
                                        mf.partialMax = m.partialMax;

                                    if (m.flipped) {
                                        if (f.orientation == '-') {
                                            mf.orientation = '+';
                                        } else if (f.orientation == '+') {
                                            mf.orientation = '-';
                                        }
                                    }
                                    mappedFeatures.push(mf);
                                }
                            }
                        }
                    }

                    var m1 = thisB.mapping.mapPoint(seg.name, seg.start);
                    var m2 = thisB.mapping.mapPoint(seg.name, seg.end);

                    if (m1 && m2) {
                        var segDestCoverage = new Range(m1.pos, m2.pos);
                        if (mappedLoc)
                            mappedLoc = union(mappedLoc, segDestCoverage);
                        else
                            mappedLoc = segDestCoverage;
                    }

                    --count;
                    if (count == 0) {
                        thisB.busy--;
                        thisB.notifyActivity();
                        callback(finalStatus, mappedFeatures, fscale, mappedLoc);
                    }
                }, styleFilters);
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

Browser.prototype.sourceAdapterIsCapable = function(s, cap) {
    if (!s.capabilities)
        return false;
    else return s.capabilities()[cap];
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        FeatureSourceBase: FeatureSourceBase,

        TwoBitSequenceSource: TwoBitSequenceSource,
        DASSequenceSource: DASSequenceSource,
        MappedFeatureSource: MappedFeatureSource,
        CachingFeatureSource: CachingFeatureSource,
        BWGFeatureSource: BWGFeatureSource,
        RemoteBWGFeatureSource: RemoteBWGFeatureSource,
        BAMFeatureSource: BAMFeatureSource,
        RemoteBAMFeatureSource: RemoteBAMFeatureSource,
        DummyFeatureSource: DummyFeatureSource,
        DummySequenceSource: DummySequenceSource,

        registerSourceAdapterFactory: dalliance_registerSourceAdapterFactory,
        registerParserFactory: dalliance_registerParserFactory,
        makeParser: dalliance_makeParser
    }

    // Standard set of plugins.
    require('./ensembljson');
    require('./tabix-source');
    require('./memstore');
    require('./bedwig');
    require('./vcf');
}
