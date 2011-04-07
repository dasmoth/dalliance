// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// slider.js: SVG+DOM slider control
//

function DSlider(width, opts) {
    if (!opts) {
        opts = {};
    }
    this.width = width;
    this.opts = opts;

    // privates

    var value = 0;
    var thisSlider = this;
    var sliderDeltaX;

    // Create SVG

    this.svg = document.createElementNS(NS_SVG, 'g');
    this.track = document.createElementNS(NS_SVG, 'path');
    this.track.setAttribute('fill', 'grey');
    this.track.setAttribute('stroke', 'grey');
    this.track.setAttribute('stroke-width', '1');
    this.track.setAttribute('d', 'M 0 35' +
                                 ' L ' + width + ' 35' +
                                 ' L ' + width + ' 15' +
                                 ' L 0 32 Z');
    this.svg.appendChild(this.track);

    this.handle = document.createElementNS(NS_SVG, 'rect');
    this.handle.setAttribute('x', -4);
    this.handle.setAttribute('y', 10);
    this.handle.setAttribute('width', 8);
    this.handle.setAttribute('height', 30);
    this.handle.setAttribute('stroke', 'none');
    this.handle.setAttribute('fill', 'blue');
    this.handle.setAttribute('fill-opacity', 0.5);
    this.svg.appendChild(this.handle);


    this.getValue = function() {
        return value;
    }

    this.setValue = function(v) {
        if (v < 0) {
            v = 0;
        } else if (v > this.width) {
            v = this.width;
        } 
        value = v;
        this.handle.setAttribute('x', value - 4);
    }

    this.setColor = function(c) {
        this.handle.setAttribute('fill', c);
    }

    this.onchange = null;

    var moveHandler = function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        var sliderX = Math.max(-4, Math.min(ev.clientX + sliderDeltaX, width - 4));
        thisSlider.handle.setAttribute('x', sliderX);
        value = sliderX + 4;
        if (thisSlider.onchange) {
            thisSlider.onchange(value, false);
        }
    }
    var upHandler = function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        if (thisSlider.onchange) {
            thisSlider.onchange(value, true);
        }
        document.removeEventListener('mousemove', moveHandler, true);
        document.removeEventListener('mouseup', upHandler, true);
    }

    this.handle.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        sliderDeltaX = thisSlider.handle.getAttribute('x') - ev.clientX;
        document.addEventListener('mousemove', moveHandler, true);
        document.addEventListener('mouseup', upHandler, true);
    }, false);
}