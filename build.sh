#!/bin/sh

cat js/{bam,bigwig,bin,cbrowser,feature-popup,chainset,color,das,domui,feature-draw,features,karyoscape,kspace,quant-config,sample,sequence-tier,sha1,slider,spans,tier,track-adder,twoBit,utils,version}.js json/json2.js jszlib/js/inflate.js >dalliance-all.js
java -jar compiler.jar --js dalliance-all.js >dalliance-compiled.js
