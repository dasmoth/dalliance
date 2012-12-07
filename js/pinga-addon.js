
var host = 'localhost';

var TABLE_GENOTYPE_INDEX    = 0;
var TABLE_LOCUS_INDEX       = 1;
var TABLE_METHYLATION_INDEX = 2;
var TABLE_SAMPLE_INDEX      = 3;

var seriesColors = [
        '#4572A7',
        'rgba(255, 0, 0, 0.3)',
        'rgba(0, 255, 0, 0.3)',
        'rgba(0, 0, 255, 0.3)',
        'rgba(255, 0, 255, 0.3)',
        'rgba(255, 255, 0, 0.3)',
        'rgba(0, 255, 255, 0.3)'
    ];

var selectedSite = '';
var casesMean = 0.0;
var controlsMean = 0.0;

var methylationtable = null;

var comparisonChart;

pingaFeatureDetailsCallback = function(ev, feature, group, graphOnly) {
    if (!feature.id.match(/^cg\d+(\/\d+)?/))
        return false;

    $.ajax({
        url: 'http://' + host + '/das/pinga/features?segment=' + feature.segment + ':' + feature.min + ',' + feature.max,
        success: function(data) {
            var features = data.getElementsByTagName('FEATURE');

            if (features.length == 0)
                return;

            var site = features[0].getAttribute('id').replace(/\/.*$/, '');
            selectedSite = site;

            var labels = new Array();

            // Cases and control quantiles:
            var quantile = 50.0; // percentiles
            var cases = new Array();
            var controls = new Array();
            var caseQuantiles = new Array();
            var controlQuantiles = new Array();

            for (var i = 0; i < features.length; i++) {
                var scoreString = features[i].getElementsByTagName('SCORE')[0].childNodes[0].nodeValue;
                var value = parseFloat(scoreString.replace(/,.*$/, ''));
                var isCase = scoreString.replace(/^.*?,/, '') == '1';
                labels.push(features[i].getAttribute('id').replace(/.*?_/, '').replace(/ .*$/, ''));

                if (isCase)
                    cases.push(value);
                else
                    controls.push(value);
            }

            cases.sort();
            controls.sort();

            var k = 1;
            for (i = 0; i < cases.length; i++)
                if (i + 1 >= Math.ceil(cases.length / quantile * k)) {
                    caseQuantiles.push(cases[i]);
                    k++;
                }
            k = 1;
            for (i = 0; i < controls.length; i++)
                if (i + 1 >= Math.ceil(controls.length / quantile * k)) {
                    controlQuantiles.push(controls[i]);
                    k++;
                }

            var quantileSeries = new Array();
            for (i = 0; i < caseQuantiles.length; i++)
                quantileSeries.push([ caseQuantiles[i], controlQuantiles[i] ]);

            // Calculate means:
            casesMean = 0.0;
            for (i = 0; i < cases.length; i++)
                casesMean += cases[i];
            casesMean /= cases.length;
            controlsMean = 0.0;
            for (i = 0; i < controls.length; i++)
                controlsMean += controls[i];
            controlsMean /= controls.length;

            makeSiteChart(site);

            for (i = 0; i < quantileSeries.length; i++)
                chart.addSeries({ type: 'scatter', name: 'Quantile ' + (i + 1) + '/' + quantileSeries.length, data: [ quantileSeries[i] ] });

            if (!graphOnly)
                pingaSaveValue(feature.segment, feature.min);
            pingaFlashTab($('#methylationtab'));
            pingaUpdateMethylationtableClickCallbacks();
        }
    });

    return true;
}

pingaUpdateMethylationtableClickCallbacks = function() {
    $('#savedmethylationvalues tbody tr').unbind('click');
    $('#savedmethylationvalues tbody tr').click(function(e) {
        if ($(this).hasClass('row_selected')) {
            $(this).removeClass('row_selected');
        } else {
            methylationtable.$('tr.row_selected').removeClass('row_selected');
            $(this).addClass('row_selected');
            var feature = {
                id: $(this)[0].children[0].innerHTML,
                segment: $(this)[0].children[1].innerHTML,
                min: $(this)[0].children[2].innerHTML,
                max: $(this)[0].children[2].innerHTML
            };
            pingaFeatureDetailsCallback(null, feature, {}, true);
        }
    });
}

