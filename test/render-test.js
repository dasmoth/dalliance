"use strict"

const renderTestBrowser = new Browser({
    chr:          '11',
    defaultStart: 9000000,
    defaultEnd:   19000000,
    viewStart:    9000000,
    viewEnd:      19000000,
    cookieKey:    'render-test',
    noPersist:    true,

    coordSystem: {
        speciesName: 'Mouse',
        taxon: 10090,
        auth: 'GRCm',
        version: 38,
        ucscName: 'mm10'
    },


    chains: {
        mm9ToMm10: new Chainset('http://www.derkholm.net:8080/das/mm9ToMm10/', 'NCBIM37', 'GRCm38',
                                {
                                    speciesName: 'Mouse',
                                    taxon: 10090,
                                    auth: 'NCBIM',
                                    version: 37,
                                    ucscName: 'mm9'
                                })
    },


    sources:      [{name: 'Genome',
                    twoBitURI:  'http://www.biodalliance.org/datasets/GRCm38/mm10.2bit',
                    desc: 'Mouse reference genome build GRCm38'}
                   
                   ,{name: 'Histogram',
                     desc: 'Test histogram',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [
                         {
                             min: 11000000,
                             max: 12000000,
                             score: 5,
                             orientation: '-',
                             seq:  "GTCAGCTGCAGCAGTAGCGAAGACT",
                             quals: "++**//++aab021!!gfOF0//!!",
                             cigar: "5M5I5M5D5S"
                         },
                         {
                             min: 12000000,
                             max: 13000000,
                             score: 2,
                             seq:  "GTCAGCTGCAGCAGTAGCGAAGACT",
                             quals: "++**//++aab021!!gfOF0//!!",
                             orientation: ',',
                             cigar: "5M5I5M5D5S"
                         },
                         {
                             min: 13000000,
                             max: 15000000,
                             score: 4,
                             seq:  "GTCAGCTGCAGCAGTAGCGAAGACT",
                             quals: "++**//++aab021!!gfOF0//!!",
                             orientation: '-',
                             cigar: "5M5I5M5D5S"
                         },
                         {
                             min: 15000000,
                             max: 16000000,
                             score: 3,
                             seq:  "GTCAGCTGCAGCAGTAGCGAAGACT",
                             quals: "++**//++aab021!!gfOF0//!!",
                             orientation: '.',
                             cigar: "5M5I5M5D5S"
                         },
                         {
                             min: 16000000,
                             max: 18000000,
                             score: 1,
                             seq:  "GTCAGCTGCAGCAGTAGCGAAGACT",
                             quals: "++**//++aab021!!gfOF0//!!",
                             orientation: '-',
                             cigar: "5M5I5M5D5S"
                         }
                     ],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'HISTOGRAM',
                             MIN: 1,
                             MAX: 6,
                             STEPS: 6,
                             HEIGHT: '30',
                             COLOR1: 'red',
                             COLOR2: 'green',
                             COLOR3: 'blue',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, CROSS glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'CROSS',
                             HEIGHT: '12',
                             FGCOLOR: 'red',
                             COLOR_BY_SCORE2: 'yes',
                             COLOR1: 'red',
                             COLOR2: 'green',
                             COLOR3: 'blue',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, CROSS, SCATTER glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'CROSS',
                             HEIGHT: '13',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                             SCATTER: 'yes'
                         }
                     }],
                    }
                   
                   ,{name: 'Genes, BOX glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'BOX',
                             HEIGHT: '14',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'no',
                             LABEL: 'no',
                         }
                     }],
                    }
                   
                   ,{name: 'Genes, HIDDEN glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'HIDDEN',
                         }
                     }],
                    }
                   
                   ,{name: 'Genes, POINT glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'POINT',
                             HEIGHT: '15',
                             COLOR1: 'green',
                             COLOR2: 'green',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, ARROW glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'ARROW',
                             PARALLEL: 'yes',
                             SOUTHWEST: 'yes',
                             NORTHEAST: 'yes',
                             HEIGHT: '16',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         },
                     }],
                    }

                   ,{name: 'Genes, ANCHORED ARROW glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'ANCHORED_ARROW',
                             PARALLEL: 'yes',
                             SOUTHWEST: 'yes',
                             NORTHEAST: 'yes',
                             HEIGHT: '17',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, LINEPLOT glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'LINEPLOT',
                             HEIGHT: '30',
                             MAX: '5',
                             MIN: '0',
                             STEPS: '10',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, LINE glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'LINE',
                             HEIGHT: '18',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, PRIMERS glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'PRIMERS',
                             HEIGHT: '19',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }
                   
                   ,{name: 'Genes, SPAN glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'SPAN',
                             HEIGHT: '20',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, TEXT glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'TEXT',
                             FONT: 'courier',
                             FONTSIZE: '10',
                             STRING: 'test',
                             STYLE: 'bold',
                             HEIGHT: '9',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }
                   
                   ,{name: 'Genes, TOOMANY glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         score: 5
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: 'TOOMANY',
                             LINEWIDTH: '30',
                             HEIGHT: '20',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }

                   ,{name: 'Genes, __SEQUENCE glyph',
                     desc: 'Gene structures from GENCODE M2',
                     collapseSuperGroups: true,
                     tier_type: 'test-source',
                     features: [{
                         min: 11000000,
                         max: 18000000,
                         orientation: '-',
                         score: 5,
                         cigar: "3M1I3M1D5S"
                     }],
                     style: [{
                         type: 'default',
                         style: {
                             glyph: '__SEQUENCE',
                             HEIGHT: '21',
                             FGCOLOR: 'red',
                             BGCOLOR: 'red',
                             BUMP: 'yes',
                             LABEL: 'no',
                         }
                     }],
                    }],

    uiPrefix: '../',
    
    fullScreen: true,

    onFirstRender: checkRendering
});

