var VERSION = {
    MAJOR: 0,
    MINOR: 3,
    MICRO: 81
}

VERSION.toString = function() {
    return '' + this.MAJOR + '.' + this.MINOR + '.' + this.MICRO;
}
