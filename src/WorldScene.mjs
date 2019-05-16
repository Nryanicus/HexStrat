'use strict';

import * as hexLib from "./misc/hex-functions.mjs";
import {shuffle, lerpColour} from "./misc/utilities.mjs";
import {aStar} from "./misc/aStar.mjs";
import {hex_layout, player_colours, white, grey, black} from "./misc/constants.mjs";
import * as events from "./misc/events.mjs";
import {Unit} from "./Unit.mjs";
import {Capitol} from "./Capitol.mjs";
import {HexCursor} from "./HexCursor.mjs";
import {generateWorld, placeCapitols, determineTerritories} from "./world_functions.mjs";

export class WorldScene extends Phaser.Scene
{

    constructor()
    {
        super("world");
        this.camera_controls;
        this.occupied = new Map();
        this.hex_to_sprite = new Map();
        this.pathfinder;

        this.world;
        this.world_string_set;
        this.territories;
        this.closest_units;
        this.capitol_positions;
        this.player_colours;
    }

    preload()
    {
        this.load.image('hex', 'res/Hex.png');
        this.load.image('capitol', 'res/Capitol.png');

        this.load.image('purchase', 'res/Purchase.png');
        this.load.image('purchase_select', 'res/PurchaseSelection.png');
        this.load.image('hex_select', 'res/HexOutlineBlur.png');
        this.load.image('hex_flat', 'res/HexGlow.png');

        this.load.image('sword', 'res/Sword.png');
        this.load.image('pike', 'res/Pike.png');
        this.load.image('cavalry', 'res/Cavalry.png');
        this.load.image('musket', 'res/Musket.png');
    }

    create()
    {
        var controlConfig = {
            camera: this.cameras.main,
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            speed: 0.5
        };

        this.camera_controls = new Phaser.Cameras.Controls.FixedKeyControl(controlConfig);

        this.events.on(events.recalc_territories, function()
        {
            [this.territories, this.closest_units] = determineTerritories(this.world, this.getPlayerPositions(), this.pathfinder);
            this.colourTerritories(false);
            this.events.emit(events.territory_change);
        }, this);

        this.registry.set("treasury0", 20);
        this.registry.set("upkeep0", 0);

        this.createMap();
        this.initUI();

        var i = 0;
        this.territories.forEach(function(owner_id, string, map)
        {
            if (owner_id == 0)
                i++;
        }, this);
        this.registry.set("income0", i);
    }

