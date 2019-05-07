'use strict';

import {MasterScene} from "./MasterScene.mjs";
import {background} from "./misc/constants.mjs";

var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [MasterScene],
    backgroundColor: background,
    render: { // todo experiment with pixel art setting
        antialias: false,
        roundPixels: true,
    }
};

var game = new Phaser.Game(config);