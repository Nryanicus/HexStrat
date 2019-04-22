import * as hexLib from "./lib/hex-functions.mjs";
import range from "./lib/misc.mjs";

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

var controls;
var hex_layout;
var game = new Phaser.Game(config);
var hexes = []

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

    // hex test
    hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));
    var spiral = hexLib.hex_spiral(hexLib.Hex(0,0,0), 100);
    spiral.forEach(function(h)
    {
        var p = hexLib.hex_to_pixel(hex_layout, h);
        var s = this.add.sprite(p.x, p.y, 'hex');
        hexes.push({h, s});
    }, this);

    function reposition_hexes()
    {
        hexes.forEach(function(hs){
            var h = hs["h"];
            var s = hs["s"];
            var p = hexLib.hex_to_pixel(hex_layout, h);
            s.setPosition(p.x, p.y);
        });
        console.log(hex_layout.size);
    }

    this.input.keyboard.on('keydown_T', function (event) {
        hex_layout.size.x += 0.1;
        reposition_hexes();
    });
    this.input.keyboard.on('keydown_G', function (event) {
        hex_layout.size.x -= 0.1;
        reposition_hexes();
    });
    this.input.keyboard.on('keydown_Y', function (event) {
        hex_layout.size.y += 0.1;
        reposition_hexes();
    });
    this.input.keyboard.on('keydown_H', function (event) {
        hex_layout.size.y -= 0.1;
        reposition_hexes();
    });
}


function update (time, delta)
{
    controls.update(delta);
}
