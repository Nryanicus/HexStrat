import * as hexLib from "./misc/hex-functions.mjs";
import {sword, pike, cavalry, musket, capitol, unit_cost} from "./misc/constants.mjs"
import {combatResult} from "./misc/utilities.mjs"

// pick the best state for the given player from a list of states
// just pick states that give us the most money. Will implement other considerations later if needed
export function heuristic(states, player_id)
{
    var best_state = states[0];
    var best_score = states[0].incomes[player_id];
    for (var i=1; i<states.length; i++)
    {
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
        this.num_players = this.treasuries.length;
        this.treasuries = treasuries;
        this.incomes = incomes;
        this.upkeeps = upkeeps;
        this.capitols = capitols; // {hex, owner, lives}
        this.world_hex_set = world_hex_set;
        this.world = world;
        this.occupied = occupied; // Hex.toString : {type, owner, can_move}
        this.pathfinder = pathfinder;
    }

    clone()
    {
        var treasuries = new Array(this.treasuries);
        var incomes = new Array(this.incomes);
        var upkeeps = new Array(this.upkeeps);
        var occupied = new Map();
        this.occupied.forEach(function(value, key, map)
        {
            var copy = {type: value.type, owner: value.owner, can_move: value.can_move};
            occupied.set(key, copy);
        }, this);
        var capitols = [];
        this.capitols.forEach(function(c)
        {
            var copy = {hex: c.hex, owner: c.owner, lives: c.lives};
            capitols.push(copy);
        }, this);
        return new GameState(this.current_player, this.world, this.world_hex_set, this.pathfinder, occupied, capitols, treasuries, incomes, upkeeps);
    }

    updateIncomes()
    {
        var players = [];
        for (var i=0; i < this.player_colours.length; i++) 
            players.push([]);
        this.occupied.forEach(function(unit, hex, map)
        {
            players[unit.owner_id].push(hexLib.Hex.prototype.fromString(hex));
        });
        var t, c;
        [t ,c] = determineTerritories(this.world, players, this.pathfinder);
        this.incomes = [];
        for (var i = 0; i < this.num_players; i++)
            incomes.push(0);
        t.forEach(function(owner_id, string, map)
        {
            if (owner_id == -1)
                return;
            this.incomes[owner_id]++;
        }, this);
    }
        
    // get all hexes that can be moved through by the given player, to be passed to an aStar
    getValidMovementHexes(unit)
    {
        // determine where the unit can be placed
        var valid_positions = new Set();
        hexLib.hex_spiral(unit.hex, unit.move_range+1).forEach(function(h)
        {
            if (!this.world_string_set.has(h.toString()))
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
        for (var i=0; i<this.num_players; i++)
        {
            for (var player_id = 0; player_id < this.num_players; player_id++)
            {
                var inc = this.incomes[player_id];
                var up = this.incomes[player_id]
                var net = inc - up;
                this.treasury[player_id] += net;
                if (this.treasury[player_id] < 0)
                    this.removeAllUnits(player_id);
            }
        }
        this.occupied.forEach(function(unit, hex, map)
        {
            if (!unit.type == capitol)
                unit.can_move = true;
        }

    }

    // big ol' TODO:
    // refactor current scenes to use GameLogic and refactor below cases to give specific nodes from specific input
    // and a reverse map, give output from a given state transistion

    // return a list of all valid moves from a given game state
    getValidMoves(state)
    {
        var moves = [];

        // possible recruits
        [sword, pike, cavalry, musket].forEach(function(type)
        {
            var p = unit_cost.get(type);
            if (p > this.treasuries[this.current_player])
                return;
            hexLib.hex_ring(this.capitols[this.current_player].hex, 1).forEach(function(h)
            {
                if (this.occupied.has(h.toString()))
                    return;
                var move = this.clone();
                move.occupied.set(h.toString, {type: type, owner: this.current_player, can_move: false});
                move.treasuries[this.current_player] -= p;
                move.upkeeps[this.current_player] += p;
                moves.push(move);
            }, this);
        }, this);

        // possible movements
        this.occupied.forEach(function(unit, hex, map)
        {
            if (unit.owner != this.current_player || !unit.can_move)
                return;
            var move = this.clone();
            unit = move.occupied.get(hex.toString());
            hexLib.hex_spiral(unit.hex, unit.move_range+1).forEach(function(hc)
            {
                if (!this.world_hex_set.has(hc.toString()))
                    return;
                if (move.occupied.get(hc.toString()))
                {
                    // possible attacks
                    var enemy = move.occupied.get(hc.toString());
                    if (enemy.owner_id != unit.current_player)
                    {
                        var result = combatResult(unit, enemy.type)
                        unit.can_move = false;
                        move.occupied.delete(unit.hex.toString());
                        var pf = new aStar(move.getValidMovementHexes(unit), true);
                        if (result == victory)
                        {
                            move.upkeeps[enemy.owner_id] -= unit_cost(enemy.type);
                            move.occupied.set(hc.toString(), unit);
                        }
                        else if (result == defeat)
                        {
                            move.upkeeps[unit.owner_id] -= unit_cost(unit.type);
                            enemy.can_move = false;
                        }
                        else if (result == draw)
                        {
                            hexLib.hex_ring(hc, 1).forEach(function(h)
                            {
                                var path = pf.findPath(unit.hex, h);;
                                if (path.length > unit.move_range)
                                    return;
                                move = this.clone(); // need a new move for each possible destination
                                enemy = move.occupied.get(hc.toString());
                                unit = move.occupied.get(hex.toString());
                                move.occupied.set(h, unit);
                                enemy.can_move = false;
                                moves.push(move);
                            }, this);
                            return;
                        }
                        else // attack cap
                        {
                            if (enemy.lives == 1)
                            {
                                move.removeAllUnits(enemy.owner_id);
                                move.occupied.set(hc.toString(), unit);
                            }
                            else
                            {
                                hexLib.hex_ring(hc, 1).forEach(function(h)
                                {
                                    var path = pf.findPath(unit.hex, h);;
                                    if (path.length > unit.move_range)
                                        return;
                                    move = this.clone(); // need a new move for each possible destination
                                    enemy = move.occupied.get(hc.toString());
                                    enemy.lives--;
                                    unit = move.occupied.get(hex.toString());
                                    move.occupied.set(h, unit);
                                    enemy.can_move = false;
                                    moves.push(move);
                                }, this);
                                return;
                            }
                        }
                    }
                    else // can't move into allied occupied hex
                        return;
                }
                // normal move
                else
                {
                    move.occupied.delete(unit.hex.toString());
                    move.occupied.set(hc.toString(), unit);
                }
                move.updateIncomes();
                moves.push(move);
            }, this);

        // end turn
        var move = this.clone();
        if (this.current_player == this.num_players-1)
            move.endTurn();
        else
            move.current_player++;
        moves.push(move);

        return moves;
    }

    // play a game from the current state to a gameOver state, returning the result for the given player
    simulate(player_id)
    {
        var state = this;
        while (!state.gameOver)
            state = heuristic(state.getValidMoves(), state.current_player);
        if (state.winner == player_id)
            return 1;
        return -1;
    }
}