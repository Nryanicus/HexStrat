import {aStar} from "./misc/aStar.mjs";
import {hex_layout, grey, black} from "./misc/constants.mjs";
import {lerpColour} from "./misc/utilities.mjs";
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
    }

    handlePointerDown()
    {
        if (!this.can_move)
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
        var possible_paths = new Map();
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
            flat.on('pointerdown', function(event)
            {
                p = this.scene.cameras.main.getWorldPoint(event.x, event.y);
                h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                p = hexLib.hex_to_pixel(hex_layout, h);
                this.scene.occupied.set(h.toString(), this);
                this.scene.registry.set(events.is_placing_unit, false);
                utp.destroy();
                flats.map(f => f.destroy());
                // lerp into position along path
                this.moveTo(h, possible_paths.get(h.toString()));
                this.scene.events.emit(events.recalc_territories);
                // todo have attack anim and UI
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
        // grey out after move
        var tween;
        var unit = this;
        this.scene.time.delayedCall(120*i, function()
        {
            tween = this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Linear',
                duration: 600,
                onUpdate: function()
                {
                    unit.setTint(lerpColour(black, grey, tween.getValue()));
                },
            });
        }, [], this);
        this.scene.tweens.add({
            targets: this,
            ease: "Cubic",
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
            var unit = this;
            this.scene.time.delayedCall(120*i, function()
            {
                tween = this.scene.tweens.addCounter({
                    from: 0,
                    to: 1,
                    ease: 'Linear',
                    duration: 600,
                    onUpdate: function()
                    {
                        unit.setTint(lerpColour(grey, black, tween.getValue()));
                    },
                });
            }, [], this);
            this.scene.tweens.add({
                targets: this,
                ease: "Cubic",
                duration: 600,
                delay: 120*i,
                y: "-=2"
            });
        }
        this.can_move = true;
    }
}