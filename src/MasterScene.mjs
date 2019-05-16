import {WorldScene} from "./WorldScene.mjs";
import {UIScene} from "./UIScene.mjs";
import * as events from "./misc/events.mjs";

export class MasterScene extends Phaser.Scene
{

    constructor()
    {
        super("master");
    }

    create()
    {
        this.scene.add('world', WorldScene, true);
        this.scene.add('ui', UIScene, true);
        var world = this.scene.get('world');
        var ui = this.scene.get('ui');
        ui.setWorld(world);

        this.input.keyboard.on('keydown-Z', function (event) 
        {
            if (this.registry.get(events.can_gen))
            {
                ui.events.emit(events.hide_ui);
                this.registry.set(events.can_gen, false)
                this.scene.remove('world');
                this.scene.add('world', WorldScene, true);
                this.scene.moveBelow('world', "ui");
                var world = this.scene.get('world');
                ui.setWorld(world);
            }
        }, this);
    }
}
