import {WorldScene} from "./WorldScene.mjs";
import {UIScene} from "./UIScene.mjs";
import * as events from "./misc/events.mjs";
import * as GameLogic from "./GameLogic.mjs";
import {greedy_ai} from "./GreedyAI.mjs";
import {unit_cost, hex_layout, black, grey, victory, defeat, draw, attack_capitol} from "./misc/constants.mjs";
import {Unit} from "./Unit.mjs";
import * as hexLib from "./misc/hex-functions.mjs";

export class MasterScene extends Phaser.Scene
{
    constructor()
    {
        super({key:"master"});
        // super({key:"master", plugins:["InputPlugin", "Clock"]});
    }

    create()
    {
        // this.aiPlayers = [false, false];
        this.aiPlayers = [false, false];

        this.registry.set(events.events, this.events);

        this.initNewWorld();
        this.initEventHandlers();
    }

    handleEndTurn()
    {
        var player_id = this.gameState.current_player;
        this.gameState = this.gameState.endTurnMove();
        this.updateGameState();
        this.updateEconomyRegistry();
        // bankrupcy check
        if (this.gameState.treasuries[player_id] < 0)
        {
            this.events.emit(events.player_bankrupt, player_id);
            this.updatePositions();
        }

        this.events.emit(events.end_turn, player_id);

        if (this.aiPlayers[this.gameState.current_player])
            this.aiTurn();
    }

    handleRecruitPlacement(unit_type, player_id)
    {
        var cost = unit_cost.get(unit_type);
        var tres_temp = this.gameState.treasuries.slice();
        tres_temp[player_id] -= cost;
        var up_temp = this.gameState.upkeeps.slice();
        up_temp[player_id] += cost;
        this.registry.set("treasury", tres_temp);
        this.registry.set("upkeep", up_temp);
    }

    initEventHandlers()
    {
        this.input.keyboard.on('keyup-ENTER', function (event) 
        {
            // only humans can end turn via enter
            if (this.aiPlayers[this.gameState.current_player])
                return;
            this.handleEndTurn();
        }, this);

        this.events.on(events.end_turn_button, function (event) 
        {
            // only humans can end turn via button
            if (this.aiPlayers[this.gameState.current_player])
                return;
            this.handleEndTurn();
        }, this);

        // set econ values for UIScene to animate/display
        this.events.on(events.territory_change, this.updateEconomyRegistry, this);

        // animate here
        this.events.on(events.recruit_placement, function(unit_type, player_id)
        {
            this.handleRecruitPlacement(unit_type, player_id);
        }, this);
        this.events.on(events.recruit_cancel, function(unit_type, player_id)
        {
            this.registry.set("treasury", this.gameState.treasuries);
            this.registry.set("upkeep", this.gameState.upkeeps);
        }, this);

        // interface for changing the game state
        this.events.on(events.recruit_finalise, function(hex, unit, player_id)
        {
            this.world.hex_to_unit.set(hex.toString(), unit);
            this.gameState = this.gameState.recruitMove(hex, unit.type, player_id);
            this.updateGameState();
            this.updatePositions();
        }, this);

        this.events.on(events.move_to, function(from, to, player_id)
        {
            var unit = this.world.hex_to_unit.get(from.toString());
            this.world.hex_to_unit.delete(from.toString());
            this.world.hex_to_unit.set(to.toString(), unit);
            this.gameState = this.gameState.movementMove(from, to, player_id);
            this.updateGameState();
            this.updatePositions();
        }, this);

        this.events.on(events.attack_to, function(from, target, penult, player_id, result)
        {
            var unit = this.world.hex_to_unit.get(from.toString());
            this.world.hex_to_unit.delete(from.toString());
            if (result == victory)
                this.world.hex_to_unit.set(target.toString(), unit);
            else if (result == draw)
                this.world.hex_to_unit.set(penult.toString(), unit);
            else
                console.assert(result == defeat);
            this.gameState = this.gameState.attackMove(from, target, penult, player_id);
            this.updateGameState();
            this.updatePositions();
        }, this);
    }

    updateGameState()
    {
        this.registry.set(events.game_state, this.gameState);
    }

