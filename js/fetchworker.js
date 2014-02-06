
importScripts('bin.js', 'bam.js', '../jszlib/js/inflate.js')

var connections = {};

(function(global) {
    var idSeed = 0;

    global.newID = function() {
        return 'cn' + (++idSeed);
    }
}(self));

onmessage = function(event) {
    var d = event.data;
    var command = event.data.command;
    var tag = event.data.tag;

    if (command === 'connectBAM') {
        var id = newID();

        makeBam(new URLFetchable(d.uri), new URLFetchable(d.indexUri), function(bam, err) {
            if (bam) {
                connections[id] = new BAMWorkerFetcher(bam);
                postMessage({tag: tag, result: id});
            } else {
                postMessage({tag: tag, error: err || "Couldn't fetch BAM"});
            }
        });
    } else if (command === 'fetch') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.fetch(d.tag, d.chr, d.min, d.max);
    } else if (command === 'date') {
        return postMessage({tag: tag, result: Date.now()|0});
    } else {
        postMessage({tag: tag, error: 'Bad command ' + command});
    }
}

function BAMWorkerFetcher(bam) {
    this.bam = bam;

}

BAMWorkerFetcher.prototype.fetch = function(tag, chr, min, max) {
    this.bam.fetch(chr, min, max, function(records, err) {
        if (records) {
            postMessage({tag: tag, result: records, time: Date.now()|0});
        } else {
            postMessage({tag: tag, error: err});
        }
    });
}