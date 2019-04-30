'use strict';

export class MasterScene extends Phaser.Scene
{
    constructor()
    {
        super("master");
    }

    create ()
    {
        this.input.setGlobalTopOnly(false);

        this.input.keyboard.on('keydown_Z', function (event) 
        {
            console.log("derp from master");
            if (this.registry.get("can_gen"))
            {
                console.log("herp");
                // this.scene.remove("UI");
                this.scene.restart("world");
            }
        }, this);

        // start
    }
}