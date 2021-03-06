import * as hexLib from "./misc/hex-functions.mjs";
import {victory, defeat, draw, attack_capitol, sword, pike, cavalry, musket, capitol, unit_cost, unit_movement} from "./misc/constants.mjs";
import {aStar} from "./misc/aStar.mjs";
import {shuffle} from "./misc/utilities.mjs";
import * as WorldFunctions from "./world_functions.mjs";

// exceptions
const BadTransistion = "BadTransistion";
const BadPlayerId = "BadPlayerId";
const BadPathfinderRequest = "BadPathfinderRequest";
const BogusUnitType = "bogus unit type";

// GameLogic actions
export const move_to = "move_to"; // from, to
export const attack_to = "attack_to"; // from, to, penult
export const recruit_at = "recruit_at"; // owner_id, unit_type, hex
export const end_turn = "end_turn"; // next_player_id, incomes

export function combatResult(a, b)
{
    if (b == capitol)
        return attack_capitol;
    if (a == musket && b == musket)
        return draw;
    if (a == musket)
        return victory;
    if (b == musket)
        return victory;
    if (a == sword)
    {
        if (b == sword)
            return draw;
        if (b == pike)
            return victory;
        if (b == cavalry)
            return defeat;
    }
    else if (a == pike)
    {
        if (b == pike)
            return draw;
        if (b == cavalry)
            return victory;
        if (b == sword)
            return defeat;
    }
    else if (a == cavalry)
    {
        if (b == cavalry)
            return draw;
        if (b == sword)
            return victory;
        if (b == pike)
            return defeat;
    }
    console.log(BogusUnitType);
    console.log(a);
    console.log(b);
    throw(BogusUnitType);
}

// generate a new game with a new world map
// args = {num_players, seed, world_size, starting_income}
export function generateWorld(args={num_players: null, seed: null, world_size: null, starting_income: null})
{
    var world_size = (args.world_size == null) ? 10.0 : args.world_size;
    var num_players = (args.num_players == null) ? world_size/5 : args.num_players;
    var starting_treasury = (args.starting_treasury == null) ? 21 : args.starting_treasury;
    // TODO var seed = (args.seed == null) ? world_size/5 : arg.seed;
    
    // values to be populated below
    var world;
    var world_string_set;
    var capitol_positions, territories, closest_units, pathfinder;

    // generating valid worlds is nondeterministic, but doesn't tend to not happen too often
    while (true)
    {
        world = [];
        // ensure we have enough hexes to place the caps legally
        while (world.length < num_players*world_size*2)
            world = WorldFunctions.generateWorld(world_size);
        world_string_set = new Set( world.map(x => x.toString()) );

        // spawn starting locations and determine begining territories
        [capitol_positions, territories, closest_units, pathfinder] = WorldFunctions.placeCapitols(world, world_string_set, world_size, num_players);
        // if placeCapitols came back with real data we're done genning
        if (capitol_positions.length > 0)
            break;
    }

    // record player capitols
    var capitols = []
    var treasuries = []
    var upkeeps = []
    var occupied = new Map();
    for (var i=0; i<capitol_positions.length; i++)
    {
        var h = capitol_positions[i];
        occupied.set(h.toString(), {type: capitol, owner_id: i, can_move: false});
        capitols.push({hex: h, lives: 3});
        treasuries.push(starting_treasury);
        upkeeps.push(0);
    }

    var gs = new GameState(0, world, world_string_set, pathfinder, occupied, capitols, treasuries, [], upkeeps);
    gs.updateIncomes();

    return gs;
}

class GameState
{
    constructor(current_player, world, world_hex_set, pathfinder, occupied, capitols, treasuries, incomes, upkeeps)
    {
        // shorthand for readability
        this.num_players = treasuries.length;

        // terminal state info
        this.gameOver = false;
        this.winner = -1;

        // main features of most states
        this.current_player = current_player
        this.treasuries = treasuries;
        this.incomes = incomes;
        this.upkeeps = upkeeps;
        this.capitols = capitols; // {hex, lives}
        this.occupied = occupied; // Hex.toString : {type, owner_id, can_move}

        // pathfinding params. Both global for territory assigning and general for unit pathfinding
        this.world_pathfinder = pathfinder;
        this.world = world;
        this.world_hex_set = world_hex_set;
        
        // the action taken to reach this state from the previous one, used for rendering
        this.action;
    }

