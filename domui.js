/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// domui.js: SVG UI components
//

function makeTooltip(ele, text)
{
    var timer = null;
    var outlistener;
    outlistener = function(ev) {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        ele.removeEventListener('mouseout', outlistener, false);
    };

    ele.addEventListener('mouseover', function(ev) {
        var mx = ev.clientX, my = ev.clientY;
        if (!timer) {
            timer = setTimeout(function() {
                var popup = makeElement('div', text, {}, {
                    position: 'absolute',
                    top: '' + (my + 20) + 'px',
                    left: '' + (mx - 30) + 'px',
                    backgroundColor: 'rgb(250, 240, 220)',
                    borderWidth: '1px',
                    borderColor: 'black',
                    borderStyle: 'solid',
                    padding: '2px'
                });
                hPopupHolder.appendChild(popup);
                var moveHandler;
                moveHandler = function(ev) {
                    try {
                        hPopupHolder.removeChild(popup);
                    } catch (e) {
                        // May have been removed by other code which clears the popup layer.
                    }
                    window.removeEventListener('mousemove', moveHandler, false);
                }
                window.addEventListener('mousemove', moveHandler, false);
                timer = null;
            }, 1000);
            ele.addEventListener('mouseout', outlistener, false);
        }
    }, false);
}

function IconSet(uri)
{
    var req = new XMLHttpRequest();
    req.open('get', uri, false);
    req.send();
    this.icons = req.responseXML;
}

IconSet.prototype.createIcon = function(name, parent)
{
    var master = this.icons.getElementById(name);
    var copy = document.importNode(master, true);
    parent.appendChild(copy);
    var bbox = copy.getBBox();
    parent.removeChild(copy);
    copy.setAttribute('transform', 'translate(' + (-bbox.x)  + ',' + (-bbox.y)+ ')');
    var icon = makeElementNS(NS_SVG, 'g', copy);
    return icon;
}


IconSet.prototype.createButton = function(name, parent, bx, by)
{
    bx = bx|0;
    by = by|0;

    var master = this.icons.getElementById(name);
    var copy = document.importNode(master, true);
    parent.appendChild(copy);
    var bbox = copy.getBBox();
    parent.removeChild(copy);
    copy.setAttribute('transform', 'translate(' + (((bx - bbox.width - 2)/2) - bbox.x)  + ',' + (((by - bbox.height - 2)/2) - bbox.y)+ ')');
    var button = makeElementNS(NS_SVG, 'g', [
        makeElementNS(NS_SVG, 'rect', null, {
            x: 0,
            y: 0,
            width: bx,
            height: by,
            fill: 'rgb(230,230,250)',
            stroke: 'rgb(150,150,220)',
            strokeWidth: 2
        }), 
        copy ]);
    return button;
}
