// Les compétences actives, et les deux passives qui les contraignent.
//
// Chaque compétence expose deux choses : l'énumération de ses actions légales,
// et leur résolution. Une action est toujours entièrement spécifiée — tous les
// choix du joueur y figurent — et sa résolution est atomique. C'est ce qui rend
// la règle du Geôlier correcte par construction : il ne peut pas interrompre une
// compétence en cours, puisqu'une compétence n'est jamais découpée.
//
// Le plan prévoyait un fichier par compétence. Elles tiennent chacune en une
// dizaine de lignes et partagent les mêmes aides ; les éclater en neuf fichiers
// aurait coûté plus en navigation qu'il n'aurait rapporté en isolation.

import {
    ALL_DIRECTIONS,
    NEIGHBORS,
    RAYS,
    type CellId,
    type Direction,
    directionTo,
    distance,
    onBoard,
    pushTargets,
    step,
} from './board'
import { CHARACTERS, type CharacterId } from './characters'
import { movePiece } from './mutate'
import type { GameEvent, GameState, PieceId, Seat, SkillAction } from './types'
import { other } from './types'

// ─── Aides partagées ──────────────────────────────────────────────────────────

const owner = (s: GameState, p: PieceId): Seat => s.pieces[p]!.owner
const cellOf = (s: GameState, p: PieceId): CellId => s.pieces[p]!.cell
const free = (s: GameState, c: CellId): boolean => onBoard(c) && s.board[c] === null

/**
 * Personnages « visibles » au sens de la règle : sur la même ligne, sans aucun
 * autre Personnage entre les deux. Inclut les Leaders, alliés comme ennemis.
 */
function visibleFrom(state: GameState, from: CellId): { piece: PieceId; dir: Direction }[] {
    const out: { piece: PieceId; dir: Direction }[] = []
    for (const dir of ALL_DIRECTIONS) {
        for (const cell of RAYS[from]![dir]!) {
            const occupant = state.board[cell]
            if (occupant !== null) {
                out.push({ piece: occupant, dir })
                break // Le premier rencontré masque tous les suivants.
            }
        }
    }
    return out
}

/**
 * Le Protecteur empêche les compétences ENNEMIES de déplacer lui-même ou ses
 * alliés adjacents. Les compétences de son propre camp ne sont pas concernées.
 */
export function isProtectedFrom(state: GameState, target: PieceId, mover: Seat): boolean {
    const victim = state.pieces[target]!
    if (victim.owner === mover) return false

    for (let id = 0; id < state.pieces.length; id++) {
        const guard = state.pieces[id]!
        if (guard.character !== 'protecteur') continue
        if (guard.owner !== victim.owner) continue
        if (id === target) return true
        if (NEIGHBORS[guard.cell]!.includes(victim.cell)) return true
    }
    return false
}

/**
 * Le Geôlier empêche les ennemis qui lui sont adjacents d'utiliser leur
 * compétence active. Contrôle fait à l'énumération, donc avant que la
 * compétence ne commence : conforme à la précision de la règle selon laquelle
 * il n'interrompt jamais une compétence déjà engagée.
 */
export function silencedByJailer(state: GameState, piece: PieceId): boolean {
    const me = state.pieces[piece]!
    for (const neighbour of NEIGHBORS[me.cell]!) {
        const id = state.board[neighbour]
        if (id === null) continue
        const other = state.pieces[id]!
        if (other.owner !== me.owner && other.character === 'geolier') return true
    }
    return false
}

// ─── Compétences ──────────────────────────────────────────────────────────────

export interface Ability {
    actions(state: GameState, piece: PieceId): SkillAction[]
    resolve(state: GameState, action: SkillAction): GameEvent[]
}

/** Acrobate — saute par-dessus un Personnage adjacent, une ou deux fois. */
const acrobate: Ability = {
    actions(state, piece) {
        const start = cellOf(state, piece)
        // La case de départ est traitée comme vide dès le premier saut : la
        // figurine l'a quittée. Sans cela, l'Acrobate pourrait sauter
        // par-dessus lui-même lors de son second saut, et ne pourrait pas y
        // revenir.
        const occupied = (c: CellId) => onBoard(c) && state.board[c] !== null && c !== start
        const vacant = (c: CellId) => onBoard(c) && (state.board[c] === null || c === start)

        const hops = (from: CellId): CellId[] => {
            const landings: CellId[] = []
            for (const dir of ALL_DIRECTIONS) {
                const over = step(from, dir)
                if (!occupied(over)) continue
                const land = step(over, dir)
                if (vacant(land) && land !== from) landings.push(land)
            }
            return landings
        }

        const out: SkillAction[] = []
        for (const first of hops(start)) {
            out.push({ t: 'acrobate', piece, jumps: [first] })
            for (const second of hops(first)) {
                out.push({ t: 'acrobate', piece, jumps: [first, second] })
            }
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'acrobate' }>
        const events: GameEvent[] = []
        for (const land of a.jumps) events.push(movePiece(state, a.piece, land))
        return events
    },
}

