/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// jbjson.js -- query JBrowse-style REST data stores
//

function JBrowseStore(base, query) {
    this.base = base;
    this.query = query;
}

var topLevelResp;

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
		    f.segment = segment;
		    f.min = (j['start'] | 0) + 1;
		    f.max = j['end'] | 0;
		    if (j.name) {
			f.label = j.name;
		    }
		    f.type = j.type || 'unknown';
		    
		    features.push(f);
		}
		callback(features);
	    }
	}
	
    };
    req.responseType = 'text';
    req.open('GET', url, true);
    req.send('');
}
