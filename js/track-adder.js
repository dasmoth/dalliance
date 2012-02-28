/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// track-adder.js
//

Browser.prototype.currentlyActive = function(source) {
    for (var i = 0; i < this.tiers.length; ++i) {
        var ts = this.tiers[i].dasSource;
        if (ts.uri == source.uri || ts.uri == source.uri + '/') {
            // Special cases where we might meaningfully want two tiers of the same URI.
            if (ts.tier_type) {
                if (!source.tier_type || source.tier_type != ts.tier_type) {
                    continue;
                }
            }
            if (ts.stylesheet_uri) {
                if (!source.stylesheet_uri || source.stylesheet_uri != ts.stylesheet_uri) {
                    continue;
                }
            }

            return true;
        }
    }
    return false;
}

Browser.prototype.makeButton = function(name, tooltip) {
    var regButton = makeElement('span', name);
    regButton.style.backgroundColor = 'rgb(230,230,250)';
    regButton.style.borderStyle = 'solid';
    regButton.style.borderColor = 'red';
    regButton.style.borderWidth = '3px';
    regButton.style.padding = '4px';
    regButton.style.marginLeft = '10px';
    regButton.style.marginRight = '10px';
    // regButton.style.width = '100px';
    regButton.style['float'] = 'left';
    if (tooltip) {
        this.makeTooltip(regButton, tooltip);
    }
    return regButton;
}

function activateButton(addModeButtons, which) {
    for (var i = 0; i < addModeButtons.length; ++i) {
        var b = addModeButtons[i];
        b.style.borderColor = (b == which) ? 'red' : 'blue';
    }
}

