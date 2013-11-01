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

        if (tier.stylesheet.styles.length > 0) {
            var s = tier.stylesheet.styles[0].style;
            if (s.BGCOLOR) {
                var oldCol = dasColourForName(s.BGCOLOR).toHexString();
                tierColorField.value = dasColourForName(s.BGCOLOR).toHexString();
            }
            glyphField.value = s.glyph;
        }

        var tierTable = makeElement('table',
            [makeElement('tr',
                [makeElement('th', 'Tier name:'),
                 tierNameField]),

             makeElement('tr',
                [makeElement('th', 'Colour (experimental)'),
                 tierColorField]),

             makeElement('tr',
                [makeElement('th', 'Glyph'),
                 makeElement('td', glyphField)])]);
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
            console.log(tierColorField.value);
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

        this.showToolPanel(tierForm);
        this.setUiMode('tier');
    }
}