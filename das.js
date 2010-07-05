// DAS-in-Javascript library
//
// Gradually being refactored from the backend bits of SvgDAS!
//
// @author Thomas Down

var dasLibErrorHandler = function(errMsg) {
    alert(errMsg);
}
var dasLibRequestQueue = new Array();

function doCrossDomainRequest(url, handler) {
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
		  handler(req.responseXML);
	      }
            }
	};
	req.open("get", url, true);
	req.send('');
    }
}

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
}

//
// DAS 1.6 entry_points command
//

DASSource.prototype.entryPoints = function(callback) {
    var dasURI = this.uri + 'entry_points';
    doCrossDomainRequest(dasURI, function(responseXML) {
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
    doCrossDomainRequest(dasURI, function(responseXML) {
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
        dasURI = this.uri + 'features?' + segment.toDASQuery();
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
   
    //alert(dasURI);
    // Feature/group-by-ID stuff?
    
    doCrossDomainRequest(dasURI, function(responseXML) {
                var features = new Array();
                
                var featureXMLs = responseXML.getElementsByTagName("FEATURE");
                for (var i = 0; i < featureXMLs.length; ++i) {
                    var feature = featureXMLs[i];
                    var dasFeature = new DASFeature();
                    
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
                    // Notes
                    
                    var groups = feature.getElementsByTagName("GROUP");
                    for (var gi  = 0; gi < groups.length; ++gi) {
                        var groupXML = groups[gi];
                        var dasGroup = new DASGroup();
                        dasGroup.type = groupXML.getAttribute('type');
                        dasGroup.id = groupXML.getAttribute('id');
                        dasGroup.links = dasLinksOf(groupXML);
                        if (!dasFeature.groups) {
                            dasFeature.groups = new Array(dasGroup);
                        } else {
                            dasFeature.groups.push(dasGroup);
                        }
                        
                        // processing of per-group links/notes.
                    }
                    
                    // Also handle DAS/1.6 part/parent?
                    
                    features.push(dasFeature);
                }
                
                callback(features);
    });
}

//
// Utility functions
//

function elementValue(element, tag)
{
    var children = element.getElementsByTagName(tag);
    if (children.length > 0) {
        return children[0].firstChild.nodeValue;
    } else {
        return null;
    }
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
