

function FetchPool() {
    this.reqs = [];
    this.awaitedFeatures = {};
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
    this.viewCount = 0;

    this.featureCache = {};
    this.latestViews = {};
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
    if (min < 1) {
        min = 1;
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
    this.viewCount++;
    
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
    if (!this.pool) {
        return;
    }

    this.featureCache[tier] = null;
    this.startFetchesForTiers([tier]);
}

KnownSpace.prototype.startFetchesForTiers = function(tiers) {
    var thisB = this;

    var awaitedSeq = this.awaitedSeq;
    var needSeq = false;

    var gex;

    for (var t = 0; t < tiers.length; ++t) {
        try {
            if (this.startFetchesFor(tiers[t], awaitedSeq)) {
                needSeq = true;
            }
        } catch (ex) {
            tiers[t].updateStatus(ex);
            console.log('Error fetching tier source');
            console.log(ex);
            gex = ex;
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
                awaitedSeq.provide(null);
            }
        });
    } 

    if (gex)
        throw gex;
}

KnownSpace.prototype.startFetchesFor = function(tier, awaitedSeq) {
    var thisB = this;

    var viewID = this.viewCount;
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

    if (source.instrument)
        console.log('Starting  fetch ' + viewID + ' (' + this.min + ', ' + this.max + ')');
    source.fetch(this.chr, this.min, this.max, this.scale, wantedTypes, this.pool, function(status, features, scale) {
	if (source.instrument)
	    console.log('Finishing fetch ' + viewID);

	var latestViewID = thisB.latestViews[tier] || -1;
	if (latestViewID > viewID) {
	    // console.log('Ignoring out of date view');
	    return;
	}

        if (!baton || (thisB.min < baton.min) || (thisB.max > baton.max)) {         // FIXME should be merging in some cases?
            thisB.featureCache[tier] = new KSCacheBaton(thisB.chr, thisB.min, thisB.max, scale, features, status);
        }

        //if ((scale < (thisB.scale/2) && features.length > 200) || (wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0) ) {
        //    features = downsample(features, thisB.scale);
        //}
        // dlog('Provisioning ' + tier.toString() + ' with fresh features');
        //tier.viewFeatures(thisB.chr, thisB.min, thisB.max, this.scale, features);


	thisB.latestViews[tier] = viewID;
        thisB.provision(tier, thisB.chr, thisB.min, thisB.max, scale, wantedTypes, features, status, needsSeq ? awaitedSeq : null);
    });
    return needsSeq;
}

KnownSpace.prototype.provision = function(tier, chr, min, max, actualScale, wantedTypes, features, status, awaitedSeq) {
    tier.updateStatus(status);
   
   if (!status) {
        var mayDownsample = false;
        var src = tier.getSource();
        while (MappedFeatureSource.prototype.isPrototypeOf(src) || CachingFeatureSource.prototype.isPrototypeOf(src) || OverlayFeatureSource.prototype.isPrototypeOf(src)) {
	       if (OverlayFeatureSource.prototype.isPrototypeOf(src)) {
		       src = src.sources[0];
	       } else {
		      src = src.source;
	       }
        }
        if (BWGFeatureSource.prototype.isPrototypeOf(src) || BAMFeatureSource.prototype.isPrototypeOf(src)) {
            mayDownsample = true;
        }

    	if (!src.opts || (!src.opts.forceReduction && !src.opts.noDownsample)) {
            if ((actualScale < (this.scale/2) && features.length > 200)  ||
		        (mayDownsample && wantedTypes && wantedTypes.length == 1 && wantedTypes.indexOf('density') >= 0))
            {
		        features = downsample(features, this.scale);
            }
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
