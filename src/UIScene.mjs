import * as events from "./misc/events.mjs";
import {getRandomInt, getRandomFloat, padString, lerpColour} from "./misc/utilities.mjs";
import {unit_cost, white} from "./misc/constants.mjs";

export class UIScene extends Phaser.Scene
{

    constructor()
    {
        super("ui");
        this.world;
        this.ui;
        this.height = 156;
        this.player_id = 0;
        this.colour;

        this.background;
    }

    preload()
    {
        this.load.image('ui', 'res/UI.png');

        this.load.image('sword_glow', 'res/UISwordGlow.png');
        this.load.image('cavalry_glow', 'res/UICavalryGlow.png');
        this.load.image('pike_glow', 'res/UIPikeGlow.png');
        this.load.image('musket_glow', 'res/UIMusketGlow.png');
        this.load.image('end_turn_glow', 'res/UIEndTurnGlow.png');

        this.load.image('sword_select', 'res/UISwordSelect.png');
        this.load.image('cavalry_select', 'res/UICavalrySelect.png');
        this.load.image('pike_select', 'res/UIPikeSelect.png');
        this.load.image('musket_select', 'res/UIMusketSelect.png');
        this.load.image('end_turn_select', 'res/UIEndTurnSelect.png');

        this.load.image('font', 'res/font.png');
    }

    loadFont()
    {
        var config = {
            image: 'font',
            width: 8,
            height: 8,
            spacing: {x: 2, y: 0},
            chars: Phaser.GameObjects.RetroFont.TEXT_SET4
        };

        this.cache.bitmapFont.add('font', Phaser.GameObjects.RetroFont.Parse(this, config));
    }

    lerpNumericText(target, from, to)
    {
        var tween;
        var diff = Math.abs(to - from);
        var speed = getRandomFloat(0.5, 1.5)*diff;
        tween = this.tweens.addCounter({
            from: from,
            to: to,
            ease: 'Quadratic',
            duration: 10*speed,
            onUpdate: function()
            {
                var n = Math.floor(tween.getValue());
                if (n < 0)
                    n = "BANKRUPT";
                target.setText(padString(n.toString(), 10));
            },
        });
        if (to == from)
            return;
        var mod = (to - from < 0) ? "+" : "-";
        this.tweens.add(
        {
            targets: target,
            ease: 'Cubic',
            duration: 300,
            yoyo: true,
            repeat: Math.floor(speed/300),
            y: mod+"=2"
        }, this);
    }

