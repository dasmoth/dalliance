/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// quant-config.js: configuration of quantitatively-scaled tiers
//

function makeQuantConfigButton(labelGroup, tier, ypos) {
    var button = icons.createIcon('magnifier', labelGroup);
    button.setAttribute('transform', 'translate(80, ' + (ypos+20) + '), scale(0.6,0.6)');

    // FIXME style-changes don't currently work because of the way icons get grouped.
    button.addEventListener('mouseover', function(ev) {
	button.setAttribute('fill', 'red');
    }, false);
    button.addEventListener('mouseout', function(ev) {
	button.setAttribute('stroke', 'gray');
    }, false);

    button.addEventListener('mousedown', function(ev) {
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

	popup.appendChild(document.createTextNode('Configure tier'));
	
	var form = makeElement('div');
	form.appendChild(document.createTextNode('Min:'));
	var minInput = makeElement('input', '', {value: tier.min});
	form.appendChild(minInput);
	form.appendChild(makeElement('br'));
	form.appendChild(document.createTextNode('Max:'));
	var maxInput = makeElement('input', '', {value: tier.max});
	form.appendChild(maxInput);
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

	    tier.forceMin = minInput.value;
	    tier.forceMax = maxInput.value;
	    removeAllPopups();
	    dasRequestComplete(tier);
	}, false);

	hPopupHolder.appendChild(popup);
    }, false);
    
    labelGroup.appendChild(button);
}
