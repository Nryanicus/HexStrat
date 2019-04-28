'use strict';

import * as hexLib from "./lib/hex-functions.mjs";
import {range, getRandomInt, shuffle, lerpColour} from "./lib/misc.mjs";
import {generateWorld, placeCapitols} from "./world.mjs";
import {BinaryHeap} from "./lib/binaryHeap.mjs";
import {aStar} from "./lib/aStar.mjs";

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

var game = new Phaser.Game(config);
var controls;

const white = 0xffffff;
const background = 0x00081f;

const purple = 0x6110a2;
const grey = 0x797979;
const brown = 0x794100;
const cream = 0xffdba2;
const light_blue = 0x5182ff;
const yellow = 0xebd320;
const pink = 0xdb41c3;
const orange = 0xff7930;
const deep_pink = 0xdb4161;
const green = 0x306141;
const colour_names = new Map([[0x6110a2, "purple"], [0x797979, "grey"], [0x794100, "brown"], [0xffdba2, "cream"], [0x5182ff, "light_blue"], [0xebd320, "yellow"], [0xdb41c3, "pink"], [0xff7930, "orange"], [0xdb4161, "deep_pink"], [0x306141, "green"]]);

function preload ()
{
    this.load.image('purchase', 'res/Purchase.png');
    this.load.image('purchase_select', 'res/PurchaseSelection.png');
    this.load.image('select', 'res/HexOutlineBlur.png');
    this.load.image('hex', 'res/Hex.png');
    this.load.image('capitol', 'res/Cap.png');
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
    this.cameras.main.setBackgroundColor(background);

    // world gen
    var hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));
    const world_size = 25.0;
    const num_players = world_size/5;
    var world = [];
    var capitols = [];
    var territories;
    var players = []; // {Hex, Colour}
    var hex_to_sprite = new Map();
    var can_gen = true;

    // generateNewWorld.bind(this)();

    function generateNewWorld()
    {
        if (! can_gen)
            return;
        can_gen = false;
        controls.stop();
        select.setVisible(false);
        menu.setVisible(false);

        capitols.map(c => c.destroy());
        world.map(h => hex_to_sprite.get(h.toString()).destroy());
        hex_to_sprite.clear();

        world = generateWorld(world_size, hex_layout);
        var world_string_set = new Set( world.map(x => x.toString()) );
        var i = 0;
        var depth = world.length;
        world.forEach(function(h)
        {
            var p = hexLib.hex_to_pixel(hex_layout, h);
            var img = this.add.image(p.x, p.y, 'hex');
            img.scaleX = 0;
            img.scaleY = 0;
            img.depth = depth - i;
            hex_to_sprite.set(h.toString(), img);
            img.setPosition(p.x, p.y);

            this.tweens.add({
                targets: img,
                scaleX: 1,
                scaleY: 1,
                ease: 'Elastic',
                easeParams: [ 1.5, 0.5 ],
                duration: 1000,
                delay: i * 1
            });
            i++;
        }, this);   

        // spawn starting locations and determine begining territories
        var taken_positions;
        [taken_positions, territories] = placeCapitols(world, world_string_set, world_size, num_players);

        // assign colours
        var available_colours = [purple, grey, brown, cream, light_blue, yellow, pink, orange, deep_pink, green];;
        available_colours = shuffle(available_colours);
        var taken_colours = [];
        for (var i = 0; i < num_players; i++) 
        {
            var colour = available_colours.pop();
            taken_colours.push(colour);
        }

        // pan-zoom to each capitol
        // store player capitol hex and colour
        var i = 0;
        taken_positions.forEach(function(h)
        {
            // place capitol, animate surroundings
            var p = hexLib.hex_to_pixel(hex_layout, h);
            var img = this.add.image(p.x, p.y, 'capitol');
            img.scaleX = 0;
            img.scaleY = 0;

            img.setPosition(p.x, p.y);
            img.depth = world.length + 1;
            capitols.push(img);

            var colour = taken_colours[i];
            players.push({capitol: h, colour: taken_colours[i]});

            this.time.delayedCall(300+world.length+1000*i, function()
            {

                var cam = this.cameras.main;
                cam.pan(p.x, p.y, 333, "Expo");
                cam.zoomTo(3, 400, "Cubic");
                this.time.delayedCall(400, function()
                {
                    cam.zoomTo(2, 400, "Linear");
                }, [], this);

                this.tweens.add({
                    targets: img,
                    scaleX: 1,
                    scaleY: 1,
                    ease: 'Stepped',
                    easeParams: [ 3 ],
                    duration: 1000,
                    delay: 0
                });
            }, [], this);
            i++;
        }, this);

        // colour all environs, in radial fashion
        var max_d = 0;
        var tween_map = new Map();
        hex_to_sprite.forEach(function(hex, string, map)
        {
            var owner_id = territories.get(string);
            if (owner_id == -1)
                return;

            var d = aStar(hexLib.Hex.prototype.fromString(string), taken_positions[owner_id], world_string_set).length;

            max_d = d > max_d ? d : max_d;

            var tween = this.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Linear',
                duration: 100,
                delay: 300+world.length+1000*owner_id + d*100,
                onUpdate: function()
                {
                    hex.setTint(lerpColour(white, taken_colours[owner_id], tween_map.get(string).getValue()));
                }
            });

            tween_map.set(string, tween);
        }, this);

        // pan-zoom to centre
        this.time.delayedCall(300+world.length+1000*(num_players-1) + max_d*100, function()
        {
            var cam = this.cameras.main;
            cam.pan(500, 500, 1000, "Linear");
            cam.zoomTo(1.5, 1000, "Linear");
            controls.start();
            select.setVisible(true);
            can_gen = true;
        }, [], this);
    }

    this.input.keyboard.on('keydown_Z', function (event) 
    {
        generateNewWorld.bind(this)();
    }, this);

    var select = this.add.image(0, 0, 'select');
    select.depth = 999999;
    select.setVisible(false);
    this.input.on('pointermove', function (pointer) 
    {
        var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
        p = hexLib.hex_to_pixel(hex_layout, h);
        select.setPosition(p.x, p.y);
    }, this);


    // recruitment
    var menu = this.add.image(0, 0, 'purchase');
    menu.depth = 999999;
    menu.setVisible(false);


    this.input.on('pointerdown', function (pointer) 
    {
        var player_cap = players[0].capitol.toString();
        var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
        if (h.toString() == player_cap)
        {
            men.setVisible = true;
        }

    }, this);

}


function update (time, delta)
{
    controls.update(delta);
}
