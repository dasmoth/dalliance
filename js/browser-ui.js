/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// browser-us.js: standard UI wiring
//

function formatLongInt(n) {
    return (n|0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/*
 * Quite a bit of this ought to be done using a templating system, but
 * since web-components isn't quite ready for prime time yet we'll stick
 * with constructing it all in Javascript for now...
 */

Browser.prototype.initUI = function(holder, genomePanel) {
    document.head.appendChild(makeElement('link', '', {rel: 'stylesheet', href: 'css/bootstrap-scoped.css'}));
    document.head.appendChild(makeElement('link', '', {rel: 'stylesheet', href: 'css/dalliance-scoped.css'}));

    var b = this;
    var REGION_PATTERN = /([\d+,\w,\.,\_,\-]+):(\d+)([\-,\,.](\d+))?/;

    this.addFeatureListener(function(ev, hit) {
        b.featurePopup(ev, hit, null);
    });

    holder.classList.add('dalliance');
    var toolbar = makeElement('div', null, {className: 'btn-toolbar'});

    var title = b.coordSystem.speciesName + ' ' + b.coordSystem.auth + b.coordSystem.version;
    if (this.setDocumentTitle) {
        document.title = title + ' :: dalliance';
    }
    
    toolbar.appendChild(makeElement('div', makeElement('h4', title, {}, {margin: '0px'}), {className: 'btn-group'}, {verticalAlign: 'top'}));

    var locField = makeElement('input', '', {className: 'loc-field'});
    var locStatusField = makeElement('p', '', {className: 'loc-status'});
    toolbar.appendChild(makeElement('div', [locField, locStatusField], {className: 'btn-group'}, {verticalAlign: 'top', marginLeft: '10px', marginRight: '5px'}));

    var zoomInBtn = makeElement('a', [makeElement('i', null, {className: 'icon-zoom-in'})], {className: 'btn'});
    var zoomSlider = makeElement('input', '', {type: 'range', min: 100, max: 250});
    var zoomOutBtn = makeElement('a', [makeElement('i', null, {className: 'icon-zoom-out'})], {className: 'btn'});
    toolbar.appendChild(makeElement('div', [zoomInBtn,
                                            makeElement('span', zoomSlider, {className: 'btn'}),
                                            zoomOutBtn], {className: 'btn-group'}, {verticalAlign: 'top'}));

    var addTrackBtn = makeElement('a', [makeElement('i', null, {className: 'icon-plus'})], {className: 'btn'});
    var favBtn = makeElement('a', [makeElement('i', null, {className: 'icon-bookmark'})], {className: 'btn'});
    var svgBtn = makeElement('a', [makeElement('i', null, {className: 'icon-print'})], {className: 'btn'});
    var resetBtn = makeElement('a', [makeElement('i', null, {className: 'icon-refresh'})], {className: 'btn'});
    var optsButton = makeElement('a', [makeElement('i', null, {className: 'icon-cog'})], {className: 'btn'});
    toolbar.appendChild(makeElement('div', [addTrackBtn,
                                            favBtn,
                                            svgBtn,
                                            resetBtn,
                                            optsButton], {className: 'btn-group'}, {verticalAlign: 'top'}));

    holder.appendChild(toolbar);
    holder.appendChild(genomePanel);

    this.addViewListener(function(chr, min, max, zoom) {
        locField.value = '';
        locField.placeholder = ('chr' + chr + ':' + formatLongInt(min) + '..' + formatLongInt(max));
        zoomSlider.value = zoom;
        if (b.storeStatus) {
            b.storeStatus();
        }
    });

    locField.addEventListener('keydown', function(ev) {
        if (ev.keyCode == 40) {
            ev.preventDefault(); ev.stopPropagation();
            b.setSelectedTier(0);
        } if (ev.keyCode == 10 || ev.keyCode == 13) {
            ev.preventDefault();

            var g = locField.value;
            var m = REGION_PATTERN.exec(g);

            var setLocationCB = function(err) {
                    if (err) {
                        locStatusField.innerText = '' + err;
                    } else {
                        locStatusField.innerText = '';
                    }
                };

            if (m) {
                console.log(m);
                var chr = m[1], start, end;
                if (m[4]) {
                    start = m[2]|0;
                    end = m[4]|0;
                } else {
                    var width = b.viewEnd - b.viewStart + 1;
                    start = ((m[2]|0) - (width/2))|0;
                    end = start + width - 1;
                }
                b.setLocation(chr, start, end, setLocationCB);
            } else {
                if (!g || g.length == 0) {
                    return false;
                }

                b.searchEndpoint.features(null, {group: g, type: 'transcript'}, function(found) {        // HAXX
                    if (!found) found = [];
                    var min = 500000000, max = -100000000;
                    var nchr = null;
                    for (var fi = 0; fi < found.length; ++fi) {
                        var f = found[fi];
                        
                        if (f.label.toLowerCase() != g.toLowerCase()) {
                            // ...because Dazzle can return spurious overlapping features.
                            continue;
                        }

                        if (nchr == null) {
                            nchr = f.segment;
                        }
                        min = Math.min(min, f.min);
                        max = Math.max(max, f.max);
                    }

                    if (!nchr) {
                        locStatusField.innerText = "no match for '" + g + "' (search should improve soon!)";
                    } else {
                        b.highlightRegion(nchr, min, max);
                    
                        var padding = Math.max(2500, (0.3 * (max - min + 1))|0);
                        b.setLocation(nchr, min - padding, max + padding, setLocationCB);
                    }
                }, false);
            }

        }
    }, false); 


  this.addRegionSelectListener(function(chr, min, max) {
      // console.log('chr' + chr + ':' + min + '..' + max);
      // b.highlightRegion(chr, min, max);
      // console.log('selected ' + b.featuresInRegion(chr, min, max).length);
  });

  this.addTierListener(function() {
      if (b.storeStatus) {
          b.storeStatus();
      }
  });



    addTrackBtn.addEventListener('click', function(ev) {
        if (b.trackAdderVisible) {
            b.removeAllPopups();
        } else {
            b.showTrackAdder(ev);
        }
    }, false);
    b.makeTooltip(addTrackBtn, 'Add a new track from the registry or an indexed file.');

    zoomInBtn.addEventListener('click', function(ev) {
      ev.stopPropagation(); ev.preventDefault();

      b.zoomStep(-10);
    }, false);
    b.makeTooltip(zoomInBtn, 'Zoom in');

    zoomOutBtn.addEventListener('click', function(ev) {
      ev.stopPropagation(); ev.preventDefault();

      b.zoomStep(10);
    }, false);
    b.makeTooltip(zoomOutBtn, 'Zoom out');

    zoomSlider.addEventListener('change', function(ev) {
	b.zoomSliderValue = (1.0 * zoomSlider.value);
	b.zoom(Math.exp((1.0 * zoomSlider.value) / b.zoomExpt));
    }, false);
    zoomSlider.min = b.zoomMin;
    zoomSlider.max = b.zoomMax;

    favBtn.addEventListener('click', function(ev) {
       ev.stopPropagation(); ev.preventDefault();
    }, false);
    b.makeTooltip(favBtn, 'Favourite regions');

    svgBtn.addEventListener('click', function(ev) {
       ev.stopPropagation(); ev.preventDefault();
       saveSVG(b);
    }, false);
    b.makeTooltip(svgBtn, 'Export publication-quality SVG.');

    resetBtn.addEventListener('click', function(ev) {
       ev.stopPropagation(); ev.preventDefault();

       for (var i = b.tiers.length - 1; i >= 0; --i) {
           b.removeTier({index: i});
       }
       for (var i = 0; i < b.defaultSources.length; ++i) {
           b.addTier(b.defaultSources[i]);
       }

        b.setLocation(b.defaultChr, b.defaultStart, b.defaultEnd);
    }, false);
    b.makeTooltip(resetBtn, 'Reset to default tracks and view.');

    optsButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();

        var optsBox = makeElement('div');
        var scrollModeButton = makeElement('input', '', {type: 'checkbox', checked: b.reverseScrolling});
        scrollModeButton.addEventListener('change', function(ev) {
            b.reverseScrolling = scrollModeButton.checked;
        }, false);
        optsBox.appendChild(makeElement('p', ['Reverse trackpad scrolling', scrollModeButton]));
        b.removeAllPopups();
        b.popit(ev, 'Options', optsBox, {width: 300});
    }, false);

    b.addTierSelectionWrapListener(function(dir) {
        if (dir < 0) {
            b.setSelectedTier(null);
            locField.focus();
        }
    });

  }
