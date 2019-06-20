import {WorldScene} from "./WorldScene.mjs";
import {UIScene} from "./UIScene.mjs";
import * as events from "./misc/events.mjs";
import * as GameLogic from "./GameLogic.mjs";
import {unit_cost, hex_layout, black, grey} from "./misc/constants.mjs";
import {lerpColour} from "./misc/utilities.mjs";
import {Unit} from "./Unit.mjs";
import {aStar} from "./misc/aStar.mjs";
import * as hexLib from "./misc/hex-functions.mjs";

export class MasterScene extends Phaser.Scene
{
    constructor()
    {
        super({key:"master", plugins:["InputPlugin"]});
    }

    create()
    {
        this.currentPlayer = 0;
        this.numPlayers = 2;
        this.aiPlayers = [false, true];

        this.registry.set(events.events, this.events);

        this.initNewWorld();
        this.initEventHandlers();
    }

    initEventHandlers()
    {
        this.input.keyboard.on('keyup-ENTER', function (event) 
        {
            this.gameState = this.gameState.endTurnMove();
            this.updateGameState();
            this.events.emit(events.end_turn);
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
        this.events.on(events.recruit_finalise, function(hex, unit_type, player_id)
        {
            this.gameState = this.gameState.recruitMove(hex, unit_type, player_id);
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
        for (var player_id=0; player_id<this.numPlayers; player_id++)
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

        this.registry.set(events.currentPlayer, 0)
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
