import * as hexLib from "./hex-functions.mjs";
import {recruit_sword, recruit_cavalry, recruit_pike, recruit_musket} from "./events.mjs";

export const hex_layout = hexLib.Layout(hexLib.layout_pointy, hexLib.Point(11.5,10.6), hexLib.Point(500,500));

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

export const one_normal = 0.7071067811865475;

// non-recruitable unit type
export const capitol = "duck";

export const colour_names = new Map([[background, "background"], [white, "white"], [purple, "purple"], [grey, "grey"], [brown, "brown"], [cream, "cream"], [light_blue, "light_blue"], [yellow, "yellow"], [pink, "pink"], [orange, "orange"], [deep_pink, "deep_pink"], [green, "green"]]);
export const player_colours = [purple, brown, cream, light_blue, yellow, pink, orange, deep_pink, green];
export const unit_cost = new Map([[recruit_sword, 3], [recruit_cavalry, 5], [recruit_pike, 3], [recruit_musket, 7]]);
export const exclude_death_pixel = new Map([[recruit_sword, new Set([15, 16, 17])], [recruit_musket, new Set([16])], [recruit_pike, new Set([10, 16, 22])], [recruit_cavalry, new Set([9, 15, 17])]]);
export const death_pixel_dirc = new Map( [["01", [-one_normal, -one_normal]], ["02", [0, -1]], ["03", [0, -1]], ["04", [0, -1]], ["05", [one_normal, -one_normal]], ["06", [-one_normal, -one_normal]], ["07", [-one_normal, -one_normal]], ["08", [0, 0]], ["09", [0, 0]], ["10", [0, 0]], ["11", [one_normal, -one_normal]], ["12", [one_normal, -one_normal]], ["13", [-1, 0]], ["14", [-1, 0]], ["15", [0, 0]], ["16", [0, 0]], ["17", [0, 0]], ["18", [1, 0]], ["19", [1, 0]], ["20", [-one_normal, one_normal]], ["21", [-one_normal, one_normal]], ["22", [0, 0]], ["23", [0, 0]], ["24", [0, 0]], ["25", [one_normal, one_normal]], ["26", [one_normal, one_normal]], ["27", [-one_normal, one_normal]], ["28", [0, 1]], ["29", [0, 1]], ["30", [0, 1]], ["31", [one_normal, one_normal]]]);
export const capitol_death_pixels = new Map([["01", [0, -1]], ["02", [-one_normal, -one_normal]], ["03", [0, -1]], ["04", [one_normal, -one_normal]], ["05", [-one_normal, -one_normal]], ["06", [-one_normal, -one_normal]], ["07", [0, -1]], ["08", [one_normal, -one_normal]], ["09", [one_normal, -one_normal]], ["10", [-one_normal, -one_normal]], ["11", [-one_normal, -one_normal]], ["12", [-one_normal, -one_normal]], ["13", [0, 0]], ["14", [one_normal, -one_normal]], ["15", [one_normal, -one_normal]], ["16", [one_normal, -one_normal]], ["17", [-1, 0]], ["18", [-1, 0]], ["19", [0, 0]], ["20", [0, 0]], ["21", [0, 0]], ["22", [1, 0]], ["23", [1, 0]], ["24", [-one_normal, one_normal]], ["25", [-one_normal, one_normal]], ["26", [-one_normal, one_normal]], ["27", [0, 1]], ["28", [one_normal, one_normal]], ["29", [one_normal, one_normal]], ["30", [one_normal, one_normal]]]);
export const capitol_pixel_columns = [
                                                  ["05", "10", "17", "24"],
                                                        ["11", "18", "25"],
                                            ["02", "06", "12", "19", "26"],
                                      ["01", "03", "07", "13", "20", "27"],
                                            ["04", "08", "14", "21", "28"],
                                                        ["15", "22", "29"],
                                                  ["09", "16", "23", "30"],
                                     ];