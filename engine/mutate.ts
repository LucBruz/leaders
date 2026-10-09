// Mutations élémentaires du plateau.
//
// Ce module existe pour casser un cycle d'import : `abilities` a besoin de
// déplacer des figurines, et `apply` a besoin de résoudre des compétences. Les
// deux dépendent donc d'ici, et pas l'un de l'autre.

import type { CellId } from './board'
import type { GameEvent, GameState, Piece, PieceId } from './types'

/**
 * Figurine occupant une case, ou `null`.
 *
 * Indexer `board` directement rend `PieceId | null | undefined` — un index hors
 * plateau n'a pas d'entrée. Tester `=== null` n'élimine donc pas `undefined`,
 * et le compilateur le signale à chaque appel. Cet accesseur ramène les deux
 * cas d'absence à un seul.
 */
export function occupantOf(state: GameState, cell: CellId): PieceId | null {
    return state.board[cell] ?? null
}

/** Figurine par son index. Lève plutôt que de rendre `undefined` en silence. */
export function pieceOf(state: GameState, piece: PieceId): Piece {
    const found = state.pieces[piece]
    if (!found) throw new Error(`figurine inconnue : ${piece}`)
    return found
}

/** Déplace une figurine et tient l'occupation du plateau à jour. */
export function movePiece(state: GameState, piece: PieceId, to: CellId): GameEvent {
    const p = state.pieces[piece]!
    const from = p.cell
    state.board[from] = null
    state.board[to] = piece
    p.cell = to
    return { t: 'moved', piece, from, to }
}
