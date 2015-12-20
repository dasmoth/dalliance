/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// bbi-test.js
//

"use strict";

var bbi = require('../js/bigwig');
var bin = require('../js/bin');

describe('bigbed files', function() {
    var bbURI = 'http://www.biodalliance.org/datasets/tests/test-leap.bb';

    var bb;
    it('can be created by connecting to a URI', function(done) {
        bbi.makeBwg(new bin.URLFetchable(bbURI),
                    function(_bb, err) {
                        bb = _bb;
                        expect(err).toBeFalsy();
                        expect(bb).not.toBeNull();
                        done();
                });
        
    });

    it('can retrieve features from a genomic interval', function(done) {
        bb.readWigData('chr1', 1, 100000000, function(features, err) {
            expect(err).toBeFalsy();
            expect(features).toBeTruthy();
            expect(features.length > 0).toBeTruthy();
            done();
        });
    });

    it('can retrieve features by adjacency', function(done) {
        bb.getUnzoomedView().getFirstAdjacent('chr1', 100000000, -1, function(features, err) {
            expect(err).toBeFalsy();
            expect(features).toBeTruthy();
            expect(features.length).toBe(1);
            done();
        });
    });

    it('returns features from the next chromosome if there are no adjacent features on this chromosome', function(done) {
        bb.getUnzoomedView().getFirstAdjacent('chr1', 100000000, 1, function(features, err) {
            expect(err).toBeFalsy();
            expect(features).toBeTruthy();
            expect(features.length).toBe(1);
            done();
        });
    });

/*
    it('loops after last chromosome', function() {
        var features, err, flag;

        runs(function() {
            bb.getUnzoomedView().getFirstAdjacent('chr1', 1, -1, function(_f, _e) {
                flag = true;
                features = _f;
                err = _e;
            });
        });

        waitsFor(function() {
            return flag;
        }, 'Expects callback after feature fetch');

        runs(function() {
            expect(err).toBeFalsy();
            expect(features).toBeTruthy();
            // console.log(features);
            expect(features.length > 0).toBeTruthy();
        });
    }); */
});

describe('BBI objects', function() {

    var ensGeneURI = 'http://www.biodalliance.org/datasets/tests/ensGene.araTha1.bb';
    // var ensGeneURI = 'http://local.biodalliance.org/dalliance/plants/araTha/bbi/ensGene.araTha1.bb';

    var bb;

    it('can be created by connecting to a URI', function(done) {
        var cb, err;
        bbi.makeBwg(new bin.URLFetchable(ensGeneURI),
                    function(_bb, err) {
                        bb = _bb;
                        expect(err).toBeFalsy();
                        expect(bb).not.toBeNull();
                        done();
                    });
    });

    describe('have a chromToIDs map', function() {
        it('knows names of chromosomes', function() {
            expect(bb.chromsToIDs['chr2']).toBeDefined();
        });

        it('canonicalizes chrX vs. X forms', function() {
            expect(bb.chromsToIDs['2']).toBe(bb.chromsToIDs['chr2']);
        });
    });

    describe('have a schema object', function() {
        it('that represent any autosql', function() {
            expect(bb.schema.fields.length == 12);
        });
    });

    it('can retrieve features from a genomic interval', function(done) {
        bb.readWigData('chr2', 1000000, 1010000, function(features, err) {
            expect(err).toBeFalsy();
            expect(features).toBeTruthy();
            expect(features.length > 0).toBeTruthy();
            done();
        });
    });

    it('can retrieve features via extra indices', function(done) {
        bb.getExtraIndices(function(ei) {
            var index = ei[0];
            expect(index).toBeTruthy();
            if (!index) {
                done();
            } else {
                index.lookup('AT5G57360.2', function(features, err) {
                    expect(err).toBeFalsy();
                    expect(features).toBeTruthy();
                    expect(features.length > 0).toBeTruthy();
                    done();
                });
            }
        });
    });
});
