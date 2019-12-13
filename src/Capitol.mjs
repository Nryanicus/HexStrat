import * as hexLib from "./misc/hex-functions.mjs";
import {hex_layout, black, grey, unit_cost, capitol_pixel_columns, capitol_death_pixels, sword, pike, cavalry, musket, capitol} from "./misc/constants.mjs";
import {range, getRandomInt, getRandomFloat} from "./misc/utilities.mjs";
import * as events from "./misc/events.mjs";
import {Unit} from "./Unit.mjs";

export class Capitol extends Phaser.GameObjects.Container 
{
    getGameState()
    {
        return this.scene.registry.get(events.game_state);
    }

    hex()
    {
        return this.getGameState().capitols[this.owner_id].hex;
    }

    lives()
    {
        return this.getGameState().capitols[this.owner_id].lives;
    }

    getEvents()
    {
        return this.scene.registry.get(events.events);
    }

    constructor (scene, x, y, colour, owner_id)
    {
        super(scene, x, y);

        // all game logic is looked up through this key
        this.owner_id = owner_id;

        this.scene = scene;
        this.colour = colour;
        this.setPosition(x, y);
        this.depth = 1;
        this.pixels = new Map();
        this.flats = [];
        this.type = capitol;

        // deep copy
        this.pixels_columns = [];
        capitol_pixel_columns.forEach(function(col)
        {
            this.pixels_columns.push(col.slice(0));
        }, this);

        range(1, 31).forEach(function(i)
        {
            var str = i.toString();
            if (str.length == 1)
                str = "0"+str;
            var pix = this.scene.add.image(0, 0, 'cap'+str);
            this.pixels.set(str, pix);
            this.add(pix);
        }, this);

        this.scene.registry.set(events.cursor_outside_menu, true);

        // recruitment
        this.menu = this.scene.add.container(0, 0)
        this.menu.setSize(28, 78);
        this.menu.setInteractive(new Phaser.Geom.Rectangle(0,0, 28, 78), Phaser.Geom.Rectangle.Contains);
        this.menu.depth = 2;
        var menu_background = this.scene.add.image(0, 0, 'purchase');
        menu_background.setTint(this.colour.color);

        var sword_img = this.scene.add.image(0, 0, 'purchase_sword_select').setInteractive(this.scene.input.makePixelPerfect(1));
        var pike_img = this.scene.add.image(0, 0, 'purchase_pike_select').setInteractive(this.scene.input.makePixelPerfect(1));
        var cavalry_img = this.scene.add.image(0, 0, 'purchase_cavalry_select').setInteractive(this.scene.input.makePixelPerfect(1));
        var musket_img = this.scene.add.image(0, 0, 'purchase_musket_select').setInteractive(this.scene.input.makePixelPerfect(1));
        var sword_glow = this.scene.add.image(0,0, 'purchase_sword_glow');
        var pike_glow = this.scene.add.image(0,0, 'purchase_pike_glow');
        var cavalry_glow = this.scene.add.image(0,0, 'purchase_cavalry_glow');
        var musket_glow = this.scene.add.image(0,0, 'purchase_musket_glow');
        var menu_options = this.scene.add.image(0, 0, 'purchase_options');

        this.menu.add([menu_background, sword_glow, pike_glow, cavalry_glow, musket_glow, menu_options, sword_img, pike_img, cavalry_img, musket_img]);

        this.menu.setVisible(false);
        this.menu.setActive(false);
        var glows = [sword_glow, pike_glow, cavalry_glow, musket_glow];
        glows.forEach(function(g)
        {
            g.setVisible(false);
            g.setAlpha(0.5);
            g.setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({
                targets: g,
                ease: 'Sine',
                duration: 600,
                repeat: -1,
                yoyo: true,
                alpha: 1
            });
        }, this);

        // purchasing
        var unit_options = [sword_img, pike_img, cavalry_img, musket_img];
        var unit_map = new Map([[sword_img, sword], [cavalry_img, cavalry], [pike_img, pike], [musket_img, musket]]);
        var glow_map = new Map([[sword_img, sword_glow], [cavalry_img, cavalry_glow], [pike_img, pike_glow], [musket_img, musket_glow]]);
        unit_options.forEach(function(img)
        {
            img.on('pointerdown', function(pointer, localx, localy, event)
            {
                if (this.getGameState().canAfford(unit_map.get(img), this.owner_id))
                    this.getEvents().emit(events.recruit_placement, unit_map.get(img), this.owner_id);
                else
                    this.getEvents().emit(events.shake_treasury, this.owner_id);
                event.stopPropagation();
            }, this);

            img.on('pointerover', function()
            {
                glows.forEach(function(g)
                {
                    g.setVisible(g == glow_map.get(img));
                });
                this.scene.registry.set(events.cursor_outside_menu, false);
                this.getEvents().emit(events.hide_hex_cursor);
            }, this);
            img.on('pointerout', function()
            {
                glow_map.get(img).setVisible(false);
                this.scene.registry.set(events.cursor_outside_menu, false);
                this.getEvents().emit(events.hide_hex_cursor);
            }, this);
        }, this);

        // events
        this.menu.on('pointerover', function()
        {
            this.scene.registry.set(events.cursor_outside_menu, false);
            this.getEvents().emit(events.hide_hex_cursor);
        }, this);
        this.menu.on('pointerout', function()
        {
            this.scene.registry.set(events.cursor_outside_menu, true);
            this.getEvents().emit(events.show_hex_cursor);
        }, this);

        this.getEvents().on(events.recruit_placement, this.handleRecruitPlacement, this);
        this.getEvents().on(events.recruit_cancel, this.handleRecruitCancel, this);
        this.getEvents().on(events.end_turn, this.handleEndTurn, this);
        this.getEvents().on(events.close_menu, this.closeMenu, this);
    }

