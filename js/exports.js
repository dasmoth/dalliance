/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// exports.js: shim to export symbols into global namespace for ease of embedding
//

var browser = require('./cbrowser');
var chainset = require('./chainset');
var sa = require('./sourceadapters');
var utils = require('./utils');
var das = require('./das');
var sc = require('./sourcecompare');

window.Browser = browser.Browser;
window.sourcesAreEqual = sc.sourcesAreEqual;
window.Chainset = chainset.Chainset;    // Pre-0.12 configurations need this.

// Useful for info plugins.  Should be reconsidered in the future.
window.makeElement = utils.makeElement;

// Allow source plugins to be loaded separately.
window.dalliance_registerSourceAdapterFactory = sa.registerSourceAdapterFactory;
window.dalliance_registerParserFactory = sa.registerParserFactory;
window.dalliance_makeParser = sa.makeParser;

// DAS* objects for some plugins -- remove when plugin API changes...

window.DASSequence = das.DASSequence;
window.DASFeature = das.DASFeature;
window.DASGroup = das.DASGroup;
window.DASStylesheet = das.DASStylesheet;
window.DASStyle = das.DASStyle;
window.DASSource = das.DASSource;    // Pre-0.8 configurations used this.  Still some around...
