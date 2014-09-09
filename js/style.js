/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2014
//
// style.js
//

"use strict";

function StyleFilter(type, method, label) {
    this.type = type;
    this.method = method;
    this.label = label;
}

StyleFilter.prototype.equals = function(o) {
    return this.type == o.type && this.method == o.method && this.label == o.label;
}

StyleFilter.prototype.toString = function() {
    var fs = [];
    if (this.type) 
        fs.push('type=' + this.type);
    if (this.method)
        fs.push('method=' + this.method);
    if (this.label)
        fs.push('label=' + this.label);
    return 'StyleFilter<' + fs.join(';') + '>';
}

function StyleFilterSet(filters) {
    this._filters = {};
    if (filters) {
        for (var fi = 0; fi < filters.length; ++fi) {
            this.add(filters[fi]);
        }
    }
}

StyleFilterSet.prototype.add = function(filter) {
    var fs = filter.toString();
    if (!this._filters[fs]) {
        this._filters[fs] = filter;
        this._list = null;
    }
}

StyleFilterSet.prototype.addAll = function(filterSet) {
    var l = filterSet.list();
    for (var fi = 0; fi < l.length; ++fi) {
        this.add(l[fi]);
    }
}

StyleFilterSet.prototype.doesNotContain = function(filterSet) {
    var l = filterSet.list();
    for (var fi = 0; fi < l.length; ++fi) {
        if (!this._filters[fi.toString()])
            return true;
    }
    return false
}

StyleFilterSet.prototype.list = function() {
    if (!this._list) {
        this._list = [];
        for (var k in this._filters) {
            if (this._filters.hasOwnProperty(k)) {
                this._list.push(this._filters[k]);
            }
        }
    }
    return this._list;
}

StyleFilterSet.prototype.typeList = function() {
    var types = [];
    var list = this.list();
    for (var fi = 0; fi < list.length; ++fi) {
        var filter = list[fi];
        var type = filter.type;
        if (!type || type == 'default')
            return null;
        if (types.indexOf(type) < 0)
            types.push(type);
    }
    return types;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        StyleFilter: StyleFilter,
        StyleFilterSet: StyleFilterSet
    };
}
