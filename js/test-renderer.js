/* jshint esversion: 6 */
"use strict";

import { drawFeatureTier as oldDrawFeatureTier } from "./feature-draw.js";

import { shallowCopy } from "./utils.js";

import * as DefaultRenderer from "./default-renderer";

export { renderTier, drawTier };


function renderTier(status, tier) {
    drawTier(tier);
    tier.updateStatus(status);
}

// Testing is done by comparing the subtiers
// after calling two different versions of drawFeatureTier on a tier
function drawTier(tier) {
    console.log("Testing tier: " + tier.dasSource.name);

    let oldTier = shallowCopy(tier);
    let defTier = shallowCopy(tier);

    let oldStAfter = null;

    /* Old renderer */
    if (!oldTier.sequenceSource) {
        oldDrawFeatureTier(oldTier);
        if (oldTier.subtiers) {
            oldStAfter = JSON.parse(JSON.stringify(oldTier.subtiers));
        } else {
            oldStAfter = oldTier.subtiers;
        }
    }

    /* New renderer */
    let defStAfter = null;

    if (!defTier.sequenceSource) {
        let canvas = defTier.viewport.getContext("2d");
        DefaultRenderer.prepareSubtiers(defTier, canvas);
        if (defTier.subtiers) {
            defStAfter = JSON.parse(JSON.stringify(defTier.subtiers));
        } else {
            defStAfter = defTier.subtiers;
        }
    }

    /* compare output */
    if (defStAfter instanceof Array &&
        oldStAfter instanceof Array) {
        if (compareObjects(oldStAfter, defStAfter, 0, [{o1: "old " + oldTier.id, o2: "def " + defTier.id}])) {
            console.log("Tier " + tier.dasSource.name + ", Test passed");
        } else {
            console.log("Tier " + tier.dasSource.name + ", Test failed");
        }
    }
    console.log("\n\n\n");

}

function compareObjects(o1, o2, depth=0, stack=[]) {
    if (typeof(o1) !== typeof(o2)) {
        printDeep("type mismatch!", depth);
        printDeep("o1: " + typeof(o1), depth);
        console.log(o1);
        printDeep("o2: " + typeof(o2), depth);
        console.log(o2);
        printDeep("stack:", depth);
        prettyStack(stack);
        console.log("-".repeat(depth));
        return false;
    } else {
        if (o1 === null || o1 === undefined && o1 === o2) {
            return o1 === o2;
        }

        if (o1 instanceof Array &&
            o2 instanceof Array) {

            if (o1.length === o2.length) {
                let cmp = true;
                for (let i = 0; i < o1.length; i++) {

                    stack.push({o1: o1[i], o2: o2[i]});
                    if (!compareObjects(o1[i], o2[i], depth+1, stack)) {
                        cmp = false;
                        printDeep("fail on element #" + i, depth);
                        console.log("-".repeat(depth));
                        break;
                    }
                }
                return cmp;
            } else {
                printDeep("Arrays of different lengths", depth);
                printDeep("o1: " + typeof(o1), depth);
                printDeep(o1.length, depth);
                console.log(o1);
                printDeep("o2: " + typeof(o2), depth);
                printDeep(o2.length, depth);
                console.log(o2);
                printDeep("stack:", depth);
                prettyStack(stack);
                console.log("-".repeat(depth));
                return false;
            }


        } else if (typeof(o1) === "object" && o1 && o2) {
            if (Object.keys(o1).length === Object.keys(o2).length ||
                Object.keys(o1).every(k => k in o2)) {

                let cmp = true;
                for (let k in o1) {
                    stack.push({o1: o1[k], o2: o2[k], key: k});
                    if (!compareObjects(o1[k], o2[k], depth+1, stack)) {
                        cmp = false;
                        printDeep("fail when recursing on key " + k, depth);
                        console.log("-".repeat(depth));
                        break;
                    }
                }
                return cmp;

            } else {
                printDeep("Objects have different keys:", depth);
                printDeep("o1: ", depth);
                console.log(Object.keys(o1));
                printDeep("o2: ", depth);
                console.log(Object.keys(o2));
                printDeep("stack:", depth);
                prettyStack(stack);
                console.log("-".repeat(depth));
                return false;
            }

        } else {
            if (o1 === o2) {
                return true;
            } else {
                printDeep("fail when comparing primitives", depth);
                printDeep("primitives not equal: ", depth);
                printDeep("o1: ", depth);
                console.log(o1);
                printDeep("o2: ", depth);
                console.log(o2);
                printDeep("stack:", depth);
                prettyStack(stack);
                console.log("-".repeat(depth));
                return false;
            }
        }
    }
}

function printDeep(str, d=0) {
    console.log("/".repeat(d));
    console.log(str);
}

function prettyStack(stack) {
    stack.reverse().forEach((o, i) => printDeep(o, i));
}