pingaFlashTab = function(element) {
    if (element.hasClass('active'))
        return;
    element.effect('highlight', { color: '#fff', queue: false, complete: function() { pingaEffectiveFlashTab($('#methylationtab')); }}, 10);
}

// Private function:
pingaEffectiveFlashTab = function(element) {
    element.effect('highlight', { color: '#08c' }, 100);
    element.effect('highlight', { color: '#08c' }, 200);
    element.effect('highlight', { color: '#08c' }, 100);
    element.effect('highlight', { color: '#08c' }, 200);
}

/* Currently non-functional way of saving DataTable contents. */
pingaSaveTable = function() {
    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/service/csv/table',
        contentType: 'text/csv',
        data: { table: $('#savedmethylationvalues').dataTable().fnGetData() },
        success: function(data) {
            window.location = 'http://' + host + '/pinga/service/fetch/' + data
        }
    });
}

pingaClearTable = function() {
    $('#savedmethylationvalues').dataTable().fnClearTable();
    comparisonChart.destroy();
    makeComparisonChart();
}

pingaSaveValue = function(chromosome, coordinate) {
    $('#savedmethylationvalues').dataTable().fnAddData([
        selectedSite,
        chromosome,
        coordinate,
        casesMean,
        controlsMean
    ]);
    comparisonChart.addSeries({ type: 'scatter', name: 'Site ' + selectedSite, data: [ [ casesMean, controlsMean ] ] });
    $('#savedmethylationvalues tbody tr').removeClass('row_selected');
}

pingaSaveRangeCallback = function(segment, min, max) {
    b.refresh();
    $.ajax({
        url: 'http://' + host + '/das/pinga_means/features?segment=' + segment + ':' + min + ',' + max,
        success: function(data) {
            var features = data.getElementsByTagName('FEATURE');

            if (features.length == 0)
                return;

            var coordinates = {};
            var casesBySite = {};
            var controlsBySite = {};
            for (var i = 0; i < features.length; i++) {
                var site = features[i].getAttribute('id').replace(/\/.*$/, '');
                var isCase = features[i].getAttribute('id').indexOf(site + '/1') === 0;
                var coordinate = parseFloat(features[i].getElementsByTagName('START')[0].childNodes[0].nodeValue);
                var value = parseFloat(features[i].getElementsByTagName('SCORE')[0].childNodes[0].nodeValue);

                coordinates[site] = coordinate;

                if (isCase)
                    casesBySite[site] = value;
                else
                    controlsBySite[site] = value;
            }

            var sites = Object.keys(casesBySite);
            var data = new Array();
            for (i = 0; i < sites.length; i++) {
                var site = sites[i];

                if (casesBySite[site] != null && controlsBySite[site] != null) {
                    $('#savedmethylationvalues').dataTable().fnAddData([
                        site,
                        segment,
                        coordinates[site],
                        casesBySite[site],
                        controlsBySite[site]
                    ]);
                    data.push([ casesBySite[site], controlsBySite[site] ]);
                }
            }
            comparisonChart.addSeries({ type: 'scatter', name: 'Chr' + segment + ':' + min + '-' + max , data: data });
            pingaFlashTab($('#methylationtab'));
            pingaUpdateMethylationtableClickCallbacks();
        }
    });
}

makeSiteChart = function(site) {
            chart = new Highcharts.Chart({
                title: { text: 'Site ' + site },
                legend: { enabled: false },
                xAxis: {
                    title: { text: 'Beta Value Quantiles (Cases)' },
                    min: 0.0,
                    max: 1.0,
                    plotBands: [
                        { from: 0.0, to: 0.1, color: 'rgba(0, 0, 255, 0.05)', label: { text: '', style: { color: '#666666' } } },
                        { from: 0.9, to: 1.0, color: 'rgba(255, 0, 0, 0.05)', label: { text: '', style: { color: '#666666' } } }
                    ]
                },
                yAxis: {
                    title: { text: 'Beta Value Quantiles (Controls)' },
                    min: 0.0,
                    max: 1.0,
                    plotBands: [
                        { from: 0.0, to: 0.1, color: 'rgba(0, 0, 255, 0.05)', label: { text: 'Unmethylated', style: { color: '#666666' } } },
                        { from: 0.9, to: 1.0, color: 'rgba(255, 0, 0, 0.05)', label: { text: 'Methylated', style: { color: '#666666' } } }
                    ]
                },
                chart: { renderTo: 'chart', zoomType: 'xy', width: 500 },
                series: [
                    {
                        type: 'line',
                        name: 'Diagonal',
                        data: [ [ 0, 0 ], [ 1, 1 ] ],
                        marker: { enabled: false },
                        enableMouseTracking: false,
                        legendIndex: 9999999
                    }
                ]
            });

}

