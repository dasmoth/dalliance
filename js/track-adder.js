/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// track-adder.js
//


Browser.prototype.currentlyActive = function(source) {
    for (var ti = 0; ti < this.tiers.length; ++ti) {
        if (sourcesAreEqual(this.tiers[ti].dasSource, source))
            return true;
    }
    return false;
}

Browser.prototype.makeButton = function(name, tooltip) {
    var regButton = makeElement('a', name, {href: '#'});
    if (tooltip) {
        this.makeTooltip(regButton, tooltip);
    }
    return makeElement('li', regButton);
}

function activateButton(addModeButtons, which) {
    for (var i = 0; i < addModeButtons.length; ++i) {
        var b = addModeButtons[i];
        if (b === which) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    }
}

Browser.prototype.showTrackAdder = function(ev) {
    if (this.uiMode === 'add') {
        this.hideToolPanel();
        this.setUiMode('none');
        return;
    }

    var thisB = this;

    var popup = makeElement('div', null, {className: 'dalliance'} , {width: '100%', display: 'inline-block', boxSizing: 'border-box', MozBoxSizing: 'border-box', verticalAlign: 'top'});

    var addModeButtons = [];
    var makeStab, makeStabObserver;
    var regButton = this.makeButton('Registry', 'Browse compatible datasources from the DAS registry');
    addModeButtons.push(regButton);
    
    for (var m in this.mappableSources) {
        var mf  = function(mm) {
            var mapButton = thisB.makeButton(thisB.chains[mm].srcTag, 'Browse datasources mapped from ' + thisB.chains[mm].srcTag);
            addModeButtons.push(mapButton);
            mapButton.addEventListener('click', function(ev) {
                ev.preventDefault(); ev.stopPropagation();
                activateButton(addModeButtons, mapButton);
                makeStab(thisB.mappableSources[mm], mm);
            }, false);
        }; mf(m);
    }
    

    var makeHubButton = function(hub) {
        if (thisB.coordSystem.ucscName && hub.genomes[thisB.coordSystem.ucscName]) {
            var hubRemove = makeElement('i', null, {className: 'icon-remove'});
            var hbContent = makeElement('span', [hub.shortLabel || 'Unknown', ' ', hubRemove]);
            var hubButton = thisB.makeButton(hbContent, hub.longLabel);
            addModeButtons.push(hubButton);
            
            hubButton.addEventListener('click', function(ev) {
                ev.preventDefault(); ev.stopPropagation();

                hub.genomes[thisB.coordSystem.ucscName].getTracks(function(tracks, err) {
                    if (err) {
                        console.log(err);
                    }

                    activateButton(addModeButtons, hubButton);
                    makeHubStab(tracks);
                });
            }, false);

            hubRemove.addEventListener('click', function(ev) {
                ev.preventDefault(); ev.stopPropagation();
                
                for (var hi = 0; hi < thisB.hubs.length; ++hi) {
                    if (thisB.hubs[hi] == hub.url) {
                        console.log('index ' + hi);
                        thisB.hubs.splice(hi, 1);
                        break;
                    }
                }
                for (var hi = 0; hi < thisB.hubObjects.length; ++hi) {
                    if (thisB.hubObjects[hi].url == hub.url) {
                        thisB.hubObjects.splice(hi, 1);
                        break;
                    }
                }

                modeButtonHolder.removeChild(hubButton);
                activateButton(addModeButtons, addHubButton);
                switchToHubConnectMode();
            }, false);

            return hubButton;
        }
    }
 

    var defButton = this.makeButton('Defaults', 'Browse the default set of data for this browser');
    addModeButtons.push(defButton);
    var custButton = this.makeButton('Custom', 'Add arbitrary DAS data');
    addModeButtons.push(custButton);
    var binButton = this.makeButton('Binary', 'Add data in bigwig or bigbed format');
    addModeButtons.push(binButton);


    for (var hi = 0; hi < this.hubObjects.length; ++hi) {
        var hub = this.hubObjects[hi];
        makeHubButton(hub);
    }

    var addHubButton = this.makeButton('+', 'Connect to a new track-hub');
    addModeButtons.push(addHubButton);

    activateButton(addModeButtons, regButton);
    var modeButtonHolder = makeElement('ul', addModeButtons, {className: 'nav nav-tabs'}, {marginBottom: '0px'});
    popup.appendChild(modeButtonHolder);
    
    var custURL, custName, custCS, custQuant, custFile, custUser, custPass;
    var customMode = false;
    var dataToFinalize = null;

    var asform = makeElement('form', null, {}, {display: 'inline-block', width: '100%'});
    asform.addEventListener('submit', function(ev) {
            ev.stopPropagation(); ev.preventDefault();
            doAdd();
            return false;
    }, true); 
    var stabHolder = makeElement('div');
    stabHolder.style.position = 'relative';
    stabHolder.style.overflow = 'scroll';
    // stabHolder.style.height = '500px';
    asform.appendChild(stabHolder);

    var __mapping;
    var __sourceHolder;


    makeStab = function(msources, mapping) {
        refreshButton.style.display = 'none';
        addButton.style.display = 'none';
        canButton.style.display = 'none';
        if (__sourceHolder) {
            __sourceHolder.removeListener(makeStabObserver);
        }
        __mapping = mapping;
        __sourceHolder = msources;
        __sourceHolder.addListenerAndFire(makeStabObserver);
    }

    makeStabObserver = function(msources) {
        customMode = false;
        var buttons = [];
        removeChildren(stabHolder);
        if (!msources) {
            stabHolder.appendChild(makeElement('p', 'Dalliance was unable to retrieve data source information from the DAS registry, please try again later'));
            return;
        }
        
        var stabBody = makeElement('tbody', null, {className: 'table table-striped table-condensed'}, {width: '100%'});
        var stab = makeElement('table', stabBody, {className: 'table table-striped table-condensed'}, {width: '100%', tableLayout: 'fixed'}); 
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
            var r = makeElement('tr');

            var bd = makeElement('td', null, {}, {width: '30px'});
            bd.style.textAlign = 'center';
            if (!source.props || source.props.cors) {
                var b = makeElement('input');
                b.type = 'checkbox';
                b.dalliance_source = source;
                if (__mapping) {
                    b.dalliance_mapping = __mapping;
                }
                // b.checked = thisB.currentlyActive(source);
                bd.appendChild(b);
                buttons.push(b);
                b.addEventListener('change', function(ev) {
                    if (ev.target.checked) {
                        thisB.addTier(ev.target.dalliance_source);
                    } else {
                        thisB.removeTier(ev.target.dalliance_source);
                    }
                });
            } else {
                bd.appendChild(document.createTextNode('!'));
                thisB.makeTooltip(bd, makeElement('span', ["This data source isn't accessible because it doesn't support ", makeElement('a', "CORS", {href: 'http://www.w3.org/TR/cors/'}), "."]));
            }
            r.appendChild(bd);
            var ld = makeElement('td');
            ld.appendChild(document.createTextNode(source.name));
            if (source.desc && source.desc.length > 0) {
                thisB.makeTooltip(ld, source.desc);
            }
            r.appendChild(ld);
            stabBody.appendChild(r);
            ++idx;
        }

        function setChecks() {
            for (var bi = 0; bi < buttons.length; ++bi) {
                var b = buttons[bi];
                b.checked = thisB.currentlyActive(b.dalliance_source);
            }
        }
        setChecks();
        thisB.addTierListener(function(l) {
            setChecks();
        });

        stabHolder.appendChild(stab);
    };

    function makeHubStab(tracks) {
        refreshButton.style.display = 'none';
        addButton.style.display = 'none';
        canButton.style.display = 'none';

        customMode = false;
        removeChildren(stabHolder);
        
        var ttab = makeElement('div', null, {}, {width: '100%'});
        var sources = [];
        for (var i = 0; i < tracks.length; ++i) {
            sources.push(tracks[i]);
        }
        
        sources.sort(function(a, b) {
            return a.shortLabel.toLowerCase().trim().localeCompare(b.shortLabel.toLowerCase().trim());
        });

        var groups = [];
        var tops = [];
        
        for (var ti = 0; ti < sources.length; ++ti) {
            var track = sources[ti];
            if (track.children && track.children.length > 0 && track.container != 'multiWig') {
                groups.push(track);
            } else {
                tops.push(track);
            }
        }
        if (tops.length > 0) {
            groups.push({
                shortLabel: 'Others',
                children: tops});
        }
        
        var buttons = [];
        for (var gi = 0; gi < groups.length; ++gi) {
            var group = groups[gi];
            var dg = group;
            if (!dg.dimensions && dg._parent && dg._parent.dimensions)
                dg = dg._parent;

            var dprops = {}
            if (dg.dimensions) {
                var dtoks = dg.dimensions.split(/(\w+)=(\w+)/);
                for (var dti = 0; dti < dtoks.length - 2; dti += 3) {
                    dprops[dtoks[dti + 1]] = dtoks[dti + 2];
                }
            }

            if (dprops.dimX && dprops.dimY) {
                var dimX = dprops.dimX, dimY = dprops.dimY;
                var sgX = dg.subgroups[dimX];
                var sgY = dg.subgroups[dimY];
                
                var trks = {};
                for (var ci = 0; ci < group.children.length; ++ci) {
                    var child = group.children[ci];
                    var vX = child.sgm[dimX], vY = child.sgm[dimY];
                    if (!trks[vX])
                        trks[vX] = {};
                    trks[vX][vY] = child;
                }

                var matrix = makeElement('table', null, {className: 'table table-striped table-condensed'}, {tableLayout: 'fixed'});
                {
                    var header = makeElement('tr');
                    header.appendChild(makeElement('th', null, {}, {width: '150px', height: '100px'}));   // blank corner element
                    for (var si = 0; si < sgX.titles.length; ++si) {
                        var h = makeElement('th', makeElement('div', sgX.titles[si], {}, {transform: 'rotate(-60deg)', 
                                                                       transformOrigin: '0% 100%', 
                                                                       webkitTransform: 'rotate(-60deg) translate(20px,10px)', 
                                                                       webkitTransformOrigin: '0% 100%',
                                                                       textAlign: 'left'}), {}, {width: '35px',
                                                                                                 height: '100px',
                                                                                                 verticalAlign: 'bottom'})
                        header.appendChild(h);
                    }
                    matrix.appendChild(header);
                }

                var mbody = makeElement('tbody', null, {className: 'table table-striped table-condensed'})
                for (var yi = 0; yi < sgY.titles.length; ++yi) {
                    var vY = sgY.tags[yi];
                    var row = makeElement('tr');
                    row.appendChild(makeElement('th', sgY.titles[yi]), {});
                    
                    for (var xi = 0; xi < sgX.titles.length; ++xi) {
                        var vX = sgX.tags[xi];
                        var cell = makeElement('td');
                        if (trks[vX] && trks[vX][vY]) {
                            var track = trks[vX][vY];
                            var ds = track.toDallianceSource();
                            if (!ds)
                                continue;
                            
                            var r = makeElement('tr');
                            var bd = makeElement('td');
                            bd.style.textAlign = 'center';
                            
                            var b = makeElement('input');
                            b.type = 'checkbox';
                            b.dalliance_source = ds;
                            if (__mapping) {
                                b.dalliance_mapping = __mapping;
                            }
                            buttons.push(b);
                            cell.appendChild(b);
                            b.addEventListener('change', function(ev) {
                                if (ev.target.checked) {
                                    thisB.addTier(ev.target.dalliance_source);
                                } else {
                                    thisB.removeTier(ev.target.dalliance_source);
                                }
                            });

                        }
                        row.appendChild(cell);
                    } 
                    mbody.appendChild(row);
                }
                matrix.appendChild(mbody);
                ttab.appendChild(makeTreeTableSection(group.shortLabel, matrix, gi==0));                
            } else {
                var stabBody = makeElement('tbody', null, {className: 'table table-striped table-condensed'});
                var stab = makeElement('table', stabBody, {className: 'table table-striped table-condensed'}, {width: '100%', tableLayout: 'fixed'}); 
                var idx = 0;
            
                for (var i = 0; i < group.children.length; ++i) {
                    var track = group.children[i];
                    var ds = track.toDallianceSource();
                    if (!ds)
                        continue;

                    var r = makeElement('tr');
                    var bd = makeElement('td', null, {}, {width: '30px'});
                    bd.style.textAlign = 'center';
                    
                    var b = makeElement('input');
                    b.type = 'checkbox';
                    b.dalliance_source = ds;
                    if (__mapping) {
                        b.dalliance_mapping = __mapping;
                    }
                    buttons.push(b);
                    bd.appendChild(b);
                    b.addEventListener('change', function(ev) {
                        if (ev.target.checked) {
                            thisB.addTier(ev.target.dalliance_source);
                        } else {
                            thisB.removeTier(ev.target.dalliance_source);
                        }
                    });

                    r.appendChild(bd);
                    var ld = makeElement('td');
                    ld.appendChild(document.createTextNode(track.shortLabel));
                    if (track.longLabel && track.longLabel.length > 0) {
                        thisB.makeTooltip(ld, track.longLabel);
                    }
                    r.appendChild(ld);
                    stabBody.appendChild(r);
                    ++idx;
                }
                ttab.appendChild(makeTreeTableSection(group.shortLabel, stab, gi==0));
                
            }
        }

        function setChecks() {
            for (var bi = 0; bi < buttons.length; ++bi) {
                var b = buttons[bi];
                b.checked = thisB.currentlyActive(b.dalliance_source);
            }
        }
        setChecks();
        thisB.addTierListener(function(l) {
            setChecks();
        });
        
        stabHolder.appendChild(ttab);
    };
    

    regButton.addEventListener('click', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        activateButton(addModeButtons, regButton);
        makeStab(thisB.availableSources);
    }, false);
    defButton.addEventListener('click', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        activateButton(addModeButtons, defButton);
        makeStab(new Observed(thisB.defaultSources));
    }, false);
    binButton.addEventListener('click', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        switchToBinMode();
    }, false);
    addHubButton.addEventListener('click', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        switchToHubConnectMode();
    }, false);


    function switchToBinMode() {
        activateButton(addModeButtons, binButton);
        customMode = 'bin';

        refreshButton.style.display = 'none';
        addButton.style.display = 'inline';
        canButton.style.display = 'none';

        removeChildren(stabHolder);

        if (thisB.supportsBinary) {
            var pageHolder = makeElement('div', null, {}, {paddingLeft: '10px', paddingRight: '10px'});
            pageHolder.appendChild(makeElement('h3', 'Add custom URL-based data'));
            pageHolder.appendChild(makeElement('p', ['You can add indexed binary data hosted on an web server that supports CORS (', makeElement('a', 'full details', {href: 'http://www.biodalliance.org/bin.html'}), ').  Currently supported formats are bigwig, bigbed, and indexed BAM.']));

            pageHolder.appendChild(makeElement('br'));
            pageHolder.appendChild(document.createTextNode('URL: '));
            custURL = makeElement('input', '', {size: 80, value: 'http://www.biodalliance.org/datasets/ensGene.bb'}, {width: '100%'});
            pageHolder.appendChild(custURL);
            
            pageHolder.appendChild(makeElement('br'));
            pageHolder.appendChild(makeElement('b', '- or -'));
            pageHolder.appendChild(makeElement('br'));
            pageHolder.appendChild(document.createTextNode('File: '));
            custFile = makeElement('input', null, {type: 'file'});
            pageHolder.appendChild(custFile);
            
            pageHolder.appendChild(makeElement('p', 'Clicking the "Add" button below will initiate a series of test queries.'));

            stabHolder.appendChild(pageHolder);
            custURL.focus();
        } else {
            stabHolder.appendChild(makeElement('h2', 'Your browser does not support binary data'));
            stabHolder.appendChild(makeElement('p', 'Browsers currently known to support this feature include Google Chrome 9 or later and Mozilla Firefox 4 or later.'));
        }
        
    }

    function switchToHubConnectMode() {
        activateButton(addModeButtons, addHubButton);
        refreshButton.style.display = 'none';
        addButton.style.display = 'inline';
        canButton.style.display = 'none';

        customMode = 'hub-connect';
        refreshButton.style.visibility = 'hidden';

        removeChildren(stabHolder);

        var pageHolder = makeElement('div', null, {}, {paddingLeft: '10px', paddingRight: '10px'});
        pageHolder.appendChild(makeElement('h3', 'Connect to a track hub.'));
        pageHolder.appendChild(makeElement('p', ['Enter the top-level URL (usually points to a file called "hub.txt" of a UCSC-style track hub']));
        
        custURL = makeElement('input', '', {size: 120, value: 'http://www.biodalliance.org/datasets/testhub/hub.txt'}, {width: '100%'});
        pageHolder.appendChild(custURL);
        
        stabHolder.appendChild(pageHolder);
        
        custURL.focus();
    }

    custButton.addEventListener('click', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        switchToCustomMode();
    }, false);

    function switchToCustomMode() {
        activateButton(addModeButtons, custButton);
        refreshButton.style.display = 'none';
        addButton.style.display = 'inline';
        canButton.style.display = 'none';

        customMode = 'das';

        removeChildren(stabHolder);

        var customForm = makeElement('div', null, {},  {paddingLeft: '10px', paddingRight: '10px'});
        customForm.appendChild(makeElement('h3', 'Add custom DAS data'));
        customForm.appendChild(makeElement('p', 'This interface is intended for adding custom or lab-specific data.  Public data can be added more easily via the registry interface.'));
                
        customForm.appendChild(document.createTextNode('URL: '));
        customForm.appendChild(makeElement('br'));
        custURL = makeElement('input', '', {size: 80, value: 'http://www.derkholm.net:8080/das/medipseq_reads/'}, {width: '100%'});
        customForm.appendChild(custURL);

        customForm.appendChild(makeElement('p', 'Clicking the "Add" button below will initiate a series of test queries.  If the source is password-protected, you may be prompted to enter credentials.'));
        stabHolder.appendChild(customForm);

        custURL.focus();
    }



    var addButton = makeElement('button', 'Add', {className: 'btn btn-primary'});
    addButton.addEventListener('click', function(ev) {
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
            } else if (customMode === 'reset-hub') {
                switchToHubConnectMode();
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

                thisB.addTier(dataToFinalize);
                switchToCustomMode();
            } else if (customMode === 'hub-connect') {
                var curi = custURL.value.trim();
                if (!/^.+:\/\//.exec(curi)) {
                    curi = 'http://' + curi;
                }
                console.log('hub: ' + curi);
                connectTrackHub(curi, function(hub, err) {
                    if (err) {
                        removeChildren(stabHolder);
                        stabHolder.appendChild(makeElement('h2', 'Error connecting to track hub'))
                        stabHolder.appendChild(makeElement('p', err));
                        customMode = 'reset-hub';
                        return;
                    } else {
                        if (thisB.coordSystem.ucscName && hub.genomes[thisB.coordSystem.ucscName]) {
                            thisB.hubs.push(curi);
                            thisB.hubObjects.push(hub);
                            
                            var hubButton = makeHubButton(hub);
                            modeButtonHolder.appendChild(hubButton);
                            activateButton(addModeButtons, hubButton);
                            
                        
                            // FIXME redundant with hub-tab click handler.
                        
                            hub.genomes[thisB.coordSystem.ucscName].getTracks(function(tracks, err) {
                                makeHubStab(tracks);
                            });
                        } else {
                            removeChildren(stabHolder);
                            stabHolder.appendChild(makeElement('h2', 'No data for this genome'))
                            stabHolder.appendChild(makeElement('p', 'This URL appears to be a valid track-hub, but it doesn\'t contain any data for the coordinate system of this browser'));
                            stabHolder.appendChild(makeElement('p', 'coordSystem.ucscName = ' + thisB.coordSystem.ucscName));
                            customMode = 'reset-hub';
                            return;
                        }
                    }
                });
            }
        } else {
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
        nds.features(testSegment, {}, function(features, status) {
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

                var fs = null;
                if (sources.length == 1) {
                    fs = sources[0];
                } else {
                    for (var i = 0; i < sources.length; ++i) {
                        if (sources[i].uri === nds.uri) {
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
        refreshButton.style.display = 'none';
        addButton.style.display = 'inline';
        canButton.style.display = 'inline';

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
        refreshButton.style.display = 'none';
        addButton.style.display = 'inline';
        canButton.style.display = 'inline';

        removeChildren(stabHolder);
        message = message || 'Custom data format not recognized';
        stabHolder.appendChild(makeElement('h2', 'Error adding custom data'));
        stabHolder.appendChild(makeElement('p', message));
        stabHolder.appendChild(makeElement('p', 'Currently supported formats are bigBed, bigWig, and BAM.'));
        customMode = 'reset-bin';
        return;
    }
                     
    var addDasCompletionPage = function(nds, coordsDetermined, quantDetermined, quantIrrelevant) {
        refreshButton.style.display = 'none';
        addButton.style.display = 'inline';
        canButton.style.display = 'inline';

        removeChildren(stabHolder);
        stabHolder.appendChild(makeElement('h2', 'Add custom data: step 2'));
        stabHolder.appendChild(document.createTextNode('Label: '));
        custName = makeElement('input', '', {value: nds.name});
        stabHolder.appendChild(custName);


        // stabHolder.appendChild(document.createTextNode('User: '));
        custUser = makeElement('input', '');
        // stabHolder.appendChild(custUser);
        //stabHolder.appendChild(document.createTextNode('Pass: '));
        custPass = makeElement('input', '');
        // stabHolder.appendChild(custPass);
        

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


    var canButton = makeElement('button', 'Cancel', {className: 'btn'});
    canButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        switchToBinMode();
    }, false);

    var refreshButton = makeElement('button', 'Refresh', {className: 'btn'});
    refreshButton.addEventListener('click', function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        thisB.queryRegistry(__mapping);
    }, false);
    this.makeTooltip(refreshButton, 'Click to re-fetch data from the DAS registry');

    var buttonHolder = makeElement('div', [addButton, ' ', canButton, ' ', refreshButton]);
    buttonHolder.style.margin = '10px';
    asform.appendChild(buttonHolder);

    popup.appendChild(asform);
    makeStab(thisB.availableSources);

    this.showToolPanel(popup);
    this.setUiMode('add');
}
