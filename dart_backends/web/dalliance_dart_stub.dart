import 'dart:typed_data';

import 'package:js/js.dart' as js;

import 'package:bud/io_browser.dart';
import 'package:bud/tabix.dart';
import 'package:bud/gff.dart';

void main() {
  js.context.createTabixSource = new js.Callback.many(createTabixSource);
  int j = 1;
  for (int i = 0; i < 64; ++i) {
    print(' 1<<$i = $j');
    j = j * 2;
  }
  print(0x1000 * 42);
  print(0x1000000 * 42);
  print(0x10000000 * 42);
  print(0x1000 * 0x1000 * 42);
}

void createTabixSource(String url, callback) {
  js.retain(callback);
  
  TabixIndexedFile.open(new UrlResource('$url.tbi'), new UrlResource(url))
    .then((tif) {
      callback(new js.Callback.many(new TabixIndexedSource(tif).fetch));
      js.release(callback);
    });
}

class TabixIndexedSource {
  TabixIndexedFile tif;
  
  TabixIndexedSource(this.tif);
  
  fetch(String chr, int min, int max, callback) {
    js.retain(callback);
    tif.fetch(chr, min, max)
      .then((List<String> lines) {
        List records = [];
        
        for (String l in lines) {
          if (l.startsWith('#')) 
            continue;

          if (l.length == 0)
            continue;
          
          GFFRecord r = GFFRecord.parse(l);
          records.add({
            'min': r.start,
            'max': r.end, 
            'type': r.type,
            'source': r.source,
            'score': r.score
          });
        }
        
        callback(js.array(records));
        js.release(callback);
      });
  }
}