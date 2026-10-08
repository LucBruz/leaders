// Aides de test : construire une position précise sans passer par une partie
// réelle. Les tests de règles doivent pouvoir dire « le Leader est ICI et deux
// ennemis sont LÀ » en trois lignes.

import { cellAt } from '../board'
import type { CharacterId } from '../characters'
import { createGame } from '../setup'
import type { GameState, PieceId, Seat } from '../types'
import { leaderOf } from '../victory'

export function game(seed = 1, mode: 'classic' | 'strategist' = 'classic'): GameState {
    return createGame({ seed, mode })
}

/** Déplace le Leader d'un siège sur une case donnée. */
export function putLeader(state: GameState, seat: Seat, q: number, r: number): PieceId {
    const id = leaderOf(state, seat)
    const cell = cellAt(q, r)
    state.board[state.pieces[id]!.cell] = null
    state.pieces[id]!.cell = cell
    state.board[cell] = id
    return id
}

/** Ajoute une figurine et, par défaut, la carte correspondante dans la main. */
export function addPiece(
    state: GameState,
    seat: Seat,
    character: CharacterId,
    q: number,
    r: number,
    opts: { slot?: number; addCard?: boolean } = {},
): PieceId {
    const { slot = 0, addCard = true } = opts
    const cell = cellAt(q, r)
    const id = state.pieces.length
    state.pieces.push({ owner: seat, character, cell, slot })
    state.board[cell] = id
    if (addCard && !state.hands[seat].includes(character)) state.hands[seat].push(character)
    return id
}

/** Occupe une liste de cases déjà connues par index, sans passer par (q, r). */
export function fillCells(
    state: GameState,
    seat: Seat,
    cells: readonly number[],
    character: CharacterId = 'cavalier',
): PieceId[] {
    const ids: PieceId[] = []
    for (const cell of cells) {
        if (state.board[cell] !== null) continue
        const id = state.pieces.length
        state.pieces.push({ owner: seat, character, cell, slot: 0 })
        state.board[cell] = id
        ids.push(id)
    }
    return ids
}

/** Vide le plateau de toute figurine, Leaders compris. */
export function clearBoard(state: GameState): GameState {
    state.board.fill(null)
    state.pieces = []
    state.hands = [[], []]
    return state
}

/** Position minimale : les deux Leaders aux coordonnées indiquées. */
export function duel(
    a: [number, number],
    b: [number, number],
): GameState {
    const s = clearBoard(game())
    addPiece(s, 0, 'leader', a[0], a[1])
    addPiece(s, 1, 'leader', b[0], b[1])
    return s
}
