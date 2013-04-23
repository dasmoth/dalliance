/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// feature-popup.js
//

var TAGVAL_NOTE_RE = new RegExp('^([A-Za-z]+)=(.+)');

Browser.prototype.featurePopup = function(ev, feature, group){
    if (!feature) feature = {};
    if (!group) group = {};

    this.removeAllPopups();

    var table = makeElement('table', null, {className: 'table table-striped table-condensed'});
    table.style.width = '100%';
    table.style.margin = '0px';

    var name = pick(group.type, feature.type);
    var fid = pick(group.label, feature.label, group.id, feature.id);
    if (fid && fid.indexOf('__dazzle') != 0) {
        name = name + ': ' + fid;
    }

    var idx = 0;
    if (feature.method) {
        var row = makeElement('tr', [
            makeElement('th', 'Method'),
            makeElement('td', feature.method)
        ]);
        row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
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
            makeElement('td', loc.segment + ':' + loc.min + '-' + loc.max)
        ]);
        row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
        table.appendChild(row);
        ++idx;
    }
    if (feature.score !== undefined && feature.score !== null && feature.score != '-') {
        var row = makeElement('tr', [
            makeElement('th', 'Score'),
            makeElement('td', '' + feature.score)
        ]);
        row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
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
            row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
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
            row.style.backgroundColor = this.tierBackgroundColors[idx % this.tierBackgroundColors.length];
            table.appendChild(row);
            ++idx;
        }
    }

    this.popit(ev, name, table, {width: 400});
}
