// Résolution d'une action.
//
// Une action est toujours entièrement spécifiée : `apply` la résout d'un bloc,
// sans jamais laisser le moteur dans un état intermédiaire à mi-compétence.

import { resolveSkill } from './abilities'
import { CHARACTERS, HAND_LIMIT, MARKET_SIZE } from './characters'
import { movePiece } from './mutate'
import { cloneState } from './setup'
import type { Action, GameEvent, GameState, PieceId, Seat, SkillAction } from './types'
import { other } from './types'
import { loserAfter } from './victory'

export interface ApplyResult {
    state: GameState
    events: GameEvent[]
}

export { movePiece }

/** Les actions qui sont l'usage d'une compétence active, par opposition au reste. */
const SKILL_TYPES = new Set<string>([
    'acrobate', 'cavalier', 'cogneur', 'gardeRoyal', 'illusionniste',
    'lanceGrappin', 'manipulatrice', 'rodeuse', 'tavernier',
])

export function isSkillAction(action: Action): action is SkillAction {
    return SKILL_TYPES.has(action.t)
}

/** Le joueur doit-il encore recruter ? Sa main se compte en CARTES, Leader inclus. */
export function mustRecruit(state: GameState, seat: Seat): boolean {
    return state.hands[seat].length < HAND_LIMIT
}

function startRecruitPhase(state: GameState): void {
    const seat = state.turn
    if (!mustRecruit(state, seat)) {
        endTurn(state)
        return
    }
    // Le second joueur effectue deux fois la phase de Recrutement à son premier
    // tour, pour compenser le désavantage de jouer en second.
    const bonus = seat === 1 && !state.secondPlayerBonusUsed ? 1 : 0
    if (bonus) state.secondPlayerBonusUsed = true
    state.phase = 'recruit'
    state.recruitsLeft = 1 + bonus
}

function endTurn(state: GameState): void {
    state.turn = other(state.turn)
    state.phase = 'actions'
    state.acted = []
    state.recruitsLeft = 0
}

function refillMarket(state: GameState): void {
    if (state.mode === 'strategist') return
    while (state.market.length < MARKET_SIZE && state.deck.length > 0) {
        state.market.push(state.deck.shift()!)
    }
}

export function apply(state: GameState, action: Action): ApplyResult {
    const next = cloneState(state)
    const events: GameEvent[] = []
    const seat = next.turn

    if (isSkillAction(action)) {
        events.push(...resolveSkill(next, action))
        next.acted.push(action.piece)
        return finish(state, next, events, seat)
    }

    switch (action.t) {
        case 'move': {
            events.push(movePiece(next, action.piece, action.to))
            next.acted.push(action.piece)
            break
        }

        case 'endActions': {
            events.push({ t: 'turnEnded', seat })
            startRecruitPhase(next)
            break
        }

        case 'recruit': {
            const def = CHARACTERS[action.character]
            if (action.cells.length !== def.pieces) {
                throw new Error(
                    `${action.character} pose ${def.pieces} figurine(s), ${action.cells.length} case(s) fournie(s)`,
                )
            }
            next.hands[seat].push(action.character)
            const placed: PieceId[] = []
            action.cells.forEach((cell, slot) => {
                const id = next.pieces.length
                next.pieces.push({ owner: seat, character: action.character, cell, slot })
                next.board[cell] = id
                placed.push(id)
            })
            // La carte prise quitte le marché, et on révèle aussitôt la suivante.
            next.market.splice(next.market.indexOf(action.character), 1)
            refillMarket(next)
            events.push({ t: 'recruited', seat, character: action.character, pieces: placed })

            next.recruitsLeft -= 1
            if (next.recruitsLeft <= 0) endTurn(next)
            else if (!mustRecruit(next, seat)) endTurn(next)
            break
        }

        case 'skipRecruit': {
            // Aucun placement possible : le tour passe, le droit de recruter
            // n'est pas perdu puisqu'il sera réévalué au tour suivant.
            endTurn(next)
            break
        }

        case 'banish': {
            next.banned.push(action.character)
            next.market.splice(next.market.indexOf(action.character), 1)
            events.push({ t: 'banished', seat, character: action.character })
            break
        }

        default:
            throw new Error(`action non gérée : ${(action as Action).t}`)
    }

    return finish(state, next, events, seat)
}

/**
 * Clôture commune : la fin de partie est vérifiée après CHAQUE action et après
 * CHAQUE recrutement, puisque poser une figurine recrutée peut déclencher une
 * capture.
 */
function finish(
    before: GameState,
    next: GameState,
    events: GameEvent[],
    seat: Seat,
): ApplyResult {
    const loser = loserAfter(next, seat)
    if (loser !== null) {
        next.winner = other(loser)
        next.phase = 'over'
        events.push({ t: 'captured', loser, by: 'capture' })
    }
    next.seq = before.seq + 1
    return { state: next, events }
}
