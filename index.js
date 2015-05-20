module.exports = {
    browser: require('./js/cbrowser').Browser,
    chainset: require('./js/chainset').Chainset,
    sourcesAreEqual: require('./js/sourcecompare').sourcesAreEqual,
    makeElement: require('./js/utils').makeElement
};
