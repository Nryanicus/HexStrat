'use strict';

import * as hexLib from "./lib/hex-functions.mjs";
import {range} from "./lib/misc.mjs";
import {aStar} from "./lib/aStar.mjs";
import {BinaryHeap} from "./lib/binaryHeap.mjs";

export function generateWorld(world_size, hex_layout)
{
    // generate hex spiral with noisey heights
    const simplex_zoom1 = 128;
    const simplex_zoom2 = 512;
    const simplex_ratio = 0.4;
    var heightmap = new Map(); // Hex.toString() to z
    var watermap = new Map(); // Hex.toString() to bool, true for water

    var simplex1 = new SimplexNoise();
    var simplex2 = new SimplexNoise();
    var max_height = 0;
    var min_height = 10;
    var spiral = hexLib.hex_spiral(new hexLib.Hex(0,0,0), world_size);
    spiral.forEach(function(h)
    {
        var p = hexLib.hex_to_pixel(hex_layout, h);
        var z = simplex_ratio*simplex1.noise2D(p.x/simplex_zoom1, p.y/simplex_zoom1) + (1-simplex_ratio)*simplex2.noise2D(p.x/simplex_zoom2, p.y/simplex_zoom2);
        
        // shape heights so that edges tend to be lower
        var distance_ratio = 1 - hexLib.hex_distance(new hexLib.Hex(0,0,0), h)/world_size;
        z -= Math.pow(z, distance_ratio);
        
        if (z > max_height)
            max_height = z;
        if (z < min_height)
            min_height = z;
    
        heightmap.set(h.toString(), z);
    });

    // normalise height data and determine water hexes
    max_height -= min_height;

    spiral.forEach(function(h)
    {
        var z = heightmap.get(h.toString()) - min_height;
        var r = z/max_height;
        var is_water = (r > 0.5);
        watermap.set(h.toString(), is_water);
    });

    // BFS to find largest subgraph (landmass)
    var searched_hex_sprites = new Set();

    function bfs(h, subgraph)
    {
        // edge cases: out of bounds, been examined already, is water
        if (! heightmap.has(h.toString()))
            return subgraph;
        if (searched_hex_sprites.has(h.toString()))
            return subgraph;
        searched_hex_sprites.add(h.toString());
        if (!watermap.get(h.toString()))
            return subgraph;

        // base case: add current hex to subgraph, recurse to neighbours
        subgraph.push(h);
        var neighbours = hexLib.hex_ring(h, 1);
        neighbours.forEach(function(n)
        {
            subgraph = bfs(n, subgraph);
        });
        return subgraph;
    }

    var subgraphs = [];

    spiral.forEach(function(h)
    {
        subgraphs.push(bfs(h, []));
    });

    var largest_subgraph_index = 0;
    var largest_subgraph_length = subgraphs[0].length;
    for (var i in range(1, subgraphs.length))
    {
        if (subgraphs[i].length > largest_subgraph_length)
        {
            largest_subgraph_length = subgraphs[i].length;
            largest_subgraph_index = i;
        }
    }

    var largest_subgraph = subgraphs[largest_subgraph_index];

    // make the centre of gravity into the origin
    var centre_of_gravity = new hexLib.Hex(0,0,0);
    largest_subgraph.forEach(function(h)
    {
        centre_of_gravity = hexLib.hex_add(centre_of_gravity, h);
    });
    var translate = hexLib.hex_round(hexLib.hex_scale(centre_of_gravity, 1/largest_subgraph_length));


    var largest_subgraph_ids = largest_subgraph.map(h => h.toString());
    var filtered_spiral = spiral.filter(h => largest_subgraph_ids.includes(h.toString()));

    // return centered landmass
    var world = [];
    filtered_spiral.forEach(function(h)
    {
        var new_h = hexLib.hex_subtract(h, translate);
        world.push(new_h);
    });
    return world;
}

export function placeCapitols(world, world_string_set, world_size, num_players)
{
    const min_dist = world_size/num_players;
    
    // all non-coastal locations are valid starting locations
    var available_world = [];
    world.forEach(function(h){
        var no_water_neighbour = true;
        hexLib.hex_ring(h, 1).forEach(function(n)
        {
            if (! world_string_set.has(n.toString()))
                no_water_neighbour = false;
        });
        if (no_water_neighbour)
            available_world.push(h);
    });

    const available_world_original = available_world;

    var taken_positions = [];
    var attempts = 0;

    while (taken_positions.length != num_players)
    {
        // look for a spot
        var i = Math.floor(Math.random()*available_world.length);
        // console.log(i);
        var pos = available_world[ i ];
        // console.log(pos);
        taken_positions.push(pos);
        var available_world_tmp = [];
        available_world.forEach(function(h)
        {
            var dist = aStar(pos, h, world_string_set).length;
            if (dist > min_dist)
                available_world_tmp.push(h);
        }); 
        available_world = available_world_tmp;
        // if we can't place all players try again from the top, with a limit of the number of times we attempt
        if (available_world.length < num_players-i)
        {
            // console.log(i);
            // console.log(taken_positions);
            i = 0;
            // console.log(i);
            taken_positions = [];
            available_world = available_world_original;
            attempts++;
            if (attempts == 1000)
            {
                console.log("failure");
                return;
            }
        }
    }

    var territories = new Map(); // Hex.toString() => int
    world.forEach(function(h)
    {
        var bh = new BinaryHeap();
        for (var i = 0; i < num_players; i++) 
        {
            var p = taken_positions[i];
            var d = aStar(h, p, world_string_set).length;
            bh.insert(d, i);
        }
        var min_dist_player = -1;
        var closest = bh.extractMinimum();
        var second_closest = bh.extractMinimum();
        // if the two closest capitols are equidistant than the hex is neutral
        if (closest.key != second_closest.key) 
            min_dist_player = closest.value;

        territories.set(h.toString(), min_dist_player);
    });

    return [taken_positions, territories];
}