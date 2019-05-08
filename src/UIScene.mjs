import * as events from "./misc/events.mjs";

export class UIScene extends Phaser.Scene
{

    constructor()
    {
        super("ui");
        this.world;
        this.ui;
        this.height = 156;
        this.player_id = 0;

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
    }

    create()
    {
        this.ui = this.add.container(this.cameras.main.width/2, this.cameras.main.height - 16 - this.height/2 + this.height);
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
        
        this.ui.add([this.background, sword_glow, cavalry_glow, pike_glow, musket_glow, end_turn_glow, sword_select, cavalry_select, pike_select, musket_select, end_turn_select]);
        this.ui.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1138, 156), Phaser.Geom.Rectangle.Contains);

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
                this.world.events.emit(events.recruit, select_map.get(img), this.player_id);
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

        this.events.on(events.hide_ui, function()
        {
            this.tweens.killAll();
            this.ui.setPosition(this.cameras.main.width/2, this.cameras.main.height - 16 - this.height/2 + this.height);
        }, this);
    }

    setWorld(world)
    {
        this.world = world;
        this.world.events.on(events.show_ui, function()
        {
            this.background.setTint(world.player_colours[this.player_id]);
            this.tweens.add({
                targets: this.ui,
                ease: 'Cubic',
                duration: 600,
                y: "-="+this.height.toString()
            });

        }, this); 
    }
}