/** Cavalier — exactement deux cases en ligne droite, sans franchir d'obstacle. */
const cavalier: Ability = {
    actions(state, piece) {
        const from = cellOf(state, piece)
        const out: SkillAction[] = []
        for (const dir of ALL_DIRECTIONS) {
            const mid = step(from, dir)
            const to = onBoard(mid) ? step(mid, dir) : -1
            if (free(state, mid) && free(state, to)) out.push({ t: 'cavalier', piece, to })
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'cavalier' }>
        return [movePiece(state, a.piece, a.to)]
    },
}

/** Cogneur — prend la case d'un ennemi adjacent et le pousse derrière. */
const cogneur: Ability = {
    actions(state, piece) {
        const me = state.pieces[piece]!
        const out: SkillAction[] = []
        for (const dir of ALL_DIRECTIONS) {
            const targetCell = step(me.cell, dir)
            if (!onBoard(targetCell)) continue
            const target = state.board[targetCell]
            if (target === null || state.pieces[target]!.owner === me.owner) continue
            if (isProtectedFrom(state, target, me.owner)) continue
            for (const push of pushTargets(targetCell, dir)) {
                if (state.board[push] === null) out.push({ t: 'cogneur', piece, target, push })
            }
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'cogneur' }>
        const targetCell = cellOf(state, a.target)
        // L'ennemi dégage d'abord, le Cogneur prend sa place ensuite.
        const pushed = movePiece(state, a.target, a.push)
        const moved = movePiece(state, a.piece, targetCell)
        return [pushed, moved]
    },
}

/** Garde Royal — rejoint son Leader depuis n'importe où, puis un pas optionnel. */
const gardeRoyal: Ability = {
    actions(state, piece) {
        const seat = owner(state, piece)
        const leader = state.pieces.findIndex((p) => p.owner === seat && p.character === 'leader')
        if (leader < 0) return []
        const from = cellOf(state, piece)
        const out: SkillAction[] = []
        for (const to of NEIGHBORS[cellOf(state, leader)]!) {
            if (to !== from && state.board[to] !== null) continue
            out.push({ t: 'gardeRoyal', piece, to, then: null })
            for (const then of NEIGHBORS[to]!) {
                // La case de départ redevient libre une fois la figurine partie.
                if (state.board[then] === null || then === from) {
                    if (then !== to) out.push({ t: 'gardeRoyal', piece, to, then })
                }
            }
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'gardeRoyal' }>
        const events = [movePiece(state, a.piece, a.to)]
        if (a.then !== null) events.push(movePiece(state, a.piece, a.then))
        return events
    },
}

/** Illusionniste — échange sa place avec un Personnage visible non-adjacent. */
const illusionniste: Ability = {
    actions(state, piece) {
        const me = state.pieces[piece]!
        const out: SkillAction[] = []
        for (const { piece: target } of visibleFrom(state, me.cell)) {
            if (distance(me.cell, cellOf(state, target)) < 2) continue
            if (isProtectedFrom(state, target, me.owner)) continue
            out.push({ t: 'illusionniste', piece, target })
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'illusionniste' }>
        const mine = cellOf(state, a.piece)
        const theirs = cellOf(state, a.target)
        // Échange simultané, écrit à la main : enchaîner deux movePiece ne
        // marche pas ici, le second libérerait la case que le premier vient
        // d'occuper.
        state.pieces[a.piece]!.cell = theirs
        state.pieces[a.target]!.cell = mine
        state.board[theirs] = a.piece
        state.board[mine] = a.target
        return [
            { t: 'moved', piece: a.piece, from: mine, to: theirs },
            { t: 'moved', piece: a.target, from: theirs, to: mine },
        ]
    },
}

