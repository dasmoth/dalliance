/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2016
//
// module-exports.js: entry point when loading as an NPM-style module
//

"use strict";

const cbrowser = require('./cbrowser');
const sourceadapters = require('./sourceadapters');

module.exports = {
    Browser: cbrowser.Browser,
    registerSourceAdapterFactory: sourceadapters.registerSourceAdapterFactory,
    registerParserFactory: sourceadapters.registerParserFactory,
    makeParser: sourceadapters.makeParser
};
