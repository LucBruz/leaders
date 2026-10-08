// Mutations élémentaires du plateau.
//
// Ce module existe pour casser un cycle d'import : `abilities` a besoin de
// déplacer des figurines, et `apply` a besoin de résoudre des compétences. Les
// deux dépendent donc d'ici, et pas l'un de l'autre.

import type { CellId } from './board'
import type { GameEvent, GameState, PieceId } from './types'

/** Déplace une figurine et tient l'occupation du plateau à jour. */
export function movePiece(state: GameState, piece: PieceId, to: CellId): GameEvent {
    const p = state.pieces[piece]!
    const from = p.cell
    state.board[from] = null
    state.board[to] = piece
    p.cell = to
    return { t: 'moved', piece, from, to }
}
