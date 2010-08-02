// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// spans.js: JavaScript Intset/Location port.
//

function Range(min, max)
{
    this._min = min|0;
    this._max = max|0;
}

Range.prototype.min = function() {
    return this._min;
}

Range.prototype.max = function() {
    return this._max;
}

Range.prototype.contains = function(pos) {
    return pos >= this._min && pos <= this._max;
}

Range.prototype.isContiguous = function() {
    return true;
}

Range.prototype.ranges = function() {
    return [this];
}

Range.prototype.toString = function() {
    return '[' + this._min + '-' + this._max + ']';
}

function _Compound(ranges) {
    this._ranges = ranges;
    // assert sorted?
}

_Compound.prototype.min = function() {
    return this._ranges[0].min();
}

_Compound.prototype.max = function() {
    return this._ranges[this._ranges.length - 1].max();
}

_Compound.prototype.contains = function(pos) {
    // FIXME implement bsearch if we use this much.
    for (var s = 0; s < this._ranges.length; ++s) {
	if (this._ranges[s].contains(pos)) {
	    return true;
	}
    }
    return false;
}

_Compound.prototype.isContiguous = function() {
    return this._ranges.length > 1;
}

_Compound.prototype.ranges = function() {
    return this._ranges;
}

_Compound.prototype.toString = function() {
    var s = '';
    for (var r = 0; r < this._ranges.length; ++r) {
	if (r>0) {
	    s = s + ',';
	}
	s = s + this._ranges[r].toString();
    }
    return s;
}

function union(s0, s1) {
    var ranges = s0.ranges().concat(s1.ranges()).sort(rangeOrder);
    var oranges = [];
    var current = ranges[0];

    for (var i = 1; i < ranges.length; ++i) {
	var nxt = ranges[i];
	if (nxt.min() > (current.max() + 1)) {
	    oranges.push(current);
	    current = nxt;
	} else {
	    if (nxt.max() > current.max()) {
		current = new Range(current.min(), nxt.max());
	    }
	}
    }
    oranges.push(current);

    if (oranges.length == 1) {
	return oranges[0];
    } else {
	return new _Compound(oranges);
    }
}




function rangeOrder(a, b)
{
    if (a.min() < b.min()) {
        return -1;
    } else if (a.min() > b.min()) {
        return 1;
    } else if (a.max() < b.max()) {
        return -1;
    } else if (b.max() > a.max()) {
        return 1;
    } else {
        return 0;
    }
}
