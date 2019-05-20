import {aStar} from "./misc/aStar.mjs";
import {hex_layout, grey, black, red, exclude_death_pixel, death_pixel_dirc} from "./misc/constants.mjs";
import {recruit_sword, recruit_cavalry, recruit_pike, recruit_musket} from "./misc/events.mjs";
import {lerpColour, getRandomFloat, range, getRandomInt} from "./misc/utilities.mjs";
import * as hexLib from "./misc/hex-functions.mjs";
import * as events from "./misc/events.mjs";


const victory = "victory";
const defeat = "defeat";
const draw = "draw";

function combat_result(a, b)
{
    if (a.type == recruit_musket)
        return victory;
    if (b.type == recruit_musket)
        return victory;
    if (a.type == recruit_sword)
    {
        if (b.type == recruit_sword)
            return draw;
        if (b.type == recruit_pike)
            return victory;
        if (b.type == recruit_cavalry)
            return defeat;
    }
    else if (a.type == recruit_pike)
    {
        if (b.type == recruit_pike)
            return draw;
        if (b.type == recruit_cavalry)
            return victory;
        if (b.type == recruit_sword)
            return defeat;
    }
    else if (a.type == recruit_cavalry)
    {
        if (b.type == recruit_cavalry)
            return draw;
        if (b.type == recruit_sword)
            return victory;
        if (b.type == recruit_pike)
            return defeat;
    }
    else
    {
        console.log(a.type);
        throw("bogus unit type");
    }
}


