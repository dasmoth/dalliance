/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// quant-config.js: configuration of quantitatively-scaled tiers
//

var VALID_BOUND_RE = new RegExp('^-?[0-9]+(\\.[0-9]+)?$');

Browser.prototype.makeQuantConfigButton = function(quantTools, tier, ypos) {
    var thisB = this;
    quantTools.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        thisB.removeAllPopups();

        var form = makeElement('table');
        var minInput = makeElement('input', '', {value: tier.min});
        form.appendChild(makeElement('tr', [makeElement('td', 'Min:'), makeElement('td', minInput)]));
        var maxInput = makeElement('input', '', {value: tier.max});
        form.appendChild(makeElement('tr', [makeElement('td', 'Max:'), makeElement('td', maxInput)]));
        
        var updateButton = makeElement('div', 'Update');
        updateButton.style.backgroundColor = 'rgb(230,230,250)';
        updateButton.style.borderStyle = 'solid';
        updateButton.style.borderColor = 'blue';
        updateButton.style.borderWidth = '3px';
        updateButton.style.padding = '2px';
        updateButton.style.margin = '10px';
        updateButton.style.width = '150px';

        updateButton.addEventListener('mousedown', function(ev) {
            ev.stopPropagation(); ev.preventDefault();

            if (!VALID_BOUND_RE.test(minInput.value)) {
                alert("Don't understand " + minInput.value);
                return;
            }
            if (!VALID_BOUND_RE.test(maxInput.value)) {
                alert("Don't understand " + maxInput.value);
                return;
            }

            tier.dasSource.forceMin = minInput.value;
            tier.dasSource.forceMax = maxInput.value;
            thisB.removeAllPopups();
            tier.draw();
            thisB.storeStatus();          // write updated limits to storage.
        }, false);

        thisB.popit(ev, 'Configure: ' + tier.dasSource.name, [form, updateButton]);
    }, false);
}
