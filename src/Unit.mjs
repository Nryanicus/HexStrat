import * as GameLogic from "./GameLogic.mjs";
import {sword, pike, cavalry, musket, capitol, hex_layout, grey, black, red, white, exclude_death_pixel, death_pixel_dirc, one_normal, unit_movement, victory, defeat, draw, attack_capitol} from "./misc/constants.mjs";
import {getRandomFloat, range, getRandomInt} from "./misc/utilities.mjs";
import * as hexLib from "./misc/hex-functions.mjs";
import * as events from "./misc/events.mjs";

// exceptions
const BogusAttackDirection = "bogus attack direction";

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

    getGameState()
    {
        return this.scene.registry.get(events.game_state);
    }

    getEvents()
    {
        return this.scene.registry.get(events.events);
    }

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

        this.getEvents().on(events.end_turn, this.handleEndTurn, this);
        this.getEvents().on(events.player_bankrupt, this.handleBankrupcy, this);
    }

    handleBankrupcy(player_id)
    {
        if (player_id == this.owner_id)
            this.die(true);
    }

    handlePointerDown()
    {
        if (!this.can_move || this.scene.registry.get(events.is_placing_unit) || this.owner_id != this.getGameState().current_player)
            return;

        var p = hexLib.hex_to_pixel(hex_layout, this.hex);
        var utp = this.scene.add.image(p.x, p.y-2, this.type);
        utp.setTint(black);
        utp.setAlpha(0.5);
        this.scene.registry.set(events.is_placing_unit, true);
        this.scene.registry.set(events.unit_to_place, utp);

        // determine where the unit can be placed
        var possible_moves = this.getGameState().getMovesForUnit(this, this.hex);
        // don't want to list the same space twice, though we may be able to get there by multiple moves
        var marked_destinations = new Set(); 

        var pf = this.getGameState().getPathfinderFor(this.hex, false);

        var previous_hex = this.hex;
        var flats = [];
        var inds = [];
        possible_moves.forEach(function(m)
        {
            // we don't need the gamestate, just the action
            m = m.action;

            var h = m.to;
            if (m.type == GameLogic.attack_bounce_to) h = m.target;

            // prevent duplicate indicators, see above
            if (marked_destinations.has(h.toString())) return;
            marked_destinations.add(h.toString());

            var is_attack = (m.type != GameLogic.move_to);

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
                var col2 = this.scene.player_colours[this.scene.hex_to_unit.get(h.toString()).owner_id];
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
                    // don't show indicator if we don't have the range to attack from this direction
                    var path = pf.findPath(this.hex, previous_hex);
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
                            ind.setTint(Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(col2, col, 1, tween.getValue())).color);
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
            }
            flat.on('pointerover', function(pointer, localx, localy, event)
            {
                if (!is_attack)
                    previous_hex = h;
            }, this);
            flat.on('pointerdown', function(pointer, localx, localy, event)
            {
                // can't attack from angles that exceed our movement range
                if (is_attack && pf.findPath(this.hex, previous_hex).length+1 > this.move_range)
                    return;
                this.scene.registry.set(events.is_placing_unit, false);
                this.scene.registry.set(events.unit_to_place, null);
                utp.destroy();
                inds.map(f => f.destroy());
                flats.map(f => f.destroy());
                // lerp into position along path
                if (is_attack)
                    this.attackTo(h, pf.findPath(this.hex, previous_hex));
                else
                    this.moveTo(h, pf.findPath(this.hex, h));
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
        var enemy = this.getGameState().occupied.get(h_ult.toString());
        var result = GameLogic.combatResult(this.type, enemy.type);
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

    attackTo(h_ult, path, is_ai=false)
    {
        console.log("attack");
        console.log(arguments);
        var from_hex = this.hex;

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
        console.assert(path.length > 0);
        var h_penult = path[path.length-1];
        var p_penult = hexLib.hex_to_pixel(hex_layout, h_penult);
        var p_ult = hexLib.hex_to_pixel(hex_layout, h_ult);

        var diff = hexLib.hex_subtract(h_ult, h_penult);
        var img_id, flipx, flipy, x, y;
        [img_id, flipx, flipy, x, y] = get_attack_indication(diff);
        var mid_p = {x: p_penult.x/2 + p_ult.x/2, y: p_penult.y/2 + p_ult.y/2};

        var enemy = this.scene.hex_to_unit.get(h_ult.toString());
        var result = GameLogic.combatResult(this.type, enemy.type);

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
                    this.hex = h_ult;
                    if (!is_ai)
                        this.getEvents().emit(events.attack_to, from_hex, h_ult, h_penult, this.owner_id, victory);
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
                    enemy.greyOut(0);
                    enemy.can_move = false;
                    if (!is_ai)
                        this.getEvents().emit(events.attack_to, from_hex, h_ult, h_penult, this.owner_id, defeat);
                    this.die(false);
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
                    enemy.greyOut(0);
                    enemy.can_move = false;
                    if (!is_ai)
                        this.getEvents().emit(events.attack_to, from_hex, h_ult, h_penult, this.owner_id, draw);
                },
                onCompleteScope: this
            });
            i ++;
        }
        else // attack cap
        {
            var cap_dead = enemy.lives() == 1;
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
                    this.hex = h;
                    var res = cap_dead ? victory : draw;
                    if (!is_ai)
                        this.getEvents().emit(events.attack_to, from_hex, h_ult, h_penult, this.owner_id, res);
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

    moveTo(h, path, is_ai=false)
    {
        this.can_move = h.toString() == this.hex.toString();

        // put us back in place
        if (this.can_move)
            return;

        var from_hex = this.hex;

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
            this.hex = h;
            if (!is_ai)
                this.getEvents().emit(events.move_to, from_hex, h, this.owner_id);
        }, [], this);

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
                this.setTint(Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(black, grey, 1, tween.getValue())).color);
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
                this.setTint(Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(grey, black, 1, tween.getValue())).color);
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

    handleEndTurn(player_id)
    {
        if (player_id != this.owner_id) return;
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
                    pixel.setTint(Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(black, col, 1, tween.getValue())).color);
                },
                onUpdateScope: this
            }, this);
        }, this);
        this.scene.hex_to_unit.delete(this.hex.toString());
        this.getEvents().off(events.end_turn, this.handleEndTurn, this);
        this.getEvents().off(events.player_bankrupt, this.handleBankrupcy, this);

        this.destroy();
    }

    cancelRecruit()
    {
        this.getEvents().off(events.end_turn, this.handleEndTurn, this);
        this.getEvents().off(events.player_bankrupt, this.handleBankrupcy, this);

        this.destroy();
    }

    spawnAt(hex)
    {
        this.hex = hex;
        var p = hexLib.hex_to_pixel(hex_layout, hex);
        this.setPosition(p.x, p.y-2);
        this.scene.tweens.add({
            targets: this,
            ease: 'Back',
            easeParams: [4.5],
            y: "+=4",
            duration: 120,
        });
        var tween;
        var unit = this;
        tween = this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            ease: 'Linear',
            duration: 120,
            onUpdate: function()
            {
                unit.setTint(Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(black, grey, 1, tween.getValue())).color);
            }
        });
    }
}