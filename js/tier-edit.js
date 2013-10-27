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
            tier.stylesheet.styles[0].style.BGCOLOR = tierColorField.value;
            tier.draw();
        }, false);

        this.showToolPanel(tierForm);
        this.setUiMode('tier');
    }
}