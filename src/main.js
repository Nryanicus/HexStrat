'use strict';

import {WorldScene} from "./WorldScene.mjs";
import {background} from "./misc/constants.mjs";

var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [WorldScene],
    backgroundColor: background,
    render: { // todo experiment with pixel art setting
        antialias: false,
        roundPixels: true,
    }
};

var game = new Phaser.Game(config);