makeComparisonChart = function() {
    comparisonChart = new Highcharts.Chart({
        title: { text: 'Case/Control Comparison' },
        xAxis: { title: { text: 'Beta Value (Cases)' }, min: 0.0, max: 1.0 },
        yAxis: { title: { text: 'Beta Value (Controls)' }, min: 0.0, max: 1.0 },
        chart: { renderTo: 'comparison', zoomType: 'xy', width: 500 },
        colors: seriesColors,
        series: [{
            type: 'line',
            name: 'Diagonal',
            data: [ [ 0, 0 ], [ 1, 1 ] ],
            marker: { enabled: false },
            enableMouseTracking: false,
            legendIndex: 9999999
        }]
    });
}

pingaSelectionChange = function(listItem) {
    var completeList = listItem.parentElement.parentElement.children;
    for (var i = 0; i < completeList.length; i++) {
        var item = completeList[i];
        item.className = item.className.replace(/\bactive\b/, '');
    }
    if (listItem.parentElement.className == '')
        listItem.parentElement.className = 'active';
    else
        listItem.parentElement.className = listItem.parentElement.className + ' active';

    var id = listItem.parentElement.id;
    if (id)
        pingaSetQueryConstraints('Methylation',
            document.getElementsByClassName('sex active')[0].id.substr(3) +
            ',' +
            document.getElementsByClassName('group active')[0].id.substr(5));
}

pingaSetQueryConstraints = function(name, query) {
    if (!query || query == '')
        query = '/';
    else
        query = '__' + query + '/';

    b.tiers.forEach(function(tier) {
        if (tier.dasSource.name === name) {
            tier.dasSource.uri = tier.dasSource.uri.replace(/(__[^/]*)?\/$/, '') + query;
            b.refreshTier(tier);
        }
    });
}

pingaShowSitePlot = function() {
    $('#showsideplot')[0].setAttribute('class', 'active');
    $('#showrangeplot')[0].removeAttribute('class');
    $('#comparison').animate(
        {
            opacity: 0
        }, {
            complete: function() {
                $('#comparison').hide();
                $('#chart').show();
                $('#chart').animate({
                    opacity: 1
                });
            }
        });
}

pingaShowRangePlot = function() {
    $('#showrangeplot')[0].setAttribute('class', 'active');
    $('#showsideplot')[0].removeAttribute('class');
    $('#chart').animate(
        {
            opacity: 0
        }, {
            complete: function() {
                $('#chart').hide();
                $('#comparison').show();
                $('#comparison').animate({
                    opacity: 1
                });
            }
        });
}

var tableRowCounter = 0;

pingaUpdateAnnotationCounts = function(reference_table, annotation_table) {
    var offset = $(reference_table).children('tbody').children().length;
    for (var ordinal = 0; ordinal < $(annotation_table).children('tbody').children().length; ordinal++) {
        $(annotation_table).children('tbody').children()[ordinal].children[0].innerHTML = ordinal + offset + 1;
    }
}

