The renderer test consists of an HTML file, found in ``/test/render-test.html``,
which starts a BD browser containing several tracks. The browser uses the ``test-renderer``
rendering module, which is where the testing itself is done, and the test output
can be seen in the web browser console.

The tracks use the ``test-source`` tier type, which can be configured to return
any sort of track object. In this case, it's configured to return a few features,
containing enough data to test all (as far as I can tell) parts of the renderer.

The ``test-renderer`` module works by comparing the effects of ``drawFeatureTier``,
in ``feature-draw.js``, and ``drawTier``, in ``default-renderer.es6``, on each
tier's subtiers. The subtiers are what contain the glyphs, which are in turn
the objects drawn to the BD canvas. Thus, by making certain the subtiers are
identical, we know the glyphs are identical, and so we can be reasonably certain
that the eventual output to the screen is the same, in both renderers.