/** Lance-Grappin — va jusqu'à un Personnage visible, ou l'attire jusqu'à lui. */
const lanceGrappin: Ability = {
    actions(state, piece) {
        const me = state.pieces[piece]!
        const out: SkillAction[] = []
        for (const { piece: target, dir } of visibleFrom(state, me.cell)) {
            const targetCell = cellOf(state, target)
            if (distance(me.cell, targetCell) < 2) continue
            // Aller : se poser juste avant la cible.
            out.push({ t: 'lanceGrappin', piece, target, mode: 'go' })
            // Attirer : amener la cible juste devant soi.
            if (!isProtectedFrom(state, target, me.owner)) {
                out.push({ t: 'lanceGrappin', piece, target, mode: 'pull' })
            }
            void dir
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'lanceGrappin' }>
        const from = cellOf(state, a.piece)
        const targetCell = cellOf(state, a.target)
        // Le rayon ne s'arrête pas à la cible : il continue jusqu'au bord du
        // plateau. La case d'arrivée est celle qui précède immédiatement le
        // point d'ancrage, pas la dernière du rayon.
        const stopBefore = (ray: readonly CellId[], anchor: CellId) => ray[ray.indexOf(anchor) - 1]!

        if (a.mode === 'go') {
            const dir = directionTo(from, targetCell)!
            return [movePiece(state, a.piece, stopBefore(RAYS[from]![dir]!, targetCell))]
        }
        const back = directionTo(targetCell, from)!
        return [movePiece(state, a.target, stopBefore(RAYS[targetCell]![back]!, from))]
    },
}

/** Manipulatrice — pousse d'une case un ennemi visible et non-adjacent. */
const manipulatrice: Ability = {
    actions(state, piece) {
        const me = state.pieces[piece]!
        const out: SkillAction[] = []
        for (const { piece: target } of visibleFrom(state, me.cell)) {
            const victim = state.pieces[target]!
            if (victim.owner === me.owner) continue
            if (distance(me.cell, victim.cell) < 2) continue
            if (isProtectedFrom(state, target, me.owner)) continue
            for (const to of NEIGHBORS[victim.cell]!) {
                if (state.board[to] === null) out.push({ t: 'manipulatrice', piece, target, to })
            }
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'manipulatrice' }>
        return [movePiece(state, a.target, a.to)]
    },
}

/** Rôdeuse — n'importe quelle case libre qui ne touche aucun ennemi. */
const rodeuse: Ability = {
    actions(state, piece) {
        const me = state.pieces[piece]!
        const out: SkillAction[] = []
        for (let cell = 0; cell < state.board.length; cell++) {
            if (state.board[cell] !== null) continue
            const touchesEnemy = NEIGHBORS[cell]!.some((n) => {
                const id = state.board[n]
                return id !== null && state.pieces[id]!.owner !== me.owner
            })
            if (!touchesEnemy) out.push({ t: 'rodeuse', piece, to: cell })
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'rodeuse' }>
        return [movePiece(state, a.piece, a.to)]
    },
}

/** Tavernier — déplace d'une case un allié adjacent. */
const tavernier: Ability = {
    actions(state, piece) {
        const me = state.pieces[piece]!
        const out: SkillAction[] = []
        for (const cell of NEIGHBORS[me.cell]!) {
            const target = state.board[cell]
            if (target === null || state.pieces[target]!.owner !== me.owner) continue
            if (target === piece) continue
            for (const to of NEIGHBORS[cell]!) {
                if (state.board[to] === null) out.push({ t: 'tavernier', piece, target, to })
            }
        }
        return out
    },
    resolve(state, action) {
        const a = action as Extract<SkillAction, { t: 'tavernier' }>
        return [movePiece(state, a.target, a.to)]
    },
}

export const ABILITIES: Partial<Record<CharacterId, Ability>> = {
    acrobate,
    cavalier,
    cogneur,
    gardeRoyal,
    illusionniste,
    lanceGrappin,
    manipulatrice,
    rodeuse,
    tavernier,
}

/** Actions de compétence disponibles pour une figurine, Geôlier pris en compte. */
export function skillActions(state: GameState, piece: PieceId): SkillAction[] {
    const character = state.pieces[piece]!.character
    if (CHARACTERS[character].skill !== 'active') return []
    const ability = ABILITIES[character]
    if (!ability) return []
    if (silencedByJailer(state, piece)) return []
    return ability.actions(state, piece)
}

export function resolveSkill(state: GameState, action: SkillAction): GameEvent[] {
    const ability = ABILITIES[state.pieces[action.piece]!.character]
    if (!ability) throw new Error(`compétence inconnue : ${action.t}`)
    return ability.resolve(state, action)
}
