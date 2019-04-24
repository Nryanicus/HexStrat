import * as hexLib from "./lib/hex-functions.mjs";
import {range} from "./lib/misc.mjs";
import {generateWorld} from "./world.mjs";

var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);
var controls;

function preload ()
{
    this.load.image('hex', 'res/Hex.png');
}

function create ()
{
    // camera boilerplate
    var cursors = this.input.keyboard.createCursorKeys();

    var controlConfig = {
        camera: this.cameras.main,
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        zoomIn: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        zoomOut: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        speed: 0.5
    };

    controls = new Phaser.Cameras.Controls.FixedKeyControl(controlConfig);

    var hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));
    var world = generateWorld(hex_layout);
    var hex_to_sprite = new Map();

    world.forEach(function(h)
    {
        var p = hexLib.hex_to_pixel(hex_layout, h);
        var s = this.add.sprite(p.x, p.y, 'hex');
        hex_to_sprite.set(h.toString(), s);
        s.setPosition(p.x, p.y);
        s.setInteractive({ pixelPerfect: true });
        s.setData('hex', h);
        s.on('pointerdown', function (pointer) {
            console.log(s.data.values.hex);
            console.log("|===============|");
        });
    }, this);

    
}


function update (time, delta)
{
    controls.update(delta);
}
