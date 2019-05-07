import {WorldScene} from "./WorldScene.mjs";
import * as events from "./misc/events.mjs";

export class MasterScene extends Phaser.Scene
{

    constructor()
    {
        super("master");
    }

    create()
    {
        this.input.keyboard.on('keydown-Z', function (event) 
        {
            if (this.registry.get(events.can_gen))
            {
                this.registry.set(events.can_gen, false)
                this.scene.remove('world');
                this.scene.add('world', WorldScene, true);
            }
        }, this);
        this.scene.add('world', WorldScene, true);
    }
}