function get_attack_indication(h)
{
    var img_id, flipx, flipy, x, y;
    img_id = "attack_diag";
    flipx = false;
    flipy = false;
    x = 1; 
    y = 1;
    if (h.toString() == "Hex(0,-1,1)")
    {
        // all values default
    }
    else if (h.toString() == "Hex(1,-1,0)")
    {
        flipx = true;
        x = -1; 
    }
    else if (h.toString() == "Hex(1,0,-1)")
    {
        img_id = "attack";
        x = -1; 
        y = 0;
    }
    else if (h.toString() == "Hex(0,1,-1)")
    {
        x = -1; 
        y = -1;
        flipx = true;
        flipy = true;
    }
    else if (h.toString() == "Hex(-1,1,0)")
    {
        y = -1; 
        flipy = true;
    }
    else if (h.toString() == "Hex(-1,0,1)")
    {
        y = 0;
        img_id = "attack";
        flipx = true;
    }
    else
    {
        console.log(h);
        throw("bogus attack direction");
    }
    return [img_id, flipx, flipy, x, y];
}

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

        this.move_range = type == "cavalry" ? 6 : 4;

        this.scene.events.on(events.end_turn, this.handleTurnEnd, this);
        this.scene.events.on(events.player_bankrupt, this.bankrupcyCheck, this);
    }

    bankrupcyCheck(player_id)
    {
        if (player_id == this.owner_id)
        {
            var s = this.scene;
            this.die(true);
            s.events.emit(events.recalc_territories);
        }
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
        var dest_is_attack = new Map([[this.hex.toString(), false]]);
        var pf = new aStar(valid_positions, true);
        hexLib.hex_spiral(this.hex, this.move_range+1).forEach(function(h)
        {
            var is_attack = false;
            if (!this.scene.world_string_set.has(h.toString()))
                return;
            if (this.scene.occupied.has(h.toString()))
            {
                if (this.scene.occupied.get(h.toString()).owner_id != this.owner_id)
                    is_attack = true;
                else
                    return;
            }
            var path = pf.findPath(this.hex, h);
            if (path.length > 0 && path.length <= this.move_range)
            {
                possible_destinations.push(h);
                possible_paths.set(h.toString(), path);
                dest_is_attack.set(h.toString(), is_attack);
            }
        }, this);

        var previous_hex = new hexLib.Hex(0,0,0);
        var flats = [];
        var inds = [];
        possible_destinations.forEach(function(h)
        {
            var is_attack = dest_is_attack.get(h.toString());
            p = hexLib.hex_to_pixel(hex_layout, h);
            var flat = this.scene.add.image(p.x, p.y, 'hex_flat').setInteractive(this.scene.input.makePixelPerfect(1));
            flat.setBlendMode(Phaser.BlendModes.ADD);
            if (is_attack)
            {
                flat.setTint(red);
                var ind = this.scene.add.image(p.x, p.y, "Attack");
                var ind_original_pos = {x:p.x, y:p.y};
                inds.push(ind);
                ind.setVisible(false);
                var col = this.scene.player_colours[this.owner_id];
                ind.setTint(col);
                ind.depth = 2;
                flat.on('pointerover', function(pointer, localx, localy, event)
                {
                    var diff = hexLib.hex_subtract(h, previous_hex);
                    [img_id, flipx, flipy, x, y] = get_attack_indication(diff);

                    this.scene.tweens.killTweensOf(ind);
                    ind.setPosition(ind_original_pos.x, ind_original_pos.y);
                    this.scene.tweens.add({
                        targets: ind,
                        ease: 'Cubic',
                        duration: 300,
                        x: "+="+2*x.toString(),
                        y: "+="+2*y.toString(),
                        repeat: -1,
                        onComplete: function()
                        {
                            ind.setPosition(ind_original_pos.x, ind_original_pos.y);
                        }
                    });
                    var tween;
                    tween = this.scene.tweens.addCounter({
                        from: 0,
                        to: 1,
                        ease: 'Linear',
                        duration: 300,
                        onUpdate: function()
                        {
                            ind.setTint(lerpColour(col, red, tween.getValue()));
                        },
                        yoyo: true,
                        repeat: -1
                    }, this);
                    var img_id, flipx, flipy, x, y;
                    ind.setTexture(img_id);
                    ind.setFlipX(flipx);
                    ind.setFlipY(flipy);
                    ind.setVisible(true);
                }, this);
                flat.on('pointerout', function(pointer, localx, localy, event)
                {
                    ind.setVisible(false);
                }, this);
                this.scene.events.on(events.hexout, function(hex)
                {
                    if (hex.toString() == h.toString())
                        ind.setVisible(false);
                }, this);
            }
            flat.on('pointerover', function(pointer, localx, localy, event)
            {
                if (!is_attack)
                    previous_hex = h;
            }, this);
            flat.on('pointerdown', function(pointer, localx, localy, event)
            {
                p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                p = hexLib.hex_to_pixel(hex_layout, h);
                this.scene.registry.set(events.is_placing_unit, false);
                this.scene.registry.set(events.unit_to_place, null);
                utp.destroy();
                inds.map(f => f.destroy());
                flats.map(f => f.destroy());
                // lerp into position along path
                this.moveTo(h, possible_paths.get(h.toString()), is_attack);
                // todo have attack anim and UI
                event.stopPropagation();
            }, this);
            flat.setAlpha(0.01);
            this.scene.tweens.add({
                start: 0,
                end: 1,
                targets: flat,
                ease: 'Quad.InOut',
                duration: 600,
                repeat: -1,
                yoyo: true,
                alpha: 0.25
            });
            flats.push(flat);
        }, this);
    }

    moveTo(h, path, is_attack)
    {
        this.can_move = h.toString() == this.hex.toString();
        this.hex = h;

        // put us back in place
        if (this.can_move)
        {
            this.scene.occupied.set(h.toString(), this);
            return;
        }
        if (path.length > 0)
        {
            path = path.reverse();

            var i = 0;
            path.forEach(function(ph)
            {
                var p = hexLib.hex_to_pixel(hex_layout, ph);
                if (is_attack && (i == path.length-1))
                    return;
                else
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

        // hitstop
        if (is_attack)
        {
            var h_penult = path[path.length-2];
            var h_ult = path[path.length-1];
            var p_penult = hexLib.hex_to_pixel(hex_layout, h_penult);
            var p_ult = hexLib.hex_to_pixel(hex_layout, h_ult);

            var enemy = this.scene.occupied.get(h_ult.toString());
            var diff = hexLib.hex_subtract(h_ult, h_penult);
            var img_id, flipx, flipy, x, y;
            [img_id, flipx, flipy, x, y] = get_attack_indication(diff);
            var mid_p = {x: p_penult.x/2 + p_ult.x/2, y: p_penult.y/2 + p_ult.y/2};

            i++;
            this.scene.tweens.add({
                targets: this,
                ease: "Quadratic.easeOut",
                duration: 240,
                delay: 120*i,
                x: "+="+(x*4).toString(),
                y: "+="+(y*4).toString()
            }, this);     
            this.scene.tweens.add({
                targets: enemy,
                ease: "Quadratic.easeOut",
                duration: 240,
                delay: 120*i,
                x: "-="+(x*4).toString(),
                y: "-="+(y*4).toString()
            }, this);
            i += 2;
            this.scene.tweens.add({
                targets: this,
                ease: "Quintic",
                duration: 120,
                delay: 120*i,
                x: mid_p.x + x*4,
                y: mid_p.y + y*4,
            }, this);         
            this.scene.tweens.add({
                targets: enemy,
                ease: "Quintic",
                duration: 120,
                delay: 120*i,
                x: mid_p.x - x*4,
                y: mid_p.y - y*4
            }, this);
            i++;
            var result = combat_result(this, enemy);
            if (result == victory)
            {
                this.scene.tweens.add({
                    targets: this,
                    ease: "Quintic",
                    duration: 120,
                    delay: 120*i,
                    x: p_ult.x,
                    y: p_ult.y,
                    onComplete: function()
                    {
                        enemy.die(false);
                        this.scene.occupied.set(h.toString(), this);
                        this.scene.events.emit(events.recalc_territories);
                    },
                    onCompleteScope: this
                });
                i++;
            }
            else if (result == defeat)
            {
                this.scene.tweens.add({
                    targets: enemy,
                    ease: "Quintic",
                    duration: 120,
                    delay: 120*i,
                    x: p_ult.x,
                    y: p_ult.y,
                    onComplete: function()
                    {
                        var world = this.scene;
                        this.die(false);
                        world.events.emit(events.recalc_territories);
                        enemy.greyOut(0);
                        enemy.can_move = false;
                    },
                    onCompleteScope: this
                });   
                return;
            }
            else // draw
            {
                this.scene.tweens.add({
                    targets: this,
                    ease: "Linear",
                    duration: 120,
                    delay: 120*i,
                    x: mid_p.x + x*8,
                    y: mid_p.y + y*8,
                }, this);         
                this.scene.tweens.add({
                    targets: enemy,
                    ease: "Linear",
                    duration: 120,
                    delay: 120*i,
                    x: mid_p.x,
                    y: mid_p.y
                }, this);
                i++;

                this.scene.tweens.add({
                    targets: this,
                    ease: "Linear",
                    duration: 120,
                    delay: 120*i,
                    x: mid_p.x,
                    y: mid_p.y,
                }, this);         
                this.scene.tweens.add({
                    targets: enemy,
                    ease: "Linear",
                    duration: 120,
                    delay: 120*i,
                    x: mid_p.x - x*8,
                    y: mid_p.y - y*8
                }, this);
                i++;

                this.scene.tweens.add({
                    targets: this,
                    ease: "Quadratic",
                    duration: 120,
                    delay: 120*i,
                    x: p_penult.x,
                    y: p_penult.y,
                });
                this.scene.tweens.add({
                    targets: enemy,
                    ease: "Quadratic",
                    duration: 120,
                    delay: 120*i,
                    x: p_ult.x,
                    y: p_ult.y,
                    onComplete: function()
                    {
                        this.hex = h_penult;
                        this.scene.occupied.set(h_penult.toString(), this);
                        this.scene.events.emit(events.recalc_territories);
                        enemy.greyOut(0);
                        enemy.can_move = false;
                    },
                    onCompleteScope: this
                });
                i ++;
            }
        }
        else
        {
            this.scene.time.delayedCall(120*i, function()
            {
                this.scene.occupied.set(h.toString(), this);
                this.scene.events.emit(events.recalc_territories);
            }, [], this);
        }

        this.greyOut(120*i);
    }

    greyOut(delay)
    {
        // grey out and move down
        var tween;
        tween = this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            ease: 'Linear',
            duration: 600,
            delay: delay,
            onUpdate: function()
            {
                this.setTint(lerpColour(black, grey, tween.getValue()));
            },
            onUpdateScope: this,
        });
        this.scene.tweens.add({
            targets: this,
            ease: "Linear",
            duration: 600,
            delay: delay,
            y: "+=2"
        });
    }

    handleTurnEnd()
    {
        if (! this.can_move)
        {
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

    die(bankrupcy)
    {
        var initial_duration = bankrupcy ? getRandomInt(150, 450) : 0;
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
            var power = getRandomInt(1, 15);
            var duration = getRandomInt(300, 3000);
            if (bankrupcy)
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
                ease: "Cubic",
                onComplete: function() {pixel.destroy()}
            }, this);
            var tween;
            var col = this.scene.player_colours[this.owner_id];
            tween = this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Expo',
                duration: duration,
                delay: initial_duration,
                onUpdate: function()
                {
                    pixel.setTint(lerpColour(black, col, tween.getValue()));
                },
                onUpdateScope: this
            }, this);
        }, this);
        this.scene.occupied.delete(this.hex.toString());
        this.scene.events.emit(events.unit_death, this)
        this.scene.events.off(events.player_bankrupt, this.bankrupcyCheck, this);
        this.scene.events.off(events.end_turn, this.handleTurnEnd, this);
        this.destroy();
    }
}