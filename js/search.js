/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bin.js general binary data support
//

var REGION_PATTERN = /([\d+,\w,\.,\_,\-]+):([0-9,]+)([KkMmGg])?([\-,\,.]+([0-9,]+)([KkMmGg])?)?/;

function parseLocCardinal(n, m) {
    var i = n.replace(/,/g, '');
    if (m === 'k' || m === 'K') {
        return i * 1000;
    } else if (m == 'm' || m === 'M') {
        return i * 1000000;
    } else {
        return i;
    }
}

Browser.prototype.search = function(g, statusCallback) {
    var thisB = this;
    var m = REGION_PATTERN.exec(g);

    if (m) {
        var chr = m[1], start, end;
        if (m[5]) {
            start = parseLocCardinal(m[2],  m[3]);
            end = parseLocCardinal(m[5], m[6]);
        } else {
            var width = b.viewEnd - b.viewStart + 1;
            start = (parseLocCardinal(m[2], m[3]) - (width/2))|0;
            end = start + width - 1;
        }
        this.setLocation(chr, start, end, statusCallback);
    } else {
        if (!g || g.length == 0) {
            return false;
        }

        if (this.searchEndpoint) {
            return this.doDasSearch(thisB.searchEndpoint, g, statusCallback);
        }

        for (var ti = 0; ti < this.tiers.length; ++ti) {
            var tier = this.tiers[ti];
            if (sourceAdapterIsCapable(tier.featureSource, 'search')) {
                return this.doAdapterSearch(tier.featureSource, g, statusCallback);
            } else if (tier.dasSource.provides_search) {
                return this.doDasSearch(tier.dasSource, g, statusCallback);
            }
        }
        
    }
}

Browser.prototype.doAdapterSearch = function(fs, g, statusCallback) {
    var thisB = this;
    fs.search(g, function(found, err) {
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
            return statusCallback("no match for '" + g + "' (search should improve soon!)");
        } else {
            thisB.highlightRegion(nchr, min, max);
        
            var padding = Math.max(2500, (0.3 * (max - min + 1))|0);
            thisB.setLocation(nchr, min - padding, max + padding, statusCallback);
        }
    });
}

Browser.prototype.doDasSearch = function(source, g, statusCallback) {
    var thisB = this;
    source.features(null, {group: g, type: 'transcript'}, function(found) {        // HAXX
        if (!found) found = [];
        var min = 500000000, max = -100000000;
        var nchr = null;
        for (var fi = 0; fi < found.length; ++fi) {
            var f = found[fi];
            
            if (f.label.toLowerCase() != g.toLowerCase()) {
                // ...because Dazzle can return spurious overlapping features.
                continue;
            }

            if (nchr == null) {
                nchr = f.segment;
            }
            min = Math.min(min, f.min);
            max = Math.max(max, f.max);
        }

        if (!nchr) {
            return statusCallback("no match for '" + g + "' (search should improve soon!)");
        } else {
            thisB.highlightRegion(nchr, min, max);
        
            var padding = Math.max(2500, (0.3 * (max - min + 1))|0);
            thisB.setLocation(nchr, min - padding, max + padding, statusCallback);
        }
    }, false);
}