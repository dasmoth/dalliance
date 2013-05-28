/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2013
//
// browser-us.js: standard UI wiring (needs refactoring!)
//

window.addEventListener('load', function() {

  b.addFeatureListener(function(ev, hit) {
    b.featurePopup(ev, hit, null);
  });

  b.addFeatureHoverListener(function(ev, hit) {
     // console.log('hover: ' + miniJSONify(hit));
  });

  function formatLongInt(n) {
    return (n|0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  b.addViewListener(function(chr, min, max, zoom) {
      document.getElementById('locfield').value = ('chr' + chr + ':' + formatLongInt(min) + '..' + formatLongInt(max));
      zoomSlider.value = zoom;
      if (b.storeStatus) {
          b.storeStatus();
      }
  });

  b.addRegionSelectListener(function(chr, min, max) {
      // console.log('chr' + chr + ':' + min + '..' + max);
      // b.highlightRegion(chr, min, max);
      // console.log('selected ' + b.featuresInRegion(chr, min, max).length);
  });

  b.addTierListener(function() {
      if (b.storeStatus) {
          b.storeStatus();
      }
  });



    var addTrackBtn = document.getElementById('add-track-button');
    addTrackBtn.addEventListener('click', function(ev) {
      b.showTrackAdder(ev);
    }, false);
    b.makeTooltip(addTrackBtn, 'Add a track!');

    var zoomInBtn = document.getElementById('zoom-in');
    zoomInBtn.addEventListener('click', function(ev) {
      ev.stopPropagation(); ev.preventDefault();

      b.zoomStep(-10);
    }, false);
    b.makeTooltip(zoomInBtn, 'Zoom in');

    var regionField = document.getElementById('locfield');

    var zoomOutBtn = document.getElementById('zoom-out');
    zoomOutBtn.addEventListener('click', function(ev) {
      ev.stopPropagation(); ev.preventDefault();

      b.zoomStep(10);
    }, false);
    b.makeTooltip(zoomOutBtn, 'Zoom out');

    var zoomSlider = document.getElementById('zoom-slider');
    zoomSlider.addEventListener('change', function(ev) {
	b.zoomSliderValue = (1.0 * zoomSlider.value);
	b.zoom(Math.exp((1.0 * zoomSlider.value) / b.zoomExpt));
    }, false);
    zoomSlider.min = b.zoomMin;
    zoomSlider.max = b.zoomMax;

    var favBtn = document.getElementById('favourites-button');
    favBtn.addEventListener('click', function(ev) {
       ev.stopPropagation(); ev.preventDefault();
    }, false);
    b.makeTooltip(favBtn, 'Favourite regions');

    var svgBtn = document.getElementById('export-svg-button');
    svgBtn.addEventListener('click', function(ev) {
       ev.stopPropagation(); ev.preventDefault();
       saveSVG(b);
    }, false);
    b.makeTooltip(svgBtn, 'Export publication-quality SVG.');

    var resetBtn = document.getElementById('reset-button');
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
  }, false);
