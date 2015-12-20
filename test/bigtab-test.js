"use strict";

var connectBigTab = require('../js/bigtab').connectBigTab;
var URLFetchable = require('../js/bin').URLFetchable;

describe('bigtab files', function() {
    var btURI = 'http://www.biodalliance.org/datasets/ensg-to-desc.bt';

    var bt;

    it('can be created by connecting to a URI', function(done) {
        connectBigTab(new URLFetchable(btURI),
                      function(_bt, err) {
                          bt = _bt;
                          expect(err).toBeFalsy();
                          expect(bt).toBeTruthy();
                          done();
                      });
    });

    it('allows lookups', function(done) {
        bt.index.lookup("ENSG00000127054.14", function(res, err) {
            console.log(res);
            expect(err).toBeFalsy();
            done();
        });
    });
});
