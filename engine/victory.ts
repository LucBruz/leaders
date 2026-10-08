// Conditions de fin de partie.
//
// La règle est vérifiée après CHAQUE action et après CHAQUE recrutement, pas en
// fin de tour : poser une figurine recrutée peut déclencher une capture.

import { NEIGHBORS, directionTo, distance } from './board'
import { isCub } from './characters'
import type { GameState, PieceId, Seat } from './types'
import { other } from './types'

export function leaderOf(state: GameState, seat: Seat): PieceId {
    const id = state.pieces.findIndex((p) => p.owner === seat && p.character === 'leader')
    if (id < 0) throw new Error(`aucun Leader pour le siège ${seat}`)
    return id
}

/**
 * Cette figurine participe-t-elle à la Capture du Leader situé sur `leaderCell` ?
 *
 * Cas général : être adjacent au Leader.
 * L'Archère fait exception dans les deux sens — elle participe à distance de
 * deux cases en ligne droite, même si la vue est bloquée, et ne participe PAS
 * si elle est adjacente.
 * L'Ourson, seconde figurine du Vieil Ours, ne participe jamais.
 */
export function participatesInCapture(
    state: GameState,
    attacker: PieceId,
    leaderCell: number,
): boolean {
    const piece = state.pieces[attacker]!
    if (isCub(piece.character, piece.slot)) return false

    if (piece.character === 'archere') {
        return distance(piece.cell, leaderCell) === 2 && directionTo(piece.cell, leaderCell) !== null
    }
    return distance(piece.cell, leaderCell) === 1
}

/** Figurines ennemies qui participent actuellement à la Capture du Leader de `seat`. */
export function captureContributors(state: GameState, seat: Seat): PieceId[] {
    const leaderCell = state.pieces[leaderOf(state, seat)]!.cell
    const foe = other(seat)
    const out: PieceId[] = []
    for (let id = 0; id < state.pieces.length; id++) {
        if (state.pieces[id]!.owner !== foe) continue
        if (participatesInCapture(state, id, leaderCell)) out.push(id)
    }
    return out
}

/** Le Leader de `seat` est-il capturé ? L'Assassin y suffit à lui seul. */
export function isCaptured(state: GameState, seat: Seat): boolean {
    const contributors = captureContributors(state, seat)
    if (contributors.some((id) => state.pieces[id]!.character === 'assassin')) return true
    return contributors.length >= 2
}

/**
 * Le Leader de `seat` est-il encerclé ?
 * Toutes ses cases adjacentes doivent être occupées, par des Personnages
 * ennemis ou alliés indifféremment. Une case de bord en a donc moins à remplir.
 */
export function isEncircled(state: GameState, seat: Seat): boolean {
    const leaderCell = state.pieces[leaderOf(state, seat)]!.cell
    return NEIGHBORS[leaderCell]!.every((c) => state.board[c] !== null)
}

export function isDefeated(state: GameState, seat: Seat): boolean {
    return isCaptured(state, seat) || isEncircled(state, seat)
}

/**
 * Qui a perdu, s'il y a lieu. `mover` est le joueur dont l'action vient d'être
 * résolue : si les deux Leaders se retrouvent en position de défaite — ce que
 * seul un déplacement forcé de Némésis peut provoquer, l'interdiction
 * d'auto-capture écartant le cas pendant son propre tour — c'est l'adversaire
 * du joueur actif qui tombe.
 */
export function loserAfter(state: GameState, mover: Seat): Seat | null {
    const foeDown = isDefeated(state, other(mover))
    const selfDown = isDefeated(state, mover)
    if (foeDown) return other(mover)
    if (selfDown) return mover
    return null
}
