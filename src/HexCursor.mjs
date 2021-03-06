import * as hexLib from "./misc/hex-functions.mjs";
import {hex_layout, red, white} from "./misc/constants.mjs";
import * as events from "./misc/events.mjs";

//todo: add ghost trail that fades out

export class HexCursor extends Phaser.GameObjects.Image 
{
    gameState()
    {
        return this.scene.registry.get(events.game_state);
    }

    getEvents()
    {
        return this.scene.registry.get(events.events);
    }

    constructor (scene, x, y)
    {
        super(scene, x, y);
        this.scene = scene;
        this.setTexture("hex_select");
        this.setPosition(x, y);
        this.setAlpha(0.75);
        this.setBlendMode(Phaser.BlendModes.ADD);
        this.setVisible(false);
        this.depth = 1;

        // glow

        this.scene.tweens.add({
            targets: this,
            ease: 'Linear',
            duration: 600,
            repeat: -1,
            yoyo: true,
            alpha: 1
        }, this);
    
        // event listeners

        this.getEvents().on(events.hexover, function (h) 
        {
            var p = hexLib.hex_to_pixel(hex_layout, h);
            this.setPosition(p.x, p.y);
            if (this.scene.registry.get(events.is_placing_unit) && !this.gameState().occupied.has(h.toString()))
                this.scene.registry.get(events.unit_to_place).setPosition(p.x, p.y-2);
            if (this.scene.registry.get(events.is_placing_unit) && this.gameState().occupied.has(h.toString())
                && this.scene.registry.get(events.unit_to_place).owner_id != this.gameState().occupied.get(h.toString()).owner_id)
                this.setTint(red.color);
            else
                this.setTint(white.color);
        }, this);

        this.getEvents().on(events.hide_hex_cursor, function()
        {
            this.setVisible(false);
        }, this);
        this.getEvents().on(events.show_hex_cursor, function()
        {
            this.setVisible(true);
        }, this);
    }
}