
For 0.8
-------

  - Pick a UI toolkit!
     + Still looking like 'none'....
  - Performance:
     + Scrolling and zoom-preview using CSS
     + Consider tiled rendering.
     + Spin event loop between drawing ops.
  - Missing UI elements (w.r.t. 0.7)
     + Scales on quantitative tracks
     + Add/remove track mechanism.
     + "Selected track"
     + Chromosome overview (can we be less special-casey about this...?)
     + Zoom slider (necessary?  some way to hide it when not in use?)
     + Location/search tool.
  - Reinstate sequence tracks
  - Full set of glyphs on canvas renderer
  - Walk the glyphtree to produce SVG for export
  - Incremental fetch
  - Refactor next/prev support in big* code.
  - Out-to-chromosome zooming
  - UI for next/prev
  - Stylesheet overrides in config blobs.  (working now, syntax could be improved...)
  - JSON-DAS support?
  - Work out the kinks in security/preflighting.
  - Binary data on Safari 5.1/Mobile (looks like a Webkit bug?)
  - Vertical resizing
  - Track style configuration (Ron/Julie)
  - Version track config blobs per-track.
  - Clean up track add/remove API.
  - Route feature clicks/taps through an event model (i.e. feature-popup is no longer part of Browser)
  - Full binary support.
 
Real Soon Now
-------------

 - Better configuration of quantitative tracks.
     + Global y-zoom? [Matias wants this.  Wouldn't per-trackgroup be better?  Needs an explicit idea of track-groups.]
     + Switch between bars/colourways? [Leave this for now]
     + Increase/decrease viewed height of quant tracks?
 - Non-positional annotation.
 - Undo.
 - Alignment improvements.
 - Better dialogs.
 - Improved karyoscape.
 - Factor out browser tiers from UI chrome.

Nice to have
------------

 - Gene search:
     + Would be nice if it offered proper keyword search, rather than pure feature-but-ID
     + Any reason not to just hack the server to do this?
     + Suggest-as-you-type?
     + Does new DAS search proposal help?
 - State persistance between sessions
     + Add a "make URL" button?
 - Tier groups
     + Should yZoom together.
     + Other quantitative stuff?  If we support colourway switching then probably.
     + Do they have any meaning for non-quant tracks?
     + Drag together when re-ordering????
     + How are these defined?  DASSTYLE is hopeless.  Extended SOURCES document?
 - Dedicated configuration/persistance language?
 - Distance between a pair of features.
 - Rename tiers?
 - Multiple configurations/session switching/etc?

Blue sky
--------
    
 - Real-time collaborative features
    + i.e. multiple users viewing a browser with shared state.
    + Annotation (Using DAS writeback protocols?)
    + View synchronization?
    + Chat 
    + Websockets work nicely for this.  Prototype at DAS Workshop '10.
 - Navigate by blatting user sequences to the genome
    + How to do this in a DASish world?
    + Relationship with tourist mode?
 - MultiContigView equivalent?

The Server Side
---------------
 
 - Tidy up the Allow-Credentials support in Dazzle.
 - Dazzle replacement (i.e. fast, scalable, DAS middleware).
    + Any ideas from Cadastral worth following up?
    + If I write a new one, would I still do it in Java?
        * BioJava 1.4?  "BioJava 3"?  New API?
    + Alternatively... do a "Dazzle 1.5" major update
        * possible to keep the decent bits while re-doing the plugin API?
 - DAS3? :-)
