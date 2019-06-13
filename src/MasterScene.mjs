import {WorldScene} from "./WorldScene.mjs";
import {UIScene} from "./UIScene.mjs";
import * as events from "./misc/events.mjs";
import * as GameLogic from "./GameLogic.mjs";
import {unit_cost, hex_layout, black, grey} from "./misc/constants.mjs";
import {lerpColour} from "./misc/utilities.mjs";
import {MonteCarloTreeSearchNode} from "./MCTS.mjs";
import {Unit} from "./Unit.mjs";
import {aStar} from "./misc/aStar.mjs";
import * as hexLib from "./misc/hex-functions.mjs";

const time_for_MCTS = 10;

export class MasterScene extends Phaser.Scene
{

    constructor()
    {
        super("master");
    }

    create()
    {
        this.currentPlayer = 0;
        this.numPlayers = 2;
        this.aiPlayers = [false, true];

        this.initNewWorld();
    }

    initNewWorld()
    {
        this.registry.set(events.currentPlayer, 0)
        this.registry.set(events.can_gen, false)
        this.scene.remove('world');
        this.scene.remove('ui');
        this.scene.add('world', WorldScene, true, {master: this});
        this.scene.moveBelow('world', "ui");
        this.scene.add('ui', UIScene, true, {master: this});
        this.ui = this.scene.get('ui');
        this.world = this.scene.get('world');

        for (var player_id=0; player_id<this.numPlayers; player_id++)
        {
            this.registry.set("treasury"+player_id.toString(), 21);
            this.registry.set("upkeep"+player_id.toString(), 0);
            this.registry.set("income"+player_id.toString(), 0);
        }
        this.world.events.emit(events.recalc_territories);

        this.aiThinking = false;

        this.ui.setWorld(this.world);
        this.initEventHandlers();
    }

    initEventHandlers()
    {
        // control events

        this.input.keyboard.on('keyup-ENTER', function (event) 
        {
            this.world.events.emit(events.end_turn);
        }, this);

        this.input.keyboard.on('keydown-Z', function (event) 
        {
            if (this.registry.get(events.can_gen))
                this.initNewWorld();
        }, this);

        this.input.keyboard.on('keydown-X', function (event) 
        {
            console.log(this.world.occupied);
        }, this);

        // game logic events
        this.world.events.on(events.recruit_attempt, function(unit_type, player_id)
        {
            if (this.registry.get(events.is_placing_unit))
                return;
            var t = this.registry.get("treasury"+player_id.toString());

            // can't afford, shake treasury and return
            if (unit_cost.get(unit_type) > t)
                this.ui.events.emit(events.shake_treasury, player_id);
            else
                this.world.events.emit(events.recruit, unit_type, player_id);
        }, this);

        this.world.events.on(events.recruit_cost, function(unit_type, player_id)
        {
            var cost = unit_cost.get(unit_type);
            this.addTreasury(player_id, -cost);
            this.addUpkeep(player_id, cost);
        }, this);

        this.world.events.on(events.territory_change, function()
        {   
            var incomes = [];
            for (var i = 0; i < this.numPlayers; i++)
                incomes.push(0);
            this.world.territories.forEach(function(owner_id, string, map)
            {
                if (owner_id == -1)
                    return;
                incomes[owner_id]++;
            }, this);
            for (var i = 0; i < this.numPlayers; i++)
                this.registry.set("income"+i.toString(), incomes[i]);
        }, this);

        this.world.events.on(events.end_turn, this.endTurn, this);

        // reduce upkeep of slain unit
        this.world.events.on(events.unit_death, function (unit) 
        {
            var cost = unit_cost.get(unit.type);
            this.addUpkeep(unit.owner_id, -cost);
        }, this);

        // refund cancelled unit recruitment
        this.world.events.on(events.cancel_recruitment, function(player_id, unit_type)
        {
            var cost = unit_cost.get(unit_type);
            this.addTreasury(player_id, cost);
            this.addUpkeep(player_id, -cost);
        }, this);
    }

    endTurn()
    {
        this.currentPlayer++;
        if (this.currentPlayer == this.numPlayers)
        {
            for (var player_id=0; player_id<this.numPlayers; player_id++)
            {
                var inc = this.registry.get("income"+player_id.toString());
                var up = this.registry.get("upkeep"+player_id.toString());
                var net = inc - up;
                this.addTreasury(player_id, net);
                if (this.registry.get("treasury"+player_id.toString()) < 0)
                    this.world.events.emit(events.player_bankrupt, player_id);
            }
            this.currentPlayer = 0;
            this.world.events.emit(events.end_round);
        }
        // if (this.aiPlayers[this.currentPlayer])
        //     this.handleAITurn();
        // else // TODO, multiple human players
        //     null;
    }

