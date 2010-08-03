/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// das.js: queries and low-level data model.
//

var dasLibErrorHandler = function(errMsg) {
    alert(errMsg);
}
var dasLibRequestQueue = new Array();



function DASSegment(name, start, end, description) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.description = description;
}
DASSegment.prototype.toString = function() {
    return this.name + ':' + this.start + '..' + this.end;
};
DASSegment.prototype.isBounded = function() {
    return this.start && this.end;
}
DASSegment.prototype.toDASQuery = function() {
    var q = 'segment=' + this.name;
    if (this.start && this.end) {
        q += (':' + this.start + ',' + this.end);
    }
    return q;
}


function DASSource(uri, options) {
    // if (!uri.endsWith('/')) {
    //     uri = uri + '/';
    // }
    
    this.uri = uri;
    if (!options) {
        options = new Object();
    }
    this.options = options;
    this.coords = [];
    this.props = {};
}

function DASCoords() {
}

//
// DAS 1.6 entry_points command
//

DASSource.prototype.entryPoints = function(callback) {
    var dasURI = this.uri + 'entry_points';
    this.doCrossDomainRequest(dasURI, function(responseXML) {
                var entryPoints = new Array();
                
                var segs = responseXML.getElementsByTagName('SEGMENT');
                for (var i = 0; i < segs.length; ++i) {
                    var seg = segs[i];
                    var segId = seg.getAttribute('id');
                    
                    var segSize = seg.getAttribute('size');
                    var segMin, segMax;
                    if (segSize) {
                        segMin = 1; segMax = segSize;
                    } else {
                        segMin = seg.getAttribute('start');
                        segMax = seg.getAttribute('stop');
                    }
                    var segDesc = null;
                    if (seg.firstChild) {
                        segDesc = seg.firstChild.nodeValue;
                    }
                    entryPoints.push(new DASSegment(segId, segMin, segMax, segDesc));
                }          
               callback(entryPoints);
    });		
}

//
// DAS 1.6 sequence command
// Do we need an option to fall back to the dna command?
//

function DASSequence(name, start, end, alpha, seq) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.alphabet = alpha;
    this.seq = seq;
}

DASSource.prototype.sequence = function(segment, callback) {
    var dasURI = this.uri + 'sequence?' + segment.toDASQuery();
    this.doCrossDomainRequest(dasURI, function(responseXML) {
	if (!responseXML) {
	    callback([]);
	    return;
	} else {
                var seqs = new Array();
                
                var segs = responseXML.getElementsByTagName('SEQUENCE');
                for (var i = 0; i < segs.length; ++i) {
                    var seg = segs[i];
                    var segId = seg.getAttribute('id');
                    var segMin = seg.getAttribute('start');
                    var segMax = seg.getAttribute('stop');
                    var segAlpha = 'DNA';
                    var segSeq = null;
                    if (seg.firstChild) {
                        var rawSeq = seg.firstChild.nodeValue;
                        segSeq = '';
                        var idx = 0;
                        while (true) {
                            var space = rawSeq.indexOf('\n', idx);
                            if (space >= 0) {
                                segSeq += rawSeq.substring(idx, space);
                                idx = space + 1;
                            } else {
                                segSeq += rawSeq.substring(idx);
                                break;
                            }
                        }
                    }
                    seqs.push(new DASSequence(segId, segMin, segMax, segAlpha, segSeq));
                }
                
                callback(seqs);
	}
    });
}

//
// DAS 1.6 features command
//

function DASFeature() {
    // We initialize these in the parser...
}

function DASGroup() {
    // We initialize these in the parser, too...
}

function DASLink(desc, uri) {
    this.desc = desc;
    this.uri = uri;
}

