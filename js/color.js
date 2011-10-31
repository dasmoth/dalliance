function DColour(red, green, blue, name) {
    this.red = red|0;
    this.green = green|0;
    this.blue = blue|0;
    if (name) {
        this.name = name;
    }
}

DColour.prototype.toSvgString = function() {
    if (!this.name) {
        this.name = "rgb(" + this.red + "," + this.green + "," + this.blue + ")";
    }

    return this.name;
}

var palette = {
    red: new DColour(255, 0, 0, 'red'),
    green: new DColour(0, 255, 0, 'green'),
    blue: new DColour(0, 0, 255, 'blue'),
    yellow: new DColour(255, 255, 0, 'yellow'),
    white: new DColour(255, 255, 255, 'white'),
    black: new DColour(0, 0, 0, 'black')
};

var COLOR_RE = new RegExp('^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$');

function dasColourForName(name) {
    var c = palette[name];
    if (!c) {
        var match = COLOR_RE.exec(name);
        if (match) {
            c = new DColour(('0x' + match[1])|0, ('0x' + match[2])|0, ('0x' + match[3])|0, name);
            palette[name] = c;
        } else {
            dlog("couldn't handle color: " + name);
            c = palette.black;
            palette[name] = c;
        }
    }
    return c;
}

function makeGradient(steps, color1, color2, color3) {
    var cols = [];
    var c1 = dasColourForName(color1);
    var c2 = dasColourForName(color2);

    if (color3) {
	var c3 = dasColourForName(color3);
	for (var s = 0; s < steps; ++s) {
	    var relScore = (1.0 * s)/(steps-1);
	    var ca, cb, frac;
	    if (relScore < 0.5) {
                ca = c1;
                cb = c2;
                frac = relScore * 2;
            } else {
		ca = c2;
		cb = c3;
                frac = (relScore * 2.0) - 1.0;
            }
	    var fill = new DColour(
		((ca.red * (1.0 - frac)) + (cb.red * frac))|0,
		((ca.green * (1.0 - frac)) + (cb.green * frac))|0,
		((ca.blue * (1.0 - frac)) + (cb.blue * frac))|0
            ).toSvgString();
	    cols.push(fill);
	}
    } else {
	for (var s = 0; s < steps; ++s) {
	    var frac = (1.0 * s)/(steps-1);
	    var fill = new DColour(
		((c1.red * (1.0 - frac)) + (c2.red * frac))|0,
		((c1.green * (1.0 - frac)) + (c2.green * frac))|0,
		((c1.blue * (1.0 - frac)) + (c2.blue * frac))|0
            ).toSvgString();
	    cols.push(fill);
	}
    }
    return cols;
}
