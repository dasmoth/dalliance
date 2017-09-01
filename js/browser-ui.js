/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

//
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// browser-us.js: standard UI wiring
//

"use strict";

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var utils = require('./utils');
    var makeElement = utils.makeElement;
    var removeChildren = utils.removeChildren;

    var nf = require('./numformats');
    var formatLongInt = nf.formatLongInt;

    var makeZoomSlider = require('./zoomslider');

    // For side effects

    require('./tier-edit');
    require('./export-config');
    require('./export-ui');
    require('./export-image');
    require('./svg-export');
    require('./session');
}

/*
 * Quite a bit of this ought to be done using a templating system, but
 * since web-components isn't quite ready for prime time yet we'll stick
 * with constructing it all in Javascript for now...
 */

Browser.prototype.initUI = function(holder, genomePanel) {
    if (!this.noSourceCSS) {
      ['bootstrap-scoped.css', 'dalliance-scoped.css', 'font-awesome.min.css'].forEach(function(path) {
        document.head.appendChild(makeElement('link', '', {
          rel: 'stylesheet',
          href: this.resolveURL('$$css/' + path)
        }));
      }.bind(this));
    }

    var b = this;

    if (!b.disableDefaultFeaturePopup) {
        this.addFeatureListener(function(ev, feature, hit, tier) {
            b.featurePopup(ev, feature, hit, tier);
        });
    }

    holder.classList.add('dalliance');
    var toolbar = b.toolbar = makeElement('div', null, {className: 'btn-toolbar toolbar'});

    var title = b.coordSystem.speciesName + ' ' + b.nameForCoordSystem(b.coordSystem);
    if (this.setDocumentTitle) {
        document.title = title + ' :: dalliance';
    }

    var locField = makeElement('input', '', {className: 'loc-field'});
    b.makeTooltip(locField, 'Enter a genomic location or gene name');
    var locStatusField = makeElement('p', '', {className: 'loc-status'});

    var zoomInBtn = makeElement('a', [makeElement('i', null, {className: 'fa fa-search-plus'})], {className: 'btn'});
    var zoomSlider = new makeZoomSlider({width: b.zoomSliderWidth});
    b.makeTooltip(zoomSlider, "Highlighted button shows current zoom level, gray button shows inactive zoom level (click or tap SPACE to toggle).")

    var zoomOutBtn = makeElement('a', [makeElement('i', null, {className: 'fa fa-search-minus'})], {className: 'btn'});

    var clearHighlightsButton = makeElement('a', [makeElement('i', null, {className: 'fa fa-eraser'})], {className: 'btn'});

    var addTrackBtn = makeElement('a', [makeElement('i', null, {className: 'fa fa-plus'})], {className: 'btn'});
    var favBtn = makeElement('a', [makeElement('i', null, {className: 'fa fa-bookmark'})], {className: 'btn'});
    var svgBtn = makeElement('a', [makeElement('i', null, {className: 'fa fa-print'})], {className: 'btn'});
    var resetBtn = makeElement('a', [makeElement('i', null, {className: 'fa fa-refresh'})], {className: 'btn'});
    var optsButton = makeElement('a', [makeElement('i', null, {className: 'fa fa-cogs'})], {className: 'btn'});
    var helpButton = makeElement('a', [makeElement('i', null, {className: 'fa fa-question'})], {className: 'btn'});

    var tierEditButton = makeElement('a', [makeElement('i', null, {className: 'fa fa-road'})], {className: 'btn'});
    b.makeTooltip(tierEditButton, 'Configure currently selected track(s) (E)')

    var leapLeftButton = makeElement('a', [makeElement('i', null, {className: 'fa fa-angle-left'})], {className: 'btn'}, {width: '5px'});
    var leapRightButton = makeElement('a', [makeElement('i', null, {className: 'fa fa-angle-right'})], {className: 'btn pull-right'}, {width: '5px'});

    var modeButtons = makeElement('div', null, {className: 'btn-group pull-right'});
    if (!this.noTrackAdder)
        modeButtons.appendChild(addTrackBtn);
    if (!this.noTrackEditor)
        modeButtons.appendChild(tierEditButton);
    if (!this.noExport)
        modeButtons.appendChild(svgBtn);
    if (!this.noOptions)
        modeButtons.appendChild(optsButton);
    if (!this.noHelp)
        modeButtons.appendChild(helpButton);

    this.setUiMode = function(m) {
        this.uiMode = m;
        var mb = {help: helpButton, add: addTrackBtn, opts: optsButton, 'export': svgBtn, tier: tierEditButton};
        for (var x in mb) {
            if (x == m)
                mb[x].classList.add('active');
            else
                mb[x].classList.remove('active');
        }
    }

    if (!this.noLeapButtons)
        toolbar.appendChild(leapRightButton);

    if (modeButtons.firstChild)
        toolbar.appendChild(modeButtons);
    
    if (!this.noLeapButtons)
        toolbar.appendChild(leapLeftButton);
    if (!this.noTitle) {
        toolbar.appendChild(makeElement('div', makeElement('h4', title, {}, {margin: '0px'}), {className: 'btn-group title'}));
    }
    if (!this.noLocationField)
        toolbar.appendChild(makeElement('div', [locField, locStatusField], {className: 'btn-group loc-group'}));
    if (!this.noClearHighlightsButton)
        toolbar.appendChild(clearHighlightsButton);

    if (!this.noZoomSlider) {
        toolbar.appendChild(makeElement('div', [zoomInBtn,
                                                makeElement('span', zoomSlider, {className: 'btn'}),
                                                zoomOutBtn], {className: 'btn-group'}));
    }
    
    if (this.toolbarBelow) {
        holder.appendChild(genomePanel);
        holder.appendChild(toolbar);
    } else {
        holder.appendChild(toolbar);
        holder.appendChild(genomePanel);
    }


    var lt2 = Math.log(2) / Math.log(10);
    var lt5 = Math.log(5) / Math.log(10);
    var roundSliderValue = function(x) {
        var ltx = (x / b.zoomExpt + Math.log(b.zoomBase)) / Math.log(10);
        
        var whole = ltx|0
        var frac = ltx - whole;
        var rounded

        if (frac < 0.01)
            rounded = whole;
        else if (frac <= (lt2 + 0.01))
            rounded = whole + lt2;
        else if (frac <= (lt5 + 0.01))
            rounded = whole + lt5;
        else {
            rounded = whole + 1;
        }

        return (rounded * Math.log(10) -Math.log(b.zoomBase)) * b.zoomExpt;
    }

    var markSlider = function(x) {
        zoomSlider.addLabel(x, humanReadableScale(Math.exp(x / b.zoomExpt) * b.zoomBase));
    }

    this.addViewListener(function(chr, min, max, _oldZoom, zoom) {
        locField.value = (chr + ':' + formatLongInt(min) + '..' + formatLongInt(max));
        zoomSlider.min = zoom.min|0;
        zoomSlider.max = zoom.max|0;
        if (zoom.isSnapZooming) {
            zoomSlider.value = zoom.alternate
            zoomSlider.value2 = zoom.current;
            zoomSlider.active = 2;
        } else {
            zoomSlider.value = zoom.current;
            zoomSlider.value2 = zoom.alternate;
            zoomSlider.active = 1;
        }

        if (zoom.current == zoom.min)
            zoomInBtn.classList.add('disabled');
        else
            zoomInBtn.classList.remove('disabled');

        if (zoom.current == zoom.max)
            zoomOutBtn.classList.add('disabled');
        else
            zoomOutBtn.classList.remove('disabled');

        zoomSlider.removeLabels();
        var zmin = zoom.min;
        var zmax = zoom.max;
        var zrange = zmax - zmin;

        
        var numSliderTicks = 4;
        if (b.zoomSliderWidth && b.zoomSliderWidth < 150)
            numSliderTicks = 3;
        markSlider(roundSliderValue(zmin));
        for (var sti = 1; sti < numSliderTicks - 1; ++sti) {
            markSlider(roundSliderValue(zmin + (1.0 * sti * zrange / (numSliderTicks -1))));
        }
        markSlider(roundSliderValue(zmax));

        if (b.storeStatus) {
            b.storeViewStatus();
        }

        if (b.highlights.length > 0) {
            clearHighlightsButton.style.display = 'inline-block';
        } else {
            clearHighlightsButton.style.display = 'none';
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
            b.search(g, function(err) {
                if (err) {
                    locStatusField.textContent = '' + err;
                } else {
                    locStatusField.textContent = '';
                }
            });
        }
    }, false);
    
    var trackAddPopup;
    addTrackBtn.addEventListener('click', function(ev) {
        if (trackAddPopup && trackAddPopup.displayed) {
            b.removeAllPopups();
        } else {
            trackAddPopup = b.showTrackAdder(ev);
        }
    }, false);
    b.makeTooltip(addTrackBtn, 'Add a new track from the registry or an indexed file. (A)');

    zoomInBtn.addEventListener('click', function(ev) {
      ev.stopPropagation(); ev.preventDefault();

      b.zoomStep(-10);
    }, false);
    b.makeTooltip(zoomInBtn, 'Zoom in (+)');

    zoomOutBtn.addEventListener('click', function(ev) {
      ev.stopPropagation(); ev.preventDefault();

      b.zoomStep(10);
    }, false);
    b.makeTooltip(zoomOutBtn, 'Zoom out (-)');

    zoomSlider.addEventListener('change', function(ev) {
        var wantSnap = zoomSlider.active == 2;
        if (wantSnap != b.isSnapZooming) {
            b.savedZoom = b.zoomSliderValue  - b.zoomMin;
            b.isSnapZooming = wantSnap;
        }
        var activeZSV = zoomSlider.active == 1 ? zoomSlider.value : zoomSlider.value2;

    	b.zoomSliderValue = (1.0 * activeZSV);
    	b.zoom(Math.exp((1.0 * activeZSV) / b.zoomExpt));
    }, false);

    favBtn.addEventListener('click', function(ev) {
       ev.stopPropagation(); ev.preventDefault();
    }, false);
    b.makeTooltip(favBtn, 'Favourite regions');

    svgBtn.addEventListener('click', function(ev) {
       ev.stopPropagation(); ev.preventDefault();
        b.openExportPanel();
    }, false);
    b.makeTooltip(svgBtn, 'Export publication-quality SVG. (X)');

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
    b.makeTooltip(helpButton, 'Help; Keyboard shortcuts. (H)');

    tierEditButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        if (b.selectedTiers.length == 1) {
            b.openTierPanel(b.tiers[b.selectedTiers[0]]);
        }
    }, false);

    leapLeftButton.addEventListener('click', function(ev) {
        b.leap(b.reverseKeyScrolling ? -1 : 1, false);
    }, false);
    b.makeTooltip(leapLeftButton, function(ev) {
        var st = b.getSelectedTier();
        var tier;
        if (st >= 0)
            tier = b.tiers[st];

        if (tier && tier.featureSource && b.sourceAdapterIsCapable(tier.featureSource, 'quantLeap') && typeof(tier.quantLeapThreshold) == 'number') {
            return 'Jump to the next region with a score above the threshold in the selected track "' + (tier.config.name || tier.dasSource.name) + '"" (ctrl+LEFT)';
        } else if (tier && tier.featureSource && b.sourceAdapterIsCapable(tier.featureSource, 'leap')) {
            return 'Jump to the next feature in the selected track "' + (tier.config.name || tier.dasSource.name) + '" (ctrl+LEFT)';
        } else {
            return 'Jump left (shift+LEFT)';
        }
    });

    leapRightButton.addEventListener('click', function(ev) {
        b.leap(b.reverseKeyScrolling ? 1 : -1, false);
    }, false);
    b.makeTooltip(leapRightButton, function(ev) {
        var st = b.getSelectedTier();
        var tier;
        if (st >= 0)
            tier = b.tiers[st];

        if (tier && tier.featureSource && b.sourceAdapterIsCapable(tier.featureSource, 'quantLeap') && typeof(tier.quantLeapThreshold) == 'number') {
            return 'Jump to the next region with a score above the threshold in the selected track "' + (tier.config.name || tier.dasSource.name) + '"" (ctrl+RIGHT)';
        } else if (tier && tier.featureSource && b.sourceAdapterIsCapable(tier.featureSource, 'leap')) {
            return 'Jump to the next feature in the selected track "' + (tier.config.name || tier.dasSource.name) + '" (ctrl+RIGHT)';
        } else {
            return 'Jump right (shift+RIGHT)';
        }
    });
    b.addTierSelectionListener(function() {
        var st = b.getSelectedTier();
        var tier;
        if (st >= 0)
            tier = b.tiers[st];

        var canLeap = false;
        if (tier && tier.featureSource) {
            if (b.sourceAdapterIsCapable(tier.featureSource, 'quantLeap') && typeof(tier.quantLeapThreshold) == 'number')
                canLeap = true;
            else if (b.sourceAdapterIsCapable(tier.featureSource, 'leap'))
                canLeap = true;
        }

        leapLeftButton.firstChild.className = canLeap ? 'fa fa-angle-double-left' : 'fa fa-angle-left';
        leapRightButton.firstChild.className = canLeap ? 'fa fa-angle-double-right' : 'fa fa-angle-right';
    });

    clearHighlightsButton.addEventListener('click', function(ev) {
        b.clearHighlights();
    }, false);
    b.makeTooltip(clearHighlightsButton, 'Clear highlights (C)');

    b.addTierSelectionWrapListener(function(dir) {
        if (dir < 0) {
            b.setSelectedTier(null);
            locField.focus();
        }
    });

    b.addTierSelectionListener(function(sel) {
        if (b.uiMode === 'tier') {
            if (sel.length == 0) {
                b.hideToolPanel();
                b.manipulatingTier = null;
                b.uiMode = 'none';
            } else {
                var ft = b.tiers[sel[0]];
                if (ft != b.manipulatingTier) {
                    b.openTierPanel(ft);
                }
            }
        }
    });

    var uiKeyHandler = function(ev) {
        // console.log('bukh: ' + ev.keyCode);
        if (ev.keyCode == 65 || ev.keyCode == 97) {  // a
            ev.preventDefault(); ev.stopPropagation();
            b.showTrackAdder();
        } else if (ev.keyCode == 72 || ev.keyCode == 104) { // h
            ev.stopPropagation(); ev.preventDefault();
            b.toggleHelpPopup(ev);
        } else if (ev.keyCode == 69 || ev.keyCode == 101) { //e
            ev.stopPropagation(); ev.preventDefault();
            if (b.selectedTiers.length == 1) {
                b.openTierPanel(b.tiers[b.selectedTiers[0]]);
            }
        } else if (ev.keyCode == 88 || ev.keyCode == 120) { // x
            ev.stopPropagation(); ev.preventDefault();
            b.openExportPanel();
        } else if (ev.keyCode == 67 || ev.keyCode == 99) { // c
            ev.stopPropagation(); ev.preventDefault();
            b.clearHighlights();
        }
    };

    holder.addEventListener('focus', function(ev) {
        holder.addEventListener('keydown', uiKeyHandler, false);
    }, false);
    holder.addEventListener('blur', function(ev) {
        holder.removeEventListener('keydown', uiKeyHandler, false);
    }, false);

    holder.addEventListener('keydown', function(ev) {
        if (ev.keyCode === 27) {
            if (b.uiMode !== 'none') {
                // Only consume event if tool panel is open.
                ev.preventDefault();
                ev.stopPropagation();
                b.setUiMode('none');
                b.hideToolPanel();

                if (b.selectedTiers && b.selectedTiers.length > 0) {
                    b.browserHolder.focus();
                }
            }
        }
    }, false);
}

