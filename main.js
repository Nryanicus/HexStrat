import * as hexLib from "./lib/hex-functions.mjs";
import {range, lerpColour} from "./lib/misc.mjs";

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

const simplex_zoom1 = 128;
const simplex_zoom2 = 512;
const simplex_ratio = 0.4;
const world_size = 50.0;
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
    var simplex1 = new SimplexNoise();
    var simplex2 = new SimplexNoise();
    var max_height = 0;
    var min_height = 10;

    hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));
    var spiral = hexLib.hex_spiral(hexLib.Hex(0,0,0), world_size);
    spiral.forEach(function(h)
    {
        var p = hexLib.hex_to_pixel(hex_layout, h);
        var s = this.add.sprite(p.x, p.y, 'hex');
        var z = simplex_ratio*simplex1.noise2D(p.x/simplex_zoom1, p.y/simplex_zoom1) + (1-simplex_ratio)*simplex2.noise2D(p.x/simplex_zoom2, p.y/simplex_zoom2);
        var distance_ratio = 1 - hexLib.hex_distance(hexLib.Hex(0,0,0), h)/world_size;
        z *= distance_ratio*distance_ratio;
        s.setData('height', z);
        s.setData('distance_ratio', distance_ratio);
        if (z > max_height)
            max_height = z;
        if (z < min_height)
            min_height = z;
        hexes.push({h, s, z});
    }, this);

    max_height -= min_height;
    console.log(max_height);

    hexes.forEach(function(hs)
    {
        var h = hs["h"];
        var p = hexLib.hex_to_pixel(hex_layout, h);
        var s = hs["s"];
        var z = s.data.values.height - min_height;
        var r = z/max_height;

        var tint = lerpColour(0, 16777215, r);
        if (r > 0.5)
            tint = 16777215;
        else
            tint = 0;

        s.setTint(tint);

        s.setInteractive({ pixelPerfect: true });
        s.setData('hex', h);
        s.setData('height', z);
        s.setData('tint', tint);
        s.setData('ratio', r);
        s.on('pointerdown', function (pointer) {
            console.log(s.data.values.hex);
            console.log(s.data.values.height);
            console.log(s.data.values.tint);
            console.log(s.data.values.ratio);
            console.log(s.data.values.distance_ratio);
            console.log("|===============|");
        });
    }, this);

}


function update (time, delta)
{
    controls.update(delta);
}
