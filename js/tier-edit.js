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
        this.manipulatingTier = tier;

        var tierForm = makeElement('div');

        var tierNameField = makeElement('input', null, {type: 'text', value: tier.dasSource.name});
        var glyphField = makeElement('select');
        glyphField.appendChild(makeElement('option', 'Histogram', {value: 'HISTOGRAM'}));
        glyphField.appendChild(makeElement('option', 'Line Plot', {value: 'LINEPLOT'}));
        glyphField.appendChild(makeElement('option', 'Ribbon', {value: 'GRADIENT'}));


        var tierColorField = makeElement('input', null, {type: 'color', value: '#dd00dd'});

        var tierMinField = makeElement('input', null, {type: 'text', value: '0.0'});
        var tierMaxField = makeElement('input', null, {type: 'text', value: '10.0'});

        var quantLeapToggle = makeElement('input', null, {type: 'checkbox', checked: tier.quantLeapThreshold !== undefined});
        var quantLeapThreshField = makeElement('input', null, {type: 'text', value: tier.quantLeapThreshold, disabled: !quantLeapToggle.checked});

        if (tier.stylesheet.styles.length > 0) {
            var s = tier.stylesheet.styles[0].style;
            if (s.BGCOLOR) {
                var oldCol = dasColourForName(s.BGCOLOR).toHexString();
                tierColorField.value = dasColourForName(s.BGCOLOR).toHexString();
            }
            glyphField.value = s.glyph;

            if (s.MIN !== undefined) {
                tierMinField.value = s.MIN;
            }
            if (s.MAX !== undefined) {
                tierMaxField.value = s.MAX;
            }
        }

        if (tier.dasSource.forceMin) {
            tierMinField.value = tier.dasSource.forceMin;
        }
        if (tier.dasSource.forceMax) {
            tierMaxField.value = tier.dasSource.forceMax;
        }

        var tierTable = makeElement('table',
            [makeElement('tr',
                [makeElement('th', 'Tier name:'),
                 tierNameField]),

             makeElement('tr',
                [makeElement('th', 'Colour'),
                 tierColorField]),

             makeElement('tr',
                [makeElement('th', 'Glyph'),
                 makeElement('td', glyphField)]),

             makeElement('tr',
                [makeElement('th', 'Min value:'),
                 makeElement('td', tierMinField)]),

             makeElement('tr',
                [makeElement('th', 'Max value:'),
                 makeElement('td', tierMaxField)]),

             makeElement('tr',
                [makeElement('th', 'Threshold-leap'),
                 makeElement('td', quantLeapToggle)]),

             makeElement('tr',
                [makeElement('th', 'Threshold:'),
                 makeElement('td', quantLeapThreshField)]),
             ]);


        tierForm.appendChild(tierTable);

        tierNameField.addEventListener('input', function(ev) {
            tier.nameElement.innerText = tier.dasSource.name = tierNameField.value;
        }, false);

        var redrawTimeout = null;
        function scheduleRedraw() {
            if (!redrawTimeout) {
                redrawTimeout = setTimeout(function() {
                    tier.draw();
                    redrawTimeout = null;
                }, 10);
            }
        }

        tierColorField.addEventListener('change', function(ev) {
            for (var i = 0; i < tier.stylesheet.styles.length; ++i) {
                tier.stylesheet.styles[i].style.BGCOLOR = tierColorField.value;
            }
            scheduleRedraw();
        }, false);

        glyphField.addEventListener('change', function(ev) {
            for (var i = 0; i < tier.stylesheet.styles.length; ++i) {
                tier.stylesheet.styles[i].style.glyph = glyphField.value;
            }
            scheduleRedraw();
        }, false);

        tierMinField.addEventListener('input', function(ev) {
            tier.dasSource.forceMin = parseFloat(tierMinField.value);
            scheduleRedraw();
        }, false);

        tierMaxField.addEventListener('input', function(ev) {
            tier.dasSource.forceMax = parseFloat(tierMaxField.value);
            scheduleRedraw();
        }, false);

        function updateQuant() {
            quantLeapThreshField.disabled = !quantLeapToggle.checked;
            if (quantLeapToggle.checked) {
                tier.quantLeapThreshold = parseFloat(quantLeapThreshField.value);
            } else {
                tier.quantLeapThreshold = null;
            }
            scheduleRedraw();
        }
        quantLeapToggle.addEventListener('change', function(ev) {
            updateQuant();
        }, false);
        quantLeapThreshField.addEventListener('input', function(ev) {
            updateQuant();
        }, false);


        this.showToolPanel(tierForm);
        this.setUiMode('tier');
    }
}