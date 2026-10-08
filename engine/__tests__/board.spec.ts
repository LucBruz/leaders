import { describe, expect, it } from 'vitest'
import {
    ALL_DIRECTIONS,
    BOARD_RADIUS,
    CELL_COUNT,
    CELLS,
    NEIGHBORS,
    RAYS,
    axialOf,
    between,
    cellAt,
    directionTo,
    distance,
    onBoard,
    opposite,
    pushTargets,
    step,
} from '../board'

const CENTER = cellAt(0, 0)
const CORNERS = [
    cellAt(BOARD_RADIUS, 0),
    cellAt(-BOARD_RADIUS, 0),
    cellAt(0, BOARD_RADIUS),
    cellAt(0, -BOARD_RADIUS),
    cellAt(BOARD_RADIUS, -BOARD_RADIUS),
    cellAt(-BOARD_RADIUS, BOARD_RADIUS),
]

describe('forme du plateau', () => {
    it('compte 3·R² + 3·R + 1 cases, soit 37 pour un rayon de 3', () => {
        const R = BOARD_RADIUS
        expect(CELL_COUNT).toBe(3 * R * R + 3 * R + 1)
        expect(CELL_COUNT).toBe(37)
    })

    it('a une rangée centrale de 2·R + 1 cases', () => {
        const centrale = CELLS.filter((c) => c.q === 0)
        expect(centrale).toHaveLength(2 * BOARD_RADIUS + 1)
        expect(centrale).toHaveLength(7)
    })

    it('ne contient que des cases dans le rayon', () => {
        for (const { q, r } of CELLS) {
            expect(Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))).toBeLessThanOrEqual(BOARD_RADIUS)
        }
    })

    it('associe chaque index à des coordonnées uniques, dans les deux sens', () => {
        const vus = new Set<string>()
        for (let i = 0; i < CELL_COUNT; i++) {
            const { q, r } = axialOf(i)
            expect(cellAt(q, r)).toBe(i)
            vus.add(`${q},${r}`)
        }
        expect(vus.size).toBe(CELL_COUNT)
    })
})

describe('adjacence', () => {
    it('donne 6 voisins au centre', () => {
        expect(NEIGHBORS[CENTER]).toHaveLength(6)
    })

    it('donne 3 voisins aux 6 sommets', () => {
        expect(CORNERS).toHaveLength(6)
        for (const coin of CORNERS) {
            expect(onBoard(coin)).toBe(true)
            expect(NEIGHBORS[coin]).toHaveLength(3)
        }
    })

    it('donne 4 voisins aux cases de bord qui ne sont pas des sommets', () => {
        const bord = CELLS
            .map((_, i) => i)
            .filter((i) => NEIGHBORS[i]!.length < 6 && !CORNERS.includes(i))
        expect(bord.length).toBe(12)
        for (const c of bord) expect(NEIGHBORS[c]).toHaveLength(4)
    })

    it('est symétrique : si A voisine B, B voisine A', () => {
        for (let a = 0; a < CELL_COUNT; a++) {
            for (const b of NEIGHBORS[a]!) {
                expect(NEIGHBORS[b]).toContain(a)
            }
        }
    })

    it('fait revenir au point de départ en avançant puis en reculant', () => {
        for (let c = 0; c < CELL_COUNT; c++) {
            for (const dir of ALL_DIRECTIONS) {
                const suivant = step(c, dir)
                if (onBoard(suivant)) expect(step(suivant, opposite(dir))).toBe(c)
            }
        }
    })
})

describe('distance', () => {
    it('vaut 0 pour une case avec elle-même', () => {
        for (let c = 0; c < CELL_COUNT; c++) expect(distance(c, c)).toBe(0)
    })

    it('vaut 1 exactement pour les voisins', () => {
        for (let a = 0; a < CELL_COUNT; a++) {
            for (let b = 0; b < CELL_COUNT; b++) {
                expect(distance(a, b) === 1).toBe(NEIGHBORS[a]!.includes(b))
            }
        }
    })

    it('est symétrique et ne dépasse jamais 2·R', () => {
        for (let a = 0; a < CELL_COUNT; a++) {
            for (let b = 0; b < CELL_COUNT; b++) {
                expect(distance(a, b)).toBe(distance(b, a))
                expect(distance(a, b)).toBeLessThanOrEqual(2 * BOARD_RADIUS)
            }
        }
    })

    it('met le centre à R de chaque sommet', () => {
        for (const coin of CORNERS) expect(distance(CENTER, coin)).toBe(BOARD_RADIUS)
    })
})

describe('lignes droites', () => {
    it('donne 6 rayons de R cases depuis le centre', () => {
        for (const dir of ALL_DIRECTIONS) {
            expect(RAYS[CENTER]![dir]).toHaveLength(BOARD_RADIUS)
        }
    })

    it('reconnaît un alignement et le refuse hors ligne', () => {
        const voisin = step(CENTER, 0)
        expect(directionTo(CENTER, voisin)).toBe(0)
        expect(directionTo(CENTER, CENTER)).toBeNull()

        // (2,-1) est à distance 2 du centre sans être sur aucun de ses 6 rayons.
        const coude = step(step(CENTER, 0), 1)
        expect(directionTo(CENTER, coude)).toBeNull()
    })

    it('énumère les cases strictement comprises entre deux cases alignées', () => {
        const a = CENTER
        const b = RAYS[CENTER]![0]![2]!
        expect(between(a, b)).toEqual([RAYS[CENTER]![0]![0], RAYS[CENTER]![0]![1]])
        expect(between(a, step(a, 0))).toEqual([])
    })

    it('renvoie null entre deux cases non alignées', () => {
        const coude = step(step(CENTER, 0), 1)
        expect(between(CENTER, coude)).toBeNull()
    })

    it('est cohérent dans les deux sens', () => {
        for (let a = 0; a < CELL_COUNT; a++) {
            for (let b = 0; b < CELL_COUNT; b++) {
                if (a === b) continue
                const dir = directionTo(a, b)
                if (dir === null) {
                    expect(directionTo(b, a)).toBeNull()
                } else {
                    expect(directionTo(b, a)).toBe(opposite(dir))
                    expect(between(a, b)!.length).toBe(between(b, a)!.length)
                }
            }
        }
    })
})

describe('poussée du Cogneur', () => {
    it('propose les 3 cases du côté opposé à l’assaillant', () => {
        const cible = step(CENTER, 0)
        const cases = pushTargets(cible, 0)
        expect(cases).toHaveLength(3)
        // Aucune des trois n’est la case de l’assaillant.
        expect(cases).not.toContain(CENTER)
        // Toutes sont plus loin de l’assaillant que la cible ne l’était… ou à égale
        // distance sur les diagonales, mais jamais plus proches.
        for (const c of cases) expect(distance(CENTER, c)).toBeGreaterThanOrEqual(distance(CENTER, cible))
    })

    it('ne propose que les cases du plateau quand la cible est au bord', () => {
        const coin = cellAt(BOARD_RADIUS, 0)
        for (const dir of ALL_DIRECTIONS) {
            for (const c of pushTargets(coin, dir)) expect(onBoard(c)).toBe(true)
        }
    })
})
