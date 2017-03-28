/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// bam-test.js
//

"use strict";

var makeTwoBit = require('../js/twoBit').makeTwoBit;
var URLFetchable = require('../js/bin').URLFetchable;

describe('2bit files', function() {
    var twoBitURI = 'http://www.biodalliance.org/datasets/hg19.2bit';
    var twoBit;

    it('can be created by connecting to a URI', function(done) {
        makeTwoBit(new URLFetchable(twoBitURI),
                   function(_tb, err) {
                       twoBit = _tb;
                       expect(err).toBeFalsy();
                       expect(twoBit).not.toBeNull();
                       done();
                   });
    });

    it('can retrieve bases from a genomic interval', function(done) {
        twoBit.fetch('22', 19178140, 19178170, function(seq, err) {
            expect(err).toBeFalsy();
            expect(seq).toBeTruthy();
            expect(seq.length).toBe(31);
            expect(seq).toBe('NTCACAGATCACCATACCATNTNNNGNNCNA');
            done();
        });
    });

    var twoBitURI_be = 'http://www.biodalliance.org/datasets/tests/PGSC_DM.2bit';
    var twoBit_be;

    it('can be created from a big-endian file', function(done) {
        makeTwoBit(new URLFetchable(twoBitURI_be),
                   function(_tb, err) {
                       twoBit_be = _tb;
                       expect(err).toBeFalsy();
                       expect(twoBit_be).not.toBeNull();
                       done();
                   });
    });

    it('can retrieve bases from a genomic interval', function(done) {
        twoBit_be.fetch('chr12', 178140, 178170, function(seq, err) {
            expect(err).toBeFalsy();
            expect(seq).toBeTruthy();
            expect(seq.length).toBe(31);
            expect(seq).toBe('CTGTAAGTTGAAGATATTGCATACTTTCTTT');
            done();
        });
    });
});