    // create a deep copy of this game state, so it may be modified to reflect a move without side effects
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
        return new GameState(this.current_player, this.world, this.world_hex_set, this.world_pathfinder, occupied, capitols, treasuries, incomes, upkeeps);
    }

    // wrap the world function with our params
    determineTerritories()
    {
        var players = [];
        for (var i=0; i < this.num_players; i++) 
            players.push([]);
        this.occupied.forEach(function(unit, hex, map)
        {
            players[unit.owner_id].push(hexLib.fromString(hex));
        });
        return WorldFunctions.determineTerritories(this.world, players, this.world_pathfinder);
    }

    // set incomes for current unit positions
    updateIncomes()
    {
        var t, c;
        [t, c] = this.determineTerritories();
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

    // see if the current game state is terminal, if so find the winner
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
    getValidMovementHexes(unit, hex, debug=false)
    {
        if (debug)
            console.log("creating valid hex set for pathfinder");
        // determine where the unit can be placed
        var valid_positions = new Set();
        hexLib.hex_spiral(hex, unit_movement.get(unit.type)+1).forEach(function(h)
        {
            if (!this.world_hex_set.has(h.toString()))
            {
                if (debug)
                    console.log(h,"not in world, skipping");
                return;
            }
            if (this.occupied.has(h.toString()) && this.occupied.get(h.toString()).owner_id != unit.owner_id)
            {
                if (debug)
                    console.log(h,"occupied by enemy, skipping");
                return;
            }
            valid_positions.add(h.toString());
        }, this);
        if (debug)
            console.log(valid_positions);
        return valid_positions;
    }

    getPathfinderFor(hex, debug=false)
    {
        if (!this.occupied.has(hex.toString()))
        {
            console.log(hex);
            console.log(this.occupied);
            throw BadPathfinderRequest;
        }
        return new aStar(this.getValidMovementHexes(this.occupied.get(hex.toString()), hex, debug));
    }

    // remove all units of a given player, for bankrupcy or cap killing
    removeAllUnits(player_id, kill_cap)
    {
        this.occupied.forEach(function(unit, hex, map)
        {
            if (unit.owner_id == player_id && (kill_cap || !(hex.toString() == this.capitols[player_id].hex.toString())))
            {
                this.occupied.delete(hex);
                this.upkeeps[player_id] -= unit_cost.get(unit.type);
            }
        }, this);
    }

    ///////////////////////////////////////////////
    //         UI convenience functions          //
    ///////////////////////////////////////////////

    canAfford(type, player_id)
    {
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        var cost = unit_cost.get(type);
        return cost <= this.treasuries[player_id];
    }

    ///////////////////////////////////////////////
    //        transistion legality checks        //
    ///////////////////////////////////////////////

    canRecruit(hex, type, player_id, debug=false)
    {
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        var cost = unit_cost.get(type);
        var cap_ring = hexLib.hex_ring(this.capitols[player_id].hex, 1).map(h => h.toString());
        if (debug)
        {
            console.log(arguments);
            console.log(this)
            console.log(cost);
            console.log(cost);
            console.log(cap_ring);

            console.log(this.current_player == player_id)
            console.log(cost <= this.treasuries[player_id])
            console.log(!this.occupied.has(hex.toString()))
            console.log(this.world_hex_set.has(hex.toString()))
            console.log(cap_ring.includes(hex.toString()))
        }
        return  this.current_player == player_id &&
                cost <= this.treasuries[player_id] &&
                !this.occupied.has(hex.toString()) &&
                this.world_hex_set.has(hex.toString()) &&
                cap_ring.includes(hex.toString());
    }

    canMove(source, dest, player_id, pf, debug=false)
    {
        var path = pf.findPath(source, dest);
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        if (debug)
        {
            console.log(arguments);
            console.log(this);
            console.log(path);
            console.log(this.current_player == player_id);
            console.log(!this.occupied.has(dest.toString()) || dest.toString() == source.toString());
            console.log(this.world_hex_set.has(dest.toString()));
            console.log(this.occupied.has(source.toString()));
            console.log(this.occupied.get(source.toString()).owner_id == player_id);
            console.log(this.occupied.get(source.toString()).can_move);
            console.log(path.length <= unit_movement.get(this.occupied.get(source.toString()).type));
        }
        return  this.current_player == player_id &&
                (!this.occupied.has(dest.toString())  || dest.toString() == source.toString()) &&
                this.world_hex_set.has(dest.toString()) &&
                this.occupied.has(source.toString()) &&
                this.occupied.get(source.toString()).owner_id == player_id &&
                this.occupied.get(source.toString()).can_move &&
                path.length <= unit_movement.get(this.occupied.get(source.toString()).type);
    }

    canAttackFromDirection(source, dest, penult, player_id, pf, debug=false)
    {
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        var path = pf.findPath(source, penult);
        if (debug)
        {
            console.log(arguments);
            console.log(this);
            console.log(path);
            console.log(this.current_player == player_id);
            console.log(this.occupied.has(dest.toString()));
            console.log(this.occupied.get(dest.toString()).owner_id != player_id);
            console.log(this.occupied.get(dest.toString()).owner_id != this.occupied.get(source.toString()).owner_id);
            console.log(!this.occupied.has(penult.toString()) || penult.toString() == source.toString());
            console.log(this.occupied.has(source.toString()));
            console.log(this.occupied.get(source.toString()).owner_id == player_id);
            console.log(this.occupied.get(source.toString()).can_move);
            console.log(path.length+1 <= unit_movement.get(this.occupied.get(source.toString()).type));
        }
        return  this.current_player == player_id &&
                this.occupied.has(dest.toString()) &&
                this.occupied.get(dest.toString()).owner_id != player_id &&
                this.occupied.get(dest.toString()).owner_id != this.occupied.get(source.toString()).owner_id &&
                (!this.occupied.has(penult.toString()) || penult.toString() == source.toString()) &&
                this.occupied.has(source.toString()) &&
                this.occupied.get(source.toString()).owner_id == player_id &&
                this.occupied.get(source.toString()).can_move &&
                path.length+1 <= unit_movement.get(this.occupied.get(source.toString()).type);
    }

    ///////////////////////////////////////////////
    //       transistion functions               //
    ///////////////////////////////////////////////

    // return resulting GameState from a recruit action
    recruitMove(hex, type, player_id)
    {
        if (!this.canRecruit(hex, type, player_id))
        {
            this.canRecruit(hex, type, player_id, true);
            throw(BadTransistion);
        }
        var move = this.clone();
        move.occupied.set(hex.toString(), {type: type, owner_id: player_id, can_move: false});
        var cost = unit_cost.get(type);
        move.treasuries[player_id] -= cost;
        move.upkeeps[player_id] += cost;
        move.action = {type: recruit_at, unit_type: type, owner_id: player_id, hex: hex};
        move.updateIncomes();
        return move;
    }

    movementMove(source, dest, player_id, pf=null)
    {
        if (!pf)
            pf = this.getPathfinderFor(source);
        if (!this.canMove(source, dest, player_id, pf))
        {
            this.canMove(source, dest, player_id, pf, true);
            throw(BadTransistion);
        }
        var move = this.clone();
        var unit = move.occupied.get(source.toString());
        move.action = {type: move_to, from: source, to: dest};
        move.occupied.set(dest.toString(), unit);
        move.occupied.delete(source.toString());
        unit.can_move = false;
        move.updateIncomes();
        return move;
    }

    attackMove(source, dest, penult, player_id, pf=null)
    {
        if (!pf)
            pf = this.getPathfinderFor(source);
        if (!this.canAttackFromDirection(source, dest, penult, player_id, pf))
        {
            this.canAttackFromDirection(source, dest, penult, player_id, pf, true);
            throw(BadTransistion);
        }

        var move = this.clone();
        var unit = move.occupied.get(source.toString());
        var enemy = move.occupied.get(dest.toString());
        var result = combatResult(unit.type, enemy.type);
        unit.can_move = false;
        move.action = {type: attack_to, from: source, to: dest, penult: penult};
        move.occupied.delete(source.toString());
        if (result == victory)
        {
            move.occupied.set(dest.toString(), unit);
            move.upkeeps[enemy.owner_id] -= unit_cost.get(enemy.type);
        }
        else if (result == defeat)
        {
            move.upkeeps[unit.owner_id] -= unit_cost.get(unit.type);
            enemy.can_move = false;
        }
        else if (result == draw)
        {
            move.occupied.set(penult.toString(), unit);
            enemy.can_move = false;
        }
        else // attack cap
        {
            if (!result == attack_capitol)
                throw(BadTransistion);
            if (this.capitols[enemy.owner_id].lives == 1)
            {
                move.removeAllUnits(enemy.owner_id, true);
                move.occupied.set(dest.toString(), unit);

                move.checkGameOver();
            }
            else
            {
                move.occupied.set(penult.toString(), unit);
            }
            move.capitols[enemy.owner_id].lives--;
        }
        move.updateIncomes();
        return move;
    }

    endTurnMove()
    {
        var move = this.clone();
        // econ
        var inc = move.incomes[move.current_player];
        var up = move.upkeeps[move.current_player];
        var net = inc - up;
        move.treasuries[move.current_player] += net;
        // bankrupcy
        if (move.treasuries[move.current_player] < 0)
            move.removeAllUnits(move.current_player, false);
        // movement
        move.occupied.forEach(function(unit, hex, map)
        {
            if (unit.owner_id != move.current_player) return;
            unit.can_move = unit.type != capitol;
        });
        move.action = {type: end_turn};
        // increment player
        move.current_player++;
        if (move.current_player == move.num_players)
            move.current_player = 0;
        return move;
    }

    ///////////////////////////////////////////////
    //              AI functions                 //
    ///////////////////////////////////////////////

    // return a list of all valid moves for the given unit in the given hex for the current game state
    getMovesForUnit(unit, hex)
    {
        var pf = this.getPathfinderFor(hex);
        var moves = [];
        if (this.canMove(hex, hex, unit.owner_id, pf))
            moves.push(this.movementMove(hex, hex, this.current_player, pf));
        hexLib.hex_spiral(hex, unit_movement.get(unit.type)+1).forEach(function(hc)
        {
            // attack moves
            moves = moves.concat(this.attackMoves(hex, hc, pf));
            // normal move
            if (this.canMove(hex, hc, unit.owner_id, pf))
                moves.push(this.movementMove(hex, hc, this.current_player, pf));
        }, this);

        return moves;
    }

    // return a list of all valid moves from a the current game state
    getValidMoves()
    {
        var moves = [];

        // skip to end turn if the player is dead
        if (this.capitols[this.current_player].lives != 0)
        {
            // recruit moves
            moves = moves.concat(this.recruitMoves());
            // possible movements
            this.occupied.forEach(function(unit, hex, map)
            {
                var m = this.getMovesForUnit(unit, hexLib.fromString(hex));
                moves = moves.concat(m);
            }, this);
        }
        // end turn
        moves.push(this.endTurnMove());
        return moves;
    }

    // return all possible recruits from the current game state
    recruitMoves()
    {
        var moves = [];
        // possible recruits
        [sword, pike, cavalry, musket].forEach(function(type)
        {
            hexLib.hex_ring(this.capitols[this.current_player].hex, 1).forEach(function(h)
            {
                if (this.canRecruit(h, type, this.current_player))
                    moves.push(this.recruitMove(h, type, this.current_player));
            }, this);
        }, this);
        return moves;
    }

    // return all possible attack moves from the current game state
    attackMoves(source, dest, pf)
    {
        if (!(this.occupied.has(source.toString()) && this.occupied.has(dest.toString())))
            return [];
        var moves = [];
        // possible attacks
        var path = pf.findPath(source, dest);
        var result = combatResult(this.occupied.get(source.toString()).type, this.occupied.get(dest.toString()).type);
        
        var penults = hexLib.hex_ring(dest, 1);
        for (var i=0; i<penults.length; i++)
        {
            var penult = penults[i];
            if (this.canAttackFromDirection(source, dest, penult, this.current_player, pf))
            {
                moves.push(this.attackMove(source, dest, penult, this.current_player, pf));
                // these cases there's no point considering all attack directions, break as soon as we find a valid one
                // last case is when killing a cap
                if (result == victory || result == defeat ||
                   (result == attack_capitol && this.occupied.get(dest.toString()).lives == 1))
                    break;
            }
        }
        return moves;
    }
}