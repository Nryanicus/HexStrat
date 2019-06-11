import {aStar} from "./misc/aStar.mjs";
import {sword, pike, cavalry, musket, capitol, hex_layout, grey, black, red, white, exclude_death_pixel, death_pixel_dirc, one_normal, unit_movement, victory, defeat, draw, attack_capitol} from "./misc/constants.mjs";
import {lerpColour, getRandomFloat, range, getRandomInt} from "./misc/utilities.mjs";
import * as hexLib from "./misc/hex-functions.mjs";
import * as events from "./misc/events.mjs";

// exceptions
const BogusAttackDirection = "bogus attack direction";
const BogusUnitType = "bogus unit type";

export function combatResult(a, b)
{
    if (b.type == capitol)
        return attack_capitol;
    if (a.type == musket && b.type == musket)
        return draw;
    if (a.type == musket)
        return victory;
    if (b.type == musket)
        return victory;
    if (a.type == sword)
    {
        if (b.type == sword)
            return draw;
        if (b.type == pike)
            return victory;
        if (b.type == cavalry)
            return defeat;
    }
    else if (a.type == pike)
    {
        if (b.type == pike)
            return draw;
        if (b.type == cavalry)
            return victory;
        if (b.type == sword)
            return defeat;
    }
    else if (a.type == cavalry)
    {
        if (b.type == cavalry)
            return draw;
        if (b.type == sword)
            return victory;
        if (b.type == pike)
            return defeat;
    }
    console.log(BogusUnitType);
    console.log(a.type);
    console.log(b.type);
    throw(BogusUnitType);
}

