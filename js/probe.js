/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// bedwig.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var bin = require('./bin');
    var URLFetchable = bin.URLFetchable;
    var BlobFetchable = bin.BlobFetchable;
    var readInt = bin.readInt;

    var bbi = require('./bigwig');
    var BIG_WIG_MAGIC = bbi.BIG_WIG_MAGIC;
    var BIG_BED_MAGIC = bbi.BIG_BED_MAGIC;

    var lh3utils = require('./lh3utils');
    var unbgzf = lh3utils.unbgzf;

    var bam = require('./bam');
    var BAM_MAGIC = bam.BAM_MAGIC;
    var BAI_MAGIC = bam.BAI_MAGIC;

    var tbi = require('./tabix');
    var TABIX_MAGIC = tbi.TABIX_MAGIC;

    var EncodeFetchable = require('./encode').EncodeFetchable;
}

function probeResource(source, listener, retry) {
    var BED_REGEXP = new RegExp('^\\w+\\s[0-9]+\\s[0-9]+.*$');
    var KV_REGEXP=/([^=]+)=\"?([^\"]+)\"?/;
    var VCFHEAD_RE = /^##\s*fileformat=VCFv4\..+/;

    var fetchable;
    if (source.blob)
        fetchable = new BlobFetchable(source.blob);
    else if (source.transport == 'encode')
        fetchable = new EncodeFetchable(source.uri);
    else
        fetchable = new URLFetchable(source.uri, {credentials: source.credentials});

    fetchable.slice(0, 1<<16).salted().fetch(function(result, error) {
        if (!result) {
            if (!retry) {
                source.credentials = true;
                probeResource(source, listener, true)
            }

            return listener(source, "Couldn't fetch data");
        }

        var ba = new Uint8Array(result);
        var la = new Uint32Array(result, 0, 1);
        var magic = la[0];
        if (magic == BIG_WIG_MAGIC || magic == BIG_BED_MAGIC) {
            source.tier_type = 'bwg';
            var nameExtractPattern = new RegExp('/?([^/]+?)(.bw|.bb|.bigWig|.bigBed)?$');
            var match = nameExtractPattern.exec(source.uri || source.blob.name);
            if (match) {
                source.name = match[1];
            }

            return listener(source, null);
        } else if (magic == BAI_MAGIC) {
            source.tier_type = 'bai';
            return listener(source, null);
        } else if (ba[0] == 31 || ba[1] == 139) {
            var unc = unbgzf(result);
            var uncba = new Uint8Array(unc);
            magic = readInt(uncba, 0);
            if (magic == BAM_MAGIC) {
                source.tier_type = 'bam';
                var nameExtractPattern = new RegExp('/?([^/]+?)(.bam)?$');
                var match = nameExtractPattern.exec(source.uri || source.blob.name);
                if (match) {
                    source.name = match[1];
                }

                return listener(source, null);
            } else if (magic == TABIX_MAGIC) {
                source.tier_type = 'tabix-index';
                return listener(source, null);
            } else if (magic == 0x69662323) {
                source.tier_type = 'tabix';
                source.payload = 'vcf';
                var nameExtractPattern = new RegExp('/?([^/]+?)(.vcf)?(.gz)?$');
                var match = nameExtractPattern.exec(source.uri || source.blob.name);
                if (match) {
                    source.name = match[1];
                }

                return listener(source, null);
            } else {
                console.log('magic = ' + magic.toString(16));
               return listener(source, "Unsupported format");
            }
        } else {
            var text = String.fromCharCode.apply(null, ba);
            var lines = text.split("\n");

            if (lines.length > 0 && VCFHEAD_RE.test(lines[0])) {
                source.tier_type = 'memstore';
                source.payload = 'vcf';
                var nameExtractPattern = new RegExp('/?([^/]+?)(\.vcf)?$');
                var match = nameExtractPattern.exec(source.uri || source.blob.name);
                if (match && !source.name) {
                    source.name = match[1];
                }
                return listener(source, null);
            }

            for (var li = 0; li < lines.length; ++li) {
                var line = lines[li].replace('\r', '');
                if (line.length == 0) continue;

                if (line.indexOf('browser') == 0) continue;

                if (line.indexOf('track') == 0) {
                    var maybeType = 'bed';
                    var toks = line.split(/\s/);
                    for (var ti = 1; ti < toks.length; ++ti) {
                        var m = KV_REGEXP.exec(toks[ti]);
                        if (m) {
                            if (m[1] == 'type' && m[2] == 'wiggle_0') {
                                maybeType = 'wig'
                            } else if (m[0] == 'name') {
                                source.name = m[2];
                            }
                        }
                    }

                    finishProbeBedWig(source, maybeType);
                    return listener(source, null);
                }

                if (line.indexOf('fixedStep') == 0) {
                    finishProbeBedWig(source, 'wig');
                    return listener(source, null);
                }

                if (line.indexOf('variableStep') == 0) {
                    finishProbeBedWig(source, 'wig');
                    return listener(source, null);
                }

                if (BED_REGEXP.test(line)) {
                    finishProbeBedWig(source, null);
                    return listener(source, null);
                }

                break;
            }

            return listener(source, "Unsupported format");
        }
    });
}

function finishProbeBedWig(source, maybeType) {
    source.tier_type = 'memstore';
    var nameExtractPattern = new RegExp('/?([^/]+?)(.(bed|wig))?$');
    var match = nameExtractPattern.exec(source.uri || source.blob.name);
    if (match) {
        if (!source.name)
            source.name = match[1];
        if (!maybeType && match[3]) {
            maybeType = match[3];
        }
    }
    source.payload = maybeType || 'bed';
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        probeResource: probeResource
    };
}