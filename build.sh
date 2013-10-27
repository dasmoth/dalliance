#!/bin/bash

cat js/{bam,bigwig,bin,cbrowser,feature-popup,chainset,color,das,domui,feature-draw,sequence-draw,features,feature-popup,karyoscape,kspace,quant-config,sample,sha1,svg-export,spans,thub,tier,track-adder,twoBit,utils,version,browser-ui,glyphs,session,sourceadapters,jbjson,ensembljson,overlay,tier-actions,search,tier-edit}.js jszlib/js/inflate.js polyfills/html5slider.js >dalliance-all.js
java -jar compiler.jar --js dalliance-all.js >dalliance-compiled.js
