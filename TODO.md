For 0.10
--------
   
  - Allow arbitrary glyphs to be used in scatter-plots. [DONE with <SCATTER>yes</SCATTER> stylesheet extension]
  - Extra small-glyph types [DONE SQUARE, STAR]
  - UI for leaping (button to complement ctrl-arrow).
  - Progress/activity indicators
    + ...when reloading.
    + ...when leaping.
  - Animate when leaping.
    + Also toggle-zooming?
    + Inform user of progress
  - Chromosome overviews
  - Better search (using TRIX?)
  - Per-track display customization ("Stylesheet editor")?
  - Bulk addition of local files.
  - More track-hub stuff:
    + Assembly hub support.
    + Multiwig [DONE]
    + Grouping/compositeTrack [DONE]
    + Views (leave for now?)
    + Better support for visibility options.
  - Matrix track selection.
  - User interface for connecting to a track hub. [DONE]
  - Replace feature popups with inspector?
     + Maybe a more general popupocalypse? (track-adder, help, etc.?)
  - Rethink tier-matching
     + Should track-hub-derived sources have a URI associated with their
       hub?
  - Retina display support
  - Clean up glyph insertion into subtiers (performance-critical).

For 0.11
--------

  - Undo/redo.  
  - History of recently-viewed tracks.
  - RDF/FALDO support?
  - Out-to-chromosome zooming
    + Probably needs a better set of semantic zoom hints in the
      stylesheet language.
  - Stylesheet language revamp???  
  - Incremental data fetching
  - New track-adder UI.
  - Better zoom control
    + Show all toggle levels.
    + Some kind of feedback for toggling.
  - Try to preserve layout when expanding/collapsing variants.
  - Small BED/WIG support
  - Tabix support (VCF/GFF/GTF)  [DONE on dart_backends branch]

Future
-------------

 - Work out the kinks in security/preflighting.
 - Construct as a web-component
   + (web component polyfills aren't quite ready yet).
 - Better tiling in renderer.
 - Better control of vertical resize.
 - Better configuration of quantitative tracks.
     + Global y-zoom? [Matias wants this.  Wouldn't per-trackgroup be better?  Needs an explicit idea of track-groups.]
     + Switch between bars/colourways? [Leave this for now]
     + Increase/decrease viewed height of quant tracks?
 - Non-positional annotation.
 - Alignment improvements.
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
