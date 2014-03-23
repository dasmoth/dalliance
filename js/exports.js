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

window.Browser = browser.Browser;
window.Chainset = chainset.Chainset;

// Useful for info plugins.  Should be reconsidered in the future.
window.makeElement = utils.makeElement;

// Allow source plugins to be loaded separately.
window.dalliance_registerSourceAdapterFactory = sa.registerSourceAdapterFactory;
window.dalliance_registerParserFactory = sa.registerParserFactory;
window.dalliance_makeParser = sa.makeParser;