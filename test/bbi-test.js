/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// bbi-test.js
//

describe('bigbed files', function() {
    var bbURI = 'http://www.biodalliance.org/datasets/tests/test-leap.bb';
    // var bbURI = 'http://local.biodalliance.org/dalliance/test-leap.bb';

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
             makeBwgFromURL(bbURI,
                function(_bb, _err) {
                    bb = _bb;
                    err = _err;
                    cb = true;
                });
       });

        waitsFor(function() {
            return cb;
        }, "The callback should be invoked");

        runs(function() {
            expect(err).toBeFalsy();
            expect(bb).not.toBeNull();
        });
    });

    it('can retrieve features from a genomic interval', function() {
        var features, err, flag;

        runs(function() {
            bb.readWigData('chr1', 1, 100000000, function(_f, _e) {
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
            expect(features.length > 0).toBeTruthy();
        });
    });

    it('can retrieve features by adjacency', function() {
        var features, err, flag;

        runs(function() {
            bb.getUnzoomedView().getFirstAdjacent('chr1', 100000000, -1, function(_f, _e) {
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
    });

    it('returns features from the next chromosome if there are no adjacent features on this chromosome', function() {
        var features, err, flag;

        runs(function() {
            bb.getUnzoomedView().getFirstAdjacent('chr1', 100000000, 1, function(_f, _e) {
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

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
           makeBwgFromURL(ensGeneURI,
                function(_bb, _err) {
                    bb = _bb;
                    err = _err;
                    cb = true;
                });
       });

        waitsFor(function() {
            return cb;
        }, "The callback should be invoked");

        runs(function() {
            expect(err).toBeFalsy();
            expect(bb).not.toBeNull();
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

    it('can retrieve features from a genomic interval', function() {
        var features, err, flag;

        runs(function() {
            bb.readWigData('chr2', 1000000, 1010000, function(_f, _e) {
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
            expect(features.length > 0).toBeTruthy();
        });
    });

    it('can retrieve features via extra indices', function() {
        var index, features, err, flag, flag2;

        runs(function() {
            bb.getExtraIndices(function(ei) {
                index = ei[0];
                flag = true;
            })
        });

        waitsFor(function() {
            return flag;
        }, 'Expects callback after extra-index request');

        runs(function() {
            index.lookup('AT5G57360.2', function(_f, _e) {
                features = _f;
                err = _e;
                flag2 = true;
            });
        });

        waitsFor(function() {
            return flag2;
        }, 'Expects callback after extra-index lookup');

        runs(function() {
            expect(err).toBeFalsy();
            expect(features).toBeTruthy();
            expect(features.length > 0).toBeTruthy();
        });
    });
});