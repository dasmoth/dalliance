/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bin.js general binary data support
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var bin = require('./bin');
    var URLFetchable = bin.URLFetchable;

    var connectTrix = require('./trix').connectTrix;
}

var REGION_PATTERN = /^([\d+,\w,\.,\_,\-]+)[\s:]+([0-9,\.]+?)([KkMmGg])?((-|\.\.|\s)+([0-9,\.]+)([KkMmGg])?)?$/;

function parseLocCardinal(n, m) {
    var i = parseFloat(n.replace(/,/g, ''));
    if (m === 'k' || m === 'K') {
        return (i * 1000)|0;
    } else if (m == 'm' || m === 'M') {
        return (i * 1000000)|0;
    } else {
        return i|0;
    }
}

Browser.prototype.search = function(g, statusCallback) {
    var thisB = this;
    var m = REGION_PATTERN.exec(g);

    if (m) {
        var chr = m[1], start, end;
        if (m[6]) {
            start = parseLocCardinal(m[2],  m[3]);
            end = parseLocCardinal(m[6], m[7]);
        } else {
            var width = this.viewEnd - this.viewStart + 1;
            start = (parseLocCardinal(m[2], m[3]) - (width/2))|0;
            end = start + width - 1;
        }
        this.setLocation(chr, start, end, statusCallback);
    } else {
        if (!g || g.length == 0) {
            return false;
        }

        var searchCount = 0;
        var foundLatch = false;

        var searchCallback = function(found, err) {
            --searchCount;
            if (err) {
                return statusCallback(err);
            }

            if (!found) found = [];
            var min = 500000000, max = -100000000;
            var nchr = null;
            for (var fi = 0; fi < found.length; ++fi) {
                var f = found[fi];
            
                if (nchr == null) {
                    nchr = f.segment;
                }
                min = Math.min(min, f.min);
                max = Math.max(max, f.max);
            }

            if (!nchr) {
                if (searchCount == 0 && !foundLatch)
                    return statusCallback("no match for '" + g + "'");
            } else {
                foundLatch = true;
                thisB.highlightRegion(nchr, min, max);
            
                var padding = Math.max(2500, (0.3 * (max - min + 1))|0);
                thisB.setLocation(nchr, min - padding, max + padding, statusCallback);
            }
        }

        var doTrixSearch = function(tier, trix) {
            trix.lookup(g, function(result, status) {
                if (result == null || result.length < 2) {
                    return tier.featureSource.search(g, searchCallback);
                } else {
                    var hit = result[1].split(',')[0];
                    return tier.featureSource.search(hit, searchCallback);
                }
            });
        }

        if (this.searchEndpoint) {
            searchCount = 1;
            return this.doDasSearch(thisB.searchEndpoint, g, searchCallback);
        }

        for (var ti = 0; ti < this.tiers.length; ++ti) {
            (function(tier) {
                if (thisB.sourceAdapterIsCapable(tier.featureSource, 'search')) {
                    if (tier.dasSource.trixURI) {
                        ++searchCount;
                        if (tier.trix) {
                            doTrixSearch(tier, tier.trix);
                        } else {
                            var ix = new URLFetchable(
                                tier.dasSource.trixURI,
                                {credentials: tier.dasSource.credentials,
                                 resolver: tier.dasSource.resolver}
                            );

                            var ixx = new URLFetchable(
                                tier.dasSource.trixxURI || (tier.dasSource.trixURI + 'x'),
                                {credentials: tier.dasSource.credentials,
                                 resolver: tier.dasSource.resolver}
                            );

                            connectTrix(ix, ixx, function(trix) {
                                tier.trix = trix;
                                doTrixSearch(tier, trix);
                            });
                        }
                    } else {
                        ++searchCount;
                        tier.featureSource.search(g, searchCallback);
                    }
                } else if (tier.dasSource.provides_search) {
                    ++searchCount;
                    thisB.doDasSearch(tier.dasSource, g, searchCallback);
                }
            })(this.tiers[ti]);
        }
    }
}

Browser.prototype.doDasSearch = function(source, g, searchCallback) {
    var thisB = this;
    source.features(null, {group: g, type: 'transcript'}, function(found) {
        if (!found) found = [];
        var min = 500000000, max = -100000000;
        var nchr = null;

        var found2 = [];
        for (var fi = 0; fi < found.length; ++fi) {
            var f = found[fi];
            
            if (f.label.toLowerCase() != g.toLowerCase()) {
                // ...because Dazzle can return spurious overlapping features.
                continue;
            }
            found2.push(f);
        }

        return searchCallback(found2);
    }, false);
}
