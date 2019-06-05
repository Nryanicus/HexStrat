import * as hexLib from "./misc/hex-functions.mjs";
import {victory, defeat, draw, attack_capitol, sword, pike, cavalry, musket, capitol, unit_cost, unit_movement} from "./misc/constants.mjs";
import {combatResult} from "./Unit.mjs";
import {aStar} from "./misc/aStar.mjs";
import {determineTerritories} from "./world_functions.mjs";

// GameLogic actions
export const move_to = "move_to"; // from, to
export const attack_to = "attack_to"; // from, to
export const attack_bounce_to = "attack_bounce_to"; // from, to, target
export const recruit_at = "recruit_at"; // owner_id, unit_type, hex
export const end_turn = "end_turn"; // next_player_id, incomes

// pick the best state for the given player from a list of states
// just pick states that give us the most money. Will implement other considerations later if needed
export function heuristic(states, player_id)
{
    var best_state = states[0];
    var best_score = states[0].incomes[player_id];
    for (var i=1; i<states.length; i++)
    {
        // winning states are good
        if (states[i].winner == player_id)
            return states[i];
        // more money is good
        if (states[i].incomes[player_id] > best_score)
        {
            best_state = states[i];
            best_score = best_state.incomes[player_id];
        }
    }
    return best_state;
}

export class GameState
{
    constructor(current_player, world, world_hex_set, pathfinder, occupied, capitols, treasuries, incomes, upkeeps)
    {
        this.gameOver = false;
        this.winner = -1;

        this.current_player = current_player
        this.num_players = treasuries.length;
        this.treasuries = treasuries;
        this.incomes = incomes;
        this.upkeeps = upkeeps;
        this.capitols = capitols; // {hex, lives}
        this.world_hex_set = world_hex_set;
        this.world = world;
        this.occupied = occupied; // Hex.toString : {type, owner_id, can_move}
        this.pathfinder = pathfinder;

        // used for rendering, the action taken to reach this state from the previous one
        this.action;
    }

    clone()
    {
        var treasuries = Array.from(this.treasuries);
        var incomes = Array.from(this.incomes);
        var upkeeps = Array.from(this.upkeeps);
        var occupied = new Map();
        this.occupied.forEach(function(value, key, map)
        {
            var copy = {type: value.type, owner_id: value.owner_id, can_move: value.can_move};
            occupied.set(key, copy);
        }, this);
        var capitols = [];
        this.capitols.forEach(function(c)
        {
            var copy = {hex: c.hex, lives: c.lives};
            capitols.push(copy);
        }, this);
        return new GameState(this.current_player, this.world, this.world_hex_set, this.pathfinder, occupied, capitols, treasuries, incomes, upkeeps);
    }

    updateIncomes()
    {
        var players = [];
        for (var i=0; i < this.num_players; i++) 
            players.push([]);
        this.occupied.forEach(function(unit, hex, map)
        {
            players[unit.owner_id].push(hexLib.Hex.prototype.fromString(hex));
        });
        var t, c;
        [t ,c] = determineTerritories(this.world, players, this.pathfinder);
        this.incomes = [];
        for (var i = 0; i < this.num_players; i++)
            this.incomes.push(0);
        t.forEach(function(owner_id, string, map)
        {
            if (owner_id == -1)
                return;
            this.incomes[owner_id]++;
        }, this);
    }

    checkGameOver()
    {
        var alive_caps = 0;
        var alive_player = 0;
        for (var player_id=0; player_id<this.num_players; player_id++)        
        {
            if (this.capitols[player_id].lives > 0)
            {
                alive_caps++;
                alive_player = player_id;
                if (alive_caps > 1)
                    return;
            }
        }
        this.gameOver = true;
        this.winner = alive_player;
    }
        
    // get all hexes that can be moved through by the given player, to be passed to an aStar
    // TODO: refactor, this code gets used in Unit.mjs and MasterScene.mjs
    getValidMovementHexes(unit, hex)
    {
        // determine where the unit can be placed
        var valid_positions = new Set();
        hexLib.hex_spiral(hex, unit_movement.get(unit.type)+1).forEach(function(h)
        {
            if (!this.world_hex_set.has(h.toString()))
                return;
            if (this.occupied.has(h.toString()) && this.occupied.get(h.toString()).owner_id != unit.owner_id)
                return;
            valid_positions.add(h.toString());
        }, this);
        return valid_positions;
    }

    // remove all units of a given player, for bankrupcy or cap killing
    removeAllUnits(player_id)
    {
        this.occupied.forEach(function(unit, hex, map)
        {
            if (unit.owner_id == player_id)
                this.occupied.delete(hex);
        }, this);
    }

    endTurn()
    {
        this.current_player = 0;
        for (var player_id=0; player_id<this.num_players; player_id++)
        {
            var inc = this.incomes[player_id];
            var up = this.upkeeps[player_id];
            var net = inc - up;
            this.treasuries[player_id] += net;
            if (this.treasuries[player_id] < 0)
                this.removeAllUnits(player_id);
        }
        this.occupied.forEach(function(unit, hex, map)
        {
            unit.can_move = unit.type != capitol;
        }, this);
    }

    // big ol' TODO:
    // refactor current scenes to use GameLogic and refactor below cases to give specific nodes from specific input
    // and a reverse map, give output from a given state transistion

