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
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.img),
        zoomIn: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        zoomOut: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        speed: 0.5
    };

    controls = new Phaser.Cameras.Controls.FixedKeyControl(controlConfig);

    // world gen
    var hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));
    var world = [];
    var hex_to_sprite = new Map();

    this.input.keyboard.on('keydown_Z', function (event) {
        world.map(h => hex_to_sprite.get(h.toString()).destroy());
        hex_to_sprite.clear();

        world = generateWorld(hex_layout);
        var i = 0;
        world.forEach(function(h)
        {
            var p = hexLib.hex_to_pixel(hex_layout, h);
            var img = this.add.image(p.x, p.y, 'hex');
            img.scaleX = 0;
            img.scaleY = 0;
            hex_to_sprite.set(h.toString(), img);
            img.setPosition(p.x, p.y);
            img.setInteractive({ pixelPerfect: true });
            img.setData('hex', h);
            img.on('pointerdown', function (pointer) 
            {
                console.log(img.data.values.hex);
                console.log("|===============|");
            });

            this.tweens.add({
                targets: img,
                scaleX: 1,
                scaleY: 1,
                ease: 'Elastic',
                easeParams: [ 1.5, 0.5 ],
                duration: 1000,
                delay: i * 1
            });
            i++;

        }, this);
    }, this);

    
}


function update (time, delta)
{
    controls.update(delta);
}
