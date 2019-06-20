'use strict';

import * as hexLib from "./misc/hex-functions.mjs";
import {shuffle, lerpColour} from "./misc/utilities.mjs";
import {aStar} from "./misc/aStar.mjs";
import {hex_layout, player_colours, white, grey, black} from "./misc/constants.mjs";
import * as events from "./misc/events.mjs";
import {Unit} from "./Unit.mjs";
import {Capitol} from "./Capitol.mjs";
import {HexCursor} from "./HexCursor.mjs";

export class WorldScene extends Phaser.Scene
{

    getGameState()
    {
        return this.registry.get(events.game_state);
    }

    getEvents()
    {
        return this.registry.get(events.events);
    }

    constructor()
    {
        super({key:"world", plugins:["Loader", "TweenManager", "InputPlugin", "Clock"]});

        this.camera_controls;
        this.hex_to_sprite = new Map();

        this.territories;
        this.closest_units;
        this.capitol_positions;
        this.player_colours;

        this.hex_to_unit = new Map();
    }

    preload()
    {
        this.load.image('hex', 'res/Hex.png');
        this.load.image('capitol', 'res/Capitol.png');

        this.load.image('purchase', 'res/Purchase.png');
        this.load.image('purchase_options', 'res/PurchaseOptions.png');
        this.load.image('purchase_sword_select', 'res/PurchaseSwordSelect.png');
        this.load.image('purchase_sword_glow', 'res/PurchaseSwordGlow.png');
        this.load.image('purchase_pike_select', 'res/PurchasePikeSelect.png');
        this.load.image('purchase_pike_glow', 'res/PurchasePikeGlow.png');
        this.load.image('purchase_cavalry_select', 'res/PurchaseCavalrySelect.png');
        this.load.image('purchase_cavalry_glow', 'res/PurchaseCavalryGlow.png');
        this.load.image('purchase_musket_select', 'res/PurchaseMusketSelect.png');
        this.load.image('purchase_musket_glow', 'res/PurchaseMusketGlow.png');

        this.load.image('hex_select', 'res/HexOutlineBlur.png');
        this.load.image('hex_flat', 'res/HexGlow.png');

        this.load.image('sword', 'res/Sword.png');
        this.load.image('pike', 'res/Pike.png');
        this.load.image('cavalry', 'res/Cavalry.png');
        this.load.image('musket', 'res/Musket.png');

        this.load.image('attack', 'res/Attack.png');
        this.load.image('attack_diag', 'res/AttackDiag.png');

        this.load.image('dead01', 'res/UnitDeathPixel01.png');
        this.load.image('dead02', 'res/UnitDeathPixel02.png');
        this.load.image('dead03', 'res/UnitDeathPixel03.png');
        this.load.image('dead04', 'res/UnitDeathPixel04.png');
        this.load.image('dead05', 'res/UnitDeathPixel05.png');
        this.load.image('dead06', 'res/UnitDeathPixel06.png');
        this.load.image('dead07', 'res/UnitDeathPixel07.png');
        this.load.image('dead08', 'res/UnitDeathPixel08.png');
        this.load.image('dead09', 'res/UnitDeathPixel09.png');
        this.load.image('dead10', 'res/UnitDeathPixel10.png');
        this.load.image('dead11', 'res/UnitDeathPixel11.png');
        this.load.image('dead12', 'res/UnitDeathPixel12.png');
        this.load.image('dead13', 'res/UnitDeathPixel13.png');
        this.load.image('dead14', 'res/UnitDeathPixel14.png');
        this.load.image('dead15', 'res/UnitDeathPixel15.png');
        this.load.image('dead16', 'res/UnitDeathPixel16.png');
        this.load.image('dead17', 'res/UnitDeathPixel17.png');
        this.load.image('dead18', 'res/UnitDeathPixel18.png');
        this.load.image('dead19', 'res/UnitDeathPixel19.png');
        this.load.image('dead20', 'res/UnitDeathPixel20.png');
        this.load.image('dead21', 'res/UnitDeathPixel21.png');
        this.load.image('dead22', 'res/UnitDeathPixel22.png');
        this.load.image('dead23', 'res/UnitDeathPixel23.png');
        this.load.image('dead24', 'res/UnitDeathPixel24.png');
        this.load.image('dead25', 'res/UnitDeathPixel25.png');
        this.load.image('dead26', 'res/UnitDeathPixel26.png');
        this.load.image('dead27', 'res/UnitDeathPixel27.png');
        this.load.image('dead28', 'res/UnitDeathPixel28.png');
        this.load.image('dead29', 'res/UnitDeathPixel29.png');
        this.load.image('dead30', 'res/UnitDeathPixel30.png');
        this.load.image('dead31', 'res/UnitDeathPixel31.png');

        this.load.image('cap01', 'res/CapDeathPixel01.png');
        this.load.image('cap02', 'res/CapDeathPixel02.png');
        this.load.image('cap03', 'res/CapDeathPixel03.png');
        this.load.image('cap04', 'res/CapDeathPixel04.png');
        this.load.image('cap05', 'res/CapDeathPixel05.png');
        this.load.image('cap06', 'res/CapDeathPixel06.png');
        this.load.image('cap07', 'res/CapDeathPixel07.png');
        this.load.image('cap08', 'res/CapDeathPixel08.png');
        this.load.image('cap09', 'res/CapDeathPixel09.png');
        this.load.image('cap10', 'res/CapDeathPixel10.png');
        this.load.image('cap11', 'res/CapDeathPixel11.png');
        this.load.image('cap12', 'res/CapDeathPixel12.png');
        this.load.image('cap13', 'res/CapDeathPixel13.png');
        this.load.image('cap14', 'res/CapDeathPixel14.png');
        this.load.image('cap15', 'res/CapDeathPixel15.png');
        this.load.image('cap16', 'res/CapDeathPixel16.png');
        this.load.image('cap17', 'res/CapDeathPixel17.png');
        this.load.image('cap18', 'res/CapDeathPixel18.png');
        this.load.image('cap19', 'res/CapDeathPixel19.png');
        this.load.image('cap20', 'res/CapDeathPixel20.png');
        this.load.image('cap21', 'res/CapDeathPixel21.png');
        this.load.image('cap22', 'res/CapDeathPixel22.png');
        this.load.image('cap23', 'res/CapDeathPixel23.png');
        this.load.image('cap24', 'res/CapDeathPixel24.png');
        this.load.image('cap25', 'res/CapDeathPixel25.png');
        this.load.image('cap26', 'res/CapDeathPixel26.png');
        this.load.image('cap27', 'res/CapDeathPixel27.png');
        this.load.image('cap28', 'res/CapDeathPixel28.png');
        this.load.image('cap29', 'res/CapDeathPixel29.png');
        this.load.image('cap30', 'res/CapDeathPixel30.png');
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

        this.createMap();
        this.initUI();
    }

