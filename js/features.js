function sortFeatures(tier)
{
    var ungroupedFeatures = {};
    var groupedFeatures = {};
    var groups = {};
    var superGroups = {};
    var groupsToSupers = {};
    var nonPositional = [];
    var minScore, maxScore;
    var fbid;

    var init_fbid = function() {
        fbid = {};
        for (var fi = 0; fi < tier.currentFeatures.length; ++fi) {
            var f = tier.currentFeatures[fi];
            if (f.id) {
                fbid[f.id] = f;
            }
        }
    };
    
    var superParentsOf = function(f) {
        // FIXME: should recur.
        var spids = [];
        if (f.parents) {
            for (var pi = 0; pi < f.parents.length; ++pi) {
                var pid = f.parents[pi];
                var p = fbid[pid];
                if (!p) {
                    continue;
                }
                // alert(p.type + ':' + p.typeCv);
                if (p.typeCv == 'SO:0000704') {
                    pushnew(spids, pid);
                }
            }
        }
        return spids;
    }


    for (var fi = 0; fi < tier.currentFeatures.length; ++fi) {
        // var f = eval('[' + miniJSONify(tier.currentFeatures[fi]) + ']')[0]; 
        var f = tier.currentFeatures[fi];
        if (f.parts) {
            continue;
        }

        if (!f.min || !f.max) {
            nonPositional.push(f);
            continue;
        }

        if (f.score && f.score != '.' && f.score != '-') {
            sc = 1.0 * f.score;
            if (!minScore || sc < minScore) {
                minScore = sc;
            }
            if (!maxScore || sc > maxScore) {
                maxScore = sc;
            }
        }

        var fGroups = [];
        var fSuperGroup = null;
        if (f.groups) {
            for (var gi = 0; gi < f.groups.length; ++gi) {
                var g = f.groups[gi];
                var gid = g.id;
                if (g.type == 'gene') {
                    // Like a super-grouper...
                    fSuperGroup = gid; 
                    groups[gid] = shallowCopy(g);
                } else if (g.type == 'translation') {
                    // have to ignore this to get sensible results from bj-e :-(.
                } else {
                    pusho(groupedFeatures, gid, f);
                    groups[gid] = shallowCopy(g);
                    fGroups.push(gid);
                }
            }
        }

        if (f.parents) {
            if (!fbid) {
                init_fbid();
            }
            for (var pi = 0; pi < f.parents.length; ++pi) {
                var pid = f.parents[pi];
                var p = fbid[pid];
                if (!p) {
                    // alert("couldn't find " + pid);
                    continue;
                }
                if (!p.parts) {
                    p.parts = [f];
                }
                pushnewo(groupedFeatures, pid, p);
                pusho(groupedFeatures, pid, f);
                
                if (!groups[pid]) {
                    groups[pid] = {
                        type: p.type,
                        id: p.id,
                        label: p.label || p.id
                    };
                }
                fGroups.push(pid);

                var sgs = superParentsOf(p);
                if (sgs.length > 0) {
                    fSuperGroup = sgs[0];
                    var sp = fbid[sgs[0]];
                    groups[sgs[0]] = {
                        type: sp.type,
                        id: sp.id,
                        label: sp.label || sp.id
                    };
                    if (!tier.dasSource.collapseSuperGroups) {
                        tier.dasSource.collapseSuperGroups = true;
                        tier.isLabelValid = false;
                    }
                }
            }   
        }

        if (fGroups.length == 0) {
            pusho(ungroupedFeatures, f.type, f);
        } else if (fSuperGroup) {
            for (var g = 0; g < fGroups.length; ++g) {
                var gid = fGroups[g];
                pushnewo(superGroups, fSuperGroup, gid);
                groupsToSupers[gid] = fSuperGroup;
            } 
        }       
    }

    tier.ungroupedFeatures = ungroupedFeatures;
    tier.groupedFeatures = groupedFeatures;
    tier.groups = groups;
    tier.superGroups = superGroups;
    tier.groupsToSupers = groupsToSupers;

    if (minScore) {
        if (minScore > 0) {
            minScore = 0;
        } else if (maxScore < 0) {
            maxScore = 0;
        }
        tier.currentFeaturesMinScore = minScore;
        tier.currentFeaturesMaxScore = maxScore;
    }
}