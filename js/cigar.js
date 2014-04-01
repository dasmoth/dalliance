
// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// chainset.js: liftover support
//

var CIGAR_REGEXP = new RegExp('([0-9]*)([MIDS])', 'g');

function parseCigar(cigar)
{
    var cigops = [];
    var match;
    while ((match = CIGAR_REGEXP.exec(cigar)) != null) {
        var count = match[1];
        if (count.length == 0) {
            count = 1;
        }
        cigops.push({cnt: count|0, op: match[2]});
    }
    return cigops;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        parseCigar: parseCigar
    };
}