Browser.prototype.showToolPanel = function(panel, nowrap) {
    var thisB = this;

    if (this.activeToolPanel) {
        this.activeToolPanel.parentElement.removeChild(this.activeToolPanel);
    }

    var content;
    if (nowrap)
        content = panel;
    else
        content = makeElement('div', panel, {}, {overflowY: 'auto', width: '100%'});


    var divider = makeElement('div', makeElement('i', null, {className: 'fa fa-caret-right'}), {className: 'tool-divider'});
    divider.addEventListener('click', function(ev) {
        thisB.hideToolPanel();
        thisB.setUiMode('none');
    }, false);
    this.makeTooltip(divider, 'Close tool panel (ESC)');
    this.activeToolPanel = makeElement('div', [divider, content], {className: 'tool-holder'});
    this.svgHolder.appendChild(this.activeToolPanel);
    this.resizeViewer();

    var thisB = this;
}

Browser.prototype.hideToolPanel = function() {
    if (this.activeToolPanel) {
        this.activeToolPanel.parentElement.removeChild(this.activeToolPanel);
    }
    this.svgHolder.style.width = '100%';
    this.activeToolPanel = null;
    this.resizeViewer();
}

Browser.prototype.toggleHelpPopup = function(ev) {
    if (this.uiMode === 'help') {
        this.hideToolPanel();
        this.setUiMode('none');
    } else {
        var helpFrame = makeElement('iframe', null, {scrolling: 'yes', seamless: 'seamless', src: this.resolveURL('$$help/index.html'), className: 'help-panel'});
        this.showToolPanel(helpFrame, false);
        this.setUiMode('help');
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
            b.storeStatus();
        }, false);
        optsTable.appendChild(makeElement('tr', [makeElement('td', 'Reverse trackpad scrolling', {align: 'right'}), makeElement('td', scrollModeButton)]));

        var scrollKeyButton = makeElement('input', '', {type: 'checkbox', checked: b.reverseKeyScrolling});
        scrollKeyButton.addEventListener('change', function(ev) {
            b.reverseKeyScrolling = scrollKeyButton.checked;
            b.storeStatus();
        }, false);
        optsTable.appendChild(makeElement('tr', [makeElement('td', 'Reverse scrolling buttons and keys', {align: 'right'}), makeElement('td', scrollKeyButton)]));


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
            b.storeStatus();
        }, false);
        optsTable.appendChild(makeElement('tr', [makeElement('td', 'Vertical guideline', {align: 'right'}), makeElement('td', rulerSelect)]));
        
        var singleBaseHighlightButton = makeElement('input', '', {type: 'checkbox', checked: b.singleBaseHighlight}); 
        singleBaseHighlightButton.addEventListener('change', function(ev) {
            b.singleBaseHighlight = singleBaseHighlightButton.checked;
            b.positionRuler();
            b.storeStatus();
        }, false);
        singleBaseHighlightButton.setAttribute('id','singleBaseHightlightButton'); // making this because access is required when the key 'u' is pressed and the options are visible
        optsTable.appendChild(makeElement('tr', [makeElement('td', 'Display and highlight current genome location', {align: 'right'}), makeElement('td', singleBaseHighlightButton)]));
        
        optsForm.appendChild(optsTable);

        var resetButton = makeElement('button', 'Reset browser', {className: 'btn'}, {marginLeft: 'auto', marginRight: 'auto', display: 'block'});
        resetButton.addEventListener('click', function(ev) {
            b.reset();
        }, false);
        optsForm.appendChild(resetButton);

        this.showToolPanel(optsForm);
        this.setUiMode('opts');
    }
}

function humanReadableScale(x) {
    var suffix = 'bp';
    if (x > 1000000000) {
        x /= 1000000000;
        suffix = 'Gb';
    } else if (x > 1000000) {
        x /= 1000000
        suffix = 'Mb';
    } else if (x > 1000) {
        x /= 1000;
        suffix = 'kb';
    }
    return '' + Math.round(x) + suffix;
}
