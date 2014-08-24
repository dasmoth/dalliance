/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// export-config.js
//

if (typeof(require) !== 'undefined') {
    var browser = require('./cbrowser');
    var Browser = browser.Browser;

    var utils = require('./utils');
    var shallowCopy = utils.shallowCopy;

    var sha1 = require('./sha1');
    var hex_sha1 = sha1.hex_sha1;

    var das = require('./das');
    var copyStylesheet = das.copyStylesheet;
}

Browser.prototype.exportFullConfig = function(opts) {
    opts = opts || {};

    var config = {
        chr: this.chr,
        viewStart: this.viewStart|0,
        viewEnd: this.viewEnd|0,
        cookieKey: 'dalliance_' + hex_sha1(Date.now()),

        coordSystem: this.coordSystem,

        sources: this.exportSourceConfig(),

        chains: this.exportChains()
    };

    if (this.prefix)
        config.prefix = this.prefix;

    return config;
}

Browser.prototype.exportChains = function() {
    var cc = {};
    var cs = this.chains || {};
    for (var k in cs) {
        cc[k] = cs[k].exportConfig();
    }
    return cc;
}

Browser.prototype.exportSourceConfig = function(opts) {
    opts = opts || {};

    var sourceConfig = [];
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        var tier = this.tiers[ti];
        var source = shallowCopy(tier.dasSource);

        if (source.noPersist)
            continue;

        source.coords = undefined;
        source.props = undefined;
        if (!source.disabled)
            source.disabled = undefined;

        if (tier.config.stylesheet) {
            source.style = copyStylesheet(tier.config.stylesheet).styles;
            source.stylesheet_uri = undefined;
        } else if (source.style) {
            source.style = copyStylesheet({styles: source.style}).styles;
        }

        if (typeof(tier.config.name) === 'string') {
            source.name = tier.config.name;
        }

        if (tier.config.height !== undefined) {
            source.forceHeight = tier.config.height;
        }
        if (tier.config.forceMin !== undefined) {
            source.forceMin = tier.config.forceMin;
        }
        if (tier.config.forceMinDynamic)
            source.forceMinDynamic = tier.config.forceMinDynamic;
        if (tier.config.forceMax !== undefined) {
            source.forceMax = tier.config.forceMax;
        }
        if (tier.config.bumped !== undefined) {
            source.bumped = tier.config.bumped;
        }
        if (tier.config.forceMaxDynamic)
            source.forceMaxDynamic = tier.config.forceMaxDynamic;

        sourceConfig.push(source);
    }

    return sourceConfig;
}

Browser.prototype.exportPageTemplate = function(opts) {
    opts = opts || {};
    var template = '<html>\n' +
                   '  <head>\n' +
                   '    <script language="javascript" src="' + this.resolveURL('$$dalliance-compiled.js') + '"></script>\n' +
                   '    <script language="javascript">\n' +
                   '      var dalliance_browser = new Browser(' + JSON.stringify(this.exportFullConfig(opts), null, 2) + ');\n' +
                   '    </script>\n' +  
                   '  </head>\n' +
                   '  <body>\n' +
                   '    <div id="svgHolder">Dalliance goes here</div>\n' +
                   '  </body>\n' +
                   '<html>\n';

    return template;
}