pingaAddTrack = function(table, name, sample_table, locus_table, genometh_table, description) {
    var row = tableRowCounter++;

    var removeIcon = '<i id="removetablerow' + row + '" class="icon-remove-circle"></i>';
    var rowKind = 'class="optionalrow';

    var tables = sample_table + '<br />' + locus_table + '<br />' + genometh_table;

    /*
    var rowHTML = '<tr ' + rowKind + '><td>' + name + '</td><td>' + tables + '</td><td>' + description + '</td><td>' + removeIcon + '</td></tr>';

    $(table).children('tbody').append(rowHTML);
     */
    $(table).dataTable().fnAddData([ [ name, tables, description, removeIcon ] ]);

    $('#removetablerow' + row).click(function() {
        var index = $(table).find('tr').index($(this).parent().parent()) - 1;

        /*
         * Note: Docs say that you can also pass the TR element for removal.
         *       Well, that's not working though. In order to remove a row,
         *       you really only can pass it the row's index (zero based).
         */
        if (index >= 0)
            $(table).dataTable().fnDeleteRow(index);
    });
}

pingaAddColumn = function(table, annotation_table, name, type, description, required, defaultrow, prepend) {
    var ordinal = $(table).children('tbody').children().length + 1;
    var row = tableRowCounter++;

    var removeIcon = '';
    var rowKind = 'class="requiredrow';
    if (!required) {
        rowKind = 'class="optionalrow';
        removeIcon = '<i id="removetablerow' + row + '" class="icon-remove-circle"></i>';
    }
    if (!defaultrow)
        rowKind += '"';
    else
        rowKind += ' defaultrow"';

    var rowHTML = '<tr ' + rowKind + '><td>' + ordinal + '</td><td>' + name + '</td><<td>' + type + '</td><<td>' + description + '</td><<td>' + removeIcon + '</td><</tr>';

    if (!prepend)
        $(table).children('tbody').append(rowHTML);
    else
        $(table).children('tbody').prepend(rowHTML);

    $('#removetablerow' + row).click(function() {
        var table = $(this).parent().parent().parent();
        $(this).parent().parent().remove();
        for (var ordinal = 0; ordinal < table.children().length; ordinal++) {
            table.children()[ordinal].children[0].innerHTML = ordinal + 1;
        }
        pingaUpdateAnnotationCounts('#uploadtable', '#locustable');
    });

    if (prepend)
        for (var ordinal = 0; ordinal < $(table).children('tbody').children().length; ordinal++) {
            $(table).children('tbody').children()[ordinal].children[0].innerHTML = ordinal + 1;
        }

    pingaUpdateAnnotationCounts(table, annotation_table);
}

pingaUpdateAvailableProjects = function(selection) {
    var items = $(selection)[0].length;
    for (var i = items - 1; i >= 0; i--)
        if (!$(selection)[0][i].value.match(/\.\.\./))
            $('#' + $(selection)[0][i].id).remove();
    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/metaprojects',
        data: {},
        success: function(data) {
                var tables = [];
                for (var tablename in data) {
                    if (!data.hasOwnProperty(tablename))
                        continue;
                    tables.push(tablename);
                }
                tables = tables.sort();
                for (var tableNo = 0; tableNo < tables.length; tableNo++) {
                    projectname = tables[tableNo];
                    $('#projectchoice').append('<option id="projectchoice' + tables.indexOf(projectname) + '">' + projectname + '</option>');
                }
            }
        });
}

pingaUpdateAvailableTables = function(selection) {
    var items = $(selection)[0].length;
    for (var i = items - 1; i >= 0; i--)
        if (!$(selection)[0][i].value.match(/ /))
            $('#' + $(selection)[0][i].id).remove();
    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/metatables',
        data: {},
        success: function(data) {
                var tables = [];
                for (var tablename in data) {
                    if (!data.hasOwnProperty(tablename))
                        continue;
                    tables.push(tablename);
                }
                tables = tables.sort();
                for (var tableNo = 0; tableNo < tables.length; tableNo++) {
                    tablename = tables[tableNo];
                    $('#tablechoice').append('<option id="tablechoice' + tables.indexOf(tablename) + '">' + tablename + '&nbsp;(' + data[tablename].replace(/;.*$/, '') + ')</option>');
                }
            }
        });
}

