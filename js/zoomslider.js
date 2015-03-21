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

function makeZoomSlider(opts) {
    opts = opts || {};
    
    var minPos = 0, maxPos = opts.width || 200;
    var min = 0, max = 200;
    var pos = 50, pos2 = 100;
    var labels = [];
    var track = makeElement('hr', null, {className: 'slider-track'}, {width: '' + (maxPos|0) + 'px'});
    var thumb = makeElement('hr', null, {className: 'slider-thumb active'});
    var thumb2 = makeElement('hr', null, {className: 'slider-thumb'});
    var slider = makeElement('div', [track, thumb, thumb2], {className: 'slider'},  {width: '' + ((maxPos|0) + 10) + 'px'});

    slider.removeLabels = function() {
        for (var li = 0; li < labels.length; ++li) {
            slider.removeChild(labels[li]);
        }
        labels = [];
    }

    slider.addLabel = function(val, txt) {
        var pos = (minPos + ((val - min) * (maxPos - minPos))/(max-min))|0;
        var label = makeElement('div', txt, {className: 'slider-label'}, {
            left: '' + ((minPos + ((val - min) * (maxPos - minPos))/(max-min))|0) + 'px'
        });
        slider.appendChild(label);
        labels.push(label);
    }

    var onChange = document.createEvent('HTMLEvents');
    onChange.initEvent('change', true, false);

    function setPos(np) {
        np = Math.min(np, maxPos);
        np = Math.max(np, minPos);
        pos = np;
        thumb.style.left = '' + pos + 'px';
    }

    function setPos2(np) {
        np = Math.min(np, maxPos);
        np = Math.max(np, minPos);
        pos2 = np;
        thumb2.style.left = '' + pos2 + 'px';
    }

    Object.defineProperty(slider, 'value', {
        get: function()  {return min + (((pos-minPos) * (max-min)) / (maxPos - minPos));},
        set: function(v) {
          var np = minPos + ((v-min) * (maxPos-minPos))/(max-min);
          setPos(np);
        }
    });

    Object.defineProperty(slider, 'value2', {
        get: function()  {return min + (((pos2-minPos) * (max-min)) / (maxPos - minPos));},
        set: function(v) {
          var np = minPos + ((v-min) * (maxPos-minPos))/(max-min);
          setPos2(np);
        }
    });

    Object.defineProperty(slider, 'active', {
        get: function() {return thumb.classList.contains('active') ? 1 : 2},
        set: function(x) {
            if (x == 1) {
                thumb.classList.add('active');
                thumb2.classList.remove('active');
            } else {
                thumb2.classList.add('active');
                thumb.classList.remove('active');
            }
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
    var which;

    var thumbMouseDown = function(ev) {
        which = this == thumb ? 1 : 2;
        if (which != slider.active) {
            slider.active = which;
            slider.dispatchEvent(onChange);
        }
        ev.stopPropagation(); ev.preventDefault();
        window.addEventListener('mousemove', thumbDragHandler, false);
        window.addEventListener('mouseup', thumbDragEndHandler, false);
        offset = ev.clientX - (which == 1 ? pos : pos2);
    };

    thumb.addEventListener('mousedown', thumbMouseDown, false);
    thumb2.addEventListener('mousedown', thumbMouseDown, false);

    var thumbDragHandler = function(ev) {
        if (which == 1)
            setPos(ev.clientX - offset);
        else
            setPos2(ev.clientX - offset);
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
