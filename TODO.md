For 0.11
--------

  - UI for leaping (button to complement ctrl-arrow).
  - Search of bigbed files.
  - Retina display support.
  - Replace feature popups with inspector?
  - Assembly hub support.
  - Bulk addition of local files.
  - Rename tracks.
  - Per-track display customization ("Stylesheet editor")?
  - Chromosome overviews.
  - Animate when leaping/toggling.
  - Export track configuration for current browser state.

For 0.12
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

Nice to have
------------

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
 - Multiple configurations/session switching/etc?

Blue sky
--------
    
 - MultiContigView equivalent?
 - Client-side analysis of quantitative tracks.
 - Better presentation of gene models in the light of expression data.