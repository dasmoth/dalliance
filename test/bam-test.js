/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// bam-test.js
//

var makeBam = require('../js/bam').makeBam;
var URLFetchable = require('../js/bin').URLFetchable;

describe('BAM files', function() {
    var bamURI = 'http://www.biodalliance.org/datasets/bodymap-skeletal_muscle-chr22.bam';
    // var bbURI = 'http://local.biodalliance.org/dalliance/test-leap.bb';
    var bam;

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
             makeBam(new URLFetchable(bamURI), new URLFetchable(bamURI + '.bai'), null,
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

    it('can use indexChunks', function() {
        // generated with https://gist.github.com/8eca3f215058d7bb3994
        var indexChunks = {"chunks": [[8, 16], [16, 24], [24, 32], [32, 40], [40, 48], [48, 56], [56, 64], [64, 72], [72, 80], [80, 88], [88, 96], [96, 104], [104, 112], [112, 120], [120, 128], [128, 136], [136, 144], [144, 152], [152, 160], [160, 168], [168, 176], [176, 184], [184, 192], [192, 200], [200, 208], [208, 216], [216, 224], [224, 232], [232, 240], [240, 248], [248, 256], [256, 264], [264, 272], [272, 280], [280, 288], [288, 296], [296, 304], [304, 312], [312, 320], [320, 328], [328, 336], [336, 344], [344, 352], [352, 360], [360, 368], [368, 376], [376, 71224], [71224, 71232], [71232, 71240], [71240, 71248], [71248, 71256], [71256, 71264], [71264, 71272], [71272, 71280], [71280, 71288], [71288, 71296], [71296, 71304], [71304, 71312], [71312, 71320], [71320, 71328], [71328, 71336], [71336, 71344], [71344, 71352], [71352, 71360], [71360, 71368], [71368, 71376], [71376, 71384], [71384, 71392], [71392, 71400], [71400, 71408], [71408, 71416], [71416, 71424], [71424, 71432], [71432, 71440], [71440, 71448], [71448, 71456], [71456, 71464], [71464, 71472], [71472, 71480], [71480, 71488], [71488, 71496], [71496, 71504], [71504, 71512], [71512, 71520]], "minBlockIndex": 1382};

        var cb, err;
        var features, err, flag;
        runs(function() {
            makeBam(new URLFetchable(bamURI), new URLFetchable(bamURI + '.bai'), indexChunks,
                function(_bam, _err) {
                    bam = _bam;
                    err = _err;
                    cb = true;
                });
        });

        waitsFor(function() {
            return cb;
        }, "callback after fetch");

        runs(function() {
            bam.fetch('22', 30000000, 30010000, function(_f, _e) {
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

    it('does not fetch BAM when BAI load fails', function() {
        var failUrl = { fetch: function(cb) { cb(null); } };
        var countingUrl = {
          count: 0,
          fetch: function(cb) {
            this.count += 1;
            cb();
          },
          slice: function() {
            return this;
          }
        };

        var cb, err;
        runs(function() {
            makeBam(countingUrl, failUrl, null,
                function(_bam, _err) {
                    bam = _bam;
                    err = _err;
                    cb = true;
                });
        });

        waitsFor(function() {
            return cb;
        }, "callback after fetch");

        runs(function() {
            expect(err).toEqual("Couldn't access BAI");
            expect(countingUrl.count).toEqual(0);
        });
    });
});
