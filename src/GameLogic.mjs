import * as hexLib from "./misc/hex-functions.mjs";
import {victory, defeat, draw, attack_capitol, sword, pike, cavalry, musket, capitol, unit_cost, unit_movement} from "./misc/constants.mjs";
import {aStar} from "./misc/aStar.mjs";
import {shuffle} from "./misc/utilities.mjs";
import * as WorldFunctions from "./world_functions.mjs";
// import {generateWorld, placeCapitols, determineTerritories} from "./world_functions.mjs";

// exceptions
export const BadTransistion = "BadTransistion";
export const BadPlayerId = "BadPlayerId";
const BogusUnitType = "bogus unit type";

// GameLogic actions
export const move_to = "move_to"; // from, to
export const attack_to = "attack_to"; // from, to
export const attack_bounce_to = "attack_bounce_to"; // from, to, target
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

    var gs = new GameState(0, world, world_string_set, pathfinder, occupied, capitols, treasuries, [], []);
    gs.updateIncomes();

    return gs;
}

export class GameState
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

    // increment current player, do end of round updates if appropriate
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

    ///////////////////////////////////////////////
    //        transistion legality checks        //
    ///////////////////////////////////////////////

    canRecruit(hex, type, player_id)
    {
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        var cost = unit_cost.get(type);
        var cap_ring = hexLib.hex_spiral(this.capitols[player_id].hex, 1);
        return  this.current_player == player_id &&
                cost <= this.treasuries[player_id] &&
                !this.occupied.has(hex.toString()) &&
                this.world_hex_set.has(hex.toString()) &&
                cap_ring.includes(hex);
    }

    canMove(source, dest, pf, player_id)
    {
        var path = pf.findPath(source, dest);
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        return  this.current_player == player_id &&
                !this.occupied.has(dest.toString()) &&
                this.world_hex_set.has(dest.toString()) &&
                this.occupied.has(source.toString()) &&
                this.occupied.get(source.toString()).owner_id == player_id &&
                this.occupied.get(source.toString()).can_move &&
                path.length <= this.occupied.get(source.toString()).move_range;
    }

    canAttackFromDirection(source, dest, penult, pf, player_id)
    {
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        var path = pf.findPath(source, dest);
        return  this.current_player == player_id &&
                this.occupied.has(dest.toString()) &&
                this.occupied.has(dest.toString()).owner_id != player_id &&
                !this.occupied.has(penult.toString()) &&
                this.occupied.has(source.toString()) &&
                this.occupied.get(source.toString()).owner_id == player_id &&
                this.occupied.get(source.toString()).can_move &&
                path.length <= this.occupied.get(source.toString()).move_range;
    }

    ///////////////////////////////////////////////
    //       transistion functions               //
    ///////////////////////////////////////////////

    // return resulting GameState from a recruit action
    recruitMove(hex, type, player_id)
    {
        if (!this.canRecruit(hex, type, player_id))
            throw(BadTransistion);
        var move = this.clone();
        move.occupied.set(hex.toString(), {type: type, owner_id: player_id, can_move: false});
        var cost = unit_cost.get(type);
        move.treasuries[player_id] -= cost;
        move.upkeeps[player_id] += cost;
        move.action = {type: recruit_at, unit_type: type, owner_id: player_id, hex: hex};
        move.updateIncomes();
        return move;
    }

    movementMove(source, dest, pf, player_id)
    {
        if (!this.canMove(source, dest, pf, player_id))
            throw(BadTransistion);
        var move = this.clone();
        var unit = move.occupied.get(source.toString());
        move.action = {type: move_to, from: source, to: dest};
        move.occupied.set(dest.toString(), unit);
        move.occupied.delete(source.toString());
        unit.can_move = false;
        move.updateIncomes();
        return move;
    }

    attackMove(source, dest, penult, pf, player_id)
    {
        if (!this.canAttackFromDirection(source, dest, penult, pf, player_id))
            throw(BadTransistion);

        var move;
        var result = combatResult(this.occupied.get(source.toString()).type, this.occupied.get(dest.toString()).type);
        if (result == victory)
        {
            move = this.movementMove(source, dest);
            var enemy = move.occupied.get(dest.toString());
            move.upkeeps[enemy.owner_id] -= unit_cost.get(enemy.type);
            move.action = {type: attack_to, from: source, to: dest};
        }
        else if (result == defeat)
        {
            move = this.clone();
            var unit = move.occupied.get(source.toString());
            var enemy = move.occupied.get(dest.toString());
            move.occupied.delete(source.toString());
            move.action = {type: attack_to, from: source, to: dest};
            move.upkeeps[unit.owner_id] -= unit_cost.get(unit.type);
            enemy.can_move = false;
        }
        else if (result == draw)
        {
            move = this.clone();
            var unit = move.occupied.get(source.toString());
            var enemy = move.occupied.get(dest.toString());
            move.occupied.set(penult.toString(), unit);
            move.occupied.delete(source.toString());
            unit.can_move = false;
            enemy.can_move = false;
            move.action = {type: attack_bounce_to, from: source, to: penult, target: dest};
        }
        else // attack cap
        {
            if (!result == attack_capitol)
                throw(BadTransistion);
            move = this.clone();
            var unit = move.occupied.get(source.toString());
            unit.can_move = false;
            var enemy = move.occupied.get(dest.toString());
            if (enemy.lives == 1)
            {
                move.removeAllUnits(enemy.owner_id);
                move.occupied.set(dest.toString(), unit);
                move.checkGameOver();
            }
            else
            {
                var move = this.clone();
                var unit = move.occupied.get(source.toString());
                unit.can_move = false;
                enemy.lives--;
                move.occupied.set(penult.toString(), unit);
                move.occupied.delete(source.toString());
                move.action = {type: attack_bounce_to, from: source, to: penult, target: dest};
            }
        }
        move.updateIncomes();
        return move;
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

    ///////////////////////////////////////////////
    //              AI functions                 //
    ///////////////////////////////////////////////

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
                // this is repeated in the legality functions, but early exit is helpful for our AI
                if (unit.owner_id != this.current_player || !unit.can_move)
                    return;
                hex = hexLib.fromString(hex);
                var pf = new aStar(this.getValidMovementHexes(unit, hex), true);
                hexLib.hex_spiral(hex, unit_movement.get(unit.type)+1).forEach(function(hc)
                {
                    // ditto above for the checks here
                    if (!this.world_hex_set.has(hc.toString()))
                        return;
                    // attack move
                    if (this.occupied.has(hc.toString()))
                        moves = moves.concat(this.attackMoves(hex, hc, pf));
                    // normal move
                    else
                        moves.push(this.movementMove(hex, hc, pf, this.current_player));
                }, this);
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
        var moves = [];
        // possible attacks
        var path = pf.findPath(source, dest);
        var result = combatResult(this.occupied.get(source.toString()).type, this.occupied.get(dest.toString()).type);
        
        var penults = hexLib.hex_ring(dest, 1);
        for (var i=0; i<penults.length; i++)
        {
            var penult = penults[i];
            if (this.canAttackFromDirection(source, dest, penult, pf, this.current_player))
            {
                moves.push(this.attackMove(source, dest, penult, pf, this.current_player));
                // these cases there's no point considering all attack directions, break as soon as we find a valid one
                // last case is when killing a cap
                if (result == victory || result == defeat ||
                   (result == attack_capitol && this.occupied.get(dest.toString()).lives == 1))
                    break;
            }
        }
        return moves;
    }

    // give a value between 0 and 1 for the current game state for the given player
    evaluation(player_id)
    {
        if (player_id >= this.num_players)
            throw(BadPlayerId);
        // more money is good
        function income_score(state, player_id)
        {
            return state.incomes[player_id];
        }

        // having more troops is good
        function troop_score(state, player_id)
        {
            var score = 0;
            state.occupied.forEach(function(unit, hex, map)
            {
                if (unit.owner_id == player_id)
                    score++;
                else
                    score--;
            });
            return score;
        }

        // taking away opponents' lives is good
        // having more lives than opponents' is better
        function life_score(state, player_id)
        {
            var score = 0;
            for (var i=0; i<state.num_players; i++)
            {
                if (i == player_id) 
                    score += 3*state.capitols[i].lives;
                else
                    score -= state.capitols[i].lives;
            }
            return score;
        }

        // score on various metrics relative to the strongest player in those fields
        var total_score = 0;
        var metrics = [income_score, troop_score, life_score]
        metrics.forEach(function(score)
        {
            var highest_score = score(this, 0);
            var best_player = 0;
            var scores = [highest_score];
            for (var i=1; i<this.num_players; i++)
            {
                var s = score(this, i);
                scores.push(s);
                if (s > highest_score)
                {
                    highest_score = s;
                    best_player = i;
                }
            }
            // full points for being the best
            if (best_player == player_id)
                total_score += 1/metrics.length;
            // otherwise normalise to the better player
            else
                total_score += scores[player_id]/highest_score/metrics.length;
        });
        return total_score;
    }
}