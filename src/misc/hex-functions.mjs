'use strict';

import {range} from "./utilities.mjs";

export function Point(x, y) {
    return {x: x, y: y};
}


export class Hex{
    constructor(q, r, s) 
    {
        // if (Math.round(q + r + s) !== 0) throw "q + r + s must be 0";
        this.q = q;
        this.r = r;
        this.s = s;
    }

    toString()
    {
        return "Hex(" + this.q + ',' + this.r + ',' + this.s + ")";
    }
}


export function fromString(s) 
{
    var str = s.slice(4,-1);
    var arr = str.split(",");
    return new Hex(parseInt(arr[0], 10), parseInt(arr[1], 10), parseInt(arr[2], 10));
}

export function hex_add(a, b)
{
    return new Hex(a.q + b.q, a.r + b.r, a.s + b.s);
}

export function hex_subtract(a, b)
{
    return new Hex(a.q - b.q, a.r - b.r, a.s - b.s);
}

export function hex_scale(a, k)
{
    return new Hex(a.q * k, a.r * k, a.s * k);
}

export function hex_rotate_left(a)
{
    return new Hex(-a.s, -a.q, -a.r);
}

export function hex_rotate_right(a)
{
    return new Hex(-a.r, -a.s, -a.q);
}

export var hex_directions = [new Hex(1, 0, -1), new Hex(1, -1, 0), new Hex(0, -1, 1), new Hex(-1, 0, 1), new Hex(-1, 1, 0), new Hex(0, 1, -1)];
export function hex_direction(direction)
{
    return hex_directions[direction];
}

export function hex_neighbor(hex, direction)
{
    return hex_add(hex, hex_direction(direction));
}

export var hex_diagonals = [new Hex(2, -1, -1), new Hex(1, -2, 1), new Hex(-1, -1, 2), new Hex(-2, 1, 1), new Hex(-1, 2, -1), new Hex(1, 1, -2)];
export function hex_diagonal_neighbor(hex, direction)
{
    return hex_add(hex, hex_diagonals[direction]);
}

export function hex_length(hex)
{
    return (Math.abs(hex.q) + Math.abs(hex.r) + Math.abs(hex.s)) / 2;
}

export function hex_distance(a, b)
{
    return hex_length(hex_subtract(a, b));
}

export function hex_round(h)
{
    var qi = Math.round(h.q);
    var ri = Math.round(h.r);
    var si = Math.round(h.s);
    var q_diff = Math.abs(qi - h.q);
    var r_diff = Math.abs(ri - h.r);
    var s_diff = Math.abs(si - h.s);
    if (q_diff > r_diff && q_diff > s_diff)
    {
        qi = -ri - si;
    }
    else
        if (r_diff > s_diff)
        {
            ri = -qi - si;
        }
        else
        {
            si = -qi - ri;
        }
    return new Hex(qi, ri, si);
}

export function hex_lerp(a, b, t)
{
    return new Hex(a.q * (1.0 - t) + b.q * t, a.r * (1.0 - t) + b.r * t, a.s * (1.0 - t) + b.s * t);
}

export function hex_linedraw(a, b)
{
    var N = hex_distance(a, b);
    var a_nudge = new Hex(a.q + 0.000001, a.r + 0.000001, a.s - 0.000002);
    var b_nudge = new Hex(b.q + 0.000001, b.r + 0.000001, b.s - 0.000002);
    var results = [];
    var step = 1.0 / Math.max(N, 1);
    for (var i = 0; i <= N; i++)
    {
        results.push(hex_round(hex_lerp(a_nudge, b_nudge, step * i)));
    }
    return results;
}


export function OffsetCoord(col, row) {
    return {col: col, row: row};
}

export var EVEN = 1;
export var ODD = -1;
export function qoffset_from_cube(offset, h)
{
    var col = h.q;
    var row = h.r + (h.q + offset * (h.q & 1)) / 2;
    return OffsetCoord(col, row);
}

export function qoffset_to_cube(offset, h)
{
    var q = h.col;
    var r = h.row - (h.col + offset * (h.col & 1)) / 2;
    var s = -q - r;
    return new Hex(q, r, s);
}

export function roffset_from_cube(offset, h)
{
    var col = h.q + (h.r + offset * (h.r & 1)) / 2;
    var row = h.r;
    return OffsetCoord(col, row);
}

export function roffset_to_cube(offset, h)
{
    var q = h.col - (h.row + offset * (h.row & 1)) / 2;
    var r = h.row;
    var s = -q - r;
    return new Hex(q, r, s);
}




export function DoubledCoord(col, row) {
    return {col: col, row: row};
}

export function qdoubled_from_cube(h)
{
    var col = h.q;
    var row = 2 * h.r + h.q;
    return DoubledCoord(col, row);
}

export function qdoubled_to_cube(h)
{
    var q = h.col;
    var r = (h.row - h.col) / 2;
    var s = -q - r;
    return new Hex(q, r, s);
}

export function rdoubled_from_cube(h)
{
    var col = 2 * h.q + h.r;
    var row = h.r;
    return DoubledCoord(col, row);
}

export function rdoubled_to_cube(h)
{
    var q = (h.col - h.row) / 2;
    var r = h.row;
    var s = -q - r;
    return new Hex(q, r, s);
}




export function Orientation(f0, f1, f2, f3, b0, b1, b2, b3, start_angle) {
    return {f0: f0, f1: f1, f2: f2, f3: f3, b0: b0, b1: b1, b2: b2, b3: b3, start_angle: start_angle};
}




export function Layout(orientation, size, origin) {
    return {orientation: orientation, size: size, origin: origin};
}

export var layout_pointy = Orientation(Math.sqrt(3.0), Math.sqrt(3.0) / 2.0, 0.0, 3.0 / 2.0, Math.sqrt(3.0) / 3.0, -1.0 / 3.0, 0.0, 2.0 / 3.0, 0.5);
export var layout_flat = Orientation(3.0 / 2.0, 0.0, Math.sqrt(3.0) / 2.0, Math.sqrt(3.0), 2.0 / 3.0, 0.0, -1.0 / 3.0, Math.sqrt(3.0) / 3.0, 0.0);
export function hex_to_pixel(layout, h)
{
    var M = layout.orientation;
    var size = layout.size;
    var origin = layout.origin;
    var x = (M.f0 * h.q + M.f1 * h.r) * size.x;
    var y = (M.f2 * h.q + M.f3 * h.r) * size.y;
    return Point(x + origin.x, y + origin.y);
}

export function pixel_to_hex(layout, p)
{
    var M = layout.orientation;
    var size = layout.size;
    var origin = layout.origin;
    var pt = Point((p.x - origin.x) / size.x, (p.y - origin.y) / size.y);
    var q = M.b0 * pt.x + M.b1 * pt.y;
    var r = M.b2 * pt.x + M.b3 * pt.y;
    return new Hex(q, r, -q - r);
}

export function hex_corner_offset(layout, corner)
{
    var M = layout.orientation;
    var size = layout.size;
    var angle = 2.0 * Math.PI * (M.start_angle - corner) / 6.0;
    return Point(size.x * Math.cos(angle), size.y * Math.sin(angle));
}

export function polygon_corners(layout, h)
{
    var corners = [];
    var center = hex_to_pixel(layout, h);
    for (var i = 0; i < 6; i++)
    {
        var offset = hex_corner_offset(layout, i);
        corners.push(Point(center.x + offset.x, center.y + offset.y));
    }
    return corners;
}

export function hex_ring(center, radius)
{
    var results = [];
    var hex = hex_add(center, hex_scale(hex_direction(4), radius));
    for (var i in range(0,6))
    {
        for (var j in range(0, radius))
        {
            results.push(hex);
            hex = hex_neighbor(hex, i);
        }
    }
    return results
}

export function hex_spiral(center, radius)
{
    var results = [center];
    for (var k in range(1, radius))
    {
        results = results.concat(hex_ring(center, k));
    }
    return results;
}