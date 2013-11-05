/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// browser-us.js: standard UI wiring
//

var molgenisUrl = location.hostname;
        if(location.port != ""){
        	molgenisUrl = molgenisUrl+":"+location.port;
        }

function formatLongInt(n) {
    return (n|0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function parseLocCardinal(n, m) {
    var i = n.replace(/,/g, '');
    if (m === 'k' || m === 'K') {
        return i * 1000;
    } else if (m == 'm' || m === 'M') {
        return i * 1000000;
    } else {
        return i;
    }
}

/*
 * Quite a bit of this ought to be done using a templating system, but
 * since web-components isn't quite ready for prime time yet we'll stick
 * with constructing it all in Javascript for now...
 */

Browser.prototype.initUI = function(holder, genomePanel) {
    // FIXME shouldn't be hard-coded...
    document.head.appendChild(makeElement('link', '', {rel: 'stylesheet', href: this.uiPrefix + 'css/bootstrap-scoped.css'}));
    document.head.appendChild(makeElement('link', '', {rel: 'stylesheet', href: this.uiPrefix + 'css/dalliance-scoped.css'}));

    var b = this;
    var REGION_PATTERN = /([\d+,\w,\.,\_,\-]+):([0-9,]+)([KkMmGg])?([\-,\,.]+([0-9,]+)([KkMmGg])?)?/;
    // var REGION_PATTERN = /([\d+,\w,\.,\_,\-]+):([0-9,]+)([\-,\,.]+([0-9,]+))?/;

    if (!b.disableDefaultFeaturePopup) {
        this.addFeatureListener(function(ev, feature, hit, tier) {
            b.featurePopup(ev, feature, hit, tier);
            //BEGIN custom MOLGENIS code
            updateMolgenisTable(molgenisUrl, b.chr, hit[0]);
            //END custom MOLGENIS code
        });
    }

    holder.classList.add('dalliance');
    var toolbar = makeElement('div', null, {className: 'btn-toolbar'});

    var title = b.coordSystem.speciesName + ' ' + b.coordSystem.auth + b.coordSystem.version;
    if (this.setDocumentTitle) {
        document.title = title + ' :: dalliance';
    }
    
    if (!this.noTitle) {
        toolbar.appendChild(makeElement('div', makeElement('h4', title, {}, {margin: '0px'}), {className: 'btn-group'}, {verticalAlign: 'top'}));
    }

    var locField = makeElement('input', '', {className: 'loc-field'});
    b.makeTooltip(locField, 'Enter a genomic location or gene name');
    var locStatusField = makeElement('p', '', {className: 'loc-status'});
    toolbar.appendChild(makeElement('div', [locField, locStatusField], {className: 'btn-group'}, {verticalAlign: 'top', marginLeft: '10px', marginRight: '5px'}));


    var zoomInBtn = makeElement('a', [makeElement('i', null, {className: 'icon-zoom-in'})], {className: 'btn'});
    var zoomSlider = makeElement('input', '', {type: 'range', min: 100, max: 250}, {width: '200px'});  // NB min and max get overwritten.
    var zoomOutBtn = makeElement('a', [makeElement('i', null, {className: 'icon-zoom-out'})], {className: 'btn'});
    toolbar.appendChild(makeElement('div', [zoomInBtn,
                                            makeElement('span', zoomSlider, {className: 'btn'}),
                                            zoomOutBtn], {className: 'btn-group'}, {verticalAlign: 'top'}));

    var addTrackBtn = makeElement('a', [makeElement('i', null, {className: 'icon-plus'})], {className: 'btn'});
    var favBtn = makeElement('a', [makeElement('i', null, {className: 'icon-bookmark'})], {className: 'btn'});
    var svgBtn = makeElement('a', [makeElement('i', null, {className: 'icon-print'})], {className: 'btn'});
    var resetBtn = makeElement('a', [makeElement('i', null, {className: 'icon-refresh'})], {className: 'btn'});
    var optsButton = makeElement('div', [makeElement('i', null, {className: 'icon-cog'})], {className: 'btn'});

    var helpButton = makeElement('div', [makeElement('i', null, {className: 'icon-info-sign'})], {className: 'btn'});
    
    toolbar.appendChild(makeElement('div', [svgBtn,
                                            resetBtn], {className: 'btn-group'}, {verticalAlign: 'top'}));

    toolbar.appendChild(makeElement('div', [addTrackBtn, optsButton, helpButton], {className: 'btn-group pull-right'}, {verticalAlign: 'top'}));

    holder.appendChild(toolbar);
    holder.appendChild(genomePanel);

    this.addViewListener(function(chr, min, max, _oldZoom, zoom) {
        locField.value = '';
        locField.placeholder = ('chr' + chr + ':' + formatLongInt(min) + '..' + formatLongInt(max));
        zoomSlider.min = zoom.min;
        zoomSlider.max = zoom.max;
        zoomSlider.value = zoom.current;
        if (b.storeStatus) {
            b.storeViewStatus();
        }
    });

    this.addTierListener(function() {
        if (b.storeStatus) {
            b.storeTierStatus();
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
                var chr = m[1], start, end;
                if (m[5]) {
                    start = parseLocCardinal(m[2],  m[3]);
                    end = parseLocCardinal(m[5], m[6]);
                } else {
                    var width = b.viewEnd - b.viewStart + 1;
                    start = (parseLocCardinal(m[2], m[3]) - (width/2))|0;
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


    
    var trackAddPopup;
    addTrackBtn.addEventListener('click', function(ev) {
        if (trackAddPopup && trackAddPopup.displayed) {
            b.removeAllPopups();
        } else {
            trackAddPopup = b.showTrackAdder(ev);
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
        b.saveSVG();
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
       
            //BEGIN custom MOLGENIS code
        updateMolgenisTable(molgenisUrl, b.chr, null);
            //END custom MOLGENIS code
        
    }, false);
    b.makeTooltip(resetBtn, 'Reset to default tracks and view.');

    var optsPopup;
    optsButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();

        b.toggleOptsPopup(ev);
    }, false);
    b.makeTooltip(optsButton, 'Configure options.');

    helpButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        b.toggleHelpPopup(ev);
    });
    b.makeTooltip(helpButton, 'Help; Keyboard shortcuts.');

    b.addTierSelectionWrapListener(function(dir) {
        if (dir < 0) {
            b.setSelectedTier(null);
            locField.focus();
        }
    });
    //BEGIN custom MOLGENIS code
    updateMolgenisTable(molgenisUrl, b.chr, null);
    //END custom MOLGENIS code

    var uiKeyHandler = function(ev) {
        // console.log('bukh: ' + ev.keyCode);
        if (ev.keyCode == 65 || ev.keyCode == 97) {  // a
            ev.preventDefault(); ev.stopPropagation();
            b.showTrackAdder();
        } else if (ev.keyCode == 72 || ev.keyCode == 104) { // h
            ev.stopPropagation(); ev.preventDefault();
            b.toggleHelpPopup(ev);
        }
    };

    holder.addEventListener('focus', function(ev) {
        holder.addEventListener('keydown', uiKeyHandler, false);
    }, false);
    holder.addEventListener('blur', function(ev) {
        holder.removeEventListener('keydown', uiKeyHandler, false);
    }, false);
}

Browser.prototype.toggleHelpPopup = function(ev) {
    if (this.helpPopup && this.helpPopup.displayed) {
        this.removeAllPopups();
    } else {
    	// BEGIN custom MOLGENIS code
    	var helpFrame = makeElement('iframe', null, {src: this.uiPrefix + 'css/index.html'}, {width: '490px', height: '500px'});
    	// END custom MOLGENIS code
    	this.helpPopup = this.popit(ev, 'Help', helpFrame, {width: 500});
    }
}

Browser.prototype.toggleOptsPopup = function(ev) {
    var b = this;

    if (this.uiMode === 'opts') {
        this.hideToolPanel();
        this.setUiMode('none');
    } else {
        var optsForm = makeElement('div', null, {className: 'form-horizontal'}, {boxSizing: 'border-box', MozBoxSizing: 'border-box', display: 'inline-block', verticalAlign: 'top'});
        var optsTable = makeElement('table');
        optsTable.cellPadding = 5;
        var scrollModeButton = makeElement('input', '', {type: 'checkbox', checked: b.reverseScrolling});
        scrollModeButton.addEventListener('change', function(ev) {
            b.reverseScrolling = scrollModeButton.checked;
        }, false);
        optsTable.appendChild(makeElement('tr', [makeElement('td', 'Reverse trackpad scrolling', {align: 'right'}), makeElement('td', scrollModeButton)]));


        var rulerSelect = makeElement('select');
        rulerSelect.appendChild(makeElement('option', 'Left', {value: 'left'}));
        rulerSelect.appendChild(makeElement('option', 'Center', {value: 'center'}));
        rulerSelect.appendChild(makeElement('option', 'Right', {value: 'right'}));
        rulerSelect.appendChild(makeElement('option', 'None', {value: 'none'}));
        rulerSelect.value = b.rulerLocation;
        rulerSelect.addEventListener('change', function(ev) {
            b.rulerLocation = rulerSelect.value;
            b.positionRuler();
            for (var ti = 0; ti < b.tiers.length; ++ti) {
                b.tiers[ti].paintQuant();
            }
        }, false);
        optsTable.appendChild(makeElement('tr', [makeElement('td', 'Vertical guideline', {align: 'right'}), makeElement('td', rulerSelect)]));
        
        optsForm.appendChild(optsTable);
        this.removeAllPopups();
        this.optsPopup = this.popit(ev, 'Options', optsForm, {width: 500});
    }
}

