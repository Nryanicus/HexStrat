import {WorldScene} from "./WorldScene.mjs";
import {UIScene} from "./UIScene.mjs";
import * as events from "./misc/events.mjs";
import {unit_cost} from "./misc/constants.mjs";

export class MasterScene extends Phaser.Scene
{

    constructor()
    {
        super("master");
    }

    create()
    {
        this.num_players = 2;

        this.initNewWorld();
    }

    initNewWorld()
    {
        this.registry.set(events.can_gen, false)
        this.scene.remove('world');
        this.scene.remove('ui');
        this.scene.add('world', WorldScene, true, {master: this});
        this.scene.moveBelow('world', "ui");
        this.scene.add('ui', UIScene, true, {master: this});
        this.ui = this.scene.get('ui');
        this.world = this.scene.get('world');
        this.ui.setWorld(this.world);
        this.initEventHandlers();
    }

    initEventHandlers()
    {
        // control events

        this.input.keyboard.on('keydown-X', function (event) 
        {
            console.log(world.occupied);
        }, this);

        this.input.keyboard.on('keydown-ENTER', function (event) 
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

        this.world.events.on(events.recruit, function(unit_type, player_id)
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

        this.world.events.on(events.end_turn, function()
        {   
            for (var player_id = 0; player_id < this.num_players; player_id++)
            {
                var inc = this.registry.get("income"+player_id.toString());
                var up = this.registry.get("upkeep"+player_id.toString());
                var net = inc - up;
                this.addTreasury(player_id, net);
                if (this.registry.get("treasury"+player_id.toString()) < 0)
                    this.world.events.emit(events.player_bankrupt, player_id);
            }
        }, this);

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