    createMap()
    {
        const world_size = 10.0;
        const num_players = world_size/5;
        this.world = [];
        this.hex_to_sprite.clear()
        this.occupied.clear();

        this.camera_controls.stop();

        while (true)
        {
            while (this.world.length < num_players*world_size*2)
                this.world = generateWorld(world_size);
            this.world_string_set = new Set( this.world.map(x => x.toString()) );

            // spawn starting locations and determine begining territories
            [this.capitol_positions, this.territories, this.closest_units, this.pathfinder] = placeCapitols(this.world, this.world_string_set, world_size, num_players);
            // if placeCapitols came back with real data we're done genning
            if (this.capitol_positions.length > 0)
                break;
            this.world = [];
        }

        var i = 0;
        var depth = -this.world.length;
        this.world.forEach(function(h)
        {
            var p = hexLib.hex_to_pixel(hex_layout, h);
            var img = this.add.image(p.x, p.y, 'hex');
            img.scaleX = 0;
            img.scaleY = 0;
            img.depth = depth + i;
            this.hex_to_sprite.set(h.toString(), img);
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

        // assign colours
        var available_colours = player_colours.slice(); // clone
        available_colours = shuffle(available_colours);
        this.player_colours = [];
        for (var i = 0; i < num_players; i++) 
        {
            var colour = available_colours.pop();
            this.player_colours.push(colour);
        }

        // pan-zoom to each capitol
        // store player capitol hex and colour
        var i = 0;
        this.capitol_positions.forEach(function(h)
        {
            // place capitol, animate surroundings
            var p = hexLib.hex_to_pixel(hex_layout, h);

            var cap = new Capitol(this, p.x, p.y, h, this.player_colours[i], i);
            this.add.existing(cap);
            cap.scaleX = 0;
            cap.scaleY = 0;

            cap.setPosition(p.x, p.y);
            cap.depth = this.world.length + 1;

            this.occupied.set(h.toString(), cap);

            this.time.delayedCall(300+this.world.length+1000*i, function()
            {

                var cam = this.cameras.main;
                cam.pan(p.x, p.y, 333, "Expo");
                cam.zoomTo(3, 400, "Cubic");
                this.time.delayedCall(400, function()
                {
                    cam.zoomTo(2, 400, "Linear");
                }, [], this);

                this.tweens.add({
                    targets: cap,
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

        var max_d = this.colourTerritories();

        // pan-zoom to centre, enable camera_controls and UI
        this.time.delayedCall(300+this.world.length+1000*(num_players-1) + max_d*100, function()
        {
            var cam = this.cameras.main;
            cam.pan(500, 500, 1000, "Linear");
        }, [], this);
        this.time.delayedCall(300+this.world.length+1000*(num_players-1) + max_d*100 + 1000, function()
        {
            this.camera_controls.start();
            this.registry.set(events.can_gen, true);
            this.events.emit(events.show_hex_cursor);
            this.events.emit(events.show_ui, true);
        }, [], this);
    }

    initUI()
    {
        var cursor = new HexCursor(this, -1000, -1000);
        this.add.existing(cursor);

        // do input reading instead of events on the hex images themselves to ensure even if other
        // gameobjects are on top of the hex image it still goes through
        // IMPORTANT: if we don't want this to trigger have the event listeners on top stopPropagation()
        this.input.on("pointerdown", function(pointer)
        {
            var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
            if (this.world_string_set.has(h.toString()))
                this.events.emit(events.hexdown, h);
        },this);
        this.input.on("pointermove", function(pointer)
        {
            var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
            if (this.world_string_set.has(h.toString()))
            {
                this.events.emit(events.hexover, h);
                if ( (!this.registry.get(events.menu_open) || this.registry.get(events.cursor_outside_menu)) && this.registry.get(events.can_gen) )
                    this.events.emit(events.show_hex_cursor, h);
            }
            else
                this.events.emit(events.hide_hex_cursor, h);
        },this);

        // map interaction
        this.events.on(events.hexdown, function (hex) 
        {
            this.events.emit(events.close_menu);
            if (this.occupied.has(hex.toString()))
            {
                var unit = this.occupied.get(hex.toString());
                unit.handlePointerDown();
            }
        }, this);
    }

    getPlayerPositions()
    {
        var players = [];
        for (var i=0; i < this.player_colours.length; i++) 
            players.push([]);
        this.occupied.forEach(function(unit, hex, map)
        {
            players[unit.owner_id].push(hexLib.Hex.prototype.fromString(hex));
        });
        return players;
    }

    colourTerritories(initial_delay=true)
    {
        // colour all environs, in radial fashion
        var max_d = 0;
        var tween_map = new Map();
        this.hex_to_sprite.forEach(function(hex, string, map)
        {
            var owner_id = this.territories.get(string);
            var d = this.pathfinder.findPath(hexLib.Hex.prototype.fromString(string), this.closest_units.get(string)).length;

            max_d = d > max_d ? d : max_d;
            var col1 = hex.isTinted ? hex.tint : white;
            var col2 = owner_id != -1 ? this.player_colours[owner_id] : white;
            var initdelay = 0;
            if (initial_delay)
                initdelay = 300+this.world.length+1000*owner_id;
            var tween = this.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Linear',
                duration: 100,
                delay: initdelay + d*100,
                onUpdate: function()
                {
                    hex.setTint(lerpColour(col1, col2, tween_map.get(string).getValue()));
                    hex.tint = col2;
                }
            }, this);

            tween_map.set(string, tween);
        }, this);

        return max_d;
    }

    update (time, delta)
    {
        this.camera_controls.update(delta);
    }
}
