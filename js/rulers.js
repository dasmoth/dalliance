/* jshint esversion: 6 */

"use strict";

export { Ruler, rulerDrawCallback };


function Ruler(options) {
    let self = this;

    self.value = options.value;
    self.min = options.min;
    self.max = options.max;
    self.width = options.width;
    self.color = options.color;

    Object.keys(self).map(key => {
        if (self[key] === undefined) {
            console.log("WARNING: Ruler option " + key + " not set");
        }
    });
}

Ruler.prototype.constructor = Ruler;

function rulerDrawCallback(canvas, tier) {
    let rulers = tier.dasSource.rulers;

    if (!rulers) {
        console.log("Tier uses ruler callback but has no rulers!");
    } else if (!(rulers instanceof Array)) {
        console.log("rulers.js: 'rulers' should be an Array");
    }


    rulers.map(r => {
        let rulerY = ((r.max - r.value) * r.height);
        let viewWidth = tier.viewport.width;
        let oldLineWidth = canvas.lineWidth;

        canvas.strokeStyle = r.color;
        canvas.beginPath();
        canvas.moveTo(-viewWidth, rulerY + r.offset);
        // Other parts of the code rely on not having changed the lineWidth...
        // So we need to change it back when we're done.
        canvas.lineWidth = r.width;
        canvas.lineTo(2*viewWidth, rulerY + r.offset);
        canvas.stroke();
        canvas.lineWidth = oldLineWidth;
    });
}
