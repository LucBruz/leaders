// Grille hexagonale en coordonnées axiales (q, r), orientation « pointy-top ».
// La troisième coordonnée cubique se déduit toujours : s = -q - r.
//
// Le plateau de Leaders est un hexagone régulier de 4 cases par arête, soit un
// rayon de 3 : toutes les cases telles que max(|q|, |r|, |s|) <= 3.
// Cela donne 3·R² + 3·R + 1 = 37 cases et une rangée centrale de 2·R + 1 = 7.
//
// Le rayon est volontairement une constante paramétrable : toute la géométrie en
// découle, rien n'est codé en dur pour 37 cases.

export const BOARD_RADIUS = 3

export interface Axial {
    q: number
    r: number
}

/** Index d'une case du plateau. `OFF_BOARD` désigne l'extérieur. */
export type CellId = number
export const OFF_BOARD: CellId = -1

/** Les 6 directions de la grille, dans le sens horaire. */
export const DIRECTIONS: readonly Axial[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
] as const

export type Direction = 0 | 1 | 2 | 3 | 4 | 5
export const ALL_DIRECTIONS: readonly Direction[] = [0, 1, 2, 3, 4, 5]

/** Direction opposée (rotation d'un demi-tour). */
export function opposite(dir: Direction): Direction {
    return ((dir + 3) % 6) as Direction
}

// ─── Construction du plateau ──────────────────────────────────────────────────
// L'ordre des cases fait partie de l'état sérialisé : il doit rester stable.
// On balaie q croissant, puis r croissant.

function buildCells(radius: number): Axial[] {
    const cells: Axial[] = []
    for (let q = -radius; q <= radius; q++) {
        const rMin = Math.max(-radius, -q - radius)
        const rMax = Math.min(radius, -q + radius)
        for (let r = rMin; r <= rMax; r++) cells.push({ q, r })
    }
    return cells
}

export const CELLS: readonly Axial[] = buildCells(BOARD_RADIUS)
export const CELL_COUNT = CELLS.length

const INDEX_BY_KEY = new Map<string, CellId>()
CELLS.forEach((c, i) => INDEX_BY_KEY.set(`${c.q},${c.r}`, i))

/** Index de la case en (q, r), ou `OFF_BOARD` si hors plateau. */
export function cellAt(q: number, r: number): CellId {
    return INDEX_BY_KEY.get(`${q},${r}`) ?? OFF_BOARD
}

export function axialOf(cell: CellId): Axial {
    return CELLS[cell]!
}

export function onBoard(cell: CellId): boolean {
    return cell >= 0 && cell < CELL_COUNT
}

// ─── Tables précalculées ──────────────────────────────────────────────────────
// Le moteur est appelé en boucle serrée (énumération des coups légaux, et plus
// tard une IA) : on paie la géométrie une fois au chargement du module.

/** `STEP[cell][dir]` → case voisine dans cette direction, ou `OFF_BOARD`. */
export const STEP: readonly (readonly CellId[])[] = CELLS.map(({ q, r }) =>
    DIRECTIONS.map((d) => cellAt(q + d.q, r + d.r)),
)

/** Voisins existants d'une case, sans ordre garanti de direction. */
export const NEIGHBORS: readonly (readonly CellId[])[] = STEP.map((row) =>
    row.filter(onBoard),
)

/** `RAYS[cell][dir]` → toutes les cases en ligne droite, de la plus proche à la plus lointaine. */
export const RAYS: readonly (readonly (readonly CellId[])[])[] = CELLS.map((_, cell) =>
    ALL_DIRECTIONS.map((dir) => {
        const ray: CellId[] = []
        let cur = STEP[cell]![dir]!
        while (onBoard(cur)) {
            ray.push(cur)
            cur = STEP[cur]![dir]!
        }
        return ray
    }),
)

export function step(cell: CellId, dir: Direction): CellId {
    return STEP[cell]![dir]!
}

/** Distance hexagonale entre deux cases. */
export function distance(a: CellId, b: CellId): number {
    const x = axialOf(a)
    const y = axialOf(b)
    return (Math.abs(x.q - y.q) + Math.abs(x.r - y.r) + Math.abs(x.q + x.r - y.q - y.r)) / 2
}

/**
 * Direction de `from` vers `to` s'ils sont alignés, sinon `null`.
 * « Aligné » est la notion de « même ligne » de la règle.
 */
export function directionTo(from: CellId, to: CellId): Direction | null {
    if (from === to) return null
    for (const dir of ALL_DIRECTIONS) {
        if (RAYS[from]![dir]!.includes(to)) return dir
    }
    return null
}

/**
 * Cases strictement comprises entre deux cases alignées.
 * Renvoie `null` si elles ne sont pas sur une même ligne.
 */
export function between(from: CellId, to: CellId): CellId[] | null {
    const dir = directionTo(from, to)
    if (dir === null) return null
    const ray = RAYS[from]![dir]!
    return ray.slice(0, ray.indexOf(to))
}

/**
 * Les trois cases « opposées » à `from` vue depuis une case adjacente, utilisées
 * par la poussée du Cogneur : celles du côté opposé à l'assaillant.
 * `dir` est la direction de l'assaillant vers la cible.
 */
export function pushTargets(target: CellId, dir: Direction): CellId[] {
    const spread: Direction[] = [
        ((dir + 5) % 6) as Direction,
        dir,
        ((dir + 1) % 6) as Direction,
    ]
    return spread.map((d) => step(target, d)).filter(onBoard)
}

// ─── Rendu ────────────────────────────────────────────────────────────────────

/** Centre d'une case en pixels, pour le SVG. Partagé entre moteur et vue. */
export function toPixel(cell: CellId, size: number): { x: number; y: number } {
    const { q, r } = axialOf(cell)
    return {
        x: size * Math.sqrt(3) * (q + r / 2),
        y: size * 1.5 * r,
    }
}