DASSource.prototype.features = function(segment, options, callback) {
    var dasURI;
    if (this.uri.indexOf('http://') == 0) {
        dasURI = this.uri + 'features?';

	if (segment) {
	    dasURI += segment.toDASQuery();
	} else if (options.group) {
	    var g = options.group;
	    if (typeof g == 'string') {
		dasURI += ';group_id=' + g;
	    } else {
		for (var gi = 0; gi < g.length; ++gi) {
		    dasURI += ';group_id=' + g[gi];
		}
	    }
	}
        if (options.type) {
            if (typeof options.type == 'string') {
                dasURI += ';type=' + options.type;
            } else {
                for (var ti = 0; ti < options.type.length; ++ti) {
                    dasURI += ';type=' + options.type[ti];
                }
            }
        }
	
        if (options.maxbins) {
            dasURI += ';maxbins=' + options.maxbins;
        }
    } else {
        dasURI = this.uri;
    }
   
    // alert(dasURI);

    // Feature/group-by-ID stuff?
    
    this.doCrossDomainRequest(dasURI, function(responseXML, req) {

	if (!responseXML) {
	    callback([], 'Failed request: ' + dasURI);     // FIXME response code here?
	    return;
	}
	if (req) {
	    /*
	    var caps = req.getResponseHeader('X-DAS-Capabilties');
	    if (caps) {
		alert(caps);
	    }
	    */
	}

        var features = new Array();
        var segmentMap = {};

	var segs = responseXML.getElementsByTagName('SEGMENT');
	for (var si = 0; si < segs.length; ++si) {
            var segmentXML = segs[si];
	    var segmentID = segmentXML.getAttribute('id');
            segmentMap[segmentID] = {
                min: segmentXML.getAttribute('start'),
                max: segmentXML.getAttribute('stop')
            };
	    
                var featureXMLs = segmentXML.getElementsByTagName('FEATURE');
                for (var i = 0; i < featureXMLs.length; ++i) {
                    var feature = featureXMLs[i];
                    var dasFeature = new DASFeature();
                    
		    dasFeature.segment = segmentID;
                    dasFeature.id = feature.getAttribute('id');
                    dasFeature.label = feature.getAttribute('label');
                    dasFeature.min = elementValue(feature, "START");
                    dasFeature.max = elementValue(feature, "END");
                    dasFeature.type = elementValue(feature, "TYPE");
                    dasFeature.method = elementValue(feature, "METHOD");
                    {
                        var ori = elementValue(feature, "ORIENTATION");
                        if (!ori) {
                            ori = '0';
                        }
                        dasFeature.orientation = ori;
                    }
                    dasFeature.score = elementValue(feature, "SCORE");
                    dasFeature.links = dasLinksOf(feature);
                    dasFeature.notes = dasNotesOf(feature);
                    
                    var groups = feature.getElementsByTagName("GROUP");
                    for (var gi  = 0; gi < groups.length; ++gi) {
                        var groupXML = groups[gi];
                        var dasGroup = new DASGroup();
                        dasGroup.type = groupXML.getAttribute('type');
                        dasGroup.id = groupXML.getAttribute('id');
                        dasGroup.links = dasLinksOf(groupXML);
			dasGroup.notes = dasNotesOf(groupXML);
                        if (!dasFeature.groups) {
                            dasFeature.groups = new Array(dasGroup);
                        } else {
                            dasFeature.groups.push(dasGroup);
                        }
                    }
                    

                    if (dasFeature.notes) {
                        for (var ni = 0; ni < dasFeature.notes.length; ++ni) {
                            var n = dasFeature.notes[ni];
                            if (n.indexOf('Genename=') == 0) {
                                var gg = new DASGroup();
                                gg.type='gene';
                                gg.id = n.substring(9);
                                if (!dasFeature.groups) {
                                    dasFeature.groups = new Array(gg);
                                } else {
                                    dasFeature.groups.push(gg);
                                }
                            }
                        }
                    }
                    

                    // Also handle DAS/1.6 part/parent?
                    
                    features.push(dasFeature);
                }
	}
                
        callback(features, undefined, segmentMap);
    });
}

function DASStylesheet() {
    this.highZoomStyles = new Object();
    this.mediumZoomStyles = new Object();
    this.lowZoomStyles = new Object();
}

DASStylesheet.prototype.pushStyle = function(type, zoom, style) {
    if (!zoom) {
	this.highZoomStyles[type] = style;
	this.mediumZoomStyles[type] = style;
	this.lowZoomStyles[type] = style;
    } else if (zoom == 'high') {
	this.highZoomStyles[type] = style;
    } else if (zoom == 'medium') {
	this.mediumZoomStyles[type] = style;
    } else if (zoom == 'low') {
	this.lowZoomStyles[type] = style;
    }
}

function DASStyle() {
}

DASSource.prototype.stylesheet = function(successCB, failureCB) {
    var dasURI;
    if (this.endpoint_stylesheet) {
        dasURI = this.endpoint_stylesheet;
    } else {
        dasURI = this.uri + 'stylesheet';
    }

    this.doCrossDomainRequest(dasURI, function(responseXML) {
	if (!responseXML) {
	    if (failureCB) {
		failureCB();
	    } 
	    return;
	}
	var stylesheet = new DASStylesheet();
	var typeXMLs = responseXML.getElementsByTagName('TYPE');
	for (var i = 0; i < typeXMLs.length; ++i) {
	    var typeStyle = typeXMLs[i];
	    var type = typeStyle.getAttribute('id'); // Am I right in thinking that this makes DASSTYLE XML invalid?  Ugh.
	    var glyphXMLs = typeStyle.getElementsByTagName('GLYPH');
	    for (var gi = 0; gi < glyphXMLs.length; ++gi) {
		var glyphXML = glyphXMLs[gi];
		var zoom = glyphXML.getAttribute('zoom');
		var glyph = childElementOf(glyphXML);
		var style = new DASStyle();
		style.glyph = glyph.localName;
		var child = glyph.firstChild;
	
		while (child) {
		    if (child.nodeType == Node.ELEMENT_NODE) {
			// alert(child.localName);
			style[child.localName] = child.firstChild.nodeValue;
		    }
		    child = child.nextSibling;
		}
		stylesheet.pushStyle(type, zoom, style);
	    }
	}
	successCB(stylesheet);
    }, false);
}

