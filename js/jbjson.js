/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// jbjson.js -- query JBrowse-style REST data stores
//

if (typeof(require) !== 'undefined') {
    var das = require('./das');
    var DASStylesheet = das.DASStylesheet;
    var DASStyle = das.DASStyle;
    var DASFeature = das.DASFeature;
    var DASGroup = das.DASGroup;

    var utils = require('./utils');
    var shallowCopy = utils.shallowCopy;

    var spans = require('./spans');
    var Range = spans.Range;
    var union = spans.union;
    var intersection = spans.intersection;
}

function JBrowseStore(base, query) {
    this.base = base;
    this.query = query;
}

function jbori(strand) {
    if (strand > 0)
        return '+';
    else if (strand < 0)
        return '-';
}

JBrowseStore.prototype.features = function(segment, opts, callback) {
    opts = opts || {};

    url = this.base + '/features/' + segment.name;

    var filters = [];
    if (this.query) {
	   filters.push(this.query);
    }
    if (segment.isBounded) {
    	filters.push('start=' + segment.start);
    	filters.push('end=' + segment.end);
    }
    if (filters.length > 0) {
	    url = url + '?' + filters.join('&');
    }

    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
	if (req.readyState == 4) {
	    if (req.status >= 300) {
		    callback(null, 'Error code ' + req.status);
	    } else {
		var jf = JSON.parse(req.response)['features'];
		var features = [];
		for (fi = 0; fi < jf.length; ++fi) {
		    var j = jf[fi];
		    
		    var f = new DASFeature();
		    f.segment = segment.name;
		    f.min = (j['start'] | 0) + 1;
		    f.max = j['end'] | 0;
		    if (j.name) {
			f.label = j.name;
		    }
                    if (j.strand)
                        f.orientation = jbori(j.strand);
		    f.type = j.type || 'unknown';

                    if (j.subfeatures && j.subfeatures.length > 0) {
                        f.id = j.uniqueID;

                        var blocks = [];
                        var cds = [];
                        var all = [];

                        for (var si = 0; si < j.subfeatures.length; ++si) {
                            var sj = j.subfeatures[si];
                            var sf = shallowCopy(f);
                            sf.min = sj.start + 1;
                            sf.max = sj.end;
                            sf.groups = [f];

                            all.push(sf);
                            blocks.push(new Range(sf.min, sf.max));
                            if (sj.type === 'CDS')
                                cds.push(sf);
                        }
                        
                        if (cds.length > 0) {
                            spans = union(blocks);
                            var txGroup = shallowCopy(f);
                            txGroup.type = 'transcript';
                            spans.ranges().forEach(function(exon) {
                                features.push({
                                    segment:     segment.name,
                                    min:         exon.min(),
                                    max:         exon.max(),
                                    orientation: f.orientation,
                                    groups:      [txGroup],
                                    type:        'transcript'
                                });
                            });

                            var tlGroup = shallowCopy(f);
                            cds.forEach(function(cdsExon) {
                                cdsExon.type = 'translation'
                                cdsExon.groups = [tlGroup];
                                features.push(cdsExon);
                            });
                        } else {
                            all.forEach(function(f) {
                                features.push(f);
                            });
                        }
                    } else {
		        features.push(f);
                    }
		}
		callback(features);
	    }
	}
	
    };
    
    req.open('GET', url, true);
    req.responseType = 'text';
    req.send('');
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        JBrowseStore: JBrowseStore
    };
}
