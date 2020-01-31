export function greedy_ai(game_state)
{
    var player_id = game_state.current_player;
    var to_do = [];
    while (game_state.current_player == player_id)
    {
        var moves = game_state.getValidMoves();
        var best_move = moves[0];
        var best_score = moves[0].evaluation(player_id);

        for (var i = 1; i < moves.length; i++)
        {
            var s = moves[i].evaluation(player_id);
            if (s > best_score)
            {
                best_score = s;
                best_move = moves[i];
            }
        }

        to_do.push(best_move);
        game_state = best_move;
    }

    return to_do;
}