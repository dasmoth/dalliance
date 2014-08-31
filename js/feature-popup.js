/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// feature-popup.js
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var utils = require('./utils');
    var pick = utils.pick;
    var pushnew = utils.pushnew;
    var makeElement = utils.makeElement;
}


var TAGVAL_NOTE_RE = new RegExp('^([A-Za-z_-]+)=(.+)');

Browser.prototype.addFeatureInfoPlugin = function(handler) {
    if (!this.featureInfoPlugins) {
        this.featureInfoPlugins = [];
    }
    this.featureInfoPlugins.push(handler);
}

function FeatureInfo(hit, feature, group) {
    var name = pick(group.type, feature.type);
    var fid = pick(group.label, feature.label, group.id, feature.id);
    if (fid && fid.indexOf('__dazzle') != 0) {
        name = name + ': ' + fid;
    }

    this.hit = hit;
    this.feature = feature;
    this.group = group;
    this.title = name;
    this.sections = [];
}

FeatureInfo.prototype.setTitle = function(t) {
    this.title = t;
}

FeatureInfo.prototype.add = function(label, info) {
    if (typeof info === 'string') {
        info = makeElement('span', info);
    }
    this.sections.push({label: label, info: info});
}

Browser.prototype.featurePopup = function(ev, __ignored_feature, hit, tier) {
    var hi = hit.length;
    var feature = --hi >= 0 ? hit[hi] : {};
    var group = --hi >= 0 ? hit[hi] : {};

    var featureInfo = new FeatureInfo(hit, feature, group);
    featureInfo.tier = tier;
    var fips = this.featureInfoPlugins || [];
    for (var fipi = 0; fipi < fips.length; ++fipi) {
        try {
            fips[fipi](feature, featureInfo);
        } catch (e) {
            console.log(e.stack || e);
        }
    }
    fips = tier.featureInfoPlugins || [];
    for (fipi = 0; fipi < fips.length; ++fipi) {
        try {
            fips[fipi](feature, featureInfo);
        } catch (e) {
            console.log(e.stack || e);
        }
    }

    this.removeAllPopups();

    var table = makeElement('table', null, {className: 'table table-striped table-condensed'});
    table.style.width = '100%';
    table.style.margin = '0px';

    var idx = 0;
    if (feature.method) {
        var row = makeElement('tr', [
            makeElement('th', 'Method'),
            makeElement('td', feature.method)
        ]);
        table.appendChild(row);
        ++idx;
    }
    {
        var loc;
        if (group.segment) {
            loc = group;
        } else {
            loc = feature;
        }
        var row = makeElement('tr', [
            makeElement('th', 'Location'),
            makeElement('td', loc.segment + ':' + loc.min + '-' + loc.max, {}, {minWidth: '200px'})
        ]);
        table.appendChild(row);
        ++idx;
    }
    if (feature.score !== undefined && feature.score !== null && feature.score != '-'
        && !feature.suppressScore) {
        var row = makeElement('tr', [
            makeElement('th', 'Score'),
            makeElement('td', '' + feature.score)
        ]);
        table.appendChild(row);
        ++idx;
    }
    {
        var links = maybeConcat(group.links, feature.links);
        if (links && links.length > 0) {
            var row = makeElement('tr', [
                makeElement('th', 'Links'),
                makeElement('td', links.map(function(l) {
                    return makeElement('div', makeElement('a', l.desc, {href: l.uri, target: '_new'}));
                }))
            ]);
            table.appendChild(row);
            ++idx;
        }
    }
    {
        var notes = maybeConcat(group.notes, feature.notes);
        for (var ni = 0; ni < notes.length; ++ni) {
            var k = 'Note';
            var v = notes[ni];
            var m = v.match(TAGVAL_NOTE_RE);
            if (m) {
                k = m[1];
                v = m[2];
            }

            var row = makeElement('tr', [
                makeElement('th', k),
                makeElement('td', v)
            ]);
            table.appendChild(row);
            ++idx;
        }
    }

    for (var fisi = 0; fisi < featureInfo.sections.length; ++fisi) {
        var section = featureInfo.sections[fisi];
        table.appendChild(makeElement('tr', [
            makeElement('th', section.label),
            makeElement('td', section.info)]));
    }        

    this.popit(ev, featureInfo.title || 'Feature', table, {width: 450});
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
