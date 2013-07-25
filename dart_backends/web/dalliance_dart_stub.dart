import 'dart:typed_data';
import 'dart:collection';

import 'package:js/js.dart' as js;

import 'package:bud/io_browser.dart';
import 'package:bud/tabix.dart';
import 'package:bud/gff.dart';

void main() {
  js.context.createTabixSource = new js.Callback.many(createTabixSource);
}

void createTabixSource(String url, String payload, callback) {
  js.retain(callback);
  
  TabixIndexedFile.open(new UrlResource('$url.tbi'), new UrlResource(url))
    .then((tif) {
      callback(new js.Callback.many(new TabixIndexedSource(tif, payload).fetch));
      js.release(callback);
    });
}

class TabixIndexedSource {
  TabixIndexedFile tif;
  String payload;
  Function parser;
  Set names;
  
  TabixIndexedSource(this.tif, this.payload) {
    names = new HashSet.from(tif.seqNames);
    
    if (payload == 'gff2')
      parser = (String line) => GFFRecord.parse(line, 2);
    else
      parser = (String line) => GFFRecord.parse(line, 3);
  }
  
  fetch(String chr, int min, int max, callback) {
    if (!names.contains(chr))
      chr = 'chr$chr';
    if (!names.contains(chr))
      return callback(js.array([]));
    
    js.retain(callback);
    
    
    tif.fetch(chr, min, max)
      .then((List<String> lines) {
        List records = [];
        
        for (String l in lines) {
          if (l.startsWith('#')) 
            continue;

          if (l.length == 0)
            continue;
          
          GFFRecord r = parser(l);
          
          var df = {
            'min': r.start,
            'max': r.end, 
            'type': r.type,
            'source': r.source,
            'score': r.score
          };
          
          if (r.strand != null) {
            df['orientation'] = r.strand.token;
          }
          
          if (r.attributes != null && r.attributes.containsKey('transcript_id')) {
            df['groups'] = [{'id': r.attributes['transcript_id'],
                          'type': 'gtf-transcript'}];
          }
          
          records.add(js.map(df));
        }
        
        callback(js.array(records));
        js.release(callback);
      });
  }
}