Browser.prototype.showTrackAdder = function(ev) {
    var thisB = this;
    var mx =  ev.clientX, my = ev.clientY;
    mx +=  document.documentElement.scrollLeft || document.body.scrollLeft;
    my +=  document.documentElement.scrollTop || document.body.scrollTop;

    var popup = document.createElement('div');
    popup.appendChild(makeElement('div', null, {}, {clear: 'both', height: '10px'})); // HACK only way I've found of adding appropriate spacing in Gecko.

    var addModeButtons = [];
    var makeStab, makeStabObserver;
    var regButton = this.makeButton('Registry', 'Browse compatible datasources from the DAS registry');
    addModeButtons.push(regButton);
    for (var m in this.mappableSources) {
        var mf  = function(mm) {
            var mapButton = thisB.makeButton(thisB.chains[mm].srcTag, 'Browse datasources mapped from ' + thisB.chains[mm].srcTag);
            addModeButtons.push(mapButton);
            mapButton.addEventListener('mousedown', function(ev) {
                ev.preventDefault(); ev.stopPropagation();
                activateButton(addModeButtons, mapButton);
                makeStab(thisB.mappableSources[mm], mm);
            }, false);
        }; mf(m);
    }
    var defButton = this.makeButton('Defaults', 'Browse the default set of data for this browser');
    addModeButtons.push(defButton);
    var custButton = this.makeButton('Custom', 'Add arbitrary DAS data');
    addModeButtons.push(custButton);
    var binButton = this.makeButton('Binary', 'Add data in bigwig or bigbed format');
    addModeButtons.push(binButton);
    activateButton(addModeButtons, regButton);
    popup.appendChild(makeElement('div', addModeButtons), null);
    
    popup.appendChild(makeElement('div', null, {}, {clear: 'both', height: '10px'})); // HACK only way I've found of adding appropriate spacing in Gecko.
    
    var addButtons = [];
    var custURL, custName, custCS, custQuant, custFile, custUser, custPass;
    var customMode = false;
    var dataToFinalize = null;

    var asform = makeElement('form', null, {}, {clear: 'both'});
    asform.addEventListener('submit', function(ev) {
            ev.stopPropagation(); ev.preventDefault();
            doAdd();
            return false;
    }, true); 
    var stabHolder = document.createElement('div');
    stabHolder.style.position = 'relative';
    stabHolder.style.overflow = 'auto';
    stabHolder.style.height = '400px';
    asform.appendChild(stabHolder);

    var __mapping;
    var __sourceHolder;


    makeStab = function(msources, mapping) {
        refreshButton.style.visibility = 'visible';
        if (__sourceHolder) {
            __sourceHolder.removeListener(makeStabObserver);
        }
        __mapping = mapping;
        __sourceHolder = msources;
        __sourceHolder.addListenerAndFire(makeStabObserver);
       
    }

    makeStabObserver = function(msources) {
        customMode = false;
        addButtons = [];
        removeChildren(stabHolder);
        if (!msources) {
            stabHolder.appendChild(makeElement('p', 'Dalliance was unable to retrieve data source information from the DAS registry, please try again later'));
            return;
        }
        var stab = document.createElement('table');
        stab.style.width='100%';
        var idx = 0;

        var sources = [];
        for (var i = 0; i < msources.length; ++i) {
            sources.push(msources[i]);
        }
        
        sources.sort(function(a, b) {
            return a.name.toLowerCase().trim().localeCompare(b.name.toLowerCase().trim());
        });

        for (var i = 0; i < sources.length; ++i) {
            var source = sources[i];
            var r = document.createElement('tr');
            r.style.backgroundColor = thisB.tierBackgroundColors[idx % thisB.tierBackgroundColors.length];

            var bd = document.createElement('td');
            bd.style.textAlign = 'center';
            if (thisB.currentlyActive(source)) {
                bd.appendChild(document.createTextNode('X'));
                thisB.makeTooltip(bd, "This data source is already active.");
            } else if (!source.props || source.props.cors) {
                var b = document.createElement('input');
                b.type = 'checkbox';
                b.dalliance_source = source;
                if (__mapping) {
                    b.dalliance_mapping = __mapping;
                }
                bd.appendChild(b);
                addButtons.push(b);
                thisB.makeTooltip(bd, "Check here then click 'Add' to activate.");
            } else {
                bd.appendChild(document.createTextNode('!'));
                thisB.makeTooltip(bd, makeElement('span', ["This data source isn't accessible because it doesn't support ", makeElement('a', "CORS", {href: 'http://www.w3.org/TR/cors/'}), "."]));
            }
            r.appendChild(bd);
            var ld = document.createElement('td');
            ld.appendChild(document.createTextNode(source.name));
            if (source.desc && source.desc.length > 0) {
                thisB.makeTooltip(ld, source.desc);
            }
            r.appendChild(ld);
            stab.appendChild(r);
            ++idx;
        }
        stabHolder.appendChild(stab);
    };
    

    regButton.addEventListener('mousedown', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        activateButton(addModeButtons, regButton);
        makeStab(thisB.availableSources);
    }, false);
    defButton.addEventListener('mousedown', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        activateButton(addModeButtons, defButton);
        makeStab(new Observed(thisB.defaultSources));
    }, false);

    binButton.addEventListener('mousedown', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        activateButton(addModeButtons, binButton);
        switchToBinMode();
    }, false);


    function switchToBinMode() {
        customMode = 'bin';
        refreshButton.style.visibility = 'hidden';

        removeChildren(stabHolder);

        if (thisB.supportsBinary) {
            stabHolder.appendChild(makeElement('h2', 'Add custom URL-based data'));
            stabHolder.appendChild(makeElement('p', ['You can add indexed binary data hosted on an web server that supports CORS (', makeElement('a', 'full details', {href: 'http://www.biodalliance.org/bin.html'}), ').  Currently supported formats are bigwig, bigbed, and indexed BAM.']));

            stabHolder.appendChild(makeElement('br'));
            stabHolder.appendChild(document.createTextNode('URL: '));
            custURL = makeElement('input', '', {size: 80, value: 'http://www.biodalliance.org/datasets/ensGene.bb'});
            stabHolder.appendChild(custURL);
            custURL.focus();
            stabHolder.appendChild(makeElement('br'));
            stabHolder.appendChild(makeElement('b', '- or -'));
            stabHolder.appendChild(makeElement('br'));
            stabHolder.appendChild(document.createTextNode('File: '));
            custFile = makeElement('input', null, {type: 'file'});
            stabHolder.appendChild(custFile);
            

            stabHolder.appendChild(makeElement('p', 'Clicking the "Add" button below will initiate a series of test queries.'));
        } else {
            stabHolder.appendChild(makeElement('h2', 'Your browser does not support binary data'));
            stabHolder.appendChild(makeElement('p', 'Browsers currently known to support this feature include Google Chrome 9 or later and Mozilla Firefox 4 or later.'));
        }
        
    }

    custButton.addEventListener('mousedown', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        activateButton(addModeButtons, custButton);
        switchToCustomMode();
    }, false);

    var switchToCustomMode = function() {
        customMode = 'das';
        refreshButton.style.visibility = 'hidden';

        removeChildren(stabHolder);

        var customForm = makeElement('div');
        customForm.appendChild(makeElement('h2', 'Add custom DAS data'));
        customForm.appendChild(makeElement('p', 'This interface is intended for adding custom or lab-specific data.  Public data can be added more easily via the registry interface.'));
                
        customForm.appendChild(document.createTextNode('URL: '));
        customForm.appendChild(makeElement('br'));
        custURL = makeElement('input', '', {size: 80, value: 'http://www.derkholm.net:8080/das/medipseq_reads/'});
        customForm.appendChild(custURL);

        customForm.appendChild(makeElement('p', 'Clicking the "Add" button below will initiate a series of test queries.  If the source is password-protected, you may be prompted to enter credentials.'));
        stabHolder.appendChild(customForm);

        custURL.focus();
    }



    var addButton = document.createElement('span');
    addButton.style.backgroundColor = 'rgb(230,230,250)';
    addButton.style.borderStyle = 'solid';
    addButton.style.borderColor = 'blue';
    addButton.style.borderWidth = '3px';
    addButton.style.padding = '2px';
    addButton.style.margin = '10px';
    addButton.style.width = '150px';
    // addButton.style.float = 'left';
    addButton.appendChild(document.createTextNode('Add'));
    addButton.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        doAdd();
    }, false);

    function doAdd() {
        if (customMode) {
            if (customMode === 'das') {
                var curi = custURL.value.trim();
                if (!/^.+:\/\//.exec(curi)) {
                    curi = 'http://' + curi;
                }
                var nds = new DASSource({name: 'temporary', uri: curi});
                tryAddDAS(nds);
            } else if (customMode === 'bin') {
                var opts = {name: 'temporary'};
                var fileList = custFile.files;
                if (fileList && fileList.length > 0 && fileList[0]) {
                    opts.bwgBlob = fileList[0];
                    opts.noPersist = true;
                } else {
                    var curi = custURL.value.trim();
                    if (!/^.+:\/\//.exec(curi)) {
                        curi = 'http://' + curi;
                    }
                    opts.bwgURI = curi;
                }
                var nds = new DASSource(opts);
                tryAddBin(nds);
            } else if (customMode === 'reset') {
                switchToCustomMode();
            } else if (customMode === 'reset-bin') {
                switchToBinMode(); 
            } else if (customMode === 'prompt-bai') {
                var fileList = custFile.files;
                if (fileList && fileList.length > 0 && fileList[0]) {
                    dataToFinalize.baiBlob = fileList[0];
                    completeBAM(dataToFinalize);
                } else {
                    promptForBAI(dataToFinalize);
                }
            } else if (customMode === 'finalize') {
                dataToFinalize.name = custName.value;
                var m = custCS.value;
                if (m != '__default__') {
                    dataToFinalize.mapping = m;
                } else {
                    dataToFinalize.mapping = undefined;
                }
                if (custQuant) {
                    dataToFinalize.maxbins = custQuant.checked;
                }

                if (custUser.value.length > 1 && custPass.value.length > 1) {
                    dlog('password');
                    dataToFinalize.xUser = custUser.value;
                    dataToFinalize.xPass = custPass.value;
                }

                thisB.sources.push(dataToFinalize);
                thisB.makeTier(dataToFinalize);
                thisB.storeStatus();
                thisB.removeAllPopups();
            }
        } else {
            for (var bi = 0; bi < addButtons.length; ++bi) {
                var b = addButtons[bi];
                if (b.checked) {
                    var nds = b.dalliance_source;
                    thisB.sources.push(nds);
                    thisB.makeTier(nds);
                    thisB.storeStatus();
                }
            }
            thisB.removeAllPopups();
        }
    };

    var tryAddDAS = function(nds, retry) {
        var knownSpace = thisB.knownSpace;
        if (!knownSpace) {
            alert("Can't confirm track-addition to an uninit browser.");
            return;
        }
        var tsm = Math.max(knownSpace.min, (knownSpace.min + knownSpace.max - 100) / 2)|0;
        var testSegment = new DASSegment(knownSpace.chr, tsm, Math.min(tsm + 99, knownSpace.max));
//        dlog('test segment: ' + testSegment);
        nds.features(testSegment, {}, function(features, status) {
            // dlog('status=' + status);
            if (status) {
                if (!retry) {
                    dlog('retrying with credentials');
                    nds.credentials = true;
                    tryAddDAS(nds, true);
                } else {
                    removeChildren(stabHolder);
                    stabHolder.appendChild(makeElement('h2', 'Custom data not found'));
                    stabHolder.appendChild(makeElement('p', 'DAS uri: ' + nds.uri + ' is not answering features requests'));
                    customMode = 'reset';
                    return;
                }
            } else {
                var nameExtractPattern = new RegExp('/([^/]+)/?$');
                var match = nameExtractPattern.exec(nds.uri);
                if (match) {
                    nds.name = match[1];
                }

                tryAddDASxSources(nds);
                return;
            }
        });
    }

    function tryAddDASxSources(nds, retry) {
        var uri = nds.uri;
        if (retry) {
            var match = /(.+)\/[^\/]+\/?/.exec(uri);
            if (match) {
                uri = match[1] + '/sources';
            }
        }
//        dlog('sourceQuery: ' + uri);
        function sqfail() {
            if (!retry) {
                return tryAddDASxSources(nds, true);
            } else {
                return addDasCompletionPage(nds);
            }
        }
        new DASRegistry(uri, {credentials: nds.credentials}).sources(
            function(sources) {
                if (!sources || sources.length == 0) {
                    return sqfail();
                } 
//                dlog('got ' + sources.length + ' sources');

                var fs = null;
                if (sources.length == 1) {
                    fs = sources[0];
                } else {
                    for (var i = 0; i < sources.length; ++i) {
                        if (sources[i].uri === nds.uri) {
//                            dlog('got match!');
                            fs = sources[i];
                            break;
                        }
                    }
                }

                var coordsDetermined = false, quantDetermined = false;
                if (fs) {
                    nds.name = fs.name;
                    nds.desc = fs.desc;
                    if (fs.maxbins) {
                        nds.maxbins = true;
                    } else {
                        nds.maxbins = false;
                    }
                    if (fs.capabilities) {
                        nds.capabilities = fs.capabilities;
                    }
                    quantDetermined = true
                    
                    if (fs.coords && fs.coords.length == 1) {
                        var coords = fs.coords[0];
                        if (coordsMatch(coords, thisB.coordSystem)) {
                            coordsDetermined = true;
                        } else if (thisB.chains) {
                            for (var k in thisB.chains) {
                                if (coordsMatch(coords, thisB.chains[k].coords)) {
                                    nds.mapping = k;
                                    coordsDetermined = true;
                                }
                            }
                        }
                    }
                    
                }
                return addDasCompletionPage(nds, coordsDetermined, quantDetermined);
            },
            function() {
                return sqfail();
            }
        );
    }

    var tryAddBin = function(nds) {
        var fetchable;
        if (nds.bwgURI) {
            fetchable = new URLFetchable(nds.bwgURI);
        } else {
            fetchable = new BlobFetchable(nds.bwgBlob);
        }

        fetchable.slice(0, 1<<16).fetch(function(result, error) {
            if (!result) {
                removeChildren(stabHolder);
                stabHolder.appendChild(makeElement('h2', 'Custom data not found'));
                if (nds.bwgURI) {
                    stabHolder.appendChild(makeElement('p', 'Data URI: ' + nds.bwgURI + ' is not accessible.'));
                } else {
                    stabHolder.appendChild(makeElement('p', 'File access failed, are you using an up-to-date browser?'));
                }

                if (error) {
                    stabHolder.appendChild(makeElement('p', '' + error));
                }
                stabHolder.appendChild(makeElement('p', 'If in doubt, please check that the server where the file is hosted supports CORS.'));
                customMode = 'reset-bin';
                return;
            }

            var ba = new Uint8Array(result);
            var magic = readInt(ba, 0);
            if (magic == BIG_WIG_MAGIC || magic == BIG_BED_MAGIC) {
                var nameExtractPattern = new RegExp('/?([^/]+?)(.bw|.bb|.bigWig|.bigBed)?$');
                var match = nameExtractPattern.exec(nds.bwgURI || nds.bwgBlob.name);
                if (match) {
                    nds.name = match[1];
                }

                return addDasCompletionPage(nds, false, false, true);
            } else {
                if (ba[0] != 31 || ba[1] != 139) {
                    return binFormatErrorPage();
                }
                var unc = unbgzf(result);
                var uncba = new Uint8Array(unc);
                magic = readInt(uncba, 0);
                if (magic == BAM_MAGIC) {
                    if (nds.bwgBlob) {
                        return promptForBAI(nds);
                    } else {
                        return completeBAM(nds);
                    }
                } else {
                    // maybe Tabix?
                   return binFormatErrorPage();
                }
            }
        });
    }

    function promptForBAI(nds) {
        removeChildren(stabHolder);
        customMode = 'prompt-bai'
        stabHolder.appendChild(makeElement('h2', 'Select an index file'));
        stabHolder.appendChild(makeElement('p', 'Dalliance requires a BAM index (.bai) file when displaying BAM data.  These normally accompany BAM files.  For security reasons, web applications like Dalliance can only access local files which you have explicity selected.  Please use the file chooser below to select the appropriate BAI file'));

        stabHolder.appendChild(document.createTextNode('Index file: '));
        custFile = makeElement('input', null, {type: 'file'});
        stabHolder.appendChild(custFile);
        dataToFinalize = nds;
    }

    function completeBAM(nds) {
        var indexF;
        if (nds.baiBlob) {
            indexF = new BlobFetchable(nds.baiBlob);
        } else {
            indexF = new URLFetchable(nds.bwgURI + '.bai');
        }
        indexF.slice(0, 256).fetch(function(r) {
                var hasBAI = false;
                if (r) {
                    var ba = new Uint8Array(r);
                    var magic2 = readInt(ba, 0);
                    hasBAI = (magic2 == BAI_MAGIC);
                }
                if (hasBAI) {
                    var nameExtractPattern = new RegExp('/?([^/]+?)(.bam)?$');
                    var match = nameExtractPattern.exec(nds.bwgURI || nds.bwgBlob.name);
                    if (match) {
                        nds.name = match[1];
                    }

                    nds.bamURI = nds.bwgURI;
                    nds.bamBlob = nds.bwgBlob;
                    nds.bwgURI = undefined;
                    nds.bwgBlob = undefined;
                            
                    return addDasCompletionPage(nds, false, false, true);
                } else {
                    return binFormatErrorPage('You have selected a valid BAM file, but a corresponding index (.bai) file was not found.  Please index your BAM (samtools index) and place the BAI file in the same directory');
                }
        });
    }

    function binFormatErrorPage(message) {
        removeChildren(stabHolder);
        message = message || 'Custom data format not recognized';
        stabHolder.appendChild(makeElement('h2', 'Error adding custom data'));
        stabHolder.appendChild(makeElement('p', message));
        stabHolder.appendChild(makeElement('p', 'Currently supported formats are bigBed, bigWig, and BAM.'));
        customMode = 'reset-bin';
        return;
    }
                     
    var addDasCompletionPage = function(nds, coordsDetermined, quantDetermined, quantIrrelevant) {
        removeChildren(stabHolder);
        stabHolder.appendChild(makeElement('h2', 'Add custom data: step 2'));
        stabHolder.appendChild(document.createTextNode('Label: '));
        custName = makeElement('input', '', {value: nds.name});
        stabHolder.appendChild(custName);


        stabHolder.appendChild(document.createTextNode('User: '));
        custUser = makeElement('input', '');
        stabHolder.appendChild(custUser);
        stabHolder.appendChild(document.createTextNode('Pass: '));
        custPass = makeElement('input', '');
        stabHolder.appendChild(custPass);
        

        stabHolder.appendChild(makeElement('br'));
        stabHolder.appendChild(makeElement('br'));
        stabHolder.appendChild(makeElement('h4', 'Coordinate system: '));
        custCS = makeElement('select', null);
        custCS.appendChild(makeElement('option', thisB.coordSystem.auth + thisB.coordSystem.version, {value: '__default__'}));
        if (thisB.chains) {
            for (var csk in thisB.chains) {
                var cs = thisB.chains[csk].coords;
                custCS.appendChild(makeElement('option', cs.auth + cs.version, {value: csk}));
            }
        }
        custCS.value = nds.mapping || '__default__';
        stabHolder.appendChild(custCS);

        if (coordsDetermined) {
            stabHolder.appendChild(makeElement('p', "(Based on server response, probably doesn't need changing.)"));
        } else {
            stabHolder.appendChild(makeElement('p', [makeElement('b', 'Warning: '), "unable to determine the correct value from server responses.  Please check carefully."]));
            stabHolder.appendChild(makeElement('p', "If you don't see the mapping you're looking for, please contact thomas@biodalliance.org"));
        }

        if (!quantIrrelevant) {
            stabHolder.appendChild(document.createTextNode('Quantitative: '));
            custQuant = makeElement('input', null, {type: 'checkbox', checked: true});
            if (typeof nds.maxbins !== 'undefined') {
                custQuant.checked = nds.maxbins;
            }
            stabHolder.appendChild(custQuant);
            if (quantDetermined) {
                stabHolder.appendChild(makeElement('p', "(Based on server response, probably doesn't need changing.)"));
            } else {
                stabHolder.appendChild(makeElement('p', [makeElement('b', "Warning: "), "unable to determine correct value.  If in doubt, leave checked."]));
            }
        }

        if (nds.bwgBlob) {
            stabHolder.appendChild(makeElement('p', [makeElement('b', 'Warning: '), 'data added from local file.  Due to the browser security model, the track will disappear if you reload Dalliance.']));
        }

        custName.focus();
        customMode = 'finalize';
        dataToFinalize = nds;
    }


    var canButton = document.createElement('span');
    canButton.style.backgroundColor = 'rgb(230,230,250)';
    canButton.style.borderStyle = 'solid';
    canButton.style.borderColor = 'blue';
    canButton.style.borderWidth = '3px';
    canButton.style.padding = '2px';
    canButton.style.margin = '10px';
    canButton.style.width = '150px';
    // canButton.style.float = 'left';
    canButton.appendChild(document.createTextNode('Cancel'))
    canButton.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        thisB.removeAllPopups();
    }, false);

    var refreshButton = makeElement('span', 'Refresh');
    refreshButton.style.backgroundColor = 'rgb(230,230,250)';
    refreshButton.style.borderStyle = 'solid';
    refreshButton.style.borderColor = 'blue';
    refreshButton.style.borderWidth = '3px';
    refreshButton.style.padding = '2px';
    refreshButton.style.margin = '10px';
    refreshButton.style.width = '120px';
    refreshButton.addEventListener('mousedown', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        thisB.queryRegistry(__mapping);
    }, false);
    this.makeTooltip(refreshButton, 'Click to re-fetch data from the DAS registry');

    var buttonHolder = makeElement('div', [addButton, canButton, refreshButton]);
    buttonHolder.style.margin = '10px';
    asform.appendChild(buttonHolder);

    popup.appendChild(asform);
    makeStab(thisB.availableSources);

    return this.popit(ev, 'Add DAS data', popup, {width: 600});
}
