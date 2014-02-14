/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tabix-test.js
//

describe('Tabix files', function() {
    var vcfURI = 'http://www.biodalliance.org/datasets/tests/PG0000566-BLD.snps.vcf.gz';
    var tbiURI = 'http://www.biodalliance.org/datasets/tests/PG0000566-BLD.snps.vcf.gz.tbi'
    var tabix;

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
             connectTabix(new URLFetchable(vcfURI), new URLFetchable(tbiURI),
                function(_tabix, _err) {
                    tabix = _tabix;
                    err = _err;
                    cb = true;
                });
       });

        waitsFor(function() {
            return cb;
        }, "The callback should be invoked");

        runs(function() {
            expect(err).toBeFalsy();
            expect(tabix).not.toBeNull();
        });
    });

    it('can retrieve records from a genomic interval', function() {
        var features, err, flag;

        runs(function() {
            tabix.fetch('22', 30000000, 30010000, function(_f, _e) {
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
            expect(features.length).toBe(6);
        });
    });
});
