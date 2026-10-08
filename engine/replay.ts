// Rejeu d'une partie à partir de son journal d'actions.
//
// C'est la pièce centrale du jeu en ligne. Comme le moteur est entièrement
// déterministe et que la pioche dérive d'une graine partagée, une partie se
// résume à `{ graine, mode, suite d'actions }`. On n'a donc jamais besoin de
// transmettre ni de stocker l'état : il se reconstruit.
//
// Trois usages en découlent :
//  — la reconnexion, qui rejoue le journal depuis le début ;
//  — la validation d'un coup reçu, qui ne fait confiance à personne ;
//  — le mode rediffusion, gratuit, qui s'arrête à n'importe quel coup.

import { legalActions } from './legal'
import { apply } from './apply'
import { createGame } from './setup'
import type { Action, GameState } from './types'

export interface GameRecord {
    seed: number
    mode: 'classic' | 'strategist'
    actions: readonly Action[]
}

export class ReplayError extends Error {
    constructor(
        message: string,
        readonly index: number,
        readonly action: Action,
    ) {
        super(message)
        this.name = 'ReplayError'
    }
}

/** Une action reçue est-elle jouable dans cet état ? */
export function accepts(state: GameState, action: Action): boolean {
    const wanted = JSON.stringify(action)
    return legalActions(state).some((a) => JSON.stringify(a) === wanted)
}

/**
 * Rejoue le journal et renvoie l'état atteint.
 *
 * Chaque action est revalidée au passage : un journal corrompu, tronqué ou
 * falsifié échoue au lieu de produire silencieusement un état faux. `upTo`
 * permet de s'arrêter en chemin, ce qui donne la rediffusion.
 */
export function replay(record: GameRecord, upTo = record.actions.length): GameState {
    let state = createGame({ seed: record.seed, mode: record.mode })
    const limit = Math.min(upTo, record.actions.length)

    for (let i = 0; i < limit; i++) {
        const action = record.actions[i]!
        if (state.winner !== null) {
            throw new ReplayError('action jouée après la fin de la partie', i, action)
        }
        if (!accepts(state, action)) {
            throw new ReplayError(`action illégale au coup ${i}`, i, action)
        }
        state = apply(state, action).state
    }
    return state
}

/**
 * Applique un seul coup à un état déjà rejoué, sans tout refaire.
 *
 * C'est le chemin chaud : à chaque coup reçu de l'adversaire, on ne rejoue pas
 * toute la partie, on avance d'un cran. Le rejeu complet est réservé à la
 * reconnexion et à la résolution d'un conflit d'ordre.
 */
export function advance(state: GameState, action: Action): GameState {
    if (state.winner !== null) throw new Error('la partie est terminée')
    if (!accepts(state, action)) throw new Error(`action illégale : ${action.t}`)
    return apply(state, action).state
}

/**
 * Empreinte de l'état, pour détecter une divergence entre deux clients.
 *
 * N'entre dans le calcul que ce qui détermine la suite de la partie : la
 * position des figurines, les mains, le marché, et à qui est la main. La
 * pioche en est exclue, puisqu'elle dérive de la graine.
 */
export function fingerprint(state: GameState): string {
    const pieces = state.pieces
        .map((p, id) => `${id}:${p.owner}${p.character}${p.slot}@${p.cell}`)
        .join('|')
    const hands = state.hands.map((h) => [...h].sort().join(',')).join('/')
    const main = state.pending ? `p${state.pending.decider}` : `t${state.turn}`
    return [state.seq, main, state.phase, pieces, hands, state.market.join(','), state.winner].join(';')
}
