import {WorldScene} from "./WorldScene.mjs";
import {UIScene} from "./UIScene.mjs";
import * as events from "./misc/events.mjs";
import * as GameLogic from "./GameLogic.mjs";
import {unit_cost, hex_layout, black, grey} from "./misc/constants.mjs";
import {lerpColour} from "./misc/utilities.mjs";
import {MCTS, MonteCarloTreeSearchNode} from "./MCTS.mjs";
import {Unit} from "./Unit.mjs";
import {aStar} from "./misc/aStar.mjs";
import * as hexLib from "./misc/hex-functions.mjs";

const time_for_MCTS = 5;

export class MasterScene extends Phaser.Scene
{

    constructor()
    {
        super("master");
    }

    create()
    {
        this.current_player = 0;
        this.num_players = 2;
        this.ai_players = [false, true];

        this.initNewWorld();
    }

    initNewWorld()
    {
        this.registry.set(events.current_player, 0)
        this.registry.set(events.can_gen, false)
        this.scene.remove('world');
        this.scene.remove('ui');
        this.scene.add('world', WorldScene, true, {master: this});
        this.scene.moveBelow('world', "ui");
        this.scene.add('ui', UIScene, true, {master: this});
        this.ui = this.scene.get('ui');
        this.world = this.scene.get('world');

        for (var player_id=0; player_id<this.num_players; player_id++)
        {
            this.registry.set("treasury"+player_id.toString(), 21);
            this.registry.set("upkeep"+player_id.toString(), 0);
            this.registry.set("income"+player_id.toString(), 0);
        }
        this.world.events.emit(events.recalc_territories);

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
            for (var i = 0; i < this.num_players; i++)
                incomes.push(0);
            this.world.territories.forEach(function(owner_id, string, map)
            {
                if (owner_id == -1)
                    return;
                incomes[owner_id]++;
            }, this);
            for (var i = 0; i < this.num_players; i++)
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
        this.current_player++;
        if (this.current_player == this.num_players)
        {
            for (var player_id=0; player_id<this.num_players; player_id++)
            {
                var inc = this.registry.get("income"+player_id.toString());
                var up = this.registry.get("upkeep"+player_id.toString());
                var net = inc - up;
                this.addTreasury(player_id, net);
                if (this.registry.get("treasury"+player_id.toString()) < 0)
                    this.world.events.emit(events.player_bankrupt, player_id);
            }
            this.current_player = 0;
            this.world.events.emit(events.end_round);
        }
        if (this.ai_players[this.current_player])
            this.handleAITurn();
        else // TODO, multiple human players
            null;
    }

    handleAITurn()
    {
        // construct current game state
        var occupied = new Map();
        this.world.occupied.forEach(function(unit, hex, map)
        {
            occupied.set(hex, {type:unit.type, owner_id:unit.owner_id, can_move:unit.can_move})
        }, this);

        var capitols = [];
        var treasuries = [];
        var incomes = [];
        var upkeeps = [];
        for (var player_id=0; player_id<this.num_players; player_id++)
        {
            var cap_pos = this.world.capitol_positions[player_id];
            if (this.world.occupied.has(cap_pos.toString()))
                capitols.push({hex: cap_pos, lives: this.world.occupied.get(cap_pos.toString()).lives});
            else
                capitols.push({hex: cap_pos, lives: 0});
            treasuries.push(this.registry.get("treasury"+player_id.toString()));
            incomes.push(this.registry.get("income"+player_id.toString()));
            upkeeps.push(this.registry.get("upkeep"+player_id.toString()));
        }
        var state = new GameLogic.GameState(this.current_player, this.world.world, this.world.world_string_set, this.world.pathfinder, occupied, capitols, treasuries, incomes, upkeeps);
        var root = new MonteCarloTreeSearchNode(null, state, this.current_player);
        // run MCTS
        var actions = MCTS(root, time_for_MCTS);
        // do each action sequentially
        var i = 0;
        actions.forEach(function(a)
        {
            this.time.delayedCall(i*120+900, function()
            {
                this.handleAction(a);
            }, [], this);
            i++;
        }, this);
    }

    // get all hexes that can be moved through by the given player, to be passed to an aStar
    // TODO: refactor, this code gets used in Unit.mjs and MasterScene.mjs
    getValidMovementHexes(unit)
    {
        // determine where the unit can be placed
        var valid_positions = new Set();
        hexLib.hex_spiral(unit.hex, unit.move_range+1).forEach(function(h)
        {
            if (!this.world.world_string_set.has(h.toString()))
                return;
            if (this.world.occupied.has(h.toString()) && this.world.occupied.get(h.toString()).owner_id != unit.owner_id)
                return;
            valid_positions.add(h.toString());
        }, this);
        return valid_positions;
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
            console.log(unit);
            console.log(dest);
            console.log(path);
            if (action.type == GameLogic.move_to)
                unit.moveTo(dest, path);
            if (action.type == GameLogic.attack_to)
                unit.attackTo(dest, path);
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
