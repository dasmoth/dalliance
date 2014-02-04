/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// bam-test.js
//

describe('BAM files', function() {
    var bamURI = 'http://www.biodalliance.org/datasets/bodymap-skeletal_muscle-chr22.bam';
    // var bbURI = 'http://local.biodalliance.org/dalliance/test-leap.bb';
    var bam;

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
             makeBam(new URLFetchable(bamURI), new URLFetchable(bamURI + '.bai'),
                function(_bam, _err) {
                    bam = _bam;
                    err = _err;
                    cb = true;
                });
       });

        waitsFor(function() {
            return cb;
        }, "The callback should be invoked");

        runs(function() {
            expect(err).toBeFalsy();
            expect(bam).not.toBeNull();
        });
    });

    it('can retrieve reads from a genomic interval', function() {
        var features, err, flag;

        runs(function() {
            bam.fetch('22', 30000000, 30010000, function(_f, _e) {
                flag = true;
                features = _f;
                console.log('got ' + features.length);
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
