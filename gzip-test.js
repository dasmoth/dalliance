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

	var bresult;
	for (var i = 0; i < 100; ++i) {
	    bresult = JSInflate.inflate(dataString.substr(idx + 1));
	}
	var afterUncompress = Date.now();
	dlog('Uncompress: ' + bresult.length);
	dlog('Uncompress took ' + (afterUncompress - afterFetch) + 'ms');
    });
}