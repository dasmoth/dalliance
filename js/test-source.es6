/* jshint esversion: 6 */

/*
 Source that can be configured to produce any type of feature,
 useful for testing renderers.
 */

import { registerSourceAdapterFactory,
         FeatureSourceBase
       } from "./sourceadapters.js";

import { DASFeature
       } from "./das.js";

import * as R from "ramda";


class TestSource extends FeatureSourceBase {
    constructor(source) {
        super();

        this.features = R.defaultTo([], source.features);
    }

    genFeature(conf) {
        let feature = new DASFeature();

        for (let key in conf) {
            feature[key] = conf[key];
        }
    }

    fetch(chr, min, max, scale, types, pool, callback) {
        let features = R.forEach(this.genFeature, this.features);
        return callback(null, features, 1);
    }
}


registerSourceAdapterFactory('test-source', source => {
    return {
        features: new TestSource(source)
    };
});
