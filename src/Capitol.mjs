import * as hexLib from "./misc/hex-functions.mjs";
import {hex_layout, black, unit_cost} from "./misc/constants.mjs";
import * as events from "./misc/events.mjs";
import {Unit} from "./Unit.mjs";

export class Capitol extends Phaser.GameObjects.Image 
{
    constructor (scene, x, y, hex, colour, owner_id)
    {
        super(scene, x, y);
        this.scene = scene;
        this.hex = hex;
        this.colour = colour;
        this.owner_id = owner_id;
        this.setTexture("capitol");
        this.setPosition(x, y);
        this.depth = 1;

        this.scene.events.on("close_menu", this.closeMenu, this);

        this.scene.registry.set(events.cursor_outside_menu, true);

        // recruitment
        this.menu = this.scene.add.container(0, 0)
        this.menu.setSize(28, 78);
        this.menu.setInteractive(new Phaser.Geom.Rectangle(0,0, 28, 78), Phaser.Geom.Rectangle.Contains);
        this.menu.depth = 2;
        var menu_background = this.scene.add.image(0, 0, 'purchase');
        menu_background.setTint(this.colour);

        var sword = this.scene.add.image(0, -24, 'sword').setInteractive({pixelPerfect:true});
        var pike = this.scene.add.image(0, -8, 'pike').setInteractive({pixelPerfect:true});
        var cavalry = this.scene.add.image(0, 8, 'cavalry').setInteractive({pixelPerfect:true});
        var musket = this.scene.add.image(0, 24, 'musket').setInteractive({pixelPerfect:true});
        var purchase_select = this.scene.add.image(0,0, 'purchase_select');

        this.menu.add([menu_background, purchase_select, sword, pike, cavalry, musket]);

        this.menu.setVisible(false);
        this.menu.setActive(false);
        purchase_select.setVisible(false);
        purchase_select.setAlpha(0.75);
        purchase_select.setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
            targets: purchase_select,
            ease: 'Linear',
            duration: 600,
            repeat: -1,
            yoyo: true,
            alpha: 1
        });

        // purchasing
        var unit_options = [sword, pike, cavalry, musket];
        unit_options.forEach(function(img){img.setTint(black)});
        var unit_map = new Map([[sword,events.recruit_sword], [cavalry,events.recruit_cavalry], [pike,events.recruit_pike], [musket,events.recruit_musket]]);
        unit_options.forEach(function(img)
        {
            img.on('pointerdown', function(pointer, localx, localy, event)
            {
                this.scene.events.emit(events.recruit, unit_map.get(img), this.owner_id);
                this.scene.events.emit(events.show_hex_cursor);
                event.stopPropagation();
            }, this);

            img.on('pointerover', function()
            {
                purchase_select.setVisible(true);
                purchase_select.setPosition(img.x, img.y);
                this.scene.registry.set(events.cursor_outside_menu, false);
                this.scene.events.emit(events.hide_hex_cursor);
            }, this);
            img.on('pointerout', function()
            {
                purchase_select.setVisible(false);
                this.scene.registry.set(events.cursor_outside_menu, false);
                this.scene.events.emit(events.hide_hex_cursor);
            }, this);

        }, this);

        this.menu.on('pointerover', function()
        {
            this.scene.registry.set(events.cursor_outside_menu, false);
            this.scene.events.emit(events.hide_hex_cursor);
        }, this);
        this.menu.on('pointerout', function()
        {
            this.scene.registry.set(events.cursor_outside_menu, true);
            this.scene.events.emit(events.show_hex_cursor);
        }, this);

        this.scene.events.on(events.recruit, function(type, player_id)
        {
            if (player_id != owner_id || this.scene.registry.get(events.is_placing_unit))
                return;
            var t = this.scene.registry.get("treasury"+this.owner_id.toString());
            if (unit_cost.get(type) > t)
                return;

            var flats = [];
            this.closeMenu();

            var p = this.scene.cameras.main.getWorldPoint(event.x, event.y);
            var h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
            p = hexLib.hex_to_pixel(hex_layout, h);
            this.scene.registry.set(events.is_placing_unit, true);
            var utp = this.scene.add.existing(new Unit(this.scene, p.x, p.y-2, type, h, this.owner_id, this.scene.occupied, this.scene.world_string_set));
            this.scene.registry.set(events.unit_to_place, utp);

            hexLib.hex_ring(this.hex, 1).forEach(function(h)
            {
                if (this.scene.occupied.has(h.toString()))
                    return;
                p = hexLib.hex_to_pixel(hex_layout, h);
                var flat = this.scene.add.image(p.x, p.y, 'hex_flat').setInteractive(this.scene.input.makePixelPerfect(1));
                flat.setBlendMode(Phaser.BlendModes.ADD);
                flat.setAlpha(0.01);
                flats.push(flat);
                flat.on('pointerdown', function(pointer, localx, localy, event)
                {
                    p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                    h = hexLib.hex_round(hexLib.pixel_to_hex(hex_layout, p));
                    utp.hex = h;
                    this.scene.occupied.set(h.toString(), utp);
                    this.scene.registry.set(events.is_placing_unit, false);
                    this.scene.events.emit(events.recalc_territories);
                    flats.map(f => f.destroy());
                    flats = [];
                    this.scene.tweens.add({
                        targets: utp,
                        ease: 'Back',
                        easeParams: [4.5],
                        y: "+=2",
                        duration: 60
                    });
                    event.stopPropagation();
                }, this);
                this.scene.tweens.add({
                    targets: flat,
                    ease: 'Linear',
                    duration: 600,
                    repeat: -1,
                    yoyo: true,
                    alpha: 0.25
                });
            }, this);
        }, this);
    }

    closeMenu()
    {
        this.menu.setVisible(false);
        this.menu.setActive(false);
        this.scene.events.emit(events.show_hex_cursor);
        this.scene.registry.set(events.menu_open, false);
    } 

    openMenu()
    {
        this.menu.setVisible(true);
        this.menu.setActive(true);
        var m_p = hexLib.hex_to_pixel(hex_layout, hexLib.hex_add(this.hex, new hexLib.Hex(1,0,0)));
        this.menu.setPosition(m_p.x+3, m_p.y-2);
        this.scene.registry.set(events.menu_open, true);
    }

    handlePointerDown()
    {
        if (this.scene.registry.get(events.is_placing_unit))
            return;
        this.openMenu();
    }
}