pingaMakeGenotypeAlleleTable = function(table, annotation_table) {
    $('#locusannotationtoggle').hide();
    $('#genomethannotationtoggle').show();
    $('#sampleannotationtoggle').hide();
    $('#genomethannotation').hide();
    $('#locusannotation').hide();
    $('#sampleannotation').hide();
    $('#tablechoice')[0].selectedIndex = TABLE_GENOTYPE_INDEX;
    pingaUpdateAvailableProjects('#projectchoice');
    pingaUpdateAvailableTables('#tablechoice');
    $(table).children('tbody').children('.defaultrow').remove();
    pingaAddColumn(table, annotation_table, 'enzyme', 'text (up to 20 characters)', '', false, true, true);
    pingaAddColumn(table, annotation_table, 'genotype', 'text (up to 2 characters)', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'target', 'text (up to 20 characters)', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'sample', 'text (up to 10 characters)', '', true, true, true);
}

pingaMakeMethylationSignalTable = function(table, annotation_table) {
    $('#locusannotationtoggle').hide();
    $('#genomethannotationtoggle').show();
    $('#sampleannotationtoggle').hide();
    $('#genomethannotation').hide();
    $('#locusannotation').hide();
    $('#sampleannotation').hide();
    $('#tablechoice')[0].selectedIndex = TABLE_METHYLATION_INDEX;
    pingaUpdateAvailableProjects('#projectchoice');
    pingaUpdateAvailableTables('#tablechoice');
    $(table).children('tbody').children('.defaultrow').remove();
    pingaAddColumn(table, annotation_table, 'pvalue', 'rational number', '', false, true, true);
    pingaAddColumn(table, annotation_table, 'signal_b', 'integer', '', false, true, true);
    pingaAddColumn(table, annotation_table, 'signal_a', 'integer', '', false, true, true);
    pingaAddColumn(table, annotation_table, 'intensity', 'integer', '', false, true, true);
    pingaAddColumn(table, annotation_table, 'beta', 'rational number', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'target', 'text (up to 20 characters)', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'sample', 'text (up to 10 characters)', '', true, true, true);
}

pingaMakeSampleTable = function(table, annotation_table) {
    $('#locusannotationtoggle').hide();
    $('#genomethannotationtoggle').hide();
    $('#sampleannotationtoggle').show();
    $('#genomethannotation').hide();
    $('#locusannotation').hide();
    $('#sampleannotation').hide();
    $('#tablechoice')[0].selectedIndex = TABLE_SAMPLE_INDEX;
    pingaUpdateAvailableProjects('#projectchoice');
    pingaUpdateAvailableTables('#tablechoice');
    $(table).children('tbody').children('.defaultrow').remove();
    pingaAddColumn(table, annotation_table, 'age_diagnosis', 'integer', '', false, true, true);
    pingaAddColumn(table, annotation_table, 'is_male', 'boolean (yes/no, on/off, etc.)', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'is_case', 'boolean (yes/no, on/off, etc.)', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'sample', 'text (up to 10 characters)', '', true, true, true);
}

pingaMakeLocusTable = function(table, annotation_table) {
    $('#locusannotationtoggle').show();
    $('#genomethannotationtoggle').hide();
    $('#sampleannotationtoggle').hide();
    $('#genomethannotation').hide();
    $('#locusannotation').hide();
    $('#sampleannotation').hide();
    $('#tablechoice')[0].selectedIndex = TABLE_LOCUS_INDEX;
    pingaUpdateAvailableProjects('#projectchoice');
    pingaUpdateAvailableTables('#tablechoice');
    $(table).children('tbody').children('.defaultrow').remove();
    pingaAddColumn(table, annotation_table, 'coordinate', 'integer', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'chromosome', 'text (up to 24 characters)', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'build', 'integer', '', true, true, true);
    pingaAddColumn(table, annotation_table, 'target', 'text (up to 20 characters)', '', true, true, true);
}

pingaSelectProject = function(projectname, selection) {
    if (selection.value.match(/\.\.\./)) {
        $(projectname).attr('readonly', null);
        $(projectname)[0].value = '';
    } else {
        $(projectname)[0].value = selection.value;
        $(projectname).attr('readonly', 'readonly');
    }
}

