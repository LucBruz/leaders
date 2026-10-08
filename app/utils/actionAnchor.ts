// Traduction d'une action du moteur en « case sur laquelle le joueur clique ».
//
// Le moteur énumère des actions entièrement spécifiées. L'interface, elle, ne
// doit jamais rédupliquer cette logique : elle se contente de regrouper ces
// actions par case d'ancrage, puis de filtrer au fil des clics. Quand plusieurs
// actions partagent la même ancre, on demande au joueur de choisir.

import type { CellId } from '../../engine/board'
import type { Action, GameState, PieceId } from '../../engine/types'

/** La figurine que cette action engage, s'il y en a une. */
export function actorOf(action: Action): PieceId | null {
    return 'piece' in action ? action.piece : null
}

/**
 * Case sur laquelle le joueur clique pour désigner cette action.
 *
 * Pour les compétences qui déplacent la figurine elle-même, c'est sa
 * destination. Pour celles qui agissent sur un autre Personnage, c'est la case
 * de ce Personnage — plus parlant que sa future position.
 */
export function anchorOf(state: GameState, action: Action): CellId | null {
    switch (action.t) {
        case 'move':
        case 'cavalier':
        case 'rodeuse':
            return action.to
        case 'acrobate':
            return action.jumps[action.jumps.length - 1] ?? null
        case 'gardeRoyal':
            return action.then ?? action.to
        case 'cogneur':
        case 'illusionniste':
        case 'lanceGrappin':
            return state.pieces[action.target]?.cell ?? null
        case 'manipulatrice':
        case 'tavernier':
            return action.to
        case 'nemesis':
            return action.path[action.path.length - 1] ?? null
        default:
            return null
    }
}

/** Libellé court, affiché quand plusieurs actions partagent la même ancre. */
export function labelOf(state: GameState, action: Action, nom: (id: string) => string): string {
    const nomDe = (p: PieceId) => nom(state.pieces[p]!.character)
    switch (action.t) {
        case 'move':
            return 'Se déplacer'
        case 'acrobate':
            return action.jumps.length === 2 ? 'Deux sauts' : 'Un saut'
        case 'cavalier':
            return 'Charger de deux cases'
        case 'cogneur':
            return `Pousser ${nomDe(action.target)}`
        case 'gardeRoyal':
            return action.then === null ? 'Rejoindre le Leader' : 'Rejoindre le Leader, puis un pas'
        case 'illusionniste':
            return `Échanger avec ${nomDe(action.target)}`
        case 'lanceGrappin':
            return action.mode === 'go' ? `Aller jusqu'à ${nomDe(action.target)}` : `Attirer ${nomDe(action.target)}`
        case 'manipulatrice':
            return `Déplacer ${nomDe(action.target)}`
        case 'tavernier':
            return `Déplacer ${nomDe(action.target)}`
        case 'nemesis':
            return action.path.length === 0 ? 'Immobilisée' : 'Déplacement forcé'
        default:
            return action.t
    }
}

/** Les actions d'une figurine, regroupées par case d'ancrage. */
export function anchorsFor(
    state: GameState,
    actions: readonly Action[],
    piece: PieceId,
): Map<CellId, Action[]> {
    const map = new Map<CellId, Action[]>()
    for (const action of actions) {
        if (actorOf(action) !== piece) continue
        const cell = anchorOf(state, action)
        if (cell === null) continue
        const bucket = map.get(cell)
        if (bucket) bucket.push(action)
        else map.set(cell, [action])
    }
    return map
}
