import * as hexLib from "./hex-functions.mjs";

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

export const colour_names = new Map([[background, "background"], [white, "white"], [purple, "purple"], [grey, "grey"], [brown, "brown"], [cream, "cream"], [light_blue, "light_blue"], [yellow, "yellow"], [pink, "pink"], [orange, "orange"], [deep_pink, "deep_pink"], [green, "green"]]);
export const player_colours = [purple, brown, cream, light_blue, yellow, pink, orange, deep_pink, green];
