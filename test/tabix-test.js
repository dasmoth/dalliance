/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tabix-test.js
//

"use strict";

var connectTabix = require('../js/tabix').connectTabix;
var URLFetchable = require('../js/bin').URLFetchable;

describe('Tabix files', function() {
    var vcfURI = 'http://www.biodalliance.org/datasets/tests/PG0000566-BLD.snps.vcf.gz';
    var tbiURI = 'http://www.biodalliance.org/datasets/tests/PG0000566-BLD.snps.vcf.gz.tbi'
    var tabix;

    it('can be created by connecting to a URI', function(done) {
        var cb, err;
        connectTabix(new URLFetchable(vcfURI), new URLFetchable(tbiURI),
                     function(_tabix, err) {
                         tabix = _tabix;
                         expect(err).toBeFalsy();
                         expect(tabix).not.toBeNull();
                         done();
                     });
    });

    it('can retrieve records from a genomic interval', function(done) {
        tabix.fetch('22', 30000000, 30010000, function(features, err) {
            expect(err).toBeFalsy();
            expect(features).toBeTruthy();
            expect(features.length).toBe(6);
            done();
        });
    });
});