function get_attack_indication(h)
{
    var img_id, flipx, flipy, x, y;
    img_id = "attack_diag";
    flipx = false;
    flipy = false;
    if (h.toString() == "Hex(0,-1,1)")
    {
        x = one_normal; 
        y = one_normal;
    }
    else if (h.toString() == "Hex(1,-1,0)")
    {
        flipx = true;
        x = -one_normal; 
        y = one_normal;
    }
    else if (h.toString() == "Hex(1,0,-1)")
    {
        img_id = "attack";
        x = -1; 
        y = 0;
    }
    else if (h.toString() == "Hex(0,1,-1)")
    {
        x = -one_normal; 
        y = -one_normal;
        flipx = true;
        flipy = true;
    }
    else if (h.toString() == "Hex(-1,1,0)")
    {
        x = one_normal; 
        y = -one_normal; 
        flipy = true;
    }
    else if (h.toString() == "Hex(-1,0,1)")
    {
        x = 1;
        y = 0;
        img_id = "attack";
        flipx = true;
    }
    else
    {
        console.log(BogusAttackDirection);
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
        this.can_move = false;

        this.move_range = unit_movement.get(type);

        this.scene.events.on(events.end_round, this.handleRoundEnd, this);
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
        var attack_targets = new Map();
        var pf = new aStar(valid_positions, true);
        hexLib.hex_spiral(this.hex, this.move_range+1).forEach(function(h)
        {
            var is_attack = false;
            if (!this.scene.world_string_set.has(h.toString()))
                return;
            if (this.scene.occupied.has(h.toString()))
            {
                if (this.scene.occupied.get(h.toString()).owner_id != this.owner_id)
                {
                    is_attack = true;
                    attack_targets.set(h.toString(), this.scene.occupied.get(h.toString()));
                }
                else
                    return;
            }
            var path = pf.findPath(this.hex, h);
            if (path.length > 0 && path.length <= this.move_range)
            {
                // attacks can not be launched from occupied hexes
                if (is_attack && this.scene.occupied.has(path[1].toString()))
                    return;
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
                var attack_targ = attack_targets.get(h.toString());
                var col2 = this.scene.player_colours[attack_targ.owner_id];
                ind.setTint(col);
                ind.depth = 2;
                flat.on('pointerover', function(pointer, localx, localy, event)
                {
                    var img_id, flipx, flipy, x, y;
                    var diff = hexLib.hex_subtract(h, previous_hex);
                    try
                    {
                        [img_id, flipx, flipy, x, y] = get_attack_indication(diff);
                    }
                    catch(BogusAttackDirection)
                    {
                        return;
                    }
                    var path = possible_paths.get(previous_hex.toString())
                    if (path.length+1 > this.move_range)
                        return;

                    this.scene.tweens.killTweensOf(ind);
                    ind.setPosition(ind_original_pos.x, ind_original_pos.y);
                    this.scene.tweens.add({
                        targets: ind,
                        ease: 'Stepped',
                        easeParams: [3],
                        duration: 375,
                        x: "-="+6*x.toString(),
                        y: "-="+6*y.toString(),
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
                        ease: 'Stepped',
                        easeParams: [3],
                        duration: 375,
                        onUpdate: function()
                        {
                            ind.setTint(lerpColour(col2, col, tween.getValue()));
                        },
                        repeat: -1
                    }, this);
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
                if (is_attack && possible_paths.get(previous_hex.toString()).length+1 > this.move_range)
                    return;
                p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                p = hexLib.hex_to_pixel(hex_layout, h);
                this.scene.registry.set(events.is_placing_unit, false);
                this.scene.registry.set(events.unit_to_place, null);
                utp.destroy();
                inds.map(f => f.destroy());
                flats.map(f => f.destroy());
                // lerp into position along path
                if (is_attack)
                    this.attackTo(h, possible_paths.get(previous_hex.toString()));
                else
                    this.moveTo(h, possible_paths.get(h.toString()));
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

    getAttackToDelay(h_ult, path)
    {
        var delay = (path.length+4)*120;
        // delay depends on result
        var enemy = this.scene.occupied.get(h_ult.toString());
        var result = combatResult(this.type, enemy.type);
        if (result == victory)
            delay += 120;
        else if (result == defeat)
            null;
        else if (result == draw)
            delay += 4*120;
        else // attack cap
        {
            delay += 120;
            if (enemy.lives == 1)
                delay += 120;
        }
        return delay+600;
    }

    attackTo(h_ult, path)
    {
        this.can_move = false;

        path = path.reverse();

        var i = 0;
        path.forEach(function(ph)
        {
            var p = hexLib.hex_to_pixel(hex_layout, ph);
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

        // hitstop
        var h_penult = path[path.length-1];
        var p_penult = hexLib.hex_to_pixel(hex_layout, h_penult);
        var p_ult = hexLib.hex_to_pixel(hex_layout, h_ult);

        var diff = hexLib.hex_subtract(h_ult, h_penult);
        var img_id, flipx, flipy, x, y;
        [img_id, flipx, flipy, x, y] = get_attack_indication(diff);
        var mid_p = {x: p_penult.x/2 + p_ult.x/2, y: p_penult.y/2 + p_ult.y/2};

        var enemy = this.scene.occupied.get(h_ult.toString());
        var result = combatResult(this, enemy);

        if (!enemy.can_move && result != attack_capitol)
            enemy.standUp(120*i);

        i++;
        this.scene.tweens.add({
            targets: this,
            ease: "Quadratic.easeOut",
            duration: 240,
            delay: 120*i,
            x: "+="+(x*4).toString(),
            y: "+="+(y*4).toString()
        }, this);     
        if (result != attack_capitol)
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
        if (result != attack_capitol)
            this.scene.tweens.add({
                targets: enemy,
                ease: "Quintic",
                duration: 120,
                delay: 120*i,
                x: mid_p.x - x*4,
                y: mid_p.y - y*4
            }, this);
        i++;
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
                    this.scene.occupied.set(h_ult.toString(), this);
                    this.hex = h_ult;
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
        else if (result == draw)
        {
            this.scene.tweens.add({
                targets: this,
                ease: "Quadratic.In",
                duration: 120,
                delay: 120*i,
                x: mid_p.x,
                y: mid_p.y,
            }, this);         
            this.scene.tweens.add({
                targets: enemy,
                ease: "Quadratic.In",
                duration: 120,
                delay: 120*i,
                x: mid_p.x - x*12,
                y: mid_p.y - y*12
            }, this);
            i++;
            i++;

            this.scene.tweens.add({
                targets: this,
                ease: "Quadratic.Out",
                duration: 80,
                delay: 120*i,
                x: mid_p.x + x*12,
                y: mid_p.y + y*12,
            }, this);         
            this.scene.tweens.add({
                targets: enemy,
                ease: "Quadratic.Out",
                duration: 80,
                delay: 120*i,
                x: mid_p.x,
                y: mid_p.y
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
                    this.hex = h_penult;
                    this.scene.events.emit(events.recalc_territories);
                    enemy.greyOut(0);
                    enemy.can_move = false;
                },
                onCompleteScope: this
            });
            i ++;
        }
        else // attack cap
        {
            var cap_dead = enemy.lives == 1;
            var h;
            if (cap_dead)
                h = h_ult
            else
                h = h_penult
            this.scene.tweens.add({
                targets: this,
                ease: "Quintic",
                duration: 120,
                delay: 120*i,
                x: p_ult.x,
                y: p_ult.y,
                onComplete: function()
                {
                    enemy.loseLife();
                    this.scene.occupied.set(h.toString(), this);
                    this.hex = h;
                    this.scene.events.emit(events.recalc_territories);
                },
                onCompleteScope: this
            });
            if (!cap_dead)
            {
                i++;
                this.scene.tweens.add({
                    targets: this,
                    ease: "Quadratic",
                    duration: 120,
                    delay: 120*i,
                    x: p_penult.x,
                    y: p_penult.y,
                });
            }

            i++;
        }
        this.greyOut(120*i);
    }

    getMoveToDelay(h, path)
    {
        return path.length*120+600;
    }

    moveTo(h, path)
    {
        this.can_move = h.toString() == this.hex.toString();

        // put us back in place
        if (this.can_move)
        {
            this.scene.occupied.set(h.toString(), this);
            return;
        }

        path = path.reverse();

        var i = 0;
        path.forEach(function(ph)
        {
            var p = hexLib.hex_to_pixel(hex_layout, ph);
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

        this.scene.time.delayedCall(120*i, function()
        {
            this.scene.occupied.set(h.toString(), this);
            this.hex = h;
            this.scene.events.emit(events.recalc_territories);
        }, [], this);

        this.greyOut(120*i);
        return 120*i+600;
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

    standUp(delay=0)
    {
        var tween;
        var speed = getRandomFloat(0.5, 1.5);
        tween = this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            ease: 'Linear',
            duration: 600*speed,
            delay: delay,
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
            delay: delay,
            y: "-=2"
        });        
    }

    handleRoundEnd()
    {
        if (! this.can_move)
            this.standUp();
        this.can_move = true;
    }

    die(bankrupcy)
    {
        var initial_duration = bankrupcy ? getRandomInt(300, 900) : 0;
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
                onComplete: function() {pixel.destroy();}
            }, this);
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
                    pixel.setTint(lerpColour(black, col, tween.getValue()));
                },
                onUpdateScope: this
            }, this);
        }, this);
        this.scene.occupied.delete(this.hex.toString());
        this.scene.events.emit(events.unit_death, this)
        this.scene.events.off(events.player_bankrupt, this.bankrupcyCheck, this);
        this.scene.events.off(events.end_round, this.handleRoundEnd, this);
        this.destroy();
    }
}