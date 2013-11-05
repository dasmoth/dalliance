/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// bbi-test.js
//

describe('BBI objects', function() {
    var bb;

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
           makeBwgFromURL('http://www.biodalliance.org/datasets/tests/ensGene.araTha1.bb',
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
});