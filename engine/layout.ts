// Rôles des cases : où démarrent les Leaders et où l'on pose les recrues.
//
// ⚠ À CONFIRMER sur le plateau physique. La forme et le nombre de cases (37,
// hexagone de 4 cases par arête) sont établis et testés ; en revanche la
// position exacte des cases couronne et des cases de Recrutement dorées n'a pas
// pu être relevée de façon fiable sur les photos disponibles.
//
// Ce fichier isole volontairement cette incertitude : c'est le SEUL endroit à
// corriger le jour où les vraies positions sont connues. Rien d'autre dans le
// moteur ne présume de la disposition.
//
// Hypothèse retenue, cohérente avec les photos et les tests anglophones
// (« placed at the nearest vertex », « draft onto the two board edges nearest
// them ») : chaque Leader démarre sur un sommet, les deux sommets étant
// opposés, et les cases de Recrutement sont les deux arêtes qui aboutissent à
// ce sommet, sommet exclu — soit 6 cases par camp.

import { BOARD_RADIUS, type CellId, cellAt } from './board'
import type { Seat } from './types'

const R = BOARD_RADIUS

/** Case de départ du Leader de chaque siège, marquée d'une couronne. */
export const CROWN: readonly [CellId, CellId] = [cellAt(0, R), cellAt(0, -R)]

function edge(from: { q: number; r: number }, step: { q: number; r: number }): CellId[] {
    const cells: CellId[] = []
    for (let i = 1; i <= R; i++) cells.push(cellAt(from.q + step.q * i, from.r + step.r * i))
    return cells
}

// Depuis le sommet (0, R) : une arête remonte vers (-R, R), l'autre vers (R, 0).
const SEAT_0_RECRUIT = [
    ...edge({ q: 0, r: R }, { q: -1, r: 0 }),
    ...edge({ q: 0, r: R }, { q: 1, r: -1 }),
]
// Depuis le sommet (0, -R) : symétrique par le centre.
const SEAT_1_RECRUIT = [
    ...edge({ q: 0, r: -R }, { q: 1, r: 0 }),
    ...edge({ q: 0, r: -R }, { q: -1, r: 1 }),
]

/**
 * Cases de Recrutement de chaque siège. La case couronne en est exclue : sur
 * les visuels elle porte une gravure distincte des cercles dorés.
 */
export const RECRUIT_CELLS: readonly [readonly CellId[], readonly CellId[]] = [
    SEAT_0_RECRUIT,
    SEAT_1_RECRUIT,
]

export function recruitCells(seat: Seat): readonly CellId[] {
    return RECRUIT_CELLS[seat]
}
