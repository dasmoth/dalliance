
var host = 'localhost';

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

var comparisonChart;

pingaFeatureDetailsCallback = function(ev, feature, group) {
    if (!feature.id.match(/^cg\d+\/\d+/))
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
        }
    });

    return true;
}

pingaSaveTable = function() {
    $.ajax({
        type: 'POST',
        url: 'http://' + host + '/pinga/service/csv/table',
        contentType: 'text/csv',
        data: { table: $('#savedvalues').dataTable().fnGetData() },
        success: function(data) {
            window.location = 'http://' + host + '/pinga/service/fetch/' + data
        }
    });
}

pingaClearTable = function() {
    $('#savedvalues').dataTable().fnClearTable();
    comparisonChart.destroy();
    makeComparisonChart();
}

pingaSaveValue = function() {
    $('#savedvalues').dataTable().fnAddData([
        selectedSite,
        casesMean,
        controlsMean
    ]);
    comparisonChart.addSeries({ type: 'scatter', name: 'Site ' + selectedSite, data: [ [ casesMean, controlsMean ] ] });
}

pingaSaveRangeCallback = function(segment, min, max) {
    $.ajax({
        url: 'http://' + host + '/das/pinga_means/features?segment=' + segment + ':' + min + ',' + max,
        success: function(data) {
            var features = data.getElementsByTagName('FEATURE');

            if (features.length == 0)
                return;

            var casesBySite = {};
            var controlsBySite = {};
            for (var i = 0; i < features.length; i++) {
                var site = features[i].getAttribute('id').replace(/\/.*$/, '');
                var isCase = features[i].getAttribute('id').indexOf(site + '/1') === 0;
                var value = parseFloat(features[i].getElementsByTagName('SCORE')[0].childNodes[0].nodeValue);

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
                    $('#savedvalues').dataTable().fnAddData([
                        site,
                        casesBySite[site],
                        controlsBySite[site]
                    ]);
                    data.push([ casesBySite[site], controlsBySite[site] ]);
                }
            }
            comparisonChart.addSeries({ type: 'scatter', name: 'Chr' + segment + ':' + min + '-' + max , data: data });
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
                chart: { renderTo: 'chart', zoomType: 'xy' },
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
        chart: { renderTo: 'comparison', zoomType: 'xy' },
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

Browser.prototype.registerFeaturePopupHandler(pingaFeatureDetailsCallback);
Browser.prototype.registerHighlightHandler(pingaSaveRangeCallback);

$(document).ready(function() {
    // Site data:
    makeSiteChart('- none selected -');

    // Aggregated data:
    makeComparisonChart();

    $('#savedvalues').dataTable();
});

