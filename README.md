Biodalliance: fast, embeddable genome visualization
=========================

Dalliance is a genome viewing tool that aims to offer a high
level of interactivity while working entirely within your web
browser. It works with current versions of Chrome, Firefox, and
Safari and (with minor visual glitches) Internet Explorer 11.  It
is also usable with current mobile web browsers.

To try it, visit [https://www.biodalliance.org/human37.html](https://www.biodalliance.org/human37.html).


Development
-----------

Dalliance has now switched to a [Gulp](http://gulpjs.com/)-based build
system.  It it still possible to use the files in the js directory
directly, but this is now deprecated and may not be supported in future.

Before building, please install [Node.js](http://nodejs.org/), which
is needed for the NPM package manager.

To build:

        (sudo?) npm install -g gulp
        npm install # Install dependencies
        gulp        # Build Dalliance

...then open any of the HTML files in the `example-browsers` directory
to test.

Electron app
------------

To run as an electron app, do:

```
npm start
```

Documentation
-------------

See [the website](https://www.biodalliance.org).

Reporting bugs
--------------

Dalliance is under active development and we welcome your suggestions.
Right now, probably the best place for bug reports or feature requests
is the [Github issue tracker](https://github.com/dasmoth/dalliance/issues).

There is also a [mailing list](https://groups.google.com/forum/#!forum/biodalliance-dev)
where the project can be discussed.
