'use strict';

import * as hexLib from "./lib/hex-functions.mjs";
import {range, getRandomInt, shuffle, lerpColour} from "./lib/misc.mjs";
import {generateWorld, placeCapitols} from "./world.mjs";
import {BinaryHeap} from "./lib/binaryHeap.mjs";
import {aStar, clearCache} from "./lib/aStar.mjs";

const background = 0x00081f;

var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    backgroundColor: background,
    render: {
        antialias: false,
        roundPixels: true,
    }
};

var game = new Phaser.Game(config);
var controls;

const white = 0xffffff;

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
    this.load.image('reference', 'res/Reference.png');
    this.load.image('purchase', 'res/Purchase.png');
    this.load.image('purchase_select', 'res/PurchaseSelection.png');
    this.load.image('hex_select', 'res/HexOutlineBlur.png');
    this.load.image('hex', 'res/Hex.png');
    this.load.image('hex_flat', 'res/HexFlat.png');
    this.load.image('capitol', 'res/Cap.png');

    this.load.image('sword', 'res/Sword.png');
    this.load.image('spear', 'res/Spear.png');
    this.load.image('cavalry', 'res/Cav.png');
    this.load.image('ranged', 'res/Ranged.png');
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

    // world gen
    var hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));
    const world_size = 10.0;
    const num_players = world_size/5;
    var world = [];
    var units = [];
    var world_string_set;
    var capitols = [];
    var territories;
    var players = []; // {Hex, Colour}
    var hex_to_sprite = new Map();
    var occupied = new Map();
    var can_gen = true;

    function generateNewWorld()
    {
        if (! can_gen)
            return;
        can_gen = false;
        controls.stop();
        hex_select.setVisible(false);
        menu.setVisible(false);

        clearCache();
        players = [];
        units.map(c => c.destroy());
        occupied.clear();
        units = [];
        capitols.map(c => c.destroy());
        capitols = [];
        world.map(h => hex_to_sprite.get(h.toString()).destroy());
        world = [];
        hex_to_sprite.clear();

        while (world.length < num_players*world_size*2)
            world = generateWorld(world_size, hex_layout);
        world_string_set = new Set( world.map(x => x.toString()) );
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
                cam.zoomTo(4, 400, "Cubic");
                this.time.delayedCall(400, function()
                {
                    cam.zoomTo(3, 400, "Linear");
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
            controls.start();
            hex_select.setVisible(true);
            can_gen = true;
        }, [], this);
    }

    this.input.keyboard.on('keydown_Z', function (event) 
    {
        generateNewWorld.bind(this)();
    }, this);

    // control vars
    var unit_to_place;
    var is_placing_unit = false;

    // hex cursor
    var hex_select = this.add.image(0, 0, 'hex_select');
    hex_select.setAlpha(0.75);
    this.tweens.add({
        targets: hex_select,
        ease: 'Linear',
        duration: 600,
        repeat: -1,
        yoyo: true,
        alpha: 1
    });
    hex_select.depth = 999999;
    hex_select.setVisible(false);
    hex_select.setBlendMode(Phaser.BlendModes.ADD);
    this.input.on('pointermove', function (pointer) 
    {
        var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
        if (!world_string_set.has(h.toString()))
            return
        p = hexLib.hex_to_pixel(hex_layout, h);
        hex_select.setPosition(p.x, p.y);

        if (is_placing_unit)
        {
            unit_to_place.setPosition(p.x, p.y-2);
        }
    }, this);


    // recruitment
    var menu = this.add.container(0, 0)
    menu.setSize(96, 78);
    menu.setInteractive();
    var menu_background = this.add.image(-35, 0, 'purchase');
    var reference = this.add.image(14, 0, 'reference');

    var sword = this.add.image(-35, -24, 'sword').setInteractive({pixelPerfect:true});
    var spear = this.add.image(-35, -8, 'spear').setInteractive({pixelPerfect:true});
    var cavalry = this.add.image(-35, 8, 'cavalry').setInteractive({pixelPerfect:true});
    var ranged = this.add.image(-35, 24, 'ranged').setInteractive({pixelPerfect:true});
    var purchase_select = this.add.image(0,0, 'purchase_select');

    menu.add([menu_background, reference, purchase_select, sword, spear, cavalry, ranged]);

    reference.setVisible(false);
    menu.depth = 999999;
    menu.setVisible(false);
    menu.setActive(false);
    purchase_select.setVisible(false);
    purchase_select.setAlpha(0.75);
    purchase_select.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
        targets: purchase_select,
        ease: 'Linear',
        duration: 600,
        repeat: -1,
        yoyo: true,
        alpha: 1
    });

    var menu_state = 0;

    function close_menu()
    {
        menu_state = 0;
        menu.setVisible(false);
        reference.setVisible(false);
        menu.setActive(false);
        purchase_select.setVisible(false);
        hex_select.setVisible(true);
    }

    var unit_options = [sword, spear, cavalry, ranged];
    var unit_map = new Map([[sword,"sword"], [cavalry,"cavalry"], [spear,"spear"], [ranged,"ranged"]]);
    [sword, spear, cavalry, ranged, menu].forEach(function(img)
    {
        img.on('pointerdown', function(event)
        {
            if (unit_options.includes(img))
            {
                close_menu();

                var p = this.cameras.main.getWorldPoint(event.x, event.y);
                var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                p = hexLib.hex_to_pixel(hex_layout, h);

                unit_to_place = this.add.image(p.x, p.y-2, unit_map.get(img));
                unit_to_place.depth = 90000;
                units.push(unit_to_place);
                is_placing_unit = true;
                var flats = [];

                hexLib.hex_ring(players[0].capitol, 1).forEach(function(h)
                {
                    if (occupied.has(h.toString()))
                        return;
                    p = hexLib.hex_to_pixel(hex_layout, h);
                    var flat = this.add.image(p.x, p.y, 'hex_flat').setInteractive({pixelPerfect:true});
                    flat.depth = 90001;
                    flat.setBlendMode(Phaser.BlendModes.ADD);
                    flat.on('pointerdown', function(event)
                    {
                        p = this.cameras.main.getWorldPoint(event.x, event.y);
                        h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                        occupied.set(h.toString(), true);
                        is_placing_unit = false;
                        flats.map(f => f.destroy());
                        this.tweens.add({
                            targets: unit_to_place,
                            ease: 'Back',
                            easeParams: [4.5],
                            y: "+=2",
                            duration: 60
                        });
                    }, this);
                    flat.setAlpha(0.01);
                    this.tweens.add({
                        targets: flat,
                        ease: 'Linear',
                        duration: 600,
                        repeat: -1,
                        yoyo: true,
                        alpha: 0.25
                    });
                    flats.push(flat);
                }, this);

            }
            else
                menu_state++;

        }, this);
        img.on('pointerover', function(event)
        {
            hex_select.setVisible(false);
            if (unit_options.includes(img))
            {
                purchase_select.setVisible(true);
                var p = img.getCenter();
                purchase_select.setPosition(p.x, p.y);
            }
        }, this);
        img.on('pointerout', function(event)
        {
            hex_select.setVisible(true);
            purchase_select.setVisible(false);
        }, this);
    }, this);

    this.input.on('pointerdown', function (pointer, gameobjects) 
    {
        var player_cap = players[0].capitol.toString();
        var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
        if (h.toString() == player_cap)
        {
            menu_background.setTint(players[0].colour);
            reference.setTint(players[0].colour);
            menu_state++;
            if (menu_state == 1)
            {
                menu.setVisible(true);
                menu.setActive(true);
                var m_p = hexLib.hex_to_pixel(hex_layout, hexLib.hex_add(h, new hexLib.Hex(1,0,0)));
                menu.setPosition(m_p.x+38, m_p.y-1);
            }
            if (menu_state > 1)
            {
                reference.setVisible(true);
            }
        }
        else
        {
            // don't cancel menu if we're in the menu
            if (gameobjects.includes(menu))
                return;
            close_menu();
        }

    }, this);


    // start
    generateNewWorld.bind(this)();
}


function update (time, delta)
{
    controls.update(delta);
}
