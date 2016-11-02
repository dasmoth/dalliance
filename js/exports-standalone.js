/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2016
//
// exports-standalone.js: entry point for standalone module build
//

"use strict";

const cbrowser = require('./cbrowser');
const chainset = require('./chainset');
const sourceadapters = require('./sourceadapters');
const utils = require('./utils');
const das = require('./das');
const sourcecompare = require('./sourcecompare');
const bigwig = require('./bigwig');
const bam = require('./bam');
const bin = require('./bin');
const cigar = require('./cigar');
const ruler = require('./rulers.es6')


module.exports = {
    Browser: cbrowser.Browser,
    registerSourceAdapterFactory: sourceadapters.registerSourceAdapterFactory,
    registerParserFactory: sourceadapters.registerParserFactory,
    makeParser: sourceadapters.makeParser,
    Chainset: chainset.Chainset,

    sourceadapters,
    utils,
    das,
    sourcecompare,
    bigwig,
    bam,
    bin,
    cigar,
    ruler,
    chainset
};
