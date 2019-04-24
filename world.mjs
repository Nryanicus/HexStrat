import * as hexLib from "./lib/hex-functions.mjs";
import {range} from "./lib/misc.mjs";

export function generateWorld(hex_layout)
{
    // generate hex spiral with noisey heights
    const simplex_zoom1 = 128;
    const simplex_zoom2 = 512;
    const simplex_ratio = 0.4;
    const world_size = 35.0;
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
        // console.log("searching " + h);
        // console.log(heightmap.get(h.toString()));
        // console.log(watermap.get(h.toString()));
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

    console.log(spiral.length);
    console.log(largest_subgraph_length);

    // make the centre of gravity the centre of the screen
    var centre_of_gravity = new hexLib.Hex(0,0,0);
    subgraphs[largest_subgraph_index].forEach(function(h)
    {
        centre_of_gravity = hexLib.hex_add(centre_of_gravity, h);
    });
    var translate = hexLib.hex_round(hexLib.hex_scale(centre_of_gravity, 1/largest_subgraph_length));

    // return centered landmass
    var world = [];
    subgraphs[largest_subgraph_index].forEach(function(h)
    {
        var new_h = hexLib.hex_subtract(h, translate);
        world.push(new_h);
    });
    return world;
}