/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// tier-edit.js
//

Browser.prototype.openTierPanel = function(tier) {
    var b = this;

    if (this.uiMode === 'tier' && this.manipulatingTier === tier) {
        this.hideToolPanel();
        this.setUiMode('none');
    } else {
        function changeColor(ev) {
            for (var i = 0; i < tier.stylesheet.styles.length; ++i) {
                var style = tier.stylesheet.styles[i].style;
                if (style.BGGRAD)
                    return;

                if (numColors == 1) {
                    if (style.glyph == 'LINEPLOT' || style.glyph == 'DOT') {
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
            }
            tier.scheduleRedraw();
        }
        
        this.manipulatingTier = tier;

        var tierForm = makeElement('div', null, {className: 'tier-edit'});

        var tierNameField = makeElement('input', null, {type: 'text'});
        var glyphField = makeElement('select');
        glyphField.appendChild(makeElement('option', 'Histogram', {value: 'HISTOGRAM'}));
        glyphField.appendChild(makeElement('option', 'Line Plot', {value: 'LINEPLOT'}));
        glyphField.appendChild(makeElement('option', 'Ribbon', {value: 'GRADIENT'}));
        glyphField.appendChild(makeElement('option', 'Scatter', {value: 'SCATTER'}));


        var tierColorField = makeElement('input', null, {type: 'color', value: '#dd00dd'});
        var tierColorField2 = makeElement('input', null, {type: 'color', value: '#dd00dd'});
        var tierColorField3 = makeElement('input', null, {type: 'color', value: '#dd00dd'});
        var tierColorFields = [tierColorField, tierColorField2, tierColorField3];
        var colorListPlus = makeElement('i', null, {className: 'fa fa-plus-circle'});
        var colorListMinus = makeElement('i', null, {className: 'fa fa-minus-circle'});
        var numColors = 1;
        var colorListElement = makeElement('td');
        function setNumColors(n) {
            numColors = n;
            removeChildren(colorListElement);
            for (var i = 0; i < n; ++i)
                colorListElement.appendChild(tierColorFields[i]);
            changeColor(null);
        }
        colorListPlus.addEventListener('click', function(ev) {
            if (numColors < 3)
                setNumColors(numColors + 1);
        }, false);
        colorListMinus.addEventListener('click', function(ev) {
            if (numColors > 1)
                setNumColors(numColors - 1);
        }, false);

        var tierMinField = makeElement('input', null, {type: 'text', value: '0.0'});
        var tierMaxField = makeElement('input', null, {type: 'text', value: '10.0'});
        var tierMinToggle = makeElement('input', null, {type: 'checkbox'});
        var tierMaxToggle = makeElement('input', null, {type: 'checkbox'});

        var quantLeapToggle = makeElement('input', null, {type: 'checkbox', checked: tier.quantLeapThreshold !== undefined});
        var quantLeapThreshField = makeElement('input', null, {type: 'text', value: tier.quantLeapThreshold, disabled: !quantLeapToggle.checked});

        var tierHeightField = makeElement('input', null, {type: 'text', value: '50'});

        var seqStyle = null;
        var mainStyle = null;
        if (tier.stylesheet.styles.length > 0) {
            var s = mainStyle = tier.stylesheet.styles[0].style;

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

            if (isDasBooleanTrue(s.SCATTER)) {
                glyphField.value = 'SCATTER';
            } else {
                glyphField.value = s.glyph;
            }

            for (var si = 0; si < tier.stylesheet.styles.length; ++si) {
                var ss = tier.stylesheet.styles[si].style;
                if (ss.glyph === '__SEQUENCE') {
                    seqStyle = ss; break;
                }
            }
        }

        setNumColors(numColors);

        function refresh() {
            if (typeof tier.config.name === 'string')
                tierNameField.value = tier.config.name;
            else 
                tierNameField.value = tier.dasSource.name;

            if (tier.forceHeight) {
                tierHeightField.value = '' + tier.forceHeight;
            } else if (mainStyle && mainStyle.HEIGHT) {
                tierHeightField.value = '' + mainStyle.HEIGHT;
            }

            if (typeof tier.quantLeapThreshold == 'number') {
                quantLeapToggle.checked = true;
                quantLeapThreshField.disabled = false;
                quantLeapThreshField.value = tier.quantLeapThreshold;
            } else {
                quantLeapToggle.checked = false;
                quantLeapThreshField.disabled = true;
            }

            if (tier.stylesheet.styles.length > 0) {
                var s = mainStyle = tier.stylesheet.styles[0].style;

                /*
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

                if (isDasBooleanTrue(s.SCATTER)) {
                    glyphField.value = 'SCATTER';
                } else {
                    glyphField.value = s.glyph;
                } */

                if (s.MIN !== undefined) {
                    tierMinField.value = s.MIN;
                }
                if (!tier.forceMinDynamic && s.MIN !== undefined) {
                    tierMinToggle.checked = true;
                } else {
                    tierMinField.disabled = true;
                }

                if (s.MAX !== undefined) {
                    tierMaxField.value = s.MAX;
                }
                if (!tier.forceMaxDynamic && s.MAX !== undefined) {
                    tierMaxToggle.checked = true;
                } else {
                    tierMaxField.disabled = true;
                }

                if (tier.forceMin != undefined) {
                    tierMinField.value = tier.forceMin;
                }
                if (tier.forceMax != undefined) {
                    tierMaxField.value = tier.forceMax;
                }

                /*
                for (var si = 0; si < tier.stylesheet.styles.length; ++si) {
                    var ss = tier.stylesheet.styles[si].style;
                    if (ss.glyph === '__SEQUENCE') {
                        seqStyle = ss; break;
                    }
                } */
            }
        }
        refresh();

        var tierTable = makeElement('table',
            [makeElement('tr',
                [makeElement('th', 'Tier name:', {}, {width: '150px', textAlign: 'right'}),
                 tierNameField]),

            makeElement('tr',
                [makeElement('th', 'Style'),
                 makeElement('td', glyphField)]),

             makeElement('tr',
                [makeElement('th', ['Colour(s)', colorListPlus, colorListMinus]),
                 colorListElement]),

             makeElement('tr',
                [makeElement('th', 'Min value:'),
                 makeElement('td', [tierMinToggle, ' ', tierMinField])]),

             makeElement('tr',
                [makeElement('th', 'Max value:'),
                 makeElement('td', [tierMaxToggle, ' ', tierMaxField])]),

             makeElement('tr',
                [makeElement('th', 'Height'),
                 makeElement('td', tierHeightField)]),

             makeElement('tr',
                [makeElement('th', 'Threshold leap:'),
                 makeElement('td', [quantLeapToggle, ' ', quantLeapThreshField])])
             ]);

        if (seqStyle) {
            var seqMismatchToggle = makeElement('input', null, {type: 'checkbox', checked: seqStyle.__SEQCOLOR === 'mismatch'});
            tierTable.appendChild(makeElement('tr',
                [makeElement('th', 'Color mismatches'),
                 makeElement('td', seqMismatchToggle)]));
            seqMismatchToggle.addEventListener('change', function(ev) {
                seqStyle.__SEQCOLOR = seqMismatchToggle.checked ? 'mismatch' : 'base';
                tier.scheduleRedraw();
            });

            var seqInsertToggle = makeElement('input', null, {type: 'checkbox', checked: isDasBooleanTrue(seqStyle.__INSERTIONS)});
            tierTable.appendChild(makeElement('tr',
                [makeElement('th', 'Show insertions (experimental)'),
                 makeElement('td', seqInsertToggle)]));
            seqInsertToggle.addEventListener('change', function(ev) {
                seqStyle.__INSERTIONS = seqInsertToggle.checked ? 'yes' : 'no';
                tier.scheduleRedraw();
            });
        }


        tierForm.appendChild(tierTable);

        var resetButton = makeElement('button', 'Reset track', {className: 'btn'}, {marginLeft: 'auto', marginRight: 'auto', display: 'block'});
        resetButton.addEventListener('click', function(ev) {
            tier.setConfig({});
        }, false);
        tierForm.appendChild(resetButton);

        tierNameField.addEventListener('input', function(ev) {
            tier.mergeConfig({name: tierNameField.value});
        }, false);



        for (var ci = 0; ci < tierColorFields.length; ++ci) {
            tierColorFields[ci].addEventListener('change', changeColor, false);
        }

        glyphField.addEventListener('change', function(ev) {
            for (var i = 0; i < tier.stylesheet.styles.length; ++i) {
                var ts = tier.stylesheet.styles[i].style;

                if (glyphField.value === 'SCATTER') {
                    ts.SCATTER = true;
                    ts.glyph = 'DOT';
                    ts.SIZE = '3';
                } else {
                    ts.glyph = glyphField.value;
                }
            }
            changeColor(); // Also calls scheduleRedraw.
        }, false);

        tierMinToggle.addEventListener('change', function(ev) {
            var conf = {forceMinDynamic: !tierMinToggle.checked};
            tierMinField.disabled = !tierMinToggle.checked;
            if (tierMinToggle.checked && !Number.isNaN(parseFloat(tierMinField.value)))
                conf.forceMin = parseFloat(tierMinField.value);
            tier.mergeConfig(conf);
        });
        tierMinField.addEventListener('input', function(ev) {
            var x = parseFloat(tierMinField.value);
            if (!Number.isNaN(x))
                tier.mergeConfig({forceMin: x});
        }, false);

        tierMaxToggle.addEventListener('change', function(ev) {
            var conf = {forceMaxDynamic: !tierMaxToggle.checked};
            tierMaxField.disabled = !tierMaxToggle.checked;
            if (tierMaxToggle.checked && !Number.isNaN(parseFloat(tierMaxField.value)))
                conf.forceMax = parseFloat(tierMaxField.value);
            tier.mergeConfig(conf);
        });
        tierMaxField.addEventListener('input', function(ev) {
            var x = parseFloat(tierMaxField.value);
            if (!Number.isNaN(x))
                tier.mergeConfig({forceMax: x});
        }, false);

        tierHeightField.addEventListener('input', function(ev) {
            var x = parseFloat(tierHeightField.value);
            if (!Number.isNaN(x))
                tier.mergeConfig({height: Math.min(500, x|0)});
        }, false)

        function updateQuant() {
            quantLeapThreshField.disabled = !quantLeapToggle.checked;
            if (quantLeapToggle.checked) {
                var x = parseFloat(quantLeapThreshField.value);
                if (!Number.isNaN(x)) {
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


        this.showToolPanel(tierForm);
        this.setUiMode('tier');

        tier.addTierListener(refresh);
    }
}