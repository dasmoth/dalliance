// Shim which can be (optionally) added to the standalone build to export
// the Biodalliance 0.13 API into the top level namespace.

if (window) {
    window.Browser = biodalliance.Browser;
    window.sourcesAreEqual = biodalliance.sourcecompare.sourcesAreEqual;
    window.Chainset = biodalliance.chainset.Chainset;

    window.makeElement = biodalliance.utils.makeElement;

    window.dalliance_registerSourceAdapterFactory = biodalliance.sourceadapters.registerSourceAdapterFactory;
    window.dalliance_registerParserFactory = biodalliance.sourceadapters.registerParserFactory;
    window.dalliance_makeParser = biodalliance.sourceadapters.makeParser;

    window.DASSequence = biodalliance.das.DASSequence;
    window.DASFeature = biodalliance.das.DASFeature;
    window.DASGroup = biodalliance.das.DASGroup;
    window.DASStylesheet = biodalliance.das.DASStylesheet;
    window.DASStyle = biodalliance.das.DASStyle;
    window.DASSource = biodalliance.das.DASSource;

    window.Ruler = biodalliance.ruler.Ruler;
    window.rulerDrawCallback = biodalliance.ruler.rulerDrawCallback;
}
