import type { CellId } from './board'
import type { CharacterId } from './characters'

/** Les deux joueurs. Le siège 0 joue en premier. */
export type Seat = 0 | 1

export function other(seat: Seat): Seat {
    return (1 - seat) as Seat
}

/** Index d'une figurine dans `GameState.pieces`. */
export type PieceId = number

export interface Piece {
    owner: Seat
    character: CharacterId
    cell: CellId
    /** Rang de la figurine dans sa carte : 0, ou 1 pour l'Ourson. */
    slot: number
}

export type Phase = 'banish' | 'actions' | 'recruit' | 'over'

/**
 * Décision que le moteur doit faire prendre à un joueur avant de pouvoir
 * continuer. Réservé au déplacement forcé de la Némésis, seul cas où la main
 * revient au joueur non actif au milieu du tour adverse.
 */
export interface Pending {
    kind: 'nemesis'
    decider: Seat
    piece: PieceId
}

export interface GameState {
    mode: 'classic' | 'strategist'
    /** Occupation du plateau : `board[cell]` → figurine, ou `null`. */
    board: (PieceId | null)[]
    pieces: Piece[]
    /** Cartes devant chaque joueur, Leader inclus. Les limites se comptent ici. */
    hands: [CharacterId[], CharacterId[]]
    /** Cartes visibles : 3 en mode classique, toutes les disponibles en Stratège. */
    market: CharacterId[]
    deck: CharacterId[]
    banned: CharacterId[]
    turn: Seat
    phase: Phase
    /** Figurines ayant déjà agi pendant la phase d'Actions en cours. */
    acted: PieceId[]
    pending: Pending | null
    /** Recrutements restant à effectuer dans la phase de Recrutement en cours. */
    recruitsLeft: number
    /** Le second joueur recrute deux fois à son premier tour. */
    secondPlayerBonusUsed: boolean
    winner: Seat | null
    /** Numéro de coup, qui sert aussi de clé d'ordonnancement en ligne. */
    seq: number
}

// ─── Actions ──────────────────────────────────────────────────────────────────
// Une action est TOUJOURS entièrement spécifiée : elle contient tous les choix
// du joueur, et `apply` la résout d'un bloc. L'interface se contente de filtrer
// `legalActions` par préfixe au fil des clics. Le moteur n'a donc jamais d'état
// intermédiaire à mi-compétence — ce qui rend la règle du Geôlier correcte par
// construction, puisqu'une compétence n'est jamais découpée.

export type SkillAction =
    | { t: 'acrobate'; piece: PieceId; jumps: CellId[] }
    | { t: 'cavalier'; piece: PieceId; to: CellId }
    | { t: 'cogneur'; piece: PieceId; target: PieceId; push: CellId }
    | { t: 'gardeRoyal'; piece: PieceId; to: CellId; then: CellId | null }
    | { t: 'illusionniste'; piece: PieceId; target: PieceId }
    | { t: 'lanceGrappin'; piece: PieceId; target: PieceId; mode: 'go' | 'pull' }
    | { t: 'manipulatrice'; piece: PieceId; target: PieceId; to: CellId }
    | { t: 'rodeuse'; piece: PieceId; to: CellId }
    | { t: 'tavernier'; piece: PieceId; target: PieceId; to: CellId }

export type Action =
    | { t: 'move'; piece: PieceId; to: CellId }
    | SkillAction
    | { t: 'recruit'; character: CharacterId; cells: CellId[] }
    | { t: 'banish'; character: CharacterId }
    | { t: 'endActions' }
    /**
     * Recrutement sauté faute de placement possible : plus aucune case dorée
     * libre de son côté, ou tous les placements encercleraient son propre
     * Leader. Le recrutement est obligatoire, mais les figurines circulent
     * librement et rien ne garantit qu'une case reste disponible.
     */
    | { t: 'skipRecruit' }
    | { t: 'nemesis'; piece: PieceId; path: CellId[] }

export type ActionType = Action['t']

// ─── Événements ───────────────────────────────────────────────────────────────
// Produits par `apply` pour que l'interface anime ce qui vient de se passer sans
// avoir à comparer deux états.

export type GameEvent =
    | { t: 'moved'; piece: PieceId; from: CellId; to: CellId }
    | { t: 'recruited'; seat: Seat; character: CharacterId; pieces: PieceId[] }
    | { t: 'banished'; seat: Seat; character: CharacterId }
    | { t: 'nemesisTriggered'; piece: PieceId }
    | { t: 'captured'; loser: Seat; by: 'capture' | 'encircle' }
    | { t: 'turnEnded'; seat: Seat }
