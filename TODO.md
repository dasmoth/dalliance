For 0.13
--------

  - Feature selection
  - Replace feature popups with inspector-like interface
  - Keep labels of large features on-screen (maybe needs to be optional?)
  - Apply track-edit operations to multiple tracks at once.
  - Typeahead for search-by-gene-ID
  - Animate when leaping/toggling.
  - Overlay function plugin API
  - Clean up featureSource creation (make async?)
  - Search-by-name (or description) in track-adder.
  - Support for non-positional annotations (UI hookup for bigtab client)

For 1.0
--------

  - Undo/redo.  
  - History of recently-viewed tracks.
  - Out-to-chromosome zooming
    + Probably needs a better set of semantic zoom hints in the
      stylesheet language.
  - Better zoom control
    + Show all toggle levels.
    + Some kind of feedback for toggling.
  - Try to preserve layout when expanding/collapsing variants.
  - More Tabix payloads (GFF/GTF)
  - Chromosome overviews.

Workshop
========

For 1.1
--------



Future
-------------

 - New stylesheet language
 - More incremental data fetching.
 - Construct as a web-component (polymer?)
 - Better tiling in renderer.
 - Better ways of loading alignments (HAL?)

Nice to have
------------

 - Tier groups
     + Should yZoom together.
     + Other configuration stuff?
     + Drag together when re-ordering????
 - Dedicated configuration/persistance language?
 - Distance between a pair of features.
 - Multiple configurations/session switching/etc?
- RDF/FALDO support?

Blue sky
--------
    
 - MultiContigView equivalent?
 - Client-side analysis of quantitative tracks.
 - Better presentation of gene models in the light of expression data.