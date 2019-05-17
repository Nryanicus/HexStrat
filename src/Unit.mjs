import {aStar} from "./misc/aStar.mjs";
import {hex_layout, grey, black, exclude_death_pixel, death_pixel_dirc} from "./misc/constants.mjs";
import {lerpColour, getRandomFloat, range, getRandomInt} from "./misc/utilities.mjs";
import * as hexLib from "./misc/hex-functions.mjs";
import * as events from "./misc/events.mjs";

export class Unit extends Phaser.GameObjects.Image 
{

    constructor (scene, x, y, type, hex, owner_id)
    {
        super(scene, x, y);

        this.scene = scene;
        this.setTexture(type);
        this.setPosition(x, y);
        this.setTint(black);
        this.depth = 1; // above the map, but nothing else

        this.owner_id = owner_id;
        this.type = type;
        this.hex = hex;
        this.can_move = type != "capitol";

        this.move_range = type == "cavalry" ? 5 : 3;

        this.scene.events.on(events.end_turn, this.handleTurnEnd, this);
        this.scene.events.on(events.player_bankrupt, this.die, this);
    }

    handlePointerDown()
    {
        if (!this.can_move || this.scene.registry.get(events.is_placing_unit))
            return;
        this.can_move = false;

        this.scene.occupied.delete(this.hex.toString());

        var p = hexLib.hex_to_pixel(hex_layout, this.hex);
        var utp = this.scene.add.image(p.x, p.y-2, this.type);
        utp.setTint(black);
        utp.setAlpha(0.5);
        this.scene.registry.set(events.is_placing_unit, true);
        this.scene.registry.set(events.unit_to_place, utp);

        // determine where the unit can be placed
        var valid_positions = new Set();
        var valid_destinations = new Set();
        hexLib.hex_spiral(this.hex, this.move_range+1).forEach(function(h)
        {
            if (!this.scene.world_string_set.has(h.toString()))
                return;
            if (this.scene.occupied.has(h.toString()) && this.scene.occupied.get(h.toString()).owner_id != this.owner_id)
                return;
            valid_positions.add(h.toString());
        }, this);

        var possible_destinations = [this.hex];
        var possible_paths = new Map([[this.hex.toString(), []]]);
        var pf = new aStar(valid_positions);
        hexLib.hex_spiral(this.hex, this.move_range+1).forEach(function(h)
        {
            if (this.scene.occupied.has(h.toString()))
                return;
            var path = pf.findPath(this.hex, h);
            if (path.length > 0 && path.length <= this.move_range)
            {
                possible_destinations.push(h);
                possible_paths.set(h.toString(), path);
            }
        }, this);

        var flats = [];
        possible_destinations.forEach(function(h)
        {
            p = hexLib.hex_to_pixel(hex_layout, h);
            var flat = this.scene.add.image(p.x, p.y, 'hex_flat').setInteractive(this.scene.input.makePixelPerfect(1));
            flat.setBlendMode(Phaser.BlendModes.ADD);
            flat.on('pointerdown', function(pointer, localx, localy, event)
            {
                p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                p = hexLib.hex_to_pixel(hex_layout, h);
                this.scene.occupied.set(h.toString(), this);
                this.scene.registry.set(events.is_placing_unit, false);
                this.scene.registry.set(events.unit_to_place, null);
                utp.destroy();
                flats.map(f => f.destroy());
                // lerp into position along path
                this.moveTo(h, possible_paths.get(h.toString()));
                this.scene.events.emit(events.recalc_territories);
                // todo have attack anim and UI
                event.stopPropagation();
            }, this);
            flat.setAlpha(0.01);
            this.scene.tweens.add({
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

    moveTo(h, path)
    {
        this.can_move = h.toString() == this.hex.toString();
        this.hex = h;

        if (this.can_move)
            return;
        if (path.length > 0)
        {
            path = path.reverse();

            var i = 0;
            path.forEach(function(h)
            {
                var p = hexLib.hex_to_pixel(hex_layout, h);
                this.scene.tweens.add({
                    targets: this,
                    ease: "Cubic",
                    duration: 120,
                    delay: 120*i,
                    x: p.x,
                    y: p.y
                });
                i++;
            }, this);
        }
        // grey out after move
        var tween;
        this.scene.time.delayedCall(120*i, function()
        {
            tween = this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Linear',
                duration: 600,
                onUpdate: function()
                {
                    this.setTint(lerpColour(black, grey, tween.getValue()));
                },
                onUpdateScope: this
            });
        }, [], this);
        this.scene.tweens.add({
            targets: this,
            ease: "Linear",
            duration: 600,
            delay: 120*i,
            y: "+=2"
        });
    }

    handleTurnEnd()
    {
        if (! this.can_move)
        {
            // grey out after move
            var tween;
            var speed = getRandomFloat(0.5, 1.5);
            tween = this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Linear',
                duration: 600*speed,
                onUpdate: function()
                {
                    this.setTint(lerpColour(grey, black, tween.getValue()));
                },
                onUpdateScope: this
            });
            this.scene.tweens.add({
                targets: this,
                ease: "Linear",
                duration: 600*speed,
                y: "-=2"
            });
        }
        this.can_move = true;
    }

    die(player_id)
    {
        if (player_id != this.owner_id) 
            return;
        var initial_duration =  getRandomInt(150, 450);
        range(1, 32).forEach(function(i)
        {
            if (exclude_death_pixel.get(this.type).has(i))
                return;
            var str = i.toString();
            if (str.length == 1)
                str = "0"+str;
            var pixel = this.scene.add.image(this.x, this.y, "dead"+str);
            pixel.setTint(black);
            var starting_vec = death_pixel_dirc.get(str);
            var x = starting_vec[0] + getRandomFloat(-1,1);
            var y = starting_vec[1] + getRandomFloat(-1,1);
            var power = getRandomInt(1, 20);
            var duration = getRandomInt(300, 3000);
            this.scene.tweens.add({
                targets: pixel,
                x: "+="+(x*power).toString(),
                y: "+="+(y*power).toString(),
                duration: duration,
                delay: initial_duration,
                alpha: 0,
                ease: "Cubic",
                onComplete: function() {pixel.destroy()}
            }, this);
            this.scene.tweens.add({
                targets: pixel,
                x: "-="+starting_vec[0].toString(),
                y: "-="+starting_vec[1].toString(),
                duration: initial_duration,
                ease: "Expo"
            }, this);
        }, this);
        this.scene.events.emit(events.unit_death, this)
        this.scene.events.off(events.player_bankrupt, this.die);
        this.scene.events.off(events.end_turn, this.handleTurnEnd);
        this.destroy();
    }
}