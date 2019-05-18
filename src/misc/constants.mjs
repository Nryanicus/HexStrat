import * as hexLib from "./hex-functions.mjs";
import {recruit_sword, recruit_cavalry, recruit_pike, recruit_musket} from "./events.mjs";

export const hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.7), hexLib.Point(500,500));

export const background = 0x00081f;
export const white = 0xffffff;
export const grey = 0x222222;
export const black = 0x000000;

// player colours
export const purple = 0x6110a2;
// export const grey = 0x797979;
export const brown = 0x794100;
export const cream = 0xffdba2;
export const light_blue = 0x5182ff;
export const yellow = 0xebd320;
export const pink = 0xdb41c3;
export const orange = 0xff7930;
export const deep_pink = 0xdb4161;
export const green = 0x306141;
export const red = 0xff0000;

export const colour_names = new Map([[background, "background"], [white, "white"], [purple, "purple"], [grey, "grey"], [brown, "brown"], [cream, "cream"], [light_blue, "light_blue"], [yellow, "yellow"], [pink, "pink"], [orange, "orange"], [deep_pink, "deep_pink"], [green, "green"]]);
export const player_colours = [purple, brown, cream, light_blue, yellow, pink, orange, deep_pink, green];
export const unit_cost = new Map([[recruit_sword, 3], [recruit_cavalry, 5], [recruit_pike, 3], [recruit_musket, 7]]);
export const exclude_death_pixel = new Map([[recruit_sword, new Set([15, 16, 17])], [recruit_musket, new Set([16])], [recruit_pike, new Set([10, 16, 22])], [recruit_cavalry, new Set([9, 15, 17])]]);
export const death_pixel_dirc = new Map( [["01", [-1, -1]], ["02", [0, -1]], ["03", [0, -1]], ["04", [0, -1]], ["05", [1, -1]], ["06", [-1, -1]], ["07", [-1, -1]], ["08", [0, 0]], ["09", [0, 0]], ["10", [0, 0]], ["11", [1, -1]], ["12", [1, -1]], ["13", [-1, 0]], ["14", [-1, 0]], ["15", [0, 0]], ["16", [0, 0]], ["17", [0, 0]], ["18", [1, 0]], ["19", [1, 0]], ["20", [-1, 1]], ["21", [-1, 1]], ["22", [0, 0]], ["23", [0, 0]], ["24", [0, 0]], ["25", [1, 1]], ["26", [1, 1]], ["27", [-1, 1]], ["28", [0, 1]], ["29", [0, 1]], ["30", [0, 1]], ["31", [1, 1]]]);