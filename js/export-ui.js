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
        exportSelect.appendChild(makeElement('option', 'Dalliance config', {value: 'config'}));
        exportSelect.appendChild(makeElement('option', 'Dalliance sources', {value: 'sources'}));
        exportSelect.appendChild(makeElement('option', 'Dalliance page', {value: 'page'}));
        exportSelect.value = 'svg';
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

        var exportButton = makeElement('button', 'Export', {className: 'btn btn-primary'});
        exportButton.addEventListener('click', function(ev) {
            removeChildren(exportContent);

            var blobURL;
            var note, type, name;
            if (exportSelect.value === 'svg') {
                blobURL = URL.createObjectURL(b.makeSVG({highlights: exportHighlightsToggle.checked,
                                                         ruler: exportRulerToggle.checked ? b.rulerLocation : 'none'}));
                note = 'SVG';
                type = 'image/svg';
                name = 'dalliance-view.svg';
            } else if (exportSelect.value === 'config') {
                var config = JSON.stringify(b.exportFullConfig(), null, 2);
                var blob = new Blob([config], {type: 'text/plain'});
                blobURL = URL.createObjectURL(blob);
                note = 'Configuration';
                type = 'text/plain';
                name = 'dalliance-config.json';
            } else if (exportSelect.value === 'sources') {
                var config = JSON.stringify(b.exportSourceConfig(), null, 2);
                var blob = new Blob([config], {type: 'text/plain'});
                blobURL = URL.createObjectURL(blob);
                note = 'Source array';
                type = 'text/plain';
                name = 'dalliance-sources.json';
            } else if (exportSelect.value === 'page') {
                var page = b.exportPageTemplate();
                var type = 'text/html';
                var blob = new Blob([page], {type: type});
                blobURL = URL.createObjectURL(blob);
                note = 'Page template';
                name = 'dalliance-view.html';
            }

            if (blobURL) {
                var downloadLink = makeElement('a', '[Download]', {
                    href: blobURL,
                    download: 'dalliance-view.svg',
                    type: type
                });

                var previewLink = makeElement('a', '[Preview in browser]', {
                    href: blobURL,
                    type: type,
                    target: '_new'
                });

                exportContent.appendChild(makeElement('p', ['' + note + ' created: ', downloadLink, previewLink]));
            }
        }, false);

        b.addViewListener(function() {
            removeChildren(exportContent);
        });
        b.addTierListener(function() {
            removeChildren(exportContent);
        });

        var exportContent = makeElement('p', '');

        var exportOptsTable = makeElement('table',
            [makeElement('tr',
                [makeElement('th', 'Include highlights', {}, {width: '200px', textAlign: 'right'}),
                 makeElement('td', exportHighlightsToggle)]),
             makeElement('tr',
                [makeElement('th', 'Include vertical guideline'),
                 makeElement('td', exportRulerToggle)])
            ]);

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
