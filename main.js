import * as hexLib from "./lib/hex-functions.mjs";
import {range, lerpColour} from "./lib/misc.mjs";

var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const simplex_zoom1 = 128;
const simplex_zoom2 = 512;
const simplex_ratio = 0.4;
const world_size = 35.0;
var controls;
var hex_layout;
var game = new Phaser.Game(config);
var hex_sprite_pairs = []
var hex_sprite_lookup = new Map();

function preload ()
{
    this.load.image('hex', 'res/Hex.png');
}

function create ()
{
    // camera boilerplate
    var cursors = this.input.keyboard.createCursorKeys();

    var controlConfig = {
        camera: this.cameras.main,
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        zoomIn: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        zoomOut: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        speed: 0.5
    };

    controls = new Phaser.Cameras.Controls.FixedKeyControl(controlConfig);

    // hex test
    var simplex1 = new SimplexNoise();
    var simplex2 = new SimplexNoise();
    var max_height = 0;
    var min_height = 10;

    hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));
    var spiral = hexLib.hex_spiral(new hexLib.Hex(0,0,0), world_size);
    spiral.forEach(function(h)
    {
        var p = hexLib.hex_to_pixel(hex_layout, h);
        var s = this.add.sprite(p.x, p.y, 'hex');
        
        var z = simplex_ratio*simplex1.noise2D(p.x/simplex_zoom1, p.y/simplex_zoom1) + (1-simplex_ratio)*simplex2.noise2D(p.x/simplex_zoom2, p.y/simplex_zoom2);
        var distance_ratio = 1 - hexLib.hex_distance(new hexLib.Hex(0,0,0), h)/world_size;
        z -= Math.pow(z, distance_ratio);
        
        s.setData('height', z);
        
        if (z > max_height)
            max_height = z;
        if (z < min_height)
            min_height = z;
        
        var hs = {h: h, s: s};
        hex_sprite_pairs.push(hs);
        hex_sprite_lookup.set(h.toString(), hs);
    }, this);

    max_height -= min_height;

    hex_sprite_pairs.forEach(function(hs)
    {
        var h = hs.h;
        var p = hexLib.hex_to_pixel(hex_layout, h);
        var s = hs.s;
        var z = s.data.values.height - min_height;
        var r = z/max_height;
        var is_water = false;

        var tint = lerpColour(0, 16777215, r);
        if (r > 0.5)
            tint = 16777215;
        else
        {
            is_water = true;
            tint = 0;
        }

        s.setTint(tint);

        s.setInteractive({ pixelPerfect: true });
        s.setData('hex', h);
        s.setData('is_water', is_water);
        s.on('pointerdown', function (pointer) {
            console.log(s.data.values.hex);
            console.log(s.data.values.is_water);
            console.log("|===============|");
        });
    }, this);

    // BFS to find largest subgraph (landmass)
    var searched_hex_sprites = new Set();

    function bfs(h, subgraph)
    {
        // edge cases: out of bounds, been examined already, is water
        if (! hex_sprite_lookup.has(h.toString()))
            return subgraph;
        if (searched_hex_sprites.has(h.toString()))
            return subgraph;
        searched_hex_sprites.add(h.toString());
        if (hex_sprite_lookup.get(h.toString()).s.data.values.is_water)
            return subgraph;

        // main case, add current hex to subgraph, recurse to neighbours
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

    console.log(subgraphs);
    console.log(largest_subgraph_index);
    console.log(largest_subgraph_length);

    // make all hex_sprite_pairs which aren't part of the largest subgraph water
    for (var i in range(0, subgraphs.length))
    {
        if (i == largest_subgraph_index)
            continue;
        subgraphs[i].forEach(function(h)
        {
            var s = hex_sprite_lookup.get(h.toString()).s;
            s.setData('is_water', true);
            s.setTint(50000);
        });
    }


}


function update (time, delta)
{
    controls.update(delta);
}
