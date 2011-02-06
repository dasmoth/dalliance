var REPETITIONS = 100;

function handle() {
    var beforeFetch = Date.now();

    new URLFetchable('http://localhost/test.txt').fetch(function(dataString) {
        var afterFetch = Date.now();
        dlog('Fetched ' + dataString.length);
        dlog('Fetch took ' + (afterFetch - beforeFetch) + 'ms');

	{
	    dlog('id1=' + dataString.charCodeAt(0));
	    dlog('id2=' + dataString.charCodeAt(1));
	    dlog('cm=' + dataString.charCodeAt(2));
	    dlog('flg= ' + dataString.charCodeAt(3));
	    if (dataString.charCodeAt(3) & 8) {
		dlog('has name');
		var idx = 10;
		while (dataString.charCodeAt(idx) != 0) {
		    ++idx;
		}
		dlog('name is ' + dataString.substr(10, idx - 10));
	    }
	}

	{
	    var bb = new Uint8Array(dataString.length - idx);
	    for (var i = idx + 1; i < dataString.length; ++i) {
		bb[i - idx - 1] = dataString.charCodeAt(i);
	    }

	    var beforeNew = Date.now();
	    var nresult;
	    for (var i = 0; i < REPETITIONS; ++i) {
		nresult = new Uint8Array(jszlib_inflate_buffer(bb.buffer));
	    }
	    var afterNew = Date.now();
	    
	    dlog('NUncompress: ' + nresult.length);
	    dlog('Nuncompress took: ' + (afterNew - beforeNew) + 'ms');
	    var s = ''
	    for (i = 0; i < 100; ++i) {
		s += String.fromCharCode(nresult[i]);
	    }
	    dlog(s);
	}


	/* {
	    var bresult;
	    var beforeUncompress = Date.now();
	    for (var i = 0; i < REPETITIONS; ++i) {
		bresult = JSInflate.inflate(dataString.substr(idx + 1));
	    }
	    var afterUncompress = Date.now();
	    dlog('Uncompress: ' + bresult.length);
	    dlog('Uncompress took ' + (afterUncompress - beforeUncompress) + 'ms');
	} */
    });
}