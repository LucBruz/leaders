// Mise en place d'une partie.

import { CELL_COUNT, type CellId } from './board'
import { CHAMPIONS, MARKET_SIZE, type CharacterId } from './characters'
import { CROWN } from './layout'
import { makeRng, shuffle } from './rng'
import type { GameState, Piece, Seat } from './types'

export interface SetupOptions {
    /** Graine du mélange. Partagée entre les deux clients en ligne. */
    seed: number
    mode?: 'classic' | 'strategist'
}

export function createGame({ seed, mode = 'classic' }: SetupOptions): GameState {
    const board: (number | null)[] = new Array(CELL_COUNT).fill(null)

    // Chaque joueur pose son Leader sur sa case couronne.
    const pieces: Piece[] = [
        { owner: 0, character: 'leader', cell: CROWN[0], slot: 0 },
        { owner: 1, character: 'leader', cell: CROWN[1], slot: 0 },
    ]
    pieces.forEach((p, id) => {
        board[p.cell] = id
    })

    const shuffled = shuffle(CHAMPIONS, makeRng(seed))

    // En mode Stratège tous les Personnages sont disponibles d'emblée ; en mode
    // classique on révèle les trois premières cartes d'une pioche.
    const strategist = mode === 'strategist'
    const market: CharacterId[] = strategist ? shuffled.slice() : shuffled.slice(0, MARKET_SIZE)
    const deck: CharacterId[] = strategist ? [] : shuffled.slice(MARKET_SIZE)

    return {
        mode,
        board,
        pieces,
        hands: [['leader'], ['leader']],
        market,
        deck,
        banned: [],
        turn: 0,
        phase: 'actions',
        acted: [],
        pending: null,
        recruitsLeft: 0,
        secondPlayerBonusUsed: false,
        winner: null,
        seq: 0,
    }
}

/** Copie de travail : les tableaux modifiés par `apply` sont dupliqués. */
export function cloneState(state: GameState): GameState {
    return {
        ...state,
        board: state.board.slice(),
        pieces: state.pieces.map((p) => ({ ...p })),
        hands: [state.hands[0].slice(), state.hands[1].slice()],
        market: state.market.slice(),
        deck: state.deck.slice(),
        banned: state.banned.slice(),
        acted: state.acted.slice(),
        pending: state.pending ? { ...state.pending } : null,
    }
}

/** Figurines d'un joueur encore présentes sur le plateau. */
export function piecesOf(state: GameState, seat: Seat): number[] {
    const out: number[] = []
    for (let id = 0; id < state.pieces.length; id++) {
        if (state.pieces[id]!.owner === seat) out.push(id)
    }
    return out
}

export function cellOf(state: GameState, piece: number): CellId {
    return state.pieces[piece]!.cell
}
