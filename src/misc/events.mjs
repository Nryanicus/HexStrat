import {sword, pike, cavalry, musket} from "./constants.mjs"

//////////////////////////////////////////////////////////////
//                         events                           //
//////////////////////////////////////////////////////////////


// hexcursor control
export const hexdown = "hexdown";
export const hexover = "hexover";
export const hide_hex_cursor = "hide_hex_cursor";
export const show_hex_cursor = "show_hex_cursor";

// map gen sequencing
export const show_ui = "show_ui";
export const hide_ui = "hide_ui";

// recruitment
export const close_menu = "close_menu";
// for comms between Capitol and UIScene
export const recruit_placement = "recruit_placement"; // unit_type, player_id
export const recruit_finalise  = "recruit_finalise"; // hex, unit_type, player_id
export const recruit_cancel    = "recruit_cancel"; // unit_type, player_id
// UI
export const shake_treasury = "shake_treasury"; // player_id

// unit and UI
export const end_turn  = "end_turn";
export const end_round = "end_round";

// world
export const territory_change = "territory_change";
// unit
export const player_bankrupt = "player_bankrupt"; // player_id
export const unit_death      = "unit_death"; // hex

//////////////////////////////////////////////////////////////
//                      registry keys                       //
//////////////////////////////////////////////////////////////
// global hook to current game state
export const game_state = "game_state";
// global hook to master event system
export const events = "events";
// hex cursors stuff
export const is_placing_unit = "is_placing_unit";
export const unit_to_place = "unit_to_place";
// recruitment menu / hex cursor flags
export const menu_open = "menu_open";
export const cursor_outside_menu = "cursor_outside_menu";
// hex cursors stuff
export const can_gen = "can_gen";