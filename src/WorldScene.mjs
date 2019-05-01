'use strict';

import * as hexLib from "./misc/hex-functions.mjs";
import {shuffle, lerpColour} from "./misc/utilities.mjs";
import {aStar, clearCache} from "./misc/aStar.mjs";
import {hex_layout, player_colours, white} from "./misc/constants.mjs";
import {Unit} from "./Unit.mjs";
import {generateWorld, placeCapitols} from "./world_functions.mjs";

export class WorldScene extends Phaser.Scene
{

    constructor()
    {
        super("world");
        this.camera_controls;
        this.can_gen = false;
        this.occupied = new Map();
    }

    preload()
    {
        this.load.image('hex', 'res/Hex.png');
        this.load.image('capitol', 'res/Cap.png');

        this.load.image('reference', 'res/Reference.png');
        this.load.image('purchase', 'res/Purchase.png');
        this.load.image('purchase_select', 'res/PurchaseSelection.png');
        this.load.image('hex_select', 'res/HexOutlineBlur.png');
        this.load.image('hex_flat', 'res/HexFlat.png');

        this.load.image('sword', 'res/Sword.png');
        this.load.image('spear', 'res/Spear.png');
        this.load.image('cavalry', 'res/Cav.png');
        this.load.image('ranged', 'res/Ranged.png');
    }

    create()
    {
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

        this.camera_controls = new Phaser.Cameras.Controls.FixedKeyControl(controlConfig);

        this.input.keyboard.on('keydown_Z', function (event) 
        {
            if (this.can_gen)
            {
                this.can_gen = false;
                this.scene.restart();
            }
        }, this);

        this.createMap();
    }

    createMap()
    {

        const world_size = 10.0;
        const num_players = world_size/5;
        var world = [];
        var hex_to_sprite = new Map();

        this.camera_controls.stop();

        clearCache();

        while (world.length < num_players*world_size*2)
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
        var taken_positions, territories;
        [taken_positions, territories] = placeCapitols(world, world_string_set, world_size, num_players);

        // assign colours
        var available_colours = player_colours.slice(); // clone
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

            var colour = taken_colours[i];

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

        // pan-zoom to centre, enable camera_controls and UI
        this.time.delayedCall(300+world.length+1000*(num_players-1) + max_d*100, function()
        {
            var cam = this.cameras.main;
            cam.pan(500, 500, 1000, "Linear");
            this.camera_controls.start();
            this.can_gen = true;
            this.player_capitol_hex = taken_positions[0];
            this.player_colour = taken_colours[0];
            this.world_string_set = world_string_set;
            this.initUI();
        }, [], this);
    }

    initUI()
    {
        // control vars
        var unit_to_place;
        var flats = [];
        var is_placing_unit = false;

        // hex cursor
        var hex_select = this.add.image(0, 0, 'hex_select');
        hex_select.setAlpha(0.75);
        hex_select.depth = 90000;
        this.tweens.add({
            targets: hex_select,
            ease: 'Linear',
            duration: 600,
            repeat: -1,
            yoyo: true,
            alpha: 1
        });
        hex_select.setBlendMode(Phaser.BlendModes.ADD);
        this.input.on('pointermove', function (pointer) 
        {
            var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
            if (!this.world_string_set.has(h.toString()))
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
        menu.depth = 90000;
        menu.setSize(96, 78);
        menu.setInteractive(); // todo give hit area rect (new Phaser.Geom.Rectangle(96, 78), Phaser.Geom.Rectangle.Contains)
        var menu_background = this.add.image(-35, 0, 'purchase');
        var reference = this.add.image(14, 0, 'reference');

        var sword = this.add.image(-35, -24, 'sword').setInteractive({pixelPerfect:true});
        var spear = this.add.image(-35, -8, 'spear').setInteractive({pixelPerfect:true});
        var cavalry = this.add.image(-35, 8, 'cavalry').setInteractive({pixelPerfect:true});
        var ranged = this.add.image(-35, 24, 'ranged').setInteractive({pixelPerfect:true});
        var purchase_select = this.add.image(0,0, 'purchase_select');

        menu.add([menu_background, reference, purchase_select, sword, spear, cavalry, ranged]);

        reference.setVisible(false);
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
                    unit_to_place = this.add.existing(new Unit(this, p.x, p.y-2, unit_map.get(img), h, this.occupied, this.world_string_set));
                    unit_to_place.depth = 80000;
                    is_placing_unit = true;

                    hexLib.hex_ring(this.player_capitol_hex, 1).forEach(function(h)
                    {
                        if (this.occupied.has(h.toString()))
                            return;
                        p = hexLib.hex_to_pixel(hex_layout, h);
                        var flat = this.add.image(p.x, p.y, 'hex_flat').setInteractive({pixelPerfect:true});
                        flat.depth = 90001;
                        flat.setBlendMode(Phaser.BlendModes.ADD);
                        flat.on('pointerdown', function(pointer, localx, localy, event)
                        {
                            p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                            h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                            unit_to_place.hex = h;
                            this.occupied.set(h.toString(), unit_to_place);
                            is_placing_unit = false;
                            flats.map(f => f.destroy());
                            flats = [];
                            this.tweens.add({
                                targets: unit_to_place,
                                ease: 'Back',
                                easeParams: [4.5],
                                y: "+=2",
                                duration: 60
                            });
                            event.stopPropagation();
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
            var player_cap = this.player_capitol_hex.toString();
            var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
            if (h.toString() == player_cap && ! is_placing_unit)
            {
                menu_background.setTint(this.player_colour);
                reference.setTint(this.player_colour);
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

                if (this.occupied.has(h.toString()))
                {
                    var unit = this.occupied.get(h.toString());
                    var handle_return = unit.handlePointerDown(this.occupied, this.world_string_set);
                    if (handle_return.is_moving)
                    {
                        unit_to_place = this.add.image(p.x, p.y-2, unit.type);
                        unit_to_place.setAlpha(0.5);
                        is_placing_unit = true;

                        handle_return.possible_destinations.forEach(function(h)
                        {
                            p = hexLib.hex_to_pixel(hex_layout, h);
                            var flat = this.add.image(p.x, p.y, 'hex_flat').setInteractive({pixelPerfect:true});
                            flat.depth = 90001;
                            flat.setBlendMode(Phaser.BlendModes.ADD);
                            flat.on('pointerdown', function(event)
                            {
                                p = this.cameras.main.getWorldPoint(event.x, event.y);
                                h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                                p = hexLib.hex_to_pixel(hex_layout, h);
                                this.occupied.set(h.toString(), unit);
                                is_placing_unit = false;
                                unit_to_place.destroy();
                                flats.map(f => f.destroy());
                                flats = [];

                                // todo, lerp into position along path
                                // grey out after move
                                // have attack anim and UI
                                unit.updatePosition(p.x, p.y, h);
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

                }
            }
        }, this);
    }


    update (time, delta)
    {
        this.camera_controls.update(delta);
    }
}
