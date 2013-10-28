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
        var tierColorField = makeElement('input', null, {type: 'color', value: '#dd00dd'});

        if (tier.stylesheet.styles.length > 0) {
            var s = tier.stylesheet.styles[0].style;
            if (s.BGCOLOR) {
                tierColorField.value = dasColourForName(s.BGCOLOR).toHexString();
            }
        }

        var tierTable = makeElement('table',
            [makeElement('tr',
                [makeElement('th', 'Tier name:'),
                 tierNameField]),
             makeElement('tr',
                [makeElement('th', 'Colour (experimental)'),
                 tierColorField])]);
        tierForm.appendChild(tierTable);

        tierNameField.addEventListener('input', function(ev) {
            tier.nameElement.innerText = tierNameField.value;
        }, false);

        tierColorField.addEventListener('change', function(ev) {
            console.log(tierColorField.value);
            for (var i = 0; i < tier.stylesheet.styles.length; ++i) {
                tier.stylesheet.styles[i].style.BGCOLOR = tierColorField.value;
            }
            tier.draw();
        }, false);

        this.showToolPanel(tierForm);
        this.setUiMode('tier');
    }
}