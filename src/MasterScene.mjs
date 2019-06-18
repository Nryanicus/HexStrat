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
        super("master");
    }

    create()
    {
        this.currentPlayer = 0;
        this.numPlayers = 2;
        this.aiPlayers = [false, true];
        
        this.registry.set(events.events, this.events);

        this.initNewWorld();
    }

    gameState()
    {
        return this.registry.get(events.game_state);
    }

    events()
    {
        return this.registry.get(events.events);
    }

    initNewWorld()
    {
        this.events.removeAllListeners();
        this.registry.set(events.game_state, GameLogic.generateWorld());

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
    }
}
