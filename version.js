var VERSION = {
    MAJOR: 0,
    MINOR: 3,
    MICRO: 78
}

VERSION.toString = function() {
    return '' + this.MAJOR + '.' + this.MINOR + '.' + this.MICRO;
}
