/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// quant-config.js: configuration of quantitatively-scaled tiers
//

var VALID_BOUND_RE = new RegExp('^-?[0-9]+(\\.[0-9]+)?$');

function makeQuantConfigButton(quantTools, tier, ypos) {
    quantTools.addEventListener('mousedown', function(ev) {
	ev.stopPropagation(); ev.preventDefault();
	removeAllPopups();

	var mx =  ev.clientX, my = ev.clientY;
	mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
	my +=  document.documentElement.scrollTop || document.body.scrollTop;
	
	var popup = makeElement('div');
	var winWidth = window.innerWidth;
	popup.style.position = 'absolute';
	popup.style.top = '' + (my + 30) + 'px';
	popup.style.left = '' + Math.min((mx - 30), (winWidth-410)) + 'px';
	popup.style.width = '200px';
	popup.style.backgroundColor = 'white';
	popup.style.borderWidth = '1px';
	popup.style.borderColor = 'black'
	popup.style.borderStyle = 'solid';
	popup.style.padding = '2px';

	popup.appendChild(document.createTextNode('Configure: ' + tier.source.name));
	
	var form = makeElement('table');
	var minInput = makeElement('input', '', {value: tier.min});
        form.appendChild(makeElement('tr', [makeElement('td', 'Min:'), makeElement('td', minInput)]));
	var maxInput = makeElement('input', '', {value: tier.max});
        form.appendChild(makeElement('tr', [makeElement('td', 'Max:'), makeElement('td', maxInput)]));
        
	popup.appendChild(form);
	
	var updateButton = makeElement('div', 'Update');
        updateButton.style.backgroundColor = 'rgb(230,230,250)';
        updateButton.style.borderStyle = 'solid';
        updateButton.style.borderColor = 'blue';
        updateButton.style.borderWidth = '3px';
        updateButton.style.padding = '2px';
        updateButton.style.margin = '10px';
        updateButton.style.width = '150px';
	popup.appendChild(updateButton);

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

	    tier.source.opts.forceMin = minInput.value;
	    tier.source.opts.forceMax = maxInput.value;
	    removeAllPopups();
	    dasRequestComplete(tier);
            storeStatus();          // write updated limits to storage.
	}, false);

	hPopupHolder.appendChild(popup);
    }, false);
}