//
// sources command
// 

function DASRegistry(uri, opts)
{
    opts = opts || {};
    this.uri = uri;
    this.opts = opts;   
}

DASRegistry.prototype.sources = function(callback, failure, opts)
{
    if (!opts) {
        opts = {};
    }

    var filters = [];
    if (opts.taxon) {
        filters.push('organism=' + opts.taxon);
    }
    if (opts.auth) {
        filters.push('authority=' + opts.auth);
    }
    if (opts.version) {
        filters.push('version=' + opts.version);
    }
    var quri = this.uri;
    if (filters.length > 0) {
        quri = quri + '?' + filters.join('&');   // '&' as a separator to hack around dasregistry.org bug.
    }

    doCrossDomainRequest(quri, function(responseXML) {
	if (!responseXML && failure) {
	    failure();
	    return;
	}

	var sources = [];	
	var sourceXMLs = responseXML.getElementsByTagName('SOURCE');
	for (var si = 0; si < sourceXMLs.length; ++si) {
	    var sourceXML = sourceXMLs[si];
	    var versionXMLs = sourceXML.getElementsByTagName('VERSION');
	    if (versionXMLs.length < 1) {
		continue;
	    }
	    var versionXML = versionXMLs[0];

	    var coordXMLs = versionXML.getElementsByTagName('COORDINATES');
	    var coords = [];
	    for (var ci = 0; ci < coordXMLs.length; ++ci) {
		var coordXML = coordXMLs[ci];
		var coord = new DASCoords();
		coord.auth = coordXML.getAttribute('authority');
		coord.taxon = coordXML.getAttribute('taxid');
		coord.version = coordXML.getAttribute('version');
		coords.push(coord);
	    }
	    
	    var capXMLs = versionXML.getElementsByTagName('CAPABILITY');
	    var uri;
	    for (var ci = 0; ci < capXMLs.length; ++ci) {
		var capXML = capXMLs[ci];
		if (capXML.getAttribute('type') == 'das1:features') {
		    var fep = capXML.getAttribute('query_uri');
		    uri = fep.substring(0, fep.length - ('features'.length));
		}
	    }

	    var props = {};
	    var propXMLs = versionXML.getElementsByTagName('PROP');
	    for (var pi = 0; pi < propXMLs.length; ++pi) {
		pusho(props, propXMLs[pi].getAttribute('name'), propXMLs[pi].getAttribute('value'));
	    }
	    
	    if (uri) {
		var source = new DASSource(uri);
		source.title = sourceXML.getAttribute('title');
		source.desc = sourceXML.getAttribute('description');
		source.coords = coords;
		source.props = props;
		sources.push(source);
	    }
	}
	
	callback(sources);
    });
}


//
// Utility functions
//

function elementValue(element, tag)
{
    var children = element.getElementsByTagName(tag);
    if (children.length > 0 && children[0].firstChild) {
        return children[0].firstChild.nodeValue;
    } else {
        return null;
    }
}

function childElementOf(element)
{
    if (element.hasChildNodes()) {
	var child = element.firstChild;
	do {
	    if (child.nodeType == Node.ELEMENT_NODE) {
		return child;
	    } 
	    child = child.nextSibling;
	} while (child != null);
    }
    return null;
}


function dasLinksOf(element)
{
    var links = new Array();
    var maybeLinkChilden = element.getElementsByTagName('LINK');
    for (var ci = 0; ci < maybeLinkChilden.length; ++ci) {
        var linkXML = maybeLinkChilden[ci];
        if (linkXML.parentNode == element) {
            links.push(new DASLink(linkXML.firstChild.nodeValue, linkXML.getAttribute('href')));
        }
    }
    
    return links;
}

function dasNotesOf(element)
{
    var notes = [];
    var maybeNotes = element.getElementsByTagName('NOTE');
    for (var ni = 0; ni < maybeNotes.length; ++ni) {
	if (maybeNotes[ni].firstChild) {
	    notes.push(maybeNotes[ni].firstChild.nodeValue);
	}
    }
    return notes;
}

function doCrossDomainRequest(url, handler, credentials) {
    // TODO: explicit error handlers?

    if (window.XDomainRequest) {
	var req = new XDomainRequest();
	req.onload = function() {
	    var dom = new ActiveXObject("Microsoft.XMLDOM");
	    dom.async = false;
	    dom.loadXML(req.responseText);
	    handler(dom);
	}
	req.open("get", url);
	req.send('');
    } else {
	var req = new XMLHttpRequest();

	req.onreadystatechange = function() {
	    if (req.readyState == 4) {
              if (req.status == 200 || req.status == 0) {
		  handler(req.responseXML, req);
	      }
            }
	};
	req.open("get", url, true);
	if (credentials) {
	    req.withCredentials = true;
	}
	req.send('');
    }
}

DASSource.prototype.doCrossDomainRequest = function(url, handler) {
    return doCrossDomainRequest(url, handler, this.credentials);
}