    updatePositions()
    {
        this.events.emit(events.territory_change);
    }

    updateEconomyRegistry()
    {
        for (var player_id=0; player_id<this.gameState.num_players; player_id++)
        {
            this.registry.set("treasury", this.gameState.treasuries);
            this.registry.set("upkeep", this.gameState.upkeeps);
            this.registry.set("income", this.gameState.incomes);
        }
    }

    aiTurn()
    {
        var moves = greedy_ai(this.gameState);
        var greatest_delay = 120;
        moves.forEach(function(m)
        {
            console.log(m.action);
            if (m.action.type == GameLogic.move_to)
            {
                var unit = this.world.hex_to_unit.get(m.action.from.toString());
                var pf = this.gameState.getPathfinderFor(m.action.from);
                unit.moveTo(m.action.to, pf.findPath(m.action.from, m.action.to), true);

                this.world.hex_to_unit.delete(m.action.from.toString());
                this.world.hex_to_unit.set(m.action.to.toString(), unit);

                var delay = unit.getMoveToDelay(m.action.to, pf.findPath(m.action.from, m.action.to));
                greatest_delay = delay > greatest_delay ? delay : greatest_delay;
            }
            else if (m.action.type == GameLogic.attack_to)
            {
                var unit = this.world.hex_to_unit.get(m.action.from.toString());
                var pf = this.gameState.getPathfinderFor(m.action.from);

                var h_ult = m.action.to;
                var h_penult = m.action.penult;
                var path = pf.findPath(m.action.from, h_penult);

                if (path.length == 0)
                {
                    console.log(m.action.from, h_penult);
                    pf = this.gameState.getPathfinderFor(m.action.from, true);
                    path = pf.findPath(m.action.from, h_penult, true);
                    console.log(path);

                    console.log(this.gameState);
                    console.log(m);
                    console.log(m.action);
                    throw "zero length path being passed to attackTo";
                }

                unit.attackTo(h_ult, path, true);

                this.world.hex_to_unit.delete(m.action.from.toString());
                
                var enemy = this.gameState.occupied.get(h_ult.toString());
                var result = GameLogic.combatResult(unit.type, enemy.type);
                if (result == attack_capitol)
                {
                    if (enemy.lives <= 1)
                        this.world.hex_to_unit.set(h_ult.toString(), unit);
                    else
                        this.world.hex_to_unit.set(h_penult.toString(), unit);
                }
                else if (result == victory)
                    this.world.hex_to_unit.set(h_ult.toString(), unit);
                else if (result == draw)
                    this.world.hex_to_unit.set(h_penult.toString(), unit);
                else
                    console.assert(result == defeat);

                var delay = unit.getAttackToDelay(h_ult, path);
                greatest_delay = delay > greatest_delay ? delay : greatest_delay;
            }
            else if (m.action.type == GameLogic.recruit_at)
            {
                var unit = this.world.add.existing(new Unit(this.world, 0, 0, m.action.unit_type, m.action.hex, m.action.owner_id));
                unit.spawnAt(m.action.hex);
                this.world.hex_to_unit.set(m.action.hex.toString(), unit);
                this.handleRecruitPlacement(m.action.unit_type, m.current_player)
            }
            else if (m.action.type == GameLogic.end_turn)
            {
                // happens at end of func
            }
            else
                throw("BadAIAction");
            this.gameState = m;
            this.updateGameState();
            this.updatePositions();
        }, this);

        // end turn
        this.time.delayedCall(greatest_delay, function()
        {
            var player_id = this.gameState.current_player;
            this.events.emit(events.end_turn, player_id);
        }, [], this);
    }

    initNewWorld()
    {
        this.gameState = GameLogic.generateWorld();
        this.updateGameState();

        this.registry.set(events.can_gen, false)
        this.scene.remove('world');
        this.scene.remove('ui');
        this.scene.add('world', WorldScene, true);
        this.scene.moveBelow('world', "ui");
        this.scene.add('ui', UIScene, true);
        this.ui = this.scene.get('ui');
        this.world = this.scene.get('world');

        this.updateEconomyRegistry();

        this.aiThinking = false;

        this.ui.setWorld(this.world);
    }
}
