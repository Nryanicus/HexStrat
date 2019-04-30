'use strict';

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

export function getRandomInt(min, max) 
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
export function shuffle(a) 
{
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}