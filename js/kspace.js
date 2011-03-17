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

function KnownSpace(tierMap, chr, min, max, scale, parent) {
    this.tierMap = tierMap;
    this.chr = chr;
    this.min = min;
    this.max = max;
    this.scale = scale;

    this.featureCache = {};

    if (parent) {
	// try to copy stuff
    }
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

    for (var t = 0; t < this.tierMap.length; ++t) {
	this.startFetchesFor(this.tierMap[t]);
    }
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
    this.startFetchesFor(tier);
}

KnownSpace.prototype.startFetchesFor = function(tier) {
    var thisB = this;

    var source = tier.getSource();
    var baton = thisB.featureCache[tier];
    var wantedTypes = tier.getDesiredTypes(this.scale);
    if (wantedTypes === undefined) {
//        dlog('Aborting fetch');
        return;
    }
    if (baton) {
// 	dlog('considering cached features: ' + baton);
    }
    if (baton && baton.chr === this.chr && baton.min <= this.min && baton.max >= this.max) {
	var cachedFeatures = baton.features;
	if (baton.min < this.min || baton.max > this.max) {
	    cachedFeatures = filterFeatures(cachedFeatures, this.min, this.max);
	}
        
        // dlog('cached scale=' + baton.scale + '; wanted scale=' + thisB.scale);
//	if ((baton.scale < (thisB.scale/2) && cachedFeatures.length > 200) || (wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0) ) {
//	    cachedFeatures = downsample(cachedFeatures, thisB.scale);
//	}
        // dlog('Provisioning ' + tier.toString() + ' with ' + cachedFeatures.length + ' features from cache');
//	tier.viewFeatures(baton.chr, Math.max(baton.min, this.min), Math.min(baton.max, this.max), baton.scale, cachedFeatures);   // FIXME change scale if downsampling

        thisB.provision(tier, baton.chr, Math.max(baton.min, this.min), Math.min(baton.max, this.max), baton.scale, wantedTypes, cachedFeatures, baton.status);

	var availableScales = source.getScales();
	if (baton.scale <= this.scale || !availableScales) {
//	    dlog('used cached features');
	    return;
	} else {
//	    dlog('used cached features (temporarily)');
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
        thisB.provision(tier, thisB.chr, thisB.min, thisB.max, thisB.scale, wantedTypes, features, status);
    });
}

KnownSpace.prototype.provision = function(tier, chr, min, max, actualScale, wantedTypes, features, status) {
    if (status) {
        tier.updateStatus(status);
    } else {
        if ((actualScale < (this.scale/2) && features.length > 200) || 
            (BWGFeatureSource.prototype.isPrototypeOf(tier.getSource()) && wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0)|| 
            (BAMFeatureSource.prototype.isPrototypeOf(tier.getSource()) && wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0)) 
        {
	    features = downsample(features, this.scale);
        }
        tier.viewFeatures(chr, min, max, actualScale, features);
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

DASSequenceSource.prototype.getScales = function() {
    return [0.1, 10];
}

DASSequenceSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    if (scale < 5) {   // Correct for default targetQuantRes.
	this.dasSource.sequence(
            new DASSegment(chr, min, max),
            function(seqs) {
		var f = new DASFeature();
		f.segment = chr;
		f.min = min;
		f.max = max;
		f.sequence = seqs[0];
		callback(null, [f], 1);
            }
        );
    } else {
	var f = new DASFeature();
	f.segment = chr;
	f.min = min;
	f.max = max;
	f.sequence = new DASSequence(chr, min, max, null, null);
	callback(null, [f], 1000000000);
    }
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

function BAMFeatureSource(bamSource, opts) {
    var thisB = this;
    this.bamSource = bamSource;
    this.opts = opts || {};
    this.bamHolder = new Awaited();
    makeBam(new URLFetchable(bamSource.bamURI), new URLFetchable(bamSource.bamURI + '.bai'), function(bam) {
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
                    f.type = 'bam';
                    f.id = r.readName;
                    f.notes = ['Sequence=' + r.seq, 'MQ=' + r.mq];
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

                // dlog('mapped ' + features.length + ' -> ' + mappedFeatures.length);

		callback(status, mappedFeatures, fscale);
	    });
	}
    });
}