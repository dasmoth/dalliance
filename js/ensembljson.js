/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// ensembljson.js -- query the Ensembl REST API.
//

function EnsemblFeatureSource(source) {
    this.source = source;
    this.base = source.uri || 'http://beta.rest.ensembl.org';
    this.species = source.species || 'human';
    this.type = source.type;
}

EnsemblFeatureSource.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();
    var wigStyle = new DASStyle();
    wigStyle.glyph = 'BOX';
    wigStyle.FGCOLOR = 'black';
    wigStyle.BGCOLOR = 'orange'
    wigStyle.HEIGHT = 8;
    wigStyle.BUMP = true;
    wigStyle.LABEL = true;
    wigStyle.ZINDEX = 20;
    stylesheet.pushStyle({type: 'default'}, null, wigStyle);

    return callback(stylesheet);
}


EnsemblFeatureSource.prototype.getScales = function() {
    return [];
}

EnsemblFeatureSource.prototype.fetch = function(chr, min, max, scale, types, pool, callback) {
    url = this.base + '/feature/region/' + this.species + '/' + chr + ':' + min + '-' + max + '?feature=' + this.type + ';content-type=application/json';
    console.log(url);

    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
	if (req.readyState == 4) {
	    if (req.status >= 300) {
		callback('Error code ' + req.status, null);
	    } else {
		var jf = JSON.parse(req.response);
		var features = [];
		for (fi = 0; fi < jf.length; ++fi) {
		    var j = jf[fi];
		    
		    var f = new DASFeature();
		    f.segment = chr;
		    f.min = j['start'] | 0;
		    f.max = j['end'] | 0;
		    f.type = j.feature_type || 'unknown';
		    f.id = j.ID;
		    
		    features.push(f);
		}
		callback(null, features);
	    }
	}
	
    };
    req.responseType = 'text';
    req.open('GET', url, true);
    req.send('');
}
