import {WorldScene} from "./WorldScene.mjs";
import {UIScene} from "./UIScene.mjs";
import * as events from "./misc/events.mjs";
import * as GameLogic from "./GameLogic.mjs";
import {unit_cost, hex_layout, black, grey, victory, defeat, draw} from "./misc/constants.mjs";
import {lerpColour} from "./misc/utilities.mjs";
import {Unit} from "./Unit.mjs";
import * as hexLib from "./misc/hex-functions.mjs";

export class MasterScene extends Phaser.Scene
{
    constructor()
    {
        super({key:"master", plugins:["InputPlugin"]});
    }

    create()
    {
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
        this.events.emit(events.end_turn, player_id);
    }

    initEventHandlers()
    {
        this.input.keyboard.on('keyup-ENTER', function (event) 
        {
            // can only end turn on our turn
            if (this.aiPlayers[this.gameState.current_player])
                return;
            this.handleEndTurn();
            console.log("============================");
            console.log(this.gameState);
            console.log("============================");
        }, this);

        // set econ values for UIScene to animate/display
        this.events.on(events.territory_change, this.updateEconomyRegistry, this);

        // animate here
        this.events.on(events.recruit_placement, function(unit_type, player_id)
        {
            var cost = unit_cost.get(unit_type);
            this.registry.set("treasury"+player_id.toString(), this.gameState.treasuries[player_id]-cost);
            this.registry.set("upkeep"+player_id.toString(), this.gameState.upkeeps[player_id]+cost);
        }, this);
        this.events.on(events.recruit_cancel, function(unit_type, player_id)
        {
            var cost = unit_cost.get(unit_type);
            this.registry.set("treasury"+player_id.toString(), this.gameState.treasuries[player_id]);
            this.registry.set("upkeep"+player_id.toString(), this.gameState.upkeeps[player_id]);
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
            this.registry.set("treasury"+player_id.toString(), this.gameState.treasuries[player_id]);
            this.registry.set("upkeep"+player_id.toString(), this.gameState.upkeeps[player_id]);
            this.registry.set("income"+player_id.toString(), this.gameState.incomes[player_id]);
        }
    }

    initNewWorld()
    {
        this.events.removeAllListeners();
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