pingaSelectUploadTable = function(table, annotation_table, tablename, selection) {
    if (selection.selectedIndex === TABLE_GENOTYPE_INDEX) {
        $(tablename)[0].value = ''
        $(tablename).attr('readonly', null);
        pingaMakeGenotypeAlleleTable(table, annotation_table);
    } else if (selection.selectedIndex === TABLE_LOCUS_INDEX) {
        $(tablename)[0].value = ''
        $(tablename).attr('readonly', null);
        pingaMakeLocusTable(table, annotation_table);
    } else if (selection.selectedIndex === TABLE_METHYLATION_INDEX) {
        $(tablename)[0].value = ''
        $(tablename).attr('readonly', null);
        pingaMakeMethylationSignalTable(table, annotation_table);
    } else if (selection.selectedIndex === TABLE_SAMPLE_INDEX) {
        $(tablename)[0].value = ''
        $(tablename).attr('readonly', null);
        pingaMakeSampleTable(table, annotation_table);
    } else {
        db_tablename = selection.value.replace(/\(.*\)/g, '').trim();
        $(tablename)[0].value = db_tablename;
        $(tablename).attr('readonly', 'readonly');
        $('#tablechoice')[0].selectedIndex = selection.selectedIndex;
        $(table).children('tbody').children().remove();
        $.ajax({
            type: 'POST',
            url: 'http://' + host + '/pinga/metatable',
            data: { 'tablename' : db_tablename },
            success: function(data) {
                    var i = 0;
                    while (data.hasOwnProperty('' + i))
                        i++;
                    while (--i >= 0) {
                        var row = data['' + i];
                        pingaAddColumn(table, annotation_table, row[0], pingaSQLTypeToInformativeText(row[1]), row[2], true, true, true);
                    }
                }
            });
    }
}

pingaSQLTypeToInformativeText = function(sql) {
    var text = '';

    if (sql === 'INT' || sql === 'INTEGER') {
        text = 'integer';
    } else if (sql === 'REAL') {
        text = 'rational number';
    } else if (sql === 'BOOLEAN') {
        text = 'boolean (yes/no, on/off, etc.)';
    } else if (sql.match(/^VARCHAR\(/)) {
        text = 'text (up to ' + sql.replace(/[^0-9]+/g, '') + ' characters)';
    } else {
        // TODO Handle error.
    }

    return text;
}

pingaSubmitUpload = function(table, selection, destination, newTableName) {
    var payload = {};

    selection = $(selection)[0];

    if (destination.match(/\.\.\./))
        payload['tablename'] = newTableName;
    else
        payload['tablename'] = destination.replace(/&.*;/g, '').replace(/\(.*\)/g, '').trim();

    // Set tablename for actual file upload form (so that the POST handler knows where
    // to store the data):
    $('#uploaddestination')[0].value = payload['tablename'];

    if (selection.selectedIndex === TABLE_GENOTYPE_INDEX)
        payload['tabletype'] = 'Genotyping; Format 1';
    else if (selection.selectedIndex === TABLE_LOCUS_INDEX)
        payload['tabletype'] = 'Locus; Format 1';
    else if (selection.selectedIndex === TABLE_METHYLATION_INDEX)
        payload['tabletype'] = 'Methylation; Format 1';
    else if (selection.selectedIndex === TABLE_SAMPLE_INDEX)
        payload['tabletype'] = 'Sample; Format 1';

    for (var ordinal = 0; ordinal < $(table).children('tbody').children().length; ordinal++) {
        var columnNo = $(table).children('tbody').children()[ordinal].children[0].innerHTML;
        var name = $(table).children('tbody').children()[ordinal].children[1].innerHTML;
        var type = $(table).children('tbody').children()[ordinal].children[2].innerHTML;
        var description = $(table).children('tbody').children()[ordinal].children[3].innerHTML;

        if (ordinal + 1 != columnNo) {
            // Uh-oh! This should not be possible, because it indicates that the column numbers
            // have not been updated properly. The data in the table might be corrupt.
            return;
        }

        if (type === 'integer') {
            type = 'INTEGER';
        } else if (type === 'rational number') {
            type = 'REAL';
        } else if (type === 'boolean (yes/no, on/off, etc.)') {
            type = 'BOOLEAN';
        } else if (type.match(/text \(up to [0-9]+ characters\)/)) {
            type = 'VARCHAR(' + type.replace(/[^0-9]+/g, '') + ')';
        } else {
            // Some invalid type sneaked in, which could mean that the table is corrupt.
            return;
        }

        payload['' + ordinal] = [ name, type, description ];
    }

    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/upload',
        data: payload
    });
}

