#!/bin/bash

mkdir -p target/
mkdir -p target/js/
cat js/{bam,bigwig,bin,cbrowser,feature-popup,chainset,color,das,domui,feature-draw,sequence-draw,features,feature-popup,karyoscape,kspace,quant-config,sample,sha1,svg-export,spans,thub,tier,track-adder,twoBit,utils,version,browser-ui,glyphs,session,sourceadapters,jbjson,ensembljson,overlay}.js jszlib/js/inflate.js polyfills/html5slider.js >target/js/dalliance-all.js
java -jar compiler/compiler.jar --js target/js/dalliance-all.js > target/js/dalliance-compiled.js