    createMap()
    {
        this.hex_to_sprite.clear()

        this.camera_controls.stop();

        var i = 0;
        var depth = -this.getGameState().world.length;
        this.getGameState().world.forEach(function(h)
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
        for (var i=0; i<this.getGameState().num_players; i++) 
        {
            var colour = available_colours.pop();
            this.player_colours.push(colour);
        }

        var call_params = [];
        // pan-zoom to each capitol
        for (var i=0; i<this.getGameState().num_players; i++) 
        {
            var h = this.getGameState().capitols[i].hex;
            // place capitol, animate surroundings
            var p = hexLib.hex_to_pixel(hex_layout, h);

            var cap = new Capitol(this, p.x, p.y, this.player_colours[i], i);
            this.add.existing(cap);
            cap.scaleX = 0;
            cap.scaleY = 0;

            cap.setPosition(p.x, p.y);
            cap.depth = this.getGameState().world.length + 1;

            this.hex_to_unit.set(h.toString(), cap);

            this.time.delayedCall(300+this.getGameState().world.length+1000*i, function(cap)
            {
                var cam = this.cameras.main;
                cam.pan(cap.x, cap.y, 333, "Expo");
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
            }, [cap], this);
        };

        var max_d = this.colourTerritories();

        var num_players = this.getGameState().num_players;

        // pan-zoom to centre, enable camera_controls and UI
        this.time.delayedCall(300+this.getGameState().world.length+1000*(num_players-1) + max_d*100, function()
        {
            var cam = this.cameras.main;
            cam.pan(500, 500, 1000, "Linear");
        }, [], this);
        this.time.delayedCall(300+this.getGameState().world.length+1000*(num_players-1) + max_d*100 + 1000, function()
        {
            this.camera_controls.start();
            this.registry.set(events.can_gen, true);
            this.getEvents().emit(events.show_hex_cursor);
            this.getEvents().emit(events.show_ui, true);
        }, [], this);
    }

    initUI()
    {
        var cursor = new HexCursor(this, -1000, -1000);
        this.add.existing(cursor);

        // do input reading instead of events on the hex images themselves to ensure even if other
        // gameobjects are on top of the hex image it still goes through
        this.input.on("pointermove", function(pointer)
        {
            var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
            if (this.getGameState().world_hex_set.has(h.toString()))
            {
                this.getEvents().emit(events.hexover, h);
                if ( (!this.registry.get(events.menu_open) || this.registry.get(events.cursor_outside_menu)) && this.registry.get(events.can_gen) )
                    this.getEvents().emit(events.show_hex_cursor, h);
            }
            else
                this.getEvents().emit(events.hide_hex_cursor, h);
        }, this);

        // IMPORTANT: if we don't want this to trigger have the event listeners on top stopPropagation()
        // ALSO IMPORTANT: hexdown needs to be triggered after hexover, or the hexcursor will lag behind in some events
        this.input.on("pointerdown", function(pointer)
        {
            var p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
            if (this.getGameState().world_hex_set.has(h.toString()))
                this.getEvents().emit(events.hexdown, h);
        },this);

        // map interaction
        this.getEvents().on(events.hexdown, function (hex) 
        {
            this.getEvents().emit(events.close_menu);
            if (this.hex_to_unit.has(hex.toString()))
            {
                console.assert(this.getGameState().occupied.has(hex.toString()));
                var unit = this.hex_to_unit.get(hex.toString());
                unit.handlePointerDown();
            }
        }, this);

        // recolour map when asked to
        this.getEvents().on(events.territory_change, function()
        {
            this.colourTerritories(false);
        }, this);

    }

    colourTerritories(initial_delay=true)
    {
        var territories, closest_units;
        [territories, closest_units] = this.getGameState().determineTerritories();
        // colour all environs, in radial fashion
        var max_d = 0;
        var tween_map = new Map();
        this.hex_to_sprite.forEach(function(hex, string, map)
        {
            var owner_id = territories.get(string);
            var d = this.getGameState().world_pathfinder.findPath(hexLib.fromString(string), closest_units.get(string)).length;

            max_d = d > max_d ? d : max_d;
            var col1 = hex.isTinted ? hex.tint : white;
            var col2 = owner_id != -1 ? this.player_colours[owner_id] : white;
            var initdelay = 0;
            if (initial_delay)
                initdelay = 300+this.getGameState().world.length+1000*owner_id;
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
