// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// spans.js
//

function Range(min, max)
{
    this.min = min;
    this.max = max;
}

function rangeOrder(a, b)
{
    if (a.min < b.min) {
        return -1;
    } else if (a.min > b.min) {
        return 1;
    } else if (a.max < b.max) {
        return -1;
    } else if (b.max > a.max) {
        return 1;
    } else {
        return 0;
    }
}
