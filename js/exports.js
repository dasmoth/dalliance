/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// exports.js: shim to export symbols into global namespace for ease of embedding
//

var browser = require('./cbrowser');
var chainset = require('./chainset');

window.Browser = browser.Browser;
window.Chainset = chainset.Chainset;