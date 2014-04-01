var connectBigTab = require('../js/bigtab').connectBigTab;
var URLFetchable = require('../js/bin').URLFetchable;

describe('bigtab files', function() {
    // var btURI = 'http://localhost/dalliance/test.bt';
    var btURI = 'http://www.biodalliance.org/datasets/ensg-to-desc.bt';

    var bt;

    it('can be created by connecting to a URI', function() {
        var cb, err;
        runs(function() {
             connectBigTab(new URLFetchable(btURI),
                function(_bt, _err) {
                    console.log(_err, _bt);
                    bt = _bt;
                    err = _err;
                    cb = true;
                });
       });

        waitsFor(function() {
            return cb;
        }, "The callback should be invoked");

        runs(function() {
            console.log(err, bt);
            expect(err).toBeFalsy();
            expect(bt).toBeTruthy();
        });
    });

    it('allows lookups', function() {
        var cb, res, err;
        runs(function() {
            bt.index.lookup("ENSG00000127054.14", function(_res, _err) {
                res = _res;
                err = _err;
                cb = true;
            });
        });

        waitsFor(function() {
            return cb;
        }, "The callback should be invoked");

        runs(function() {
            console.log(res);
            expect(err).toBeFalsy();
        });
    });
});