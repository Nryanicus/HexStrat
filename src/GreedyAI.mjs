import {getRandomInt} from "./misc/utilities.mjs";

export function greedy_ai(game_state)
{
    var player_id = game_state.current_player;
    var to_do = [];
    while (game_state.current_player == player_id)
    {
        var moves = game_state.getValidMoves();
        var best_moves = [moves[0]];
        var best_score = evaluation(moves[0], player_id);

        for (var i = 1; i < moves.length; i++)
        {
            var s = evaluation(moves[i], player_id);
            moves[i].score = s;
            console.log(moves[i].action);
            console.log(moves[i]);
            console.log(s);
            if (s > best_score)
            {
                best_score = s;
                best_moves = [moves[i]];
            }
            if (s == best_score)
            {
                best_moves.push(moves[i]);
            }
        }
        var move = best_moves[getRandomInt(0, best_moves.length-1)];
        to_do.push(move);
        game_state = move;
    }

    return to_do;
}

// give a value (larger is more desirable) for the current game state for the given player
function evaluation(game_state, player_id)
{
    if (player_id >= game_state.num_players)
        throw(BadPlayerId);
    // more money is good
    function income_score(state, player_id)
    {
        return state.incomes[player_id];
    }

    // having more troops is good (scaled up as troop numbers are better than more expensive troops)
    function troop_score(state, player_id)
    {
        var score = 0;
        state.occupied.forEach(function(unit, hex, map)
        {
            if (unit.owner_id == player_id)
                score += 10;
            else
                score--;
        });
        return score;
    }

    // taking away opponents' lives is good
    function life_score(state, player_id)
    {
        var score = 0;
        for (var i=0; i<state.num_players; i++)
        {
            if (i != player_id) 
                score -= 10*state.capitols[i].lives;
        }
        return score;
    }

    // spending money is good
    // having more upkeep than income is very bad
    function macro_score(state, player_id)
    {
        var score = 0;
        if (state.upkeeps[player_id] > state.incomes[player_id])
            score = -state.upkeeps[player_id];
        return score-state.treasuries[player_id];
    }

    // score on various metrics
    var total_score = 0;
    var metrics = [income_score, troop_score, life_score, macro_score];
    metrics.forEach(function(score)
    {
        total_score += score(game_state, player_id);
    }, game_state);
    return total_score;
}