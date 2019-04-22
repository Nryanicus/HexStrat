export function range(start, stop, step) {
    if (typeof stop == 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step == 'undefined') {
        step = 1;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }

    return result;
};

export function lerpColour(a, b, amount) 
{ 
    var ar = a >> 16, ag = a >> 8 & 0xff, ab = a & 0xff;
    var br = b >> 16, bg = b >> 8 & 0xff, bb = b & 0xff;
    var rr = ar + amount * (br - ar);
    var rg = ag + amount * (bg - ag);
    var rb = ab + amount * (bb - ab);

    return ((1 << 24) + (rr << 16) + (rg << 8) + rb | 0);
}