    // return a list of all valid moves from a the current game state
    getValidMoves()
    {
        var moves = [];

        // skip to end turn if the player is dead
        if (this.capitols[this.current_player].lives != 0)
        {
            moves = moves.concat(this.recruitMoves());
            // possible movements
            this.occupied.forEach(function(unit, hex, map)
            {
                if (unit.owner_id != this.current_player || !unit.can_move)
                    return;
                hex = hexLib.Hex.prototype.fromString(hex);
                var pf = new aStar(this.getValidMovementHexes(unit, hex), true);
                hexLib.hex_spiral(hex, unit_movement.get(unit.type)+1).forEach(function(hc)
                {
                    if (!this.world_hex_set.has(hc.toString()))
                        return;
                    if (pf.findPath(hex, hc).length > unit.move_range)
                        return;
                    // attack move
                    if (this.occupied.has(hc.toString()))
                        moves = moves.concat(this.attackMoves(hex, hc, pf));
                    // normal move
                    else
                        moves.push(this.movementMove(hex, hc));
                }, this);
            }, this);
        }
        // end turn
        moves.push(this.endTurnMove());
        return moves;
    }

    endTurnMove()
    {
        var move = this.clone();
        var do_incomes = (this.current_player == this.num_players-1);
        if (do_incomes)
            move.endTurn();
        else
            move.current_player++;
        move.action = {type: end_turn};
        return move;
    }

    recruitMoves()
    {
        var moves = [];
        // possible recruits
        [sword, pike, cavalry, musket].forEach(function(type)
        {
            var c = unit_cost.get(type);
            if (c > this.treasuries[this.current_player])
                return;
            hexLib.hex_ring(this.capitols[this.current_player].hex, 1).forEach(function(h)
            {
                if (this.occupied.has(h.toString()))
                    return;
                var move = this.clone();
                move.occupied.set(h.toString(), {type: type, owner_id: this.current_player, can_move: false});
                move.treasuries[this.current_player] -= c;
                move.upkeeps[this.current_player] += c;
                move.action = {type: recruit_at, unit_type: type, owner_id: this.current_player, hex: h};
                moves.push(move);
            }, this);
        }, this);
        return moves;
    }

    movementMove(source, dest)
    {
        var move = this.clone();
        move.action = {type: move_to, from: source, to: dest};
        move.occupied.set(dest.toString(), move.occupied.get(source.toString()));
        move.occupied.delete(source.toString());
        move.occupied.get(dest.toString()).can_move = false;
        move.updateIncomes();
        return move;
    }

    attackMoves(source, dest, pf)
    {
        var moves = [];
        // possible attacks
        if (this.occupied.get(dest.toString()).owner_id != this.current_player)
        {
            var result = combatResult(this.occupied.get(source.toString()), this.occupied.get(dest.toString()));
            if (result == victory)
            {
                var move = this.movementMove(source, dest);
                var enemy = move.occupied.get(dest.toString());
                move.upkeeps[enemy.owner_id] -= unit_cost.get(enemy.type);
                move.action = {type: attack_to, from: source, to: dest};
                moves.push(move);
            }
            else if (result == defeat)
            {
                var move = this.clone();
                var unit = move.occupied.get(source.toString());
                var enemy = move.occupied.get(dest.toString());
                move.occupied.delete(source.toString());
                move.action = {type: attack_to, from: source, to: dest};
                move.upkeeps[unit.owner_id] -= unit_cost(unit.type);
                move.occupied.get(dest.toString()).can_move = false;
                moves.push(move);
            }
            else if (result == draw)
            {
                hexLib.hex_ring(dest, 1).forEach(function(h)
                {
                    var path = pf.findPath(source, h);;
                    if (path.length > unit.move_range)
                        return;
                    move = this.clone();
                    var unit = move.occupied.get(source.toString());
                    var enemy = move.occupied.get(dest.toString());
                    move.occupied.set(h.toString(), unit);
                    move.occupied.delete(source.toString());
                    unit.can_move = false;
                    enemy.can_move = false;
                    move.action = {type: attack_bounce_to, from: source, to: h, target: dest};
                    moves.push(move);
                }, this);
                return;
            }
            else // attack cap
            {
                var move = this.clone();
                var unit = move.occupied.get(source.toString());
                unit.can_move = false;
                var enemy = move.occupied.get(dest.toString());
                if (enemy.lives == 1)
                {
                    move.removeAllUnits(enemy.owner_id);
                    move.occupied.set(dest.toString(), unit);
                    move.checkGameOver();
                    moves.push(move);
                }
                else
                {
                    hexLib.hex_ring(dest, 1).forEach(function(h)
                    {
                        var path = pf.findPath(source, h);;
                        if (path.length > unit.move_range)
                            return;
                        enemy.lives--;
                        move.occupied.set(h.toString(), unit);
                        move.occupied.delete(source.toString());
                        move.action = {type: attack_bounce_to, from: source, to: h, target: dest};
                        moves.push(move);
                    }, this);
                }
            }
        }
        else // can't move into allied occupied hex
            return [];
        return moves;
    }

    // play a game from the current state to a gameOver state, returning the result for the given player
    simulate(player_id)
    {
        var state = this;
        while (!state.gameOver)
        {
            state = heuristic(state.getValidMoves(), state.current_player);
            if (state.action.type == end_turn)
                return 0;
        }
        if (state.winner == player_id)
            return 1;
        return -1;
    }
}