    handleAITurn()
    {
        // // construct current game state
        // var occupied = new Map();
        // this.world.occupied.forEach(function(unit, hex, map)
        // {
        //     occupied.set(hex, {type:unit.type, owner_id:unit.owner_id, can_move:unit.can_move})
        // }, this);

        // var capitols = [];
        // var treasuries = [];
        // var incomes = [];
        // var upkeeps = [];
        // for (var player_id=0; player_id<this.numPlayers; player_id++)
        // {
        //     var cap_pos = this.world.capitol_positions[player_id];
        //     if (this.world.occupied.has(cap_pos.toString()))
        //         capitols.push({hex: cap_pos, lives: this.world.occupied.get(cap_pos.toString()).lives});
        //     else
        //         capitols.push({hex: cap_pos, lives: 0});
        //     treasuries.push(this.registry.get("treasury"+player_id.toString()));
        //     incomes.push(this.registry.get("income"+player_id.toString()));
        //     upkeeps.push(this.registry.get("upkeep"+player_id.toString()));
        // }
        // var state = new GameLogic.GameState(this.currentPlayer, this.world.world, this.world.world_string_set, this.world.pathfinder, occupied, capitols, treasuries, incomes, upkeeps);
        // var actions = [];
        // while ((!state.gameOver))
        // {
        //     var moves = state.getValidMoves();
        //     state = GameLogic.heuristic(moves, state.currentPlayer);
        //     actions.push(state.action);
        //     if (state.action.type == GameLogic.end_turn) break;
        // }
        // var delay = 0;
        // actions.forEach(function(a)
        // {
        //     delay += this.getActionDelay(a);
        //     this.time.delayedCall(delay, function()
        //     {
        //         this.handleAction(a);
        //     }, [], this);
        // }, this);
    }

    getActionDelay(action)
    {
        var delay;
        if (action.type == GameLogic.move_to || action.type == GameLogic.attack_to || action.type == GameLogic.attack_bounce_to)
        {
            var unit = this.world.occupied.get(action.from.toString());
            var dest = action.to;
            var path = new aStar(this.gameState.getValidMovementHexes(unit), (action.type == GameLogic.attack_to || action.type == GameLogic.attack_bounce_to)).findPath(unit.hex, dest);
            if (action.type == GameLogic.move_to)
                delay = unit.getMoveToDelay(dest, path);
            if (action.type == GameLogic.attack_to)
                delay = unit.getAttackToDelay(dest, path);
            if (action.type == GameLogic.attack_bounce_to)
                delay = unit.getAttackToDelay(action.target, path);
        }
        else if (action.type == GameLogic.recruit_at)
            delay = 120;
        else if (action.type == GameLogic.end_turn)
            delay = 900;
        else
            throw("bogus gamelogic action")
        return delay;
    }

    // do animations for AI actions, set economy registries appropriately
    handleAction(action)
    {
        console.log(action);
        if (action.type == GameLogic.move_to || action.type == GameLogic.attack_to || action.type == GameLogic.attack_bounce_to)
        {
            var unit = this.world.occupied.get(action.from.toString());
            this.world.occupied.delete(action.from.toString());
            var dest = action.to;
            var path = new aStar(this.getValidMovementHexes(unit), (action.type == GameLogic.attack_to || action.type == GameLogic.attack_bounce_to)).findPath(unit.hex, dest);
            if (action.type == GameLogic.move_to)
                unit.moveTo(dest, path);
            if (action.type == GameLogic.attack_to)
                unit.attackTo(dest, path.slice(1, path.length));
            if (action.type == GameLogic.attack_bounce_to)
                unit.attackTo(action.targ, path);
        }
        else if (action.type == GameLogic.recruit_at)
        {
            var p = hexLib.hex_to_pixel(hex_layout, action.hex);
            var utp = this.world.add.existing(new Unit(this.world, p.x, p.y-2, action.unit_type, action.hex, action.owner_id, this.world.occupied, this.world.world_string_set));
            this.world.occupied.set(action.hex.toString(), utp);
            this.world.tweens.add({
                targets: utp,
                ease: 'Back',
                easeParams: [4.5],
                y: "+=4",
                duration: 120,
            });
            var tween;
            tween = this.world.tweens.addCounter({
                from: 0,
                to: 1,
                ease: 'Linear',
                duration: 120,
                onUpdate: function()
                {
                    utp.setTint(lerpColour(black, grey, tween.getValue()));
                }
            });
            this.world.events.emit(events.recruit_cost, action.owner_id, action.unit_type);
        }
        else if (action.type == GameLogic.end_turn)
            this.endTurn();
        else
            throw("bogus gamelogic action")
    }

    addUpkeep(player_id, amount)
    {
        var up = this.registry.get("upkeep"+player_id.toString());
        up += amount;
        this.registry.set("upkeep"+player_id.toString(), up);
    }

    addTreasury(player_id, amount)
    {
        var t = this.registry.get("treasury"+player_id.toString());
        t += amount;
        this.registry.set("treasury"+player_id.toString(), t);
    }
}
