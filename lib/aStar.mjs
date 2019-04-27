'use strict';

import * as hexLib from "./hex-functions.mjs";
import {BinaryHeap} from "./binaryHeap.mjs";

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

export function aStar(start, goal, hex_set)
{
    // console.log("A* start " + start + " goal "+goal);
    // console.log("world " + Array.from(hex_set));

    var open = new Set();
    open.add(start.toString());
    var closed = new Set();
    var from = new Map();
    
    var gScore = new Map();
    gScore.set(start.toString(), 0);

    var frontier = new BinaryHeap();
    frontier.insert(heuristic(start, goal), start);

    var derp = 0;
    
    while (open.size > 0 || derp != 10)
    {
        // console.log("open "+open.size);
        // console.log("frontier "+frontier.size());
        // console.log("closed "+closed.size);
        derp++;
        var current = frontier.extractMinimum().value;
        // console.log("examining "+current);
        // console.log("gScore "+gScore.get(current.toString()));

        if (current.toString() == goal.toString())
        {
            // console.log("found path");
            return reconstructPath(from, current);
        }
        open.delete(current.toString());
        closed.add(current.toString());

        hexLib.hex_ring(current, 1).forEach(function(h)
        {
            // console.log("examining neighbour "+h);
            if ( (! hex_set.has(h.toString())))
            {
                // console.log("neighbour out of bounds, skipping");
                return;
            }
            if ( closed.has(h.toString()))
            {
                // console.log("neighbour already examined, skipping");
                return;
            }

            var g_tmp = gScore.get(current.toString()) + 1;

            if (! open.has(h.toString()))
            {
                // console.log("new neighbour, will examing further later");
                open.add(h.toString());
            }
            else if (gScore.has(h.toString()) && g_tmp >= gScore.get(h.toString()))
            {
                // console.log("previous examination had better gScore, skipping");
                return;
            }
            // console.log("potential better path found");

            from.set(h, current);
            gScore.set(h.toString(), g_tmp);
            frontier.insert(g_tmp + heuristic(h, goal), h);
        });
    }
    // exhausted open without finding a path    
    // console.log("exhausted open without finding a path");
    return [];
}