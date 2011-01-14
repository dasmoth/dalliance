For 0.6
-------

  - Check maxbins support for DAS sources
  - Allow maxbins and credentials flags to be set when adding DAS sources
  - Replace js-inflate?
  - Registry caching?
  - Try to fetch SOURCE data when attaching custom DAS sources?
  - Label jiggling?
  - Next/prev feature prototype.

Browser support
---------------

     + Mozilla (FF3.5, Camino???)
     + Safari (3.1 or later)
     + Chrome.
     + Not IE<9. 
     + IE9 is looking doable:
          * UI draws correctly (IE9dp2).
          * DAS-fetching can be made to work (requires dedicated code path using XDomainRequest)
	  * Currently no features displaying
	  * Probably transform and/or clipping problems.

 
Real Soon Now
-------------

 - Cache server capabilities in the DAS layer (i.e. maxbins!)
     + Most code is in, currently doesn't work because of missing Access-Control-Expose-Headers support.
     + https://bugs.webkit.org/show_bug.cgi?id=41210
     + May be able to do something with DAS/1.6 sources since these *should* list caps in the sources document???
 - Better configuration of quantitative tracks.
     + Global y-zoom? [Matias wants this.  Wouldn't per-trackgroup be better?  Needs an explicit idea of track-groups.]
     + Switch between bars/colourways? [Leave this for now]
     + Increase/decrease viewed height of quant tracks?
 - Think about cancelling long-running XHRs if they're no longer needed?
 - Non-positional annotation.
 - Auto-detection of credentialed servers?
 - Undo

Nice to have
------------

 - Add a track removal button to error placards?
 - Ability to re-bump w/o re-fetching all the data
     + Should allow more aggressive spec-fetching?
     + Allow fetches that add to the working set, rather than replacing it.
     + Try to respect existing feature placements when scrolling.
 - Expand/collapse per-feature-group (expand transcripts for individual genes?  don't think anyone else is doing this, but I'd use it!)
 - Gene search:
     + Would be nice if it offered proper keyword search, rather than pure feature-but-ID
     + Any reason not to just hack the server to do this?
     + Suggest-as-you-type?
 - Support for a more compact encoding for quantitative tracks.
     + Will need some server suppport.  
     + Adding a new encoding to Dazzle shouldn't be too painful.
 - User-uploaded data
     + Round-tripped in via Dastard?
     + Also interesting to do LOCAL data additions?
 - State persistance between sessions
     + Add a "make URL" button?
  - Tier groups
     + Should yZoom together.
     + Other quantitative stuff?  If we support colourway switching then probably.
     + Do they have any meaning for non-quant tracks?
     + Drag together when re-ordering????
     + How are these defined?  DASSTYLE is hopeless.  Extended <sources> document?
  - Dedicated configuration/persistance language?
  - Distance between a pair of features.
  - Jiggle labels so they're always visible
     + For genes, try to keep them attached to exons.
  - Rename tiers?
  - Multiple configurations/session switching/etc?

Blue sky
--------
    
 - Tourist mode
    + Fast movement between POIs. 
 - Real-time collaborative features
    + i.e. multiple users viewing a browser with shared state.
    + Annotation (Using DAS writeback protocols?)
    + View synchronization?
    + Chat 
    + Websockets work nicely for this.  Prototype at DAS Workshop '10.
 - Navigate by blatting user sequences to the genome
    + How to do this in a DASish world?
    + Relationship with tourist mode?
 - Flip into vertical orientation (AceDB-like!)
    + How much of the rendering code would end up ori-dependent?
 - MultiContigView equivalent?

The Server Side
---------------
 
 - Tidy up the Allow-Credentials support in Dazzle.
 - bigFile-backed servers?
    + Now doing this client-side instead?  Do we still need the server?
 - BAM-backed servers. 
    + Done using Picard.  Potential scalability issues in the future but working for now.
 - Dazzle replacement (i.e. fast, scalable, DAS middleware).
    + Any ideas from Cadastral worth following up?
    + If I write a new one, would I still do it in Java?
        * BioJava 1.4?  "BioJava 3"?  New API?
    + Alternatively... do a "Dazzle 1.5" major update
        * possible to keep the decent bits while re-doing the plugin API?
 - DAS3? :-)
