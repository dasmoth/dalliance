
For 0.8
-------

  - Missing UI elements (w.r.t. 0.7)
     + Per-tier configs:
       - Expand/collapse of bumped tiers.
       - Vertical scales on quantitative tracks.
     + Chromosome overview (can we be less special-casey about this...?)
     + Location/search tool.
  - Full set of glyphs on canvas renderer
  - UI for next/prev
  - Stylesheet overrides in config blobs.  (working now, syntax could be improved...)
  - Vertical resizing?
  - Persistence system (currently broken...)
    + Version config blobs per-tier.
  - Full binary support (nearly, nearly, there, just need to not
    freak out of entry_points aren't available).
  - Refactor browser_ui.js
  - Remove dead SVGUI code!
  - Fix scrolling on newer macs.

For 0.9 (?)
-----------

  - True tiled rendering.
  - Clean separation between genome canvases and UI chrome.
  - Some sort of full-bleed mode?
  - Track-hub support
  - VCF+Tabix support
     - Anything else in Tabix envelopes?  GFF?  BED?
  - Small BED/WIG support
  - Stylesheet editor.
  - Out-to-chromosome zooming
    + Probably needs a better set of semantic zoom hints in the
      stylesheet language.  
  - Refactor next/prev support in big* code.
  - Incremental data fetching
  - Work out the kinks in security/preflighting.

 
Future
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
 - Consider JSON-DAS -- is this alive???

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
