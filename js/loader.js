function addScript(uri) {
    var script = document.createElement('script');
    script.language = 'javascript';
    script.src = uri;
    __script = script;

    var scriptNodes = document.getElementsByTagName('script');
    var currentScriptNode = scriptNodes[scriptNodes.length - 1];
    var parent = currentScriptNode.parentElement;
    if (parent.lastChild == currentScriptNode)
        parent.appendChild(script);
    else 
        parent.insertBefore(script, currentScriptNode.nextSibling);
}

DALLIANCE_SOURCES = [
    'js/bam.js',
    'js/bigwig.js',
    'js/das.js',
    'js/spans.js',
    'js/utils.js',
    'js/cbrowser.js',
    'js/feature-popup.js',
    'js/tier.js',
    'js/features.js',
    'js/color.js',
    'js/feature-draw.js',
    'js/sequence-draw.js',
    'js/domui.js',
    'js/karyoscape.js',
    'js/quant-config.js',
    'js/track-adder.js',
    'js/chainset.js',
    'js/version.js',
    'js/sha1.js',
    'js/sample.js',
    'js/kspace.js',
    'js/bin.js',
    'js/twoBit.js',
    'js/thub.js',
    'js/svg-export.js',
    'js/browser-ui.js',
    'js/glyphs.js',
    'js/session.js',
    'js/jbjson.js',
    'js/sourceadapters.js',
    'js/ensembljson.js',
    'js/overlay.js',
    'js/tier-actions.js',
    'js/tier-edit.js',
    'js/search.js',
    'jszlib/js/inflate.js',
    'polyfills/html5slider.js'
];

for (var si = 0; si < DALLIANCE_SOURCES.length; ++si) {
    addScript(DALLIANCE_SOURCES[si]);
}