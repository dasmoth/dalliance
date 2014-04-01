/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// bam-test.js
//

var makeTwoBit = require('../js/twoBit').makeTwoBit;
var URLFetchable = require('../js/bin').URLFetchable;

describe('2bit files', function() {
    var twoBitURI = 'http://www.biodalliance.org/datasets/hg19.2bit';
    var twoBit;

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
             makeTwoBit(new URLFetchable(twoBitURI),
                function(_tb, _err) {
                    twoBit = _tb;
                    err = _err;
                    cb = true;
                });
       });

        waitsFor(function() {
            return cb;
        }, "The callback should be invoked");

        runs(function() {
            expect(err).toBeFalsy();
            expect(twoBit).not.toBeNull();
        });
    });

    it('can retrieve bases from a genomic interval', function() {
        var seq, err, flag;

        runs(function() {
            twoBit.fetch('22', 19178140, 19178170, function(_s, _e) {
                flag = true;
                seq = _s;
                // console.log('got ' + seq);
                err = _e;
            });
        });

        waitsFor(function() {
            return flag;
        }, 'Expects callback after feature fetch');

        runs(function() {
            expect(err).toBeFalsy();
            expect(seq).toBeTruthy();
            console.log(seq.length);
            expect(seq.length).toBe(31);
            expect(seq).toBe('NTCACAGATCACCATACCATNTNNNGNNCNA');
        });
    });
});
