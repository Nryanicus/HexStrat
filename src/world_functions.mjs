'use strict';

import * as hexLib from "./misc/hex-functions.mjs";
import {range, shuffle} from "./misc/utilities.mjs";
import {aStar} from "./misc/aStar.mjs";
import {BinaryHeap} from "../../lib/binaryHeap.mjs";
import {hex_layout} from "./misc/constants.mjs";

export function generateWorld(world_size)
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
    range(1, subgraphs.length).forEach(function(i)
    {
        if (subgraphs[i].length > largest_subgraph_length)
        {
            largest_subgraph_length = subgraphs[i].length;
            largest_subgraph_index = i;
        }
    });

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
    const min_dist = Math.max(7, world_size/num_players);
    
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

    var pathfinder = new aStar(world_string_set);

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
            var dist = pathfinder.findPath(pos, h).length;
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
                return [[], [], []];
        }
    }

    var players = [];
    for (var i = 0; i < num_players; i++)
        players.push([taken_positions[i]]);
    var territories, closest_units;
    [territories, closest_units] = determineTerritories(world, players, pathfinder);

    return [taken_positions, territories, closest_units, pathfinder];
}

// world : iterable of Hex, [Hex]
// players : array of array of hex, [[Hex]]. i.e a list of a list of each players' positions
// returns map of Hex to int, the owning player's index. With -1 for neutral hexes
export function determineTerritories(world, players, pathfinder)
{
    var territories = new Map(); // Hex.toString() => int
    var closest_units = new Map();
    world.forEach(function(h)
    {
        var bh = new BinaryHeap();
        for (var i=0; i<players.length; i++) 
        {
            for (var j=0; j<players[i].length; j++) 
            {
                var p = players[i][j];
                var d = pathfinder.findPath(h, p).length;
                bh.insert(d, {unit_p: p, player: i});
            }
        }
        var min_dist_player = -1;

        // FIXME: need to check all closest units, not just two

        var closest = bh.extractMinimum();
        var second_closest = bh.extractMinimum();
        // if the two closest units are equidistant and not on the same side then the hex is neutral
        if (! (closest.key == second_closest.key && closest.value.player != second_closest.value.player))
            min_dist_player = closest.value.player;

        closest_units.set(h.toString(), closest.value.unit_p); // doesn't matter if it's a neutral hex or not here, since it's just for graphics
        territories.set(h.toString(), min_dist_player);
    });

    return [territories, closest_units];
}