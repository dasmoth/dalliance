/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// svg-utils.js
//

var NS_SVG = 'http://www.w3.org/2000/svg';
var NS_XLINK = 'http://www.w3.org/1999/xlink';

function SVGPath() {
    this.ops = [];
}

SVGPath.prototype.moveTo = function(x, y) {
    this.ops.push('M ' + x + ' ' + y);
}

SVGPath.prototype.lineTo = function(x, y) {
    this.ops.push('L ' + x + ' ' + y);
}

SVGPath.prototype.closePath = function() {
    this.ops.push('Z');
}

SVGPath.prototype.toPathData = function() {
    return this.ops.join(' ');
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        NS_SVG: NS_SVG,
        NS_XLINK: NS_XLINK,
        SVGPath: SVGPath
    }
}