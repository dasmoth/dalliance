/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// domui.js: SVG UI components
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var utils = require('./utils');
    var makeElement = utils.makeElement;
    var removeChildren = utils.removeChildren;
}

Browser.prototype.removeAllPopups = function() {
    for (var pi = 0; pi < this.popups.length; ++pi) {
        var popup = this.popups[pi];
        if (popup.onClose) {
            try {
                popup.onClose();
            } catch (ex) {
                console.log(ex);
            }
        }
        this.hPopupHolder.removeChild(popup.component);
    }
    this.popups = [];
}

Browser.prototype.makeTooltip = function(ele, text)
{
    ele.title = text;
}

Browser.prototype.popit = function(ev, name, ele, opts)
{
    var thisB = this;
    if (!opts) 
        opts = {};
    if (!ev) 
        ev = {};

    var width = opts.width || 200;

    var mx, my;

    if (ev.clientX) {
        var mx =  ev.clientX, my = ev.clientY;
    } else {
        mx = 500; my= 50;
    }
    mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
    my +=  document.documentElement.scrollTop || document.body.scrollTop;
    var winWidth = window.innerWidth;

    var top = my;
    var left = Math.min(mx - (width/2) - 4, (winWidth - width - 30));

    var popup = makeElement('div');
    popup.className = 'popover fade ' + (ev.clientX ? 'bottom ' : '') + 'in';
    popup.style.display = 'block';
    popup.style.position = 'absolute';
    popup.style.top = '' + top + 'px';
    popup.style.left = '' + left + 'px';
    popup.style.width = width + 'px';
    if (width > 276) {
        // HACK Bootstrappification...
        popup.style.maxWidth = width + 'px';
    }

    popup.appendChild(makeElement('div', null, {className: 'arrow'}));

    if (name) {
        var closeButton = makeElement('button', '', {className: 'close'});
        closeButton.innerHTML = '&times;'

        closeButton.addEventListener('mouseover', function(ev) {
            closeButton.style.color = 'red';
        }, false);
        closeButton.addEventListener('mouseout', function(ev) {
            closeButton.style.color = 'black';
        }, false);
        closeButton.addEventListener('click', function(ev) {
            ev.preventDefault(); ev.stopPropagation();
            thisB.removeAllPopups();
        }, false);
        var tbar = makeElement('h4', [makeElement('span', name, null, {maxWidth: '200px'}), closeButton], {/*className: 'popover-title' */}, {paddingLeft: '10px', paddingRight: '10px'});

        var dragOX, dragOY;
        var moveHandler, upHandler;
        moveHandler = function(ev) {
            ev.stopPropagation(); ev.preventDefault();
            left = left + (ev.clientX - dragOX);
            if (left < 8) {
                left = 8;
            } if (left > (winWidth - width - 32)) {
                left = (winWidth - width - 26);
            }
            top = top + (ev.clientY - dragOY);
            top = Math.max(10, top);
            popup.style.top = '' + top + 'px';
            popup.style.left = '' + Math.min(left, (winWidth - width - 10)) + 'px';
            dragOX = ev.clientX; dragOY = ev.clientY;
        }
        upHandler = function(ev) {
            ev.stopPropagation(); ev.preventDefault();
            window.removeEventListener('mousemove', moveHandler, false);
            window.removeEventListener('mouseup', upHandler, false);
        }
        tbar.addEventListener('mousedown', function(ev) {
            ev.preventDefault(); ev.stopPropagation();
            dragOX = ev.clientX; dragOY = ev.clientY;
            window.addEventListener('mousemove', moveHandler, false);
            window.addEventListener('mouseup', upHandler, false);
        }, false);
                              

        popup.appendChild(tbar);
    }

    popup.appendChild(makeElement('div', ele, {className: 'popover-content'}, {
        padding: '0px'
    }));
    this.hPopupHolder.appendChild(popup);

    this.popups.push({
        component: popup,
        onClose: opts.onClose
    });
}

function makeTreeTableSection(title, content, visible) {
    var ttButton = makeElement('i');
    function update() {
        if (visible) {
            ttButton.className = 'fa fa-caret-down';
            content.style.display = 'table';
        } else {
            ttButton.className = 'fa fa-caret-right';
            content.style.display = 'none';
        }
    }
    update();

    ttButton.addEventListener('click', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        visible = !visible;
        update();
    }, false);

    var heading = makeElement('h6', [ttButton, ' ', title], {}, {display: 'block', background: 'gray', color: 'white', width: '100%', padding: '5px 2px', margin: '0px'});
    return makeElement('div', [heading, content], {});
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        makeTreeTableSection: makeTreeTableSection
    };
}
