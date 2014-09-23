/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// zoomslider.js: custom slider component
//


"use strict";

if (typeof(require) !== 'undefined') {
    var utils = require('./utils');
    var makeElement = utils.makeElement;
}

function makeZoomSlider() {
    var track = makeElement('hr', null, {className: 'slider-track'});
    var thumb = makeElement('hr', null, {className: 'slider-thumb'});
    var slider = makeElement('div', [track, thumb], {className: 'slider'});
    var minPos = 0, maxPos = 200;
    var min = 0, max = 200;
    var pos = 50;

    var onChange = document.createEvent('HTMLEvents');
    onChange.initEvent('change', true, false);

    function setPos(np) {
        np = Math.min(np, maxPos);
        np = Math.max(np, minPos);
        pos = np;
        thumb.style.left = '' + pos + 'px';
    }

    Object.defineProperty(slider, 'value', {
        get: function()  {return min + ((pos * (max-min)) / (maxPos - minPos));},
        set: function(v) {
          var np = minPos + (v * (maxPos-minPos))/(max-min);
          setPos(np);
        }
    });

    Object.defineProperty(slider, 'min', {
      get: function() {return min},
      set: function(v) {min = v}
    });

    Object.defineProperty(slider, 'max', {
      get: function() {return max},
      set: function(v) {max = v}
    });

    var offset;

    thumb.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        window.addEventListener('mousemove', thumbDragHandler, false);
        window.addEventListener('mouseup', thumbDragEndHandler, false);
        offset = ev.clientX - pos;
    }, false);

    var thumbDragHandler = function(ev) {
        setPos(ev.clientX - offset);
        slider.dispatchEvent(onChange);
    };

    var thumbDragEndHandler = function(ev) {
        window.removeEventListener('mousemove', thumbDragHandler, false);
        window.removeEventListener('mouseup', thumbDragEndHandler, false);
    }

    return slider;
}

if (typeof(module) !== 'undefined') {
    module.exports = makeZoomSlider;
}
