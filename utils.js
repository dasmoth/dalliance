/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// utils.js: odds, sods, and ends.
//

var NUM_REGEXP = new RegExp('[0-9]+');

function stringToNumbersArray(str) {
    var nums = new Array();
    var m;
    while (m = NUM_REGEXP(str)) {
        nums.push(m[0]);
        str=str.substring(m.index + (m[0].length));
    }
    return nums;
}

var STRICT_NUM_REGEXP = new RegExp('^[0-9]+$');

function stringToInt(str) {
    str = str.replace(new RegExp(',', 'g'), '');
    if (!STRICT_NUM_REGEXP.test(str)) {
	alert("Don't understand '" + str + "'");
	return null;
    }
    return str|0;
}


function pusho(obj, k, v) {
    if (obj[k]) {
	obj[k].push(v);
    } else {
	obj[k] = [v];
    }
}

function pushnewo(obj, k, v) {
    var a = obj[k];
    if (a) {
	for (var i = 0; i < a.length; ++i) {    // indexOf requires JS16 :-(.
	    if (a[i] == v) {
		return;
	    }
	}
	a.push(v);
    } else {
	obj[k] = [v];
    }
}


function pick(a, b, c, d)
{
    if (a) {
        return a;
    } else if (b) {
        return b;
    } else if (c) {
        return c;
    } else if (d) {
        return d;
    }
}

function pushnew(l, o)
{
    for (var i = 0; i < l.length; ++i) {
        if (l[i] == o) {
            return;
        }
    }
    l.push(o);
}

function maybeConcat(a, b) {
    var l = [];
    if (a) {
        for (var i = 0; i < a.length; ++i) {
            pushnew(l, a[i]);
        }
    }
    if (b) {
        for (var i = 0; i < b.length; ++i) {
            pushnew(l, b[i]);
        }
    }
    return l;
}


//
// DOM utilities
//


function makeElement(tag, children, attribs)
{
    var ele = document.createElement(tag);
    if (children) {
        if (! (children instanceof Array)) {
            children = [children];
        }
        for (var i = 0; i < children.length; ++i) {
            var c = children[i];
            if (typeof c == 'string') {
                c = document.createTextNode(c);
            }
            ele.appendChild(c);
        }
    }
    
    if (attribs) {
        for (var l in attribs) {
            ele[l] = attribs[l];
        }
    }
    return ele;
}

function makeElementNS(namespace, tag, children, attribs)
{
    var ele = document.createElementNS(namespace, tag);
    if (children) {
        if (! (children instanceof Array)) {
            children = [children];
        }
        for (var i = 0; i < children.length; ++i) {
            var c = children[i];
            if (typeof c == 'string') {
                c = document.createTextNode(c);
            }
            ele.appendChild(c);
        }
    }
    
    if (attribs) {
        for (var l in attribs) {
            ele[l] = attribs[l];
        }
    }
    return ele;
}