pingaCreateTrack = function(table, selection, destination, newTableName) {
    var payload = {};

    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/createtrack',
        data: payload
    });
}

pingaUpdateTrackTable = function(table, sampleSelection, locusSelection, genomethSelection) {
    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/metatables',
        data: {},
        success: function(data) {
                var tables = [];
                for (var tablename in data) {
                    if (!data.hasOwnProperty(tablename))
                        continue;
                    tables.push(tablename);
                }
                tables = tables.sort();

                $(sampleSelection).find('option').remove();
                $(locusSelection).find('option').remove();
                $(genomethSelection).find('option').remove();

                for (var tableNo = 0; tableNo < tables.length; tableNo++) {
                    tablename = tables[tableNo];
                    if (data[tablename].match(/^Sample;/)) {
                        $(sampleSelection).append('<option id="sampletablechoice' + tables.indexOf(tablename) + '">' + tablename + '</option>');
                    } else if (data[tablename].match(/^Locus;/)) {
                        $(locusSelection).append('<option id="locustablechoice' + tables.indexOf(tablename) + '">' + tablename + '</option>');
                    } else if (data[tablename].match(/^(Genotype|Methylation);/)) {
                        $(genomethSelection).append('<option id="genomethtablechoice' + tables.indexOf(tablename) + '">' + tablename + '</option>');
                    } else {
                        // TODO Woops...
                    }
                }
            }
        });
    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/metatracks',
        data: {},
        success: function(data) {
                var tracks = [];
                for (var trackname in data) {
                    if (!data.hasOwnProperty(trackname))
                        continue;
                    tracks.push(trackname);
                }
                tracks = tracks.sort();

                $(table).dataTable().fnClearTable();

                for (var trackNo = 0; trackNo < tracks.length; trackNo++) {
                    trackname = tracks[trackNo];
                    pingaAddTrack(table, trackname, data[trackname][1], data[trackname][2], data[trackname][3], data[trackname][0]);
                }

                $(table).dataTable().fnDraw();
        }
        });
}

Browser.prototype.registerFeaturePopupHandler(pingaFeatureDetailsCallback);
Browser.prototype.registerHighlightHandler(pingaSaveRangeCallback);

$(document).ready(function() {
    // Make all removable table rows, well, removable:
    $('.removabletablerow').click(function() {
        var table = $(this).parent().parent().parent();
        $(this).parent().parent().remove();
        for (var ordinal = 0; ordinal < table.children().length; ordinal++) {
            table.children()[ordinal].children[0].innerHTML = ordinal + 1;
        }
        pingaUpdateAnnotationCounts('#uploadtable', '#locustable');
    });

    // Site data:
    makeSiteChart('- none selected -');

    // Aggregated data:
    makeComparisonChart();

    methylationtable = $('#savedmethylationvalues').dataTable();

    // jQuery Datatables UI tweaking:
    $('#savedmethylationvalues_length')[0].children[0].setAttribute('style', 'vertical-align: baseline');
    $('#savedmethylationvalues_length')[0].children[0].children[0].setAttribute('style', 'vertical-align: baseline');
    $('#savedmethylationvalues_length')[0].children[0].children[0].removeAttribute('size');
    $('.dataTables_filter')[0].children[0].setAttribute('style', 'vertical-align: baseline');
    $('.dataTables_filter')[0].children[0].children[0].setAttribute('style', 'vertical-align: baseline');
    $('.dataTables_filter')[0].children[0].children[0].setAttribute('class', 'search-query')

    // Show only one kind of plot, hide the other one:
    $('#comparison').animate(
        {
            opacity: 0,
            height: 'toggle'
        });

    $('#uploaddialog').on('show', function() {
        $('#tableconfig').show(0);
        $('#uploaddatafooter').show(0);
        $('#attachments').hide(0);
    });

    $('#tracktable').dataTable({
        "sDom": "tip",
        "sPaginationType": "bootstrap",
        "iDisplayLength": 5
    });
});

