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

    this.activityListeners = [];
    this.busy = 0;

    if (typeof source.type === 'string') {
        this.type = [source.type];
    } else {
        this.type = source.type || ['regulatory'];
    }
}

EnsemblFeatureSource.prototype.addActivityListener = function(listener) {
    this.activityListeners.push(listener);
}

EnsemblFeatureSource.prototype.notifyActivity = function() {
    for (var li = 0; li < this.activityListeners.length; ++li) {
        try {
            this.activityListeners[li](this.busy);
        } catch (e) {
            console.log(e);
        }
    }
}


EnsemblFeatureSource.prototype.getStyleSheet = function(callback) {
    var stylesheet = new DASStylesheet();

    var tsStyle = new DASStyle();
    tsStyle.glyph = '__NONE';
    if (this.type.indexOf('exon') >= 0)
        stylesheet.pushStyle({type: 'transcript'}, null, tsStyle);
    if (this.type.indexOf('exon') >= 0 || this.type.indexOf('transcript') >= 0)
        stylesheet.pushStyle({type: 'gene'}, null, tsStyle);

    var cdsStyle = new DASStyle();
    cdsStyle.glyph = 'BOX';
    cdsStyle.FGCOLOR = 'black';
    cdsStyle.BGCOLOR = 'red'
    cdsStyle.HEIGHT = 8;
    cdsStyle.BUMP = true;
    cdsStyle.LABEL = true;
    cdsStyle.ZINDEX = 10;
    stylesheet.pushStyle({type: 'cds'}, null, cdsStyle);

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
    var thisB = this;
    url = this.base + '/feature/region/' + this.species + '/' + chr + ':' + min + '-' + max;

    var filters = [];
    for (var ti = 0; ti < this.type.length; ++ti) {
        filters.push('feature=' + this.type[ti]);
    }
    filters.push('content-type=application/json');
    url = url + '?' + filters.join(';');

    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        thisB.busy--;
        thisB.notifyActivity();

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

                    if (j.Parent) {
                        var grp = new DASGroup();
                        grp.id = j.Parent;
                        f.groups = [grp];
                    }

                    if (j.strand) {
                        if (j.strand < 0) 
                            f.orientation = '-';
                        else if (j.strand > 0) 
                            f.orientation = '+';
                    }
		    
		    features.push(f);
		}
		callback(null, features);
	    }
	}
	
    };
    
    thisB.busy++;
    thisB.notifyActivity();

    req.open('GET', url, true);
    req.responseType = 'text';
    req.send('');
}
