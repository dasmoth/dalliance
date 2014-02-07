For 0.12
--------

  - Replace feature popups with inspector?
  - Feature selection
  - Small BED/WIG support
  - Animate when leaping/toggling.
  - Apply track-edit operations to multiple tracks at once.
  - Bulk addition of local files. [DONE]
  - Typeahead for search-by-gene-ID
  - Search-by-name (or description) in track-adder.
  - Export track configuration for current browser state.

For 0.13
--------

  - Undo/redo.  
  - History of recently-viewed tracks.
  - RDF/FALDO support?
  - Out-to-chromosome zooming
    + Probably needs a better set of semantic zoom hints in the
      stylesheet language.
  - Stylesheet language revamp???  
  - Incremental data fetching
  - Better zoom control
    + Show all toggle levels.
    + Some kind of feedback for toggling.
  - Try to preserve layout when expanding/collapsing variants.
  - More Tabix payloads (GFF/GTF)
  - Chromosome overviews.

Future
-------------

 - Construct as a web-component
   + (web component polyfills aren't quite ready yet).
 - Better tiling in renderer.
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