// Énumération des coups légaux.
//
// C'est la fonction pivot du moteur : elle sert à la validation, au surlignage
// dans l'interface, au harnais de parties automatiques, et plus tard à une IA.
// L'interface ne doit JAMAIS redupliquer cette logique — elle filtre ce
// tableau par préfixe au fil des clics du joueur.

import { NEIGHBORS, type CellId } from './board'
import { skillActions } from './abilities'
import { nemesisActions } from './nemesis'
import { CHARACTERS } from './characters'
import { recruitCells } from './layout'
import { apply } from './apply'
import { cloneState, piecesOf } from './setup'
import type { Action, GameState, PieceId, Seat } from './types'
import { isDefeated } from './victory'

/**
 * Une action est interdite si elle laisse son propre Leader capturé ou
 * encerclé. La règle est absolue : « lors de votre tour, il est interdit de
 * mettre votre Leader dans une position où il serait capturé ou encerclé ».
 */
function leavesOwnLeaderSafe(state: GameState, action: Action): boolean {
    const seat = state.turn
    try {
        const { state: after } = apply(state, action)
        return !isDefeated(after, seat)
    } catch {
        return false
    }
}

/** Destinations d'un déplacement simple : les cases adjacentes vides. */
function stepDestinations(state: GameState, piece: PieceId): CellId[] {
    return NEIGHBORS[state.pieces[piece]!.cell]!.filter((c) => state.board[c] === null)
}

/**
 * Le Vizir donne au Leader allié une case supplémentaire lors de son action.
 * Le chemin n'a pas besoin d'être spécifié : seule compte l'existence d'un
 * passage par une case vide, et l'état d'arrivée est le même quel qu'il soit.
 */
function leaderDestinations(state: GameState, piece: PieceId, seat: Seat): CellId[] {
    const first = stepDestinations(state, piece)
    if (!state.hands[seat].includes('vizir')) return first

    const from = state.pieces[piece]!.cell
    const reach = new Set<CellId>(first)
    for (const mid of first) {
        for (const c of NEIGHBORS[mid]!) {
            if (c !== from && state.board[c] === null) reach.add(c)
        }
    }
    return [...reach]
}

/** Toutes les paires non ordonnées de cases libres, pour le Vieil Ours et l'Ourson. */
function pairs(cells: readonly CellId[]): CellId[][] {
    const out: CellId[][] = []
    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) out.push([cells[i]!, cells[j]!])
    }
    return out
}

function actionPhaseMoves(state: GameState): Action[] {
    const seat = state.turn
    const out: Action[] = []
    for (const piece of piecesOf(state, seat)) {
        if (state.acted.includes(piece)) continue
        const character = state.pieces[piece]!.character

        // La Némésis ne fait pas d'action pendant sa phase d'Actions : elle ne
        // bouge que par déclenchement réactif.
        if (character === 'nemesis') continue

        const destinations =
            character === 'leader'
                ? leaderDestinations(state, piece, seat)
                : stepDestinations(state, piece)
        for (const to of destinations) out.push({ t: 'move', piece, to })

        // Chaque Personnage fait UNE action : se déplacer OU utiliser sa
        // compétence active. Les deux familles sont donc concurrentes.
        out.push(...skillActions(state, piece))
    }
    return out
}

function recruitPhaseActions(state: GameState): Action[] {
    const seat = state.turn
    const free = recruitCells(seat).filter((c) => state.board[c] === null)
    const out: Action[] = []
    for (const character of state.market) {
        const slots = CHARACTERS[character].pieces
        if (slots === 1) {
            for (const cell of free) out.push({ t: 'recruit', character, cells: [cell] })
        } else {
            for (const pair of pairs(free)) out.push({ t: 'recruit', character, cells: pair })
        }
    }
    return out
}

export function legalActions(state: GameState): Action[] {
    if (state.winner !== null || state.phase === 'over') return []

    // La Némésis est le seul cas où la main revient au joueur non actif au
    // milieu du tour adverse. Tant qu'une décision est en attente, elle seule
    // peut être prise — et par `pending.decider`, pas par `state.turn`.
    //
    // Le déplacement étant forcé par la règle, il n'est PAS filtré par
    // l'interdiction d'auto-capture : celle-ci ne vaut que « lors de votre
    // tour », ce qui ne lie pas le propriétaire de la Némésis quand elle
    // réagit pendant le tour adverse.
    if (state.pending !== null) return nemesisActions(state, state.pending.piece)

    if (state.phase === 'recruit') {
        const candidates = recruitPhaseActions(state).filter((a) => leavesOwnLeaderSafe(state, a))
        // Le recrutement est obligatoire, mais peut devenir impossible : plus
        // de case dorée libre, ou aucun placement qui n'encercle son Leader.
        return candidates.length > 0 ? candidates : [{ t: 'skipRecruit' }]
    }

    if (state.phase === 'actions') {
        const moves = actionPhaseMoves(state).filter((a) => leavesOwnLeaderSafe(state, a))
        // On peut toujours cesser d'agir, même sans avoir fait agir personne.
        return [...moves, { t: 'endActions' }]
    }

    return []
}

/**
 * Qui doit jouer maintenant. Ce n'est pas toujours `state.turn` : pendant une
 * réaction de Némésis, la main appartient à son propriétaire, même au milieu du
 * tour adverse. L'interface et la couche réseau doivent s'appuyer sur cette
 * fonction, jamais sur `state.turn` directement.
 */
export function currentDecider(state: GameState): Seat | null {
    if (state.winner !== null || state.phase === 'over') return null
    return state.pending?.decider ?? state.turn
}

/** Raccourci de validation, utilisé côté réseau avant d'accepter un coup reçu. */
export function isLegal(state: GameState, action: Action): boolean {
    const target = JSON.stringify(action)
    return legalActions(state).some((a) => JSON.stringify(a) === target)
}

/** Compte de figurines, utile aux tests et au harnais. */
export function pieceCount(state: GameState, seat: Seat): number {
    return piecesOf(state, seat).length
}

export { cloneState }
