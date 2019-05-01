import {aStar} from "./misc/aStar.mjs";
import * as hexLib from "./misc/hex-functions.mjs";

export class Unit extends Phaser.GameObjects.Image 
{

    constructor (scene, x, y, type, hex, occupied, world_string_set)
    {
        super(scene, x, y);

        this.scene = scene;
        this.type = type;
        this.setTexture(type);
        this.setPosition(x, y);
        this.hex = hex;
        this.can_move = true;

        this.occupied = occupied;
        this.world_string_set = world_string_set;

        this.move_range = 3;
    }

    handlePointerDown()
    {
        if (!this.can_move)
            return {is_moving: false};
        this.can_move = false;

        this.occupied.delete(this.hex.toString());

        var possible_destinations = [];
        hexLib.hex_spiral(this.hex, this.move_range+1).forEach(function(h)
        {
            if (! this.world_string_set.has(h.toString()) || this.occupied.has(h.toString()))
                return;
            if (aStar(this.hex, h, this.world_string_set).length > 0)
                possible_destinations.push(h);
        }, this);

        return {is_moving: true, possible_destinations: possible_destinations};
    }

    updatePosition(x, y, hex)
    {
        this.hex = hex;
        this.setPosition(x, y);
    }
}