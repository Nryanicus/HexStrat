// pick the best state for the given player from a list of states
export fucntion heuristic(states, player_id)
{
    // TODO
    return shuffle(states)[0];
}

export class GameState
{
    constructor()
    {
        this.gameOver = false;
        this.winner = -1;
    }
    
    // return a list of all valid moves from a given game state
    getValidMoves(state)
    {
        
    }

    // play a game from the current state to a gameOver state, returning the result for the given player
    simulate(player_id)
    {
        var state = this;
        while (!state.gameOver)
            state = heuristic(state.getValidMoves(), player_id);
        if (state.winner == player_id)
            return 1;
        return -1;
    }

}