function checkRendering() {
    fetch('reference-rendering.json')
        .then(function(resp) { return resp.json(); })
        .then(checkRendering2)
        .catch(function(err) {console.log(err)});
}

function checkRendering2(references) {
    references = references || {};

    const newReferences = {};
    const failingTiers = [];

    for (var ti = 0; ti < renderTestBrowser.tiers.length; ++ti) {
        const tier = renderTestBrowser.tiers[ti];
        const tierName = tier.dasSource.name;

        console.log('Testing ' + tierName);
        
        const tierData = tier.subtiers ? JSON.parse(JSON.stringify(tier.subtiers)) : [];
        const refData = references[tierName] || [];

        newReferences[tierName] = tierData;
        
        if (!compareObjects(tierData, refData)) {
            failingTiers.push(tierName);
        }
    }

    const refBlob = new Blob([JSON.stringify(newReferences, null, 2)]);

    document.body.appendChild(
        makeElement(
            'div', 
            [failingTiers.length == 0 
                ? makeElement('p', 'All tests passed')
                : makeElement('p', 'Mismatches for: ' + failingTiers.map(function(n) {return '"' + n + '"'}).join(', ') + " (see console for more details)", {}, {color: 'red'}),
             makeElement(
                 'p',
                 makeElement(
                     'a', 
                     'Export reference rendering',
                     {href: URL.createObjectURL(refBlob),
                      target: '_new'}
                 )
             )]
        )
    );
}

function compareObjects(o1, o2, depth, stack) {
    depth = depth || 0;
    stack = stack || [];

    if (typeof(o1) !== typeof(o2)) {
        printDeep("type mismatch!", depth);
        printDeep("o1: " + typeof(o1), depth);
        console.log(o1);
        printDeep("o2: " + typeof(o2), depth);
        console.log(o2);
        printDeep("stack:", depth);
        prettyStack(stack);
        console.log("-".repeat(depth));
        return false;
    } else {
        if (o1 === null || o1 === undefined && o1 === o2) {
            return o1 === o2;
        }

        if (o1 instanceof Array &&
            o2 instanceof Array) {

            if (o1.length === o2.length) {
                var cmp = true;
                for (var i = 0; i < o1.length; i++) {

                    stack.push({o1: o1[i], o2: o2[i]});
                    if (!compareObjects(o1[i], o2[i], depth+1, stack)) {
                        cmp = false;
                        printDeep("fail on element #" + i, depth);
                        console.log("-".repeat(depth));
                        break;
                    }
                }
                return cmp;
            } else {
                printDeep("Arrays of different lengths", depth);
                printDeep("o1: " + typeof(o1), depth);
                printDeep(o1.length, depth);
                console.log(o1);
                printDeep("o2: " + typeof(o2), depth);
                printDeep(o2.length, depth);
                console.log(o2);
                printDeep("stack:", depth);
                prettyStack(stack);
                console.log("-".repeat(depth));
                return false;
            }


        } else if (typeof(o1) === "object" && o1 && o2) {
            if (Object.keys(o1).length === Object.keys(o2).length ||
                Object.keys(o1).every(k => k in o2)) {

                var cmp = true;
                for (var k in o1) {
                    stack.push({o1: o1[k], o2: o2[k], key: k});
                    if (!compareObjects(o1[k], o2[k], depth+1, stack)) {
                        cmp = false;
                        printDeep("fail when recursing on key " + k, depth);
                        console.log("-".repeat(depth));
                        break;
                    }
                }
                return cmp;

            } else {
                printDeep("Objects have different keys:", depth);
                printDeep("o1: ", depth);
                console.log(Object.keys(o1));
                printDeep("o2: ", depth);
                console.log(Object.keys(o2));
                printDeep("stack:", depth);
                prettyStack(stack);
                console.log("-".repeat(depth));
                return false;
            }
        } else if (typeof(o1) === 'number' && typeof(o2) === 'number') {
            if (Math.abs(o1 - o2) <= Math.abs(Math.max(o1, o2)) * 1e-2) {
                return true;
            } else {
                printDeep("fail when comparing numbers", depth);
                printDeep("primitives not equal: ", depth);
                printDeep("o1: ", depth);
                console.log(o1);
                printDeep("o2: ", depth);
                console.log(o2);
                printDeep("stack:", depth);
                prettyStack(stack);
                console.log("-".repeat(depth));
                return false;
            }
        } else {
            if (o1 === o2) {
                return true;
            } else {
                printDeep("fail when comparing primitives", depth);
                printDeep("primitives not equal: ", depth);
                printDeep("o1: ", depth);
                console.log(o1);
                printDeep("o2: ", depth);
                console.log(o2);
                printDeep("stack:", depth);
                prettyStack(stack);
                console.log("-".repeat(depth));
                return false;
            }
        }
    }
}

function printDeep(str, d) {
    d = d || 0;

    console.log("/".repeat(d));
    console.log(str);
}


function prettyStack(stack) {
    stack.reverse().forEach(function (o, i) {printDeep(o, i)});
}
