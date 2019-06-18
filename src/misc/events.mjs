import {sword, pike, cavalry, musket} from "./constants.mjs"

// events
export const hexdown = "hexdown";
export const hexover = "hexover";
export const close_menu = "close_menu";
export const hide_hex_cursor = "hide_hex_cursor";
export const show_hex_cursor = "show_hex_cursor";
export const show_ui = "show_ui";
export const hide_ui = "hide_ui";

export const recruit_attempt = "recruit_attempt"; // one of the below (aka unit type), player id
export const recruit = "recruit"; // one of the below (aka unit type), player id
export const recruit_sword = sword;
export const recruit_cavalry = cavalry;
export const recruit_pike = pike;
export const recruit_musket = musket;
export const cancel_recruitment = "cancel_recruitment"; // player_id, unit_type
export const recruit_cost = "recruit_cost"; // unit_type, player_id
 
export const end_turn = "end_turn";
export const end_round = "end_round";

export const territory_change = "territory_change";
export const player_bankrupt = "player_bankrupt"; // player_id
export const shake_treasury = "shake_treasury"; // player_id
export const unit_death = "unit_death"; // hex

// registry keys
export const game_state = "game_state";
export const is_placing_unit = "is_placing_unit";
export const unit_to_place = "unit_to_place";
export const can_gen = "can_gen";
export const menu_open = "menu_open";
export const cursor_outside_menu = "cursor_outside_menu";