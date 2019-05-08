'use strict';

import {MasterScene} from "./MasterScene.mjs";
import {background} from "./misc/constants.mjs";

var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [MasterScene],
    backgroundColor: background,
    render: {
        pixelArt: true,
    }
};

var game = new Phaser.Game(config);