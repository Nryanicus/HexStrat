'use strict';

import * as hexLib from "./hex-functions.mjs";
import {BinaryHeap} from "../../lib/binaryHeap.mjs";

function reconstructPath(from, node)
{
    var path = [node];
    while (from.has(node))
    {
        node = from.get(node);
        path.push(node);
    }
    return path;
}

function heuristic(start, end)
{
    return hexLib.hex_distance(start, end);
}

export class aStar
{
    constructor(hex_set)
    {
        this.hex_set = hex_set;
        this.cache = new Map(); // {Hex+Hex, [Hex]}
    }

    findPath(start, goal, debug=false)
    {
        if (this.cache.has(start.toString()+goal.toString()))
        {
            if (debug)
                console.log("cache hit for "+start.toString()+" to "+goal.toString());
            return this.cache.get(start.toString()+goal.toString());
        }

        var open = new Set();
        open.add(start.toString());
        var closed = new Set();
        var from = new Map();
        
        var gScore = new Map();
        gScore.set(start.toString(), 0);

        var frontier = new BinaryHeap();
        frontier.insert(heuristic(start, goal), start);

        while (open.size > 0)
        {
            var current = frontier.extractMinimum().value;

            if (current.toString() == goal.toString())
            {
                var path = reconstructPath(from, current);
                this.cache.set(start.toString()+goal.toString(), path);
                return path;
            }
            open.delete(current.toString());
            closed.add(current.toString());

            hexLib.hex_ring(current, 1).forEach(function(h)
            {
                if (! this.hex_set.has(h.toString()) )
                    return;
                if ( closed.has(h.toString()))
                    return;

                var g_tmp = gScore.get(current.toString()) + 1;

                if (! open.has(h.toString()))
                    open.add(h.toString());
                else if (gScore.has(h.toString()) && g_tmp >= gScore.get(h.toString()))
                    return;

                from.set(h, current);
                gScore.set(h.toString(), g_tmp);
                frontier.insert(g_tmp + heuristic(h, goal), h);
            }, this);
        }
        // exhausted open without finding a path    
        return [];
    }
}