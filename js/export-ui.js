/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// export-ui.js
//

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var utils = require('./utils');
    var makeElement = utils.makeElement;
    var removeChildren = utils.removeChildren;
}

Browser.prototype.openExportPanel = function() {
    var b = this;
    if (this.uiMode === 'export') {
        this.hideToolPanel();
        this.setUiMode('none');
    } else {
        var exportForm = makeElement('div', null, {className: 'export-form'});
        var exportSelect = makeElement('select');
        exportSelect.appendChild(makeElement('option', 'SVG', {value: 'svg'}));
        exportSelect.appendChild(makeElement('option', 'Image', {value: 'png'}));
        exportSelect.appendChild(makeElement('option', 'Dalliance config', {value: 'config'}));
        exportSelect.appendChild(makeElement('option', 'Dalliance sources', {value: 'sources'}));
        exportSelect.appendChild(makeElement('option', 'Dalliance page', {value: 'page'}));
        exportSelect.value = 'svg';

        exportSelect.addEventListener('change', function(ev) {
            removeChildren(exportContent);
            setupEOT();
        }, false);
        exportForm.appendChild(makeElement('p', ['Export as: ', exportSelect]));

        var exportHighlightsToggle = makeElement('input', null, {type: 'checkbox', checked: this.exportHighlights});
        exportHighlightsToggle.addEventListener('change', function(ev) {
            b.exportHighlights = exportHighlightsToggle.checked;
            b.storeStatus();
        }, false);
        var exportRulerToggle = makeElement('input', null, {type: 'checkbox', checked: this.exportRuler});
        exportRulerToggle.addEventListener('change', function(ev) {
            b.exportRuler = exportRulerToggle.checked;
            b.storeStatus();
        }, false);
        var exportRegionToggle = makeElement('input', null, {type: 'checkbox', checked: this.exportRegion});
        exportRegionToggle.addEventListener('change', function(ev) {
            b.exportRegion = exportRegionToggle.checked;
            b.storeStatus();
        }, false);
        var exportBannerToggle = makeElement('input', null, {type: 'checkbox', checked: this.exportBanner});
        exportBannerToggle.addEventListener('change', function(ev) {
            b.exportBanner = exportBannerToggle.checked;
            b.storeStatus();
        }, false);
        var exportScale = makeElement('input', null, {type: 'text', value: '1.0'});
        var exportWidth = makeElement('input', null, {type: 'text', value: '800'});

        var exportButton = makeElement('button', 'Export', {className: 'btn btn-primary'});

        var exportDone = function(blobURL, note, type, name) {
            if (blobURL) {
                var downloadLink = makeElement('a', '[Download]', {
                    href: blobURL,
                    download: name,
                    type: type
                });

                var previewLink = makeElement('a', '[Preview in browser]', {
                    href: blobURL,
                    type: type,
                    target: '_new'
                });

                exportContent.appendChild(makeElement('p', ['' + note + ' created: ', downloadLink, previewLink]));
            }
        }

        exportButton.addEventListener('click', function(ev) {
            removeChildren(exportContent);

            var blobURL;
            if (exportSelect.value === 'svg') {
                blobURL = URL.createObjectURL(b.makeSVG({highlights: exportHighlightsToggle.checked,
                                                         banner: b.exportBanner,
                                                         region: b.exportRegion,
                                                         ruler: exportRulerToggle.checked ? b.rulerLocation : 'none',
                                                         width: parseInt(exportWidth.value) || 800}));
                exportDone(
                    blobURL,
                    'SVG',
                    'image/svg',
                    'dalliance-view.svg'
                );
            } else if (exportSelect.value === 'png') {
                var mult = parseFloat(exportScale.value);
                if (mult < 0.1 || mult > 10) {
                    alert('bad scale ' + mult);
                    return;
                }
                
                b.exportImage({
                    highlights: exportHighlightsToggle.checked,
                    banner: b.exportBanner,
                    region: b.exportRegion,
                    ruler: exportRulerToggle.checked ? b.rulerLocation : 'none',
                    resolutionMultiplier: mult,
                    width: parseInt(exportWidth.value) || 800,
                    blobCallback: function(blob) {
                        exportDone(
                            URL.createObjectURL(blob),
                            'Image',
                            'image/png',
                            'dalliance-view.png'
                        );
                    }
                });
            } else if (exportSelect.value === 'config') {
                var config = JSON.stringify(b.exportFullConfig(), null, 2);
                var blob = new Blob([config], {type: 'text/plain'});
                exportDone(
                    URL.createObjectURL(blob),
                    'Configuration',
                    'text/plain',
                    'dalliance-config.json'
                );
            } else if (exportSelect.value === 'sources') {
                var config = JSON.stringify(b.exportSourceConfig(), null, 2);
                var blob = new Blob([config], {type: 'text/plain'});
                exportDone(
                    blobURL = URL.createObjectURL(blob),
                    'Source array',
                    'text/plain',
                    'dalliance-sources.json'
                );
            } else if (exportSelect.value === 'page') {
                var page = b.exportPageTemplate();
                var type = 'text/html';
                var blob = new Blob([page], {type: type});
                exportDone(
                    URL.createObjectURL(blob),
                    'Page template',
                    'text/html',
                    'dalliance-view.html'
                );
            }
        }, false);

            

        b.addViewListener(function() {
            removeChildren(exportContent);
        });
        b.addTierListener(function() {
            removeChildren(exportContent);
        });

        var exportContent = makeElement('p', '');

        var eotHighlights = makeElement('tr',
                [makeElement('th', 'Include highlights', {}, {width: '400px', textAlign: 'right'}),
                 makeElement('td', exportHighlightsToggle)]);
        var eotGuideline = makeElement('tr',
                [makeElement('th', 'Include vertical guideline', {}, {textAlign: 'right'}),
                 makeElement('td', exportRulerToggle)]);
        var eotScale = makeElement('tr',
            [makeElement('th', 'Scale multiplier', {}, {textAlign: 'right'}),
             makeElement('td', exportScale)]);
        var eotWidth = makeElement('tr',
            [makeElement('th', 'Width (logical px)', {}, {textAlign: 'right'}),
             makeElement('td', exportWidth)]);
        var eotRegion = makeElement('tr',
            [makeElement('th', 'Label with genomic coordinates', {}, {textAlign: 'right'}),
             makeElement('td', exportRegionToggle)]);
        var eotBanner = makeElement('tr',
            [makeElement('th', 'Include banner', {}, {textAlign: 'right'}),
             makeElement('td', exportBannerToggle)]);

        var exportOptsTable = makeElement('table',
            [eotHighlights,
             eotGuideline,
             eotWidth,
             eotScale,
             eotRegion], null, {width: '500px'});
        var setupEOT = function() {
            var es = exportSelect.value;
            eotHighlights.style.display = (es == 'svg' || es == 'png') ? 'table-row' : 'none';
            eotGuideline.style.display = (es == 'svg' || es == 'png') ? 'table-row' : 'none';
            eotScale.style.display = (es == 'png') ? 'table-row' : 'none';
            eotWidth.style.display = (es == 'svg' || es == 'png') ? 'table-row' : 'none';
            eotRegion.style.display = (es == 'svg' || es == 'png') ? 'table-row' : 'none';
            eotBanner.style.display = (es == 'svg' || es == 'png') ? 'table-row' : 'none';
        }
        setupEOT();

        exportForm.appendChild(exportOptsTable);
        exportForm.appendChild(exportButton);
        exportForm.appendChild(exportContent);

        if (this.uiMode !== 'none')
            this.hideToolPanel();
        this.browserHolder.insertBefore(exportForm, this.svgHolder);
        this.activeToolPanel = exportForm;

        this.setUiMode('export');
    }
}