    initUI()
    {
        this.ui = this.add.container(this.cameras.main.width/2, this.cameras.main.height - 16 - this.height/2 + this.height*2);
        this.background = this.add.image(0, 0, "ui");
        var sword_glow = this.add.image(0, 0, "sword_glow");;
        var cavalry_glow = this.add.image(0, 0, "cavalry_glow");;
        var pike_glow = this.add.image(0, 0, "pike_glow");;
        var musket_glow = this.add.image(0, 0, "musket_glow");;
        var end_turn_glow = this.add.image(0, 0, "end_turn_glow");;

        var sword_select = this.add.image(0, 0, "sword_select");;
        var cavalry_select = this.add.image(0, 0, "cavalry_select");;
        var pike_select = this.add.image(0, 0, "pike_select");;
        var musket_select = this.add.image(0, 0, "musket_select");;
        var end_turn_select = this.add.image(0, 0, "end_turn_select");;
        
        this.treasury = this.add.bitmapText(558, -10, 'font').setOrigin(1, 0.5);
        this.treasury.setScale(2, 2);
        this.treasury.setLetterSpacing(2);
        this.income = this.add.bitmapText(558, 18, 'font').setOrigin(1, 0.5);
        this.income.setScale(2, 2);
        this.income.setLetterSpacing(2);
        this.upkeep = this.add.bitmapText(558, 46, 'font').setOrigin(1, 0.5);
        this.upkeep.setScale(2, 2);
        this.upkeep.setLetterSpacing(2);

        // TODO, move the logic here into a dedicated simulator class and have this just be an observer
        this.world.events.on(events.recruit, function(type, player_id)
        {
            if (player_id != this.player_id)
                return;
            var t = this.registry.get("treasury"+player_id.toString());
            if (unit_cost.get(type) > t)
            {
                var tween;
                var targ = this.treasury;
                var col = this.colour;
                tween = this.tweens.addCounter({
                    from: 0,
                    to: 1,
                    ease: 'Quadratic',
                    duration: 300,
                    yoyo: true,
                    onUpdate: function()
                    {
                        targ.setTint(lerpColour(col, white, tween.getValue()));
                    }
                }, this);
                this.tweens.add(
                {
                    targets: this.treasury,
                    ease: 'Cubic',
                    duration: 300,
                    yoyo: true,
                    y: "-=2"
                }, this);
                return;
            }

            var curr_t = t;
            var cost = unit_cost.get(type);
            t -= cost;
            this.registry.set("treasury"+player_id.toString(), t);
            this.lerpNumericText(this.treasury, curr_t, t);

            var up = this.registry.get("upkeep"+player_id.toString());
            var curr_up = up;
            up += cost;
            this.registry.set("upkeep"+player_id.toString(), up);
            this.lerpNumericText(this.upkeep, curr_up, up);
        }, this);

        this.world.events.on(events.territory_change, function()
        {   
            var current = this.registry.get("income"+this.player_id.toString());
            var i = 0;
            this.world.territories.forEach(function(owner_id, string, map)
            {
                if (owner_id == this.player_id)
                    i++;
            }, this);
            this.registry.set("income"+this.player_id.toString(), i);
            this.lerpNumericText(this.income, current, i);
        }, this);

        this.world.events.on(events.end_turn, function()
        {   
            var t = this.registry.get("treasury"+this.player_id.toString());
            var curr_t = t;
            var inc = this.registry.get("income"+this.player_id.toString());
            var up = this.registry.get("upkeep"+this.player_id.toString());
            t += inc - up;
            this.registry.set("treasury"+this.player_id.toString(), t);
            this.lerpNumericText(this.treasury, curr_t, t);
        }, this);

        this.treasury.setText(padString("20", 10));
        this.income.setText(padString(this.registry.get("income"+this.player_id.toString()).toString(), 10));
        this.upkeep.setText(padString("0", 10));

        this.ui.add([this.background, sword_glow, cavalry_glow, pike_glow, musket_glow, end_turn_glow, sword_select, cavalry_select, pike_select, musket_select, end_turn_select, this.treasury, this.income, this.upkeep]);

        var select_map = new Map([[sword_select, events.recruit_sword],
                                  [cavalry_select, events.recruit_cavalry],
                                  [pike_select, events.recruit_pike],
                                  [musket_select, events.recruit_musket],
                                  [end_turn_select, events.end_turn]]);

        var glow_map = new Map([[sword_select, sword_glow],
                                  [cavalry_select, cavalry_glow],
                                  [pike_select, pike_glow],
                                  [musket_select, musket_glow],
                                  [end_turn_select, end_turn_glow]]);

        [sword_select, cavalry_select, pike_select, musket_select, end_turn_select].forEach(function(img)
        {
            img.setInteractive(this.input.makePixelPerfect(1));
            glow_map.get(img).setVisible(false);
            glow_map.get(img).setBlendMode(Phaser.BlendModes.ADD);
            glow_map.get(img).setAlpha(0.1);
            this.tweens.add({
                targets: glow_map.get(img),
                ease: 'Linear',
                duration: 600,
                repeat: -1,
                yoyo: true,
                alpha: 1
            });
            img.on("pointerdown", function()
            {
                if (img != end_turn_select)
                    this.world.events.emit(events.recruit, select_map.get(img), this.player_id);
                else
                    this.world.events.emit(select_map.get(img));
            }, this);
            img.on("pointerover", function()
            {
                glow_map.get(img).setVisible(true);
            }, this);
            img.on("pointerout", function()
            {
                glow_map.get(img).setVisible(false);
            }, this);
        }, this);
    }

    create()
    {   
        this.loadFont();
        this.initUI();

        this.events.on(events.hide_ui, function()
        {
            this.tweens.killAll();
            this.ui.setPosition(this.cameras.main.width/2, this.cameras.main.height - 16 - this.height/2 + this.height*2);
        }, this);
    }

    setWorld(world)
    {
        this.world = world;
        this.world.events.on(events.show_ui, function()
        {
            this.colour = world.player_colours[this.player_id];
            this.background.setTint(this.colour);
            this.treasury.setTint(this.colour);
            this.income.setTint(this.colour);
            this.upkeep.setTint(this.colour);
            this.tweens.add({
                targets: this.ui,
                ease: 'Cubic',
                duration: 600,
                y: "-="+(this.height*2).toString()
            });

        }, this); 

        this.world.events.emit(events.territory_change);
    }
}