
For 0.7
-------

  - Evaluate canvas rendering (requires 2-stage layout)
  - If we stick to SVG rendering, implement incremental layout.
  - Move fetching/mapping/etc to a webworker.
  - If we swtich to 2-stage layout, can we do bumping &c in a worker as well?
  - Local data.
  - Next/prev feature.
  - Try touch support again.
  - Cross-index manually added sources to the registry.
  - Out-to-chromosome zooming
  - BAM support
  - Strand-flipping

 
Real Soon Now
-------------

 - Better configuration of quantitative tracks.
     + Global y-zoom? [Matias wants this.  Wouldn't per-trackgroup be better?  Needs an explicit idea of track-groups.]
     + Switch between bars/colourways? [Leave this for now]
     + Increase/decrease viewed height of quant tracks?
 - Think about cancelling long-running XHRs if they're no longer needed?
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
 - Tourist mode: fast movement between POIs 
     + (how close is this to next/prev feature?)
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
