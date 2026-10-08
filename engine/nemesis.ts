// La Némésis : déclencheur réactif.
//
// C'est la seule règle du jeu qui casse l'alternance des tours. La Némésis ne
// fait aucune action pendant sa propre phase d'Actions ; en revanche, à la fin
// de toute action qui déplace le Leader adverse — y compris pendant le tour de
// l'adversaire — elle DOIT se déplacer de deux cases, et c'est son propriétaire
// qui choisit où.
//
// D'où le champ `pending` de l'état : tant qu'il est non nul, seul
// `pending.decider` peut jouer, et il ne peut jouer que ce déplacement.

import { NEIGHBORS, type CellId } from './board'
import type { Action, GameEvent, GameState, PieceId, Seat } from './types'
import { other } from './types'

/** La Némésis en jeu pour ce siège, s'il en possède une. Il n'en existe qu'une carte. */
export function nemesisOf(state: GameState, seat: Seat): PieceId | null {
    const id = state.pieces.findIndex((p) => p.owner === seat && p.character === 'nemesis')
    return id < 0 ? null : id
}

/**
 * Quelle Némésis doit réagir à ces événements, s'il y a lieu.
 *
 * Un seul déclenchement par action, même si le Leader a été déplacé de
 * plusieurs cases — par exemple par le bonus du Vizir.
 */
export function triggeredBy(state: GameState, events: readonly GameEvent[]): PieceId | null {
    for (const event of events) {
        if (event.t !== 'moved') continue
        const piece = state.pieces[event.piece]
        if (!piece || piece.character !== 'leader') continue
        // « Leader adverse » se lit du point de vue du propriétaire de la Némésis.
        const nemesis = nemesisOf(state, other(piece.owner))
        if (nemesis !== null) return nemesis
    }
    return null
}

/**
 * Déplacements possibles de la Némésis, dans l'ordre de priorité imposé par la
 * règle : deux cases si c'est possible, sinon une seule, sinon aucune. Le
 * déplacement étant forcé, les options d'une longueur donnée excluent celles
 * des longueurs inférieures.
 */
export function nemesisActions(state: GameState, piece: PieceId): Action[] {
    const start = state.pieces[piece]!.cell
    const vacant = (c: CellId) => state.board[c] === null

    const twoSteps: Action[] = []
    for (const first of NEIGHBORS[start]!) {
        if (!vacant(first)) continue
        for (const second of NEIGHBORS[first]!) {
            // « La case d'arrivée doit être différente de la case de départ. »
            if (second === start) continue
            if (!vacant(second)) continue
            twoSteps.push({ t: 'nemesis', piece, path: [first, second] })
        }
    }
    if (twoSteps.length > 0) return twoSteps

    const oneStep: Action[] = NEIGHBORS[start]!
        .filter(vacant)
        .map((first) => ({ t: 'nemesis', piece, path: [first] }))
    if (oneStep.length > 0) return oneStep

    // Immobilisée : l'action existe quand même, pour lever l'attente.
    return [{ t: 'nemesis', piece, path: [] }]
}
