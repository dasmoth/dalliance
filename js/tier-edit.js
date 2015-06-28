/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tier-edit.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var utils = require('./utils');
    var makeElement = utils.makeElement;

    var das = require('./das');
    var isDasBooleanTrue = das.isDasBooleanTrue;
    var isDasBooleanNotFalse = das.isDasBooleanNotFalse;
    var copyStylesheet = das.copyStylesheet;

    var color = require('./color');
    var dasColourForName = color.dasColourForName;

    var sourceDataURI = require('./sourcecompare').sourceDataURI;
}

var __dalliance_smallGlyphs = {
    DOT: true, 
    EX: true, 
    STAR: true, 
    SQUARE: true, 
    CROSS: true, 
    TRIANGLE: true, 
    PLIMSOLL: true
};

Browser.prototype.openTierPanel = function(tier) {
    var b = this;

    if (this.uiMode === 'tier' && this.manipulatingTier === tier) {
        this.hideToolPanel();
        this.setUiMode('none');
    } else if (!tier) {
        return;
    } else {
        var setStyleColors = function(style) {
            if (style.BGGRAD)
                return;

            if (numColors == 1) {
                if (style.glyph == 'LINEPLOT' || __dalliance_smallGlyphs[style.glyph]) {
                    style.FGCOLOR = tierColorField.value;
                } else {
                    style.BGCOLOR = tierColorField.value;
                }
                style.COLOR1 = style.COLOR2 = style.COLOR3 = null;
            } else {
                style.COLOR1 = tierColorField.value;
                style.COLOR2 = tierColorField2.value;
                if (numColors > 2) {
                    style.COLOR3 = tierColorField3.value;
                } else {
                    style.COLOR3 = null;
                }
            }
            style._gradient = null;
            style._plusColor = tierPlusColorField.value;
            style._minusColor = tierMinusColorField.value;
        }

        var mutateStylesheet = function(visitor) {
            var nss = copyStylesheet(tier.stylesheet);
            var ssScale = tier.browser.zoomForCurrentScale();

            for (var i = 0; i < nss.styles.length; ++i) {
                var sh = nss.styles[i];
                if (sh.zoom && sh.zoom != ssScale) {
                    continue;
                }

                visitor(sh.style);
            }

            return nss;
        }

        var changeColor = function(ev) {
            tier.mergeStylesheet(mutateStylesheet(setStyleColors));
        }
        
        this.manipulatingTier = tier;

        var tierForm = makeElement('div', null, {className: 'tier-edit'});

        var aboutBanner = makeElement('div', "About '" + (tier.config.Name || tier.dasSource.name) + "'", null,
                {background: 'gray', paddingBottom: '5px', marginBottom: '5px', textAlign: 'center'});
        tierForm.appendChild(aboutBanner);

        var about = makeElement('div', 
            [makeElement('p', tier.dasSource.desc)]
        );
        var aboutNotes = [];
        var sduri = sourceDataURI(tier.dasSource);
        if (sduri &&
            (sduri.indexOf('http://') == 0 ||
             sduri.indexOf('https://') == 0 ||
             sduri.indexOf('//') == 0) &&
            sduri !== 'https://www.biodalliance.org/magic/no_uri')
        {
            aboutNotes.push(makeElement('li', makeElement('a', '(Download data)', {href: sduri})));
        }

        if (tier.dasSource.mapping) {
            var coords = this.chains[tier.dasSource.mapping].coords;
            aboutNotes.push(makeElement('li',  'Mapped from ' + coords.auth + coords.version));
        }

        if (aboutNotes.length > 0) {
            about.appendChild(makeElement('ul', aboutNotes));
        }
        
        tierForm.appendChild(about);

        var semanticBanner = makeElement('span', ' (styles for current zoom level)', null, {display: 'none'});
        var editBanner = makeElement('div', ['Edit', semanticBanner], null,
              {background: 'gray', paddingBottom: '5px', marginBottom: '5px', textAlign: 'center'});
        tierForm.appendChild(editBanner);

        var tierNameField = makeElement('input', null, {type: 'text'});
        var tierPinnedToggle = makeElement('input', null, {type: 'checkbox', disabled: this.disablePinning});

        var glyphField = makeElement('select');
        glyphField.appendChild(makeElement('option', 'Histogram', {value: 'HISTOGRAM'}));
        glyphField.appendChild(makeElement('option', 'Line Plot', {value: 'LINEPLOT'}));
        glyphField.appendChild(makeElement('option', 'Ribbon', {value: 'GRADIENT'}));
        glyphField.appendChild(makeElement('option', 'Scatter', {value: 'SCATTER'}));

        var tierColorField = makeElement('input', null, {type: 'text', value: '#dd00dd'});
        var tierColorField2 = makeElement('input', null, {type: 'text', value: '#dd00dd'});
        var tierColorField3 = makeElement('input', null, {type: 'text', value: '#dd00dd'});

        var tierPlusColorField = makeElement('input', null, {type: 'text', value: '#ffa07a'});
        var tierMinusColorField = makeElement('input', null, {type: 'text', value: '#87cefa'});

        try {
            tierColorField.type = tierColorField2.type = tierColorField3.type = 'color';
            tierPlusColorField.type = tierMinusColorField.type = 'color';
        } catch (e) {
            // IE throws if attempt to set type to 'color'.
        }

        var tierColorFields = [tierColorField, tierColorField2, tierColorField3];
        var colorListPlus = makeElement('i', null, {className: 'fa fa-plus-circle'});
        var colorListMinus = makeElement('i', null, {className: 'fa fa-minus-circle'});
        var numColors = 1;
        var colorListElement = makeElement('td', tierColorFields);
        var setNumColors = function(n) {
            numColors = n;
            for (var i = 0; i < n; ++i) 
                tierColorFields[i].style.display = 'block';
            for (var i = n; i < tierColorFields.length; ++i)
                tierColorFields[i].style.display = 'none';
        }
        colorListPlus.addEventListener('click', function(ev) {
            if (numColors < 3) {
                setNumColors(numColors + 1);
                changeColor(null);
            }
        }, false);
        colorListMinus.addEventListener('click', function(ev) {
            if (numColors > 1) {
                setNumColors(numColors - 1);
                changeColor(null);
            }
        }, false);

        var tierMinField = makeElement('input', null, {type: 'text', value: '0.0'});
        var tierMaxField = makeElement('input', null, {type: 'text', value: '10.0'});
        var tierMinToggle = makeElement('input', null, {type: 'checkbox'});
        var tierMaxToggle = makeElement('input', null, {type: 'checkbox'});

        var quantLeapToggle = makeElement('input', null, {type: 'checkbox', checked: tier.quantLeapThreshold !== undefined});
        var quantLeapThreshField = makeElement('input', null, {type: 'text', value: tier.quantLeapThreshold, disabled: !quantLeapToggle.checked});

        var tierHeightField = makeElement('input', null, {type: 'text', value: '50'});

        var bumpToggle = makeElement('input', null, {type: 'checkbox'});
        var bumpLimit = makeElement('input', null, {type: 'text'});
        var labelToggle = makeElement('input', null, {type: 'checkbox'});

        var mainStyle = null;
        if (tier.stylesheet.styles.length > 0) {
            var s = mainStyle = tier.stylesheet.styles[0].style;
        }

        var refresh = function() {
            if (typeof tier.config.name === 'string')
                tierNameField.value = tier.config.name;
            else 
                tierNameField.value = tier.dasSource.name;

            tierPinnedToggle.checked = tier.pinned;

            if (tier.forceHeight) {
                tierHeightField.value = '' + tier.forceHeight;
            } else if (mainStyle && mainStyle.HEIGHT) {
                tierHeightField.value = '' + mainStyle.HEIGHT;
            }

            if (typeof tier.quantLeapThreshold == 'number') {
                quantLeapToggle.checked = true;
                quantLeapThreshField.disabled = false;
                if (parseFloat(quantLeapThreshField.value) != tier.quantLeapThreshold)
                    quantLeapThreshField.value = tier.quantLeapThreshold;
            } else {
                quantLeapToggle.checked = false;
                quantLeapThreshField.disabled = true;
            }

            if (typeof tier.subtierMax == 'number') {
                bumpLimit.value = '' + tier.subtierMax;
            } else {
                bumpLimit.value = '' + (tier.dasSource.subtierMax || tier.browser.defaultSubtierMax);
            }

            if (tier.stylesheet.styles.length > 0) {
                var s = null;
                var isQuantitative=false, isSimpleQuantitative = false;
                var ssScale = tier.browser.zoomForCurrentScale();
                var activeStyleCount = 0;

                for (var si = 0; si < tier.stylesheet.styles.length; ++si) {
                    var sh = tier.stylesheet.styles[si];  
                    if (sh.zoom && sh.zoom != ssScale) {
                        continue;
                    }
                    ++activeStyleCount;
                    var ss = tier.stylesheet.styles[si].style;

                    if (!s) {
                        s = mainStyle = ss;
                    }
                    
                    if (ss.glyph == 'LINEPLOT' || ss.glyph == 'HISTOGRAM' || ss.glyph == 'GRADIENT' || isDasBooleanTrue(ss.SCATTER)) {
                        if (!isQuantitative)
                            s = mainStyle = ss;
                        isQuantitative = true;
                    }
                }
                if (!s) {
                    return;
                }

                semanticBanner.style.display = (activeStyleCount == tier.stylesheet.styles.length) ? 'none' : 'inline';

                isSimpleQuantitative = isQuantitative && activeStyleCount == 1;
                var isGradient = s.COLOR2 || s.BGGRAD;

                if (isQuantitative) {
                    minRow.style.display = 'table-row';
                    maxRow.style.display = 'table-row';
                    bumpRow.style.display = 'none';
                    labelRow.style.display = 'none';
                } else {
                    minRow.style.display = 'none';
                    maxRow.style.display = 'none';
                    bumpRow.style.display = 'table-row';
                    bumpToggle.checked = isDasBooleanTrue(mainStyle.BUMP);
                    bumpLimit.disabled = !isDasBooleanTrue(mainStyle.BUMP);
                    labelRow.style.display = 'table-row';
                    labelToggle.checked = isDasBooleanTrue(mainStyle.LABEL);
                }

                if (isSimpleQuantitative) {
                    styleRow.style.display = 'table-row';
                    colorRow.style.display = 'table-row';
                } else {
                    styleRow.style.display = 'none';
                    colorRow.style.display = 'none';

                }

                var numColors = 1;
                if (s.COLOR1) {
                    tierColorField.value = dasColourForName(s.COLOR1).toHexString();
                    if (s.COLOR2) {
                        tierColorField2.value = dasColourForName(s.COLOR2).toHexString();
                        if (s.COLOR3) {
                            tierColorField3.value = dasColourForName(s.COLOR3).toHexString();
                            numColors = 3;
                        } else {
                            numColors = 2;
                        }
                    }
                } else {
                    if (s.glyph == 'LINEPLOT' || s.glyph == 'DOT' && s.FGCOLOR) {
                        tierColorField.value = dasColourForName(s.FGCOLOR).toHexString();
                    } else if (s.BGCOLOR) {
                        tierColorField.value = dasColourForName(s.BGCOLOR).toHexString();
                    }
                } 
                setNumColors(numColors);

                if (s._plusColor)
                    tierPlusColorField.value = dasColourForName(s._plusColor).toHexString() || s._plusColor;
                if (s._minusColor)
                    tierMinusColorField.value = dasColourForName(s._minusColor).toHexString() || s._minusColor;
                if (isDasBooleanTrue(s.SCATTER)) {
                    glyphField.value = 'SCATTER';
                } else {
                    glyphField.value = s.glyph;
                } 

                var setMinValue, setMaxValue;
                if (s.MIN !== undefined) {
                    var x = parseFloat(s.MIN);
                    if (!isNaN(x))
                        setMinValue = x;
                }
                if (!tier.forceMinDynamic && (s.MIN !== undefined || tier.forceMin !== undefined)) {
                    tierMinToggle.checked = true;
                    tierMinField.disabled = false;
                } else {
                    tierMinToggle.checked = false;
                    tierMinField.disabled = true;
                }

                if (s.MAX !== undefined) {
                    var x = parseFloat(s.MAX)
                    if (!isNaN(x))
                        setMaxValue = x;
                }
                if (!tier.forceMaxDynamic && (s.MAX !== undefined || tier.forceMax !== undefined)) {
                    tierMaxToggle.checked = true;
                    tierMaxField.disabled = false;
                } else {
                    tierMaxToggle.checked = false;
                    tierMaxField.disabled = true;
                }

                if (tier.forceMin != undefined) {
                    setMinValue = tier.forceMin;
                }
                if (tier.forceMax != undefined) {
                    setMaxValue = tier.forceMax;
                }
                if (typeof(setMinValue) == 'number' && setMinValue != parseFloat(tierMinField.value)) {
                    tierMinField.value = setMinValue;
                }
                if (typeof(setMaxValue) == 'number' && setMaxValue != parseFloat(tierMaxField.value)) {
                    tierMaxField.value = setMaxValue;
                }

                var seqStyle = getSeqStyle(tier.stylesheet);
                if (seqStyle) {
                    seqMismatchRow.style.display = 'table-row';
                    seqMismatchToggle.checked = (seqStyle.__SEQCOLOR === 'mismatch');
                    seqInsertRow.style.display = 'table-row';
                    seqInsertToggle.checked =  isDasBooleanTrue(seqStyle.__INSERTIONS);
                    seqIgnoreQualsRow.style.display = 'table-row';
                    seqIgnoreQualsToggle.checked = (seqStyle.__disableQuals === undefined || seqStyle.__disableQuals === false);
                    console.log(seqStyle.__disableQuals);
                } else {
                    seqMismatchRow.style.display = 'none';
                    seqInsertRow.style.display = 'none';
                    seqIgnoreQualsRow.style.display = 'none';
                }

                if (seqStyle && seqMismatchToggle.checked && !isSimpleQuantitative) {
                    plusStrandColorRow.style.display = 'table-row';
                    minusStrandColorRow.style.display = 'table-row';
                } else {
                    plusStrandColorRow.style.display = 'none';
                    minusStrandColorRow.style.display = 'none';
                }
            }

            if (isQuantitative && tier.browser.sourceAdapterIsCapable(tier.featureSource, 'quantLeap'))
                quantLeapRow.style.display = 'table-row';
            else 
                quantLeapRow.style.display = 'none';
        }

        var seqMismatchToggle = makeElement('input', null, {type: 'checkbox'});
        var seqMismatchRow = makeElement('tr',
            [makeElement('th', 'Highlight mismatches & strands'),
             makeElement('td', seqMismatchToggle)]);
        seqMismatchToggle.addEventListener('change', function(ev) {
            var nss = copyStylesheet(tier.stylesheet);
            var seqStyle = getSeqStyle(nss);
            seqStyle.__SEQCOLOR = seqMismatchToggle.checked ? 'mismatch' : 'base';
            tier.mergeStylesheet(nss);
        });

        var seqInsertToggle = makeElement('input', null, {type: 'checkbox'});
        var seqInsertRow = makeElement('tr',
            [makeElement('th', 'Show insertions'),
             makeElement('td', seqInsertToggle)]);
        seqInsertToggle.addEventListener('change', function(ev) {
            var nss = copyStylesheet(tier.stylesheet);
            var seqStyle = getSeqStyle(nss);
            seqStyle.__INSERTIONS = seqInsertToggle.checked ? 'yes' : 'no';
            tier.mergeStylesheet(nss);
        });

        var seqIgnoreQualsToggle = makeElement('input', null, {type: 'checkbox'});
        var seqIgnoreQualsRow = makeElement('tr',
            [makeElement('th', 'Reflect base quality as base color transparency'),
             makeElement('td', seqIgnoreQualsToggle)]);
        seqIgnoreQualsToggle.addEventListener('change', function(ev) {
            var nss = copyStylesheet(tier.stylesheet);
            var seqStyle = getSeqStyle(nss);
            seqStyle.__disableQuals = !seqIgnoreQualsToggle.checked;
            console.log(seqStyle.__disableQuals);
            tier.mergeStylesheet(nss);
        });

        var styleRow = makeElement('tr',
                [makeElement('th', 'Style'),
                 makeElement('td', glyphField)]);
        var colorRow = makeElement('tr',
                [makeElement('th', ['Colour(s)', colorListPlus, colorListMinus]),
                 colorListElement]);
        var plusStrandColorRow = makeElement('tr',
                [makeElement('th', 'Plus Strand Color'),
                 makeElement('td', tierPlusColorField)]);
        var minusStrandColorRow = makeElement('tr',
                [makeElement('th', 'Minus Strand Color'),
                 makeElement('td', tierMinusColorField)]);
        var minRow = makeElement('tr',
                [makeElement('th', 'Min value'),
                 makeElement('td', [tierMinToggle, ' ', tierMinField])]);
        var maxRow = makeElement('tr',
                [makeElement('th', 'Max value'),
                 makeElement('td', [tierMaxToggle, ' ', tierMaxField])]);
        var quantLeapRow = 
             makeElement('tr',
                [makeElement('th', 'Threshold leap:'),
                 makeElement('td', [quantLeapToggle, ' ', quantLeapThreshField])]);
        var bumpRow = makeElement('tr',
                [makeElement('th', 'Bump overlaps'),
                 makeElement('td', [bumpToggle, ' limit: ', bumpLimit])]);
        var labelRow = makeElement('tr',
                [makeElement('th', 'Label features'),
                 makeElement('td', labelToggle)]);


        var tierTable = makeElement('table',
            [makeElement('tr',
                [makeElement('th', 'Name', {}, {width: '150px', textAlign: 'right'}),
                 tierNameField]),

             makeElement('tr',
                [makeElement('th', 'Pin to top'),
                 tierPinnedToggle]),

             makeElement('tr',
                [makeElement('th', 'Height'),
                 makeElement('td', tierHeightField)]),

            styleRow,
            colorRow,
            plusStrandColorRow,
            minusStrandColorRow,
            minRow,
            maxRow,
            quantLeapRow,
            bumpRow,
            labelRow,
            seqMismatchRow,
            seqInsertRow,
            seqIgnoreQualsRow
             ]);


        refresh();

        tierForm.appendChild(tierTable);

        var resetButton = makeElement('button', 'Reset track', {className: 'btn'}, {marginLeft: 'auto', marginRight: 'auto', display: 'block'});
        resetButton.addEventListener('click', function(ev) {
            tier.setConfig({});
        }, false);
        tierForm.appendChild(resetButton);

        tierNameField.addEventListener('input', function(ev) {
            tier.mergeConfig({name: tierNameField.value});
        }, false);

        tierPinnedToggle.addEventListener('change', function(ev) {
            tier.mergeConfig({pinned: tierPinnedToggle.checked});
        }, false);

        for (var ci = 0; ci < tierColorFields.length; ++ci) {
            tierColorFields[ci].addEventListener('change', changeColor, false);
        }

        tierPlusColorField.addEventListener('change', changeColor, false);
        tierMinusColorField.addEventListener('change', changeColor, false);

        glyphField.addEventListener('change', function(ev) {
            var nss = mutateStylesheet(function(ts) {
                if (glyphField.value === 'SCATTER') {
                    ts.SCATTER = true;
                    ts.glyph = 'DOT';
                    ts.SIZE = '3';
                } else {
                    ts.glyph = glyphField.value;
                    ts.SCATTER = undefined;
                }
                setStyleColors(ts);
            });
            tier.mergeStylesheet(nss);
        }, false);

        tierMinToggle.addEventListener('change', function(ev) {
            var conf = {forceMinDynamic: !tierMinToggle.checked};
            tierMinField.disabled = !tierMinToggle.checked;
            var x = parseFloat(tierMinField.value);
            if (tierMinToggle.checked && typeof(x) == 'number' && !isNaN(x))
                conf.forceMin = parseFloat(x);
            tier.mergeConfig(conf);
        });
        tierMinField.addEventListener('input', function(ev) {
            var x = parseFloat(tierMinField.value);
            if (typeof(x) == 'number' && !isNaN(x))
                tier.mergeConfig({forceMin: x});
        }, false);

        tierMaxToggle.addEventListener('change', function(ev) {
            var conf = {forceMaxDynamic: !tierMaxToggle.checked};
            tierMaxField.disabled = !tierMaxToggle.checked;
            var x = parseFloat(tierMaxField.value);
            if (tierMaxToggle.checked && typeof(x) == 'number' && !isNaN(x))
                conf.forceMax = parseFloat(x);
            tier.mergeConfig(conf);
        });
        tierMaxField.addEventListener('input', function(ev) {
            var x = parseFloat(tierMaxField.value);
            if (typeof(x) == 'number' && !isNaN(x))
                tier.mergeConfig({forceMax: x});
        }, false);

        tierHeightField.addEventListener('input', function(ev) {
            var x = parseFloat(tierHeightField.value);
            if (typeof(x) == 'number' && !isNaN(x))
                tier.mergeConfig({height: Math.min(500, x|0)});
        }, false);

        var updateQuant = function() {
            quantLeapThreshField.disabled = !quantLeapToggle.checked;
            if (quantLeapToggle.checked) {
                var x = parseFloat(quantLeapThreshField.value);
                if (typeof(x) == 'number' && !isNaN(x)) {
                    tier.mergeConfig({quantLeapThreshold: parseFloat(quantLeapThreshField.value)});
                }
            } else {
                tier.mergeConfig({quantLeapThreshold: null});
            }
        }
        quantLeapToggle.addEventListener('change', function(ev) {
            updateQuant();
        }, false);
        quantLeapThreshField.addEventListener('input', function(ev) {
            updateQuant();
        }, false);

        labelToggle.addEventListener('change', function(ev) {
            var nss = mutateStylesheet(function(style) {
                style.LABEL = labelToggle.checked ? 'yes' : 'no';
            });
            tier.mergeStylesheet(nss);
        }, false);
        bumpToggle.addEventListener('change', function(ev) {
            var nss = mutateStylesheet(function(style) {
                style.BUMP = bumpToggle.checked ? 'yes' : 'no';
            });
            tier.mergeStylesheet(nss);
        }, false);
        bumpLimit.addEventListener('input', function(ev) {
            var x = parseInt(bumpLimit.value);
            if (typeof(x) == 'number' && x > 0) {
                tier.mergeConfig({subtierMax: x});
            }
        }, false);


        this.showToolPanel(tierForm);
        this.setUiMode('tier');

        tier.addTierListener(refresh);

        var currentScale = tier.browser.scale;
        tier.browser.addViewListener(function() {
            if (tier.browser.scale != currentScale) {
                currentScale = tier.browser.scale;
                refresh();
            }
        });
    }
}

function getSeqStyle(stylesheet) {
    for (var si = 0; si < stylesheet.styles.length; ++si) {
        var ss = stylesheet.styles[si].style;
        if (ss.glyph === '__SEQUENCE') {
            return ss;
        }
    }
}