    handleEndTurn(player_id)
    {
        this.closeMenu();
        this.handleRecruitCancel(null, player_id);
    }

    handleRecruitCancel(unit_type, player_id)
    {
        if (player_id != this.owner_id)
            return;
        var utp = this.scene.registry.get(events.unit_to_place);
        if (utp != null)
            utp.cancelRecruit();
        this.scene.registry.set(events.is_placing_unit, false);
        this.scene.registry.set(events.unit_to_place, null);
        this.flats.map(f => f.destroy());
        this.flats = [];
    }

    handleRecruitPlacement(type, player_id)
    {
        if (player_id != this.owner_id)
            return;
        if (this.scene.registry.get(events.menu_open));
            this.closeMenu();

        var p = this.scene.cameras.main.getWorldPoint(event.x, event.y);
        var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
        p = hexLib.hex_to_pixel(hex_layout, h);
        this.scene.registry.set(events.is_placing_unit, true);
        var utp = this.scene.add.existing(new Unit(this.scene, p.x, p.y-2, type, h, this.owner_id, this.scene.occupied, this.scene.world_string_set));
        this.scene.registry.set(events.unit_to_place, utp);
        this.getEvents().emit(events.recruit_cost, utp.type, player_id)

        hexLib.hex_ring(this.hex(), 1).forEach(function(h)
        {
            if (this.getGameState().occupied.has(h.toString()))
                return;
            p = hexLib.hex_to_pixel(hex_layout, h);
            var flat = this.scene.add.image(p.x, p.y, 'hex_flat').setInteractive(this.scene.input.makePixelPerfect(1));
            flat.setBlendMode(Phaser.BlendModes.ADD);
            flat.setAlpha(0.01);
            this.flats.push(flat);
            flat.on('pointerdown', function(pointer, localx, localy, event)
            {
                p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                utp.hex = h;

                // set unit in game state
                this.getEvents().emit(events.recruit_finalise, h, utp, this.owner_id);
                // store in worldScene for UI, set registries for cursor state
                this.scene.hex_to_unit.set(h.toString(), utp);
                this.scene.registry.set(events.is_placing_unit, false);
                this.scene.registry.set(events.unit_to_place, null);

                this.flats.map(f => f.destroy());
                this.flats = [];
                this.scene.tweens.add({
                    targets: utp,
                    ease: 'Back',
                    easeParams: [4.5],
                    y: "+=4",
                    duration: 120,
                });
                var tween;
                tween = this.scene.tweens.addCounter({
                    from: 0,
                    to: 1,
                    ease: 'Linear',
                    duration: 120,
                    onUpdate: function()
                    {
                        utp.setTint(Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(black, grey, 1, tween.getValue())).color);
                    }
                });
                event.stopPropagation();
            }, this);
            this.scene.tweens.add({
                targets: flat,
                ease: 'Linear',
                duration: 600,
                repeat: -1,
                yoyo: true,
                alpha: 0.25
            });
        }, this);
    }

    closeMenu()
    {
        this.menu.setVisible(false);
        this.menu.setActive(false);
        this.getEvents().emit(events.show_hex_cursor);
        this.scene.registry.set(events.menu_open, false);
    } 

    openMenu()
    {
        this.menu.setVisible(true);
        this.menu.setActive(true);
        var m_p = hexLib.hex_to_pixel(hex_layout, hexLib.hex_add(this.hex(), new hexLib.Hex(1,0,0)));
        this.menu.setPosition(m_p.x+3, m_p.y-2);
        this.scene.registry.set(events.menu_open, true);
    }

    handlePointerDown()
    {
        if (this.scene.registry.get(events.is_placing_unit))
        {
            if (this.scene.registry.get(events.unit_to_place).owner_id == this.owner_id)
            {
                var utp = this.scene.registry.get(events.unit_to_place);
                this.getEvents().emit(events.recruit_cancel, utp.type, this.owner_id);
            }
            else
                return;
        }
        else
            if (this.owner_id == this.getGameState().current_player)
                this.openMenu();
    }

    loseLife()
    {
        var max_duration = 0;
        for (var i=0; i<10; i++)
        {
            var valid_column = false;
            var pix;
            while (!valid_column)
            {
                var j = getRandomInt(0,6);
                if (this.pixels_columns[j].length > 0)
                {
                    valid_column = true;
                    pix = this.pixels_columns[j].shift();
                }
            }

            var pixel = this.pixels.get(pix);
            var starting_vec = capitol_death_pixels.get(pix);
            var x = starting_vec[0] + getRandomFloat(-1, 1);
            var y = starting_vec[1] + getRandomFloat(-1, 1);
            var power = getRandomInt(1, 15);
            var duration = getRandomInt(300, 3000);
            var initial_duration = getRandomInt(300, 900);
            this.scene.tweens.add({
                targets: pixel,
                x: "-="+starting_vec[0].toString(),
                y: "-="+starting_vec[1].toString(),
                duration: initial_duration,
                ease: "Expo"
            }, this);
            this.scene.tweens.add({
                targets: pixel,
                x: "+="+(x*power).toString(),
                y: "+="+(y*power).toString(),
                duration: duration,
                delay: initial_duration,
                alpha: 0,
                scaleX: 2,
                scaleY: 2,
                ease: "Cubic",
                onComplete: function() 
                {
                    pixel.destroy();
                },
                onCompleteScope: this
            });
            var tween;
            var col = this.scene.player_colours[this.owner_id];
            tween = this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Quadratic.Out',
                duration: duration,
                delay: initial_duration,
                onUpdate: function()
                {
                    pixel.setTint(Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(black, col, 1, tween.getValue())).color);
                },
                onUpdateScope: this
            }, this);

            if (initial_duration > max_duration)
                max_duration = initial_duration;
        }
        this.scene.time.delayedCall(max_duration, function()
        {
            if (this.getGameState().capitols[this.owner_id].lives == 0)
            {
                this.getEvents().emit(events.player_bankrupt, this.owner_id);
                // to cancel
                this.getEvents().off(events.close_menu, this.closeMenu, this);
                this.getEvents().off(events.recruit, this.handleRecruitPlacement, this);
                this.getEvents().off(events.cancel_recruitment, this.handleCancelRecruit, this);
                // TODO more comprehensive removal from game system. e.g. AI
                this.destroy();
            }
        }, [], this);
    }
}
