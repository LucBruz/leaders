import { describe, expect, it } from 'vitest'
import { cellAt, distance } from '../board'
import { apply } from '../apply'
import { skillActions } from '../abilities'
import { legalActions } from '../legal'
import type { Action, GameState, PieceId, SkillAction } from '../types'
import { addPiece, duel } from './fixtures'

const at = (q: number, r: number) => cellAt(q, r)

/** Position de travail : les Leaders loin du centre, hors de portée. */
function board(): GameState {
    const s = duel([2, 1], [-2, -1])
    s.turn = 0
    return s
}

const cellOf = (s: GameState, p: PieceId) => s.pieces[p]!.cell
const kinds = (acts: SkillAction[]) => acts.map((a) => a.t)
const only = (acts: Action[], t: string) => acts.filter((a) => a.t === t)

describe('Acrobate', () => {
    it('saute en ligne droite par-dessus un Personnage adjacent', () => {
        const s = board()
        const acro = addPiece(s, 0, 'acrobate', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        const acts = skillActions(s, acro) as Extract<SkillAction, { t: 'acrobate' }>[]
        const simples = acts.filter((a) => a.jumps.length === 1)
        expect(simples).toHaveLength(1)
        expect(simples[0]!.jumps[0]).toBe(at(2, 0))
    })

    it('ne saute pas sans Personnage adjacent', () => {
        const s = board()
        const acro = addPiece(s, 0, 'acrobate', 0, 0)
        expect(skillActions(s, acro)).toHaveLength(0)
    })

    it('ne saute pas si la case d’arrivée est occupée', () => {
        const s = board()
        const acro = addPiece(s, 0, 'acrobate', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        addPiece(s, 1, 'cogneur', 2, 0)
        expect(skillActions(s, acro)).toHaveLength(0)
    })

    it('enchaîne jusqu’à deux sauts', () => {
        const s = board()
        const acro = addPiece(s, 0, 'acrobate', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        addPiece(s, 1, 'cogneur', 3, 0)
        const acts = skillActions(s, acro) as Extract<SkillAction, { t: 'acrobate' }>[]
        const doubles = acts.filter((a) => a.jumps.length === 2)
        expect(doubles).toHaveLength(1)
        expect(doubles[0]!.jumps).toEqual([at(2, 0), at(0, 0)])

        const after = apply(s, doubles[0]!).state
        // Il est reparti puis revenu sur sa case de départ : légal, elle est vide.
        expect(cellOf(after, acro)).toBe(at(0, 0))
    })

    it('ne saute jamais par-dessus la case qu’il vient de quitter', () => {
        const s = board()
        const acro = addPiece(s, 0, 'acrobate', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        const acts = skillActions(s, acro) as Extract<SkillAction, { t: 'acrobate' }>[]
        // Depuis (2,0), un saut par-dessus (0,0) supposerait qu'il s'y trouve
        // encore, ce qui n'est plus le cas.
        for (const a of acts.filter((x) => x.jumps.length === 2)) {
            expect(a.jumps[1]).not.toBe(at(-2, 0))
        }
    })
})

describe('Cavalier', () => {
    it('se déplace d’exactement deux cases en ligne droite', () => {
        const s = board()
        const cav = addPiece(s, 0, 'cavalier', 0, 0)
        const acts = skillActions(s, cav) as Extract<SkillAction, { t: 'cavalier' }>[]
        expect(acts).toHaveLength(6)
        for (const a of acts) expect(distance(at(0, 0), a.to)).toBe(2)
    })

    it('est bloqué par une figurine sur la case intermédiaire', () => {
        const s = board()
        const cav = addPiece(s, 0, 'cavalier', 0, 0)
        addPiece(s, 1, 'cogneur', 1, 0)
        const acts = skillActions(s, cav) as Extract<SkillAction, { t: 'cavalier' }>[]
        expect(acts.some((a) => a.to === at(2, 0))).toBe(false)
        expect(acts).toHaveLength(5)
    })
})

describe('Cogneur', () => {
    it('prend la case d’un ennemi adjacent et le pousse derrière', () => {
        const s = board()
        const cog = addPiece(s, 0, 'cogneur', 0, 0)
        const cible = addPiece(s, 1, 'cavalier', 1, 0)
        const acts = skillActions(s, cog) as Extract<SkillAction, { t: 'cogneur' }>[]
        expect(acts).toHaveLength(3) // les trois cases opposées
        const after = apply(s, acts[0]!).state
        expect(cellOf(after, cog)).toBe(at(1, 0))
        expect(cellOf(after, cible)).toBe(acts[0]!.push)
        expect(after.board[at(0, 0)]).toBeNull()
    })

    it('ne pousse pas un allié', () => {
        const s = board()
        const cog = addPiece(s, 0, 'cogneur', 0, 0)
        addPiece(s, 0, 'cavalier', 1, 0)
        expect(skillActions(s, cog)).toHaveLength(0)
    })

    it('ne pousse pas vers une case occupée', () => {
        const s = board()
        const cog = addPiece(s, 0, 'cogneur', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        addPiece(s, 1, 'rodeuse', 2, 0)
        addPiece(s, 1, 'archere', 2, -1)
        const acts = skillActions(s, cog) as Extract<SkillAction, { t: 'cogneur' }>[]
        expect(acts).toHaveLength(1)
        expect(acts[0]!.push).toBe(at(1, 1))
    })
})

describe('Garde Royal', () => {
    it('rejoint son Leader depuis n’importe quelle case', () => {
        const s = board()
        const garde = addPiece(s, 0, 'gardeRoyal', 0, -1)
        const acts = skillActions(s, garde) as Extract<SkillAction, { t: 'gardeRoyal' }>[]
        const leaderCell = at(2, 1)
        for (const a of acts) expect(distance(a.to, leaderCell)).toBe(1)
        expect(acts.some((a) => a.then === null)).toBe(true)
        expect(acts.some((a) => a.then !== null)).toBe(true)
    })

    it('applique le pas supplémentaire quand il est demandé', () => {
        const s = board()
        const garde = addPiece(s, 0, 'gardeRoyal', 0, -1)
        const acts = skillActions(s, garde) as Extract<SkillAction, { t: 'gardeRoyal' }>[]
        const avecPas = acts.find((a) => a.then !== null)!
        const after = apply(s, avecPas).state
        expect(cellOf(after, garde)).toBe(avecPas.then)
    })
})

describe('Illusionniste', () => {
    it('échange sa position avec un Personnage visible et non-adjacent', () => {
        const s = board()
        const illu = addPiece(s, 0, 'illusionniste', 0, 0)
        const cible = addPiece(s, 1, 'cavalier', 3, 0)
        const acts = skillActions(s, illu) as Extract<SkillAction, { t: 'illusionniste' }>[]
        expect(acts.some((a) => a.target === cible)).toBe(true)

        const after = apply(s, acts.find((a) => a.target === cible)!).state
        expect(cellOf(after, illu)).toBe(at(3, 0))
        expect(cellOf(after, cible)).toBe(at(0, 0))
        // Les deux cases restent occupées : l'échange ne doit rien effacer.
        expect(after.board[at(0, 0)]).toBe(cible)
        expect(after.board[at(3, 0)]).toBe(illu)
    })

    it('refuse une cible adjacente', () => {
        const s = board()
        const illu = addPiece(s, 0, 'illusionniste', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        expect(skillActions(s, illu)).toHaveLength(0)
    })

    it('refuse une cible masquée par une autre figurine', () => {
        const s = board()
        const illu = addPiece(s, 0, 'illusionniste', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        const cachee = addPiece(s, 1, 'rodeuse', 3, 0)
        const acts = skillActions(s, illu) as Extract<SkillAction, { t: 'illusionniste' }>[]
        expect(acts.some((a) => a.target === cachee)).toBe(false)
    })
})

describe('Lance-Grappin', () => {
    it('se déplace jusqu’à la cible sans la dépasser', () => {
        const s = board()
        const grap = addPiece(s, 0, 'lanceGrappin', 0, 0)
        const cible = addPiece(s, 1, 'cavalier', 3, 0)
        const aller = (skillActions(s, grap) as Extract<SkillAction, { t: 'lanceGrappin' }>[])
            .find((a) => a.target === cible && a.mode === 'go')!
        const after = apply(s, aller).state
        expect(cellOf(after, grap)).toBe(at(2, 0))
        expect(cellOf(after, cible)).toBe(at(3, 0))
    })

    it('attire la cible jusqu’à lui', () => {
        const s = board()
        const grap = addPiece(s, 0, 'lanceGrappin', 0, 0)
        const cible = addPiece(s, 1, 'cavalier', 3, 0)
        const tirer = (skillActions(s, grap) as Extract<SkillAction, { t: 'lanceGrappin' }>[])
            .find((a) => a.target === cible && a.mode === 'pull')!
        const after = apply(s, tirer).state
        expect(cellOf(after, cible)).toBe(at(1, 0))
        expect(cellOf(after, grap)).toBe(at(0, 0))
    })

    it('accroche aussi un allié', () => {
        const s = board()
        const grap = addPiece(s, 0, 'lanceGrappin', 0, 0)
        const ami = addPiece(s, 0, 'cavalier', 3, 0)
        const acts = skillActions(s, grap) as Extract<SkillAction, { t: 'lanceGrappin' }>[]
        expect(acts.filter((a) => a.target === ami)).toHaveLength(2)
    })
})

describe('Manipulatrice', () => {
    it('déplace d’une case un ennemi visible et non-adjacent', () => {
        const s = board()
        const mani = addPiece(s, 0, 'manipulatrice', 0, 0)
        const cible = addPiece(s, 1, 'cavalier', 3, 0)
        const acts = skillActions(s, mani) as Extract<SkillAction, { t: 'manipulatrice' }>[]
        expect(acts.length).toBeGreaterThan(0)
        for (const a of acts) expect(distance(a.to, at(3, 0))).toBe(1)

        const after = apply(s, acts[0]!).state
        expect(cellOf(after, cible)).toBe(acts[0]!.to)
        expect(cellOf(after, mani)).toBe(at(0, 0)) // elle ne bouge pas
    })

    it('ne manipule pas un allié', () => {
        const s = board()
        const mani = addPiece(s, 0, 'manipulatrice', 0, 0)
        addPiece(s, 0, 'cavalier', 3, 0)
        expect(skillActions(s, mani)).toHaveLength(0)
    })
})

describe('Rôdeuse', () => {
    it('va sur n’importe quelle case libre qui ne touche aucun ennemi', () => {
        const s = board()
        const rod = addPiece(s, 0, 'rodeuse', 0, 0)
        const acts = skillActions(s, rod) as Extract<SkillAction, { t: 'rodeuse' }>[]
        // Le Leader adverse interdit ses six cases voisines.
        for (const a of acts) expect(distance(a.to, at(-2, -1))).toBeGreaterThan(1)
        expect(acts.length).toBeGreaterThan(15)
    })

    it('ignore les cases adjacentes à un ennemi', () => {
        const s = board()
        const rod = addPiece(s, 0, 'rodeuse', 0, 0)
        addPiece(s, 1, 'cavalier', 2, 0)
        const acts = skillActions(s, rod) as Extract<SkillAction, { t: 'rodeuse' }>[]
        expect(acts.some((a) => a.to === at(1, 0))).toBe(false)
        expect(acts.some((a) => a.to === at(3, 0))).toBe(false)
    })
})

describe('Tavernier', () => {
    it('déplace d’une case un allié adjacent', () => {
        const s = board()
        const tav = addPiece(s, 0, 'tavernier', 0, 0)
        const ami = addPiece(s, 0, 'cavalier', 1, 0)
        const acts = skillActions(s, tav) as Extract<SkillAction, { t: 'tavernier' }>[]
        expect(acts.length).toBeGreaterThan(0)
        for (const a of acts) expect(a.target).toBe(ami)

        const after = apply(s, acts[0]!).state
        expect(cellOf(after, ami)).toBe(acts[0]!.to)
        expect(cellOf(after, tav)).toBe(at(0, 0))
    })

    it('ne déplace pas un ennemi adjacent', () => {
        const s = board()
        const tav = addPiece(s, 0, 'tavernier', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        expect(skillActions(s, tav)).toHaveLength(0)
    })
})

describe('Geôlier', () => {
    it('prive un ennemi adjacent de sa compétence active', () => {
        const s = board()
        const cav = addPiece(s, 0, 'cavalier', 0, 0)
        expect(skillActions(s, cav).length).toBeGreaterThan(0)

        addPiece(s, 1, 'geolier', 1, 0)
        expect(skillActions(s, cav)).toHaveLength(0)
    })

    it('laisse l’ennemi se déplacer normalement', () => {
        const s = board()
        const cav = addPiece(s, 0, 'cavalier', 0, 0)
        addPiece(s, 1, 'geolier', 1, 0)
        const moves = only(legalActions(s), 'move').filter(
            (a) => (a as Action & { piece: number }).piece === cav,
        )
        expect(moves.length).toBeGreaterThan(0)
    })

    it('ne gêne pas un allié', () => {
        const s = board()
        const cav = addPiece(s, 0, 'cavalier', 0, 0)
        addPiece(s, 0, 'geolier', 1, 0)
        expect(skillActions(s, cav).length).toBeGreaterThan(0)
    })

    it('n’interrompt pas un saut d’Acrobate déjà engagé', () => {
        const s = board()
        const acro = addPiece(s, 0, 'acrobate', 0, 0)
        addPiece(s, 1, 'cavalier', 1, 0)
        addPiece(s, 1, 'cogneur', 3, 0)
        // Le Geôlier est posé là où l'Acrobate atterrit entre ses deux sauts.
        addPiece(s, 1, 'geolier', 2, -1)
        const acts = skillActions(s, acro) as Extract<SkillAction, { t: 'acrobate' }>[]
        expect(acts.some((a) => a.jumps.length === 2)).toBe(true)
    })
})

describe('Protecteur', () => {
    it('empêche une compétence ennemie de le déplacer', () => {
        const s = board()
        const mani = addPiece(s, 0, 'manipulatrice', 0, 0)
        addPiece(s, 1, 'protecteur', 3, 0)
        expect(skillActions(s, mani)).toHaveLength(0)
    })

    it('protège aussi ses alliés adjacents', () => {
        const s = board()
        const mani = addPiece(s, 0, 'manipulatrice', 0, 0)
        addPiece(s, 1, 'cavalier', 3, 0)
        addPiece(s, 1, 'protecteur', 3, -1) // adjacent à la cible
        expect(skillActions(s, mani)).toHaveLength(0)
    })

    it('ne protège pas un allié éloigné', () => {
        const s = board()
        const mani = addPiece(s, 0, 'manipulatrice', 0, 0)
        addPiece(s, 1, 'cavalier', 3, 0)
        addPiece(s, 1, 'protecteur', -3, 0)
        expect(skillActions(s, mani).length).toBeGreaterThan(0)
    })

    it('bloque aussi la poussée du Cogneur', () => {
        const s = board()
        const cog = addPiece(s, 0, 'cogneur', 0, 0)
        addPiece(s, 1, 'protecteur', 1, 0)
        expect(skillActions(s, cog)).toHaveLength(0)
    })

    it('ne gêne pas les compétences de son propre camp', () => {
        const s = board()
        const tav = addPiece(s, 0, 'tavernier', 0, 0)
        addPiece(s, 0, 'protecteur', 1, 0)
        expect(skillActions(s, tav).length).toBeGreaterThan(0)
    })
})

describe('intégration avec la phase d’Actions', () => {
    it('propose déplacement ET compétence pour une même figurine', () => {
        const s = board()
        const cav = addPiece(s, 0, 'cavalier', 0, 0)
        const acts = legalActions(s)
        expect(only(acts, 'move').some((a) => (a as { piece: number }).piece === cav)).toBe(true)
        expect(only(acts, 'cavalier')).toHaveLength(6)
    })

    it('consomme l’action de la figurine après usage de sa compétence', () => {
        const s = board()
        const cav = addPiece(s, 0, 'cavalier', 0, 0)
        const acte = only(legalActions(s), 'cavalier')[0]!
        const after = apply(s, acte).state
        expect(after.acted).toContain(cav)
        expect(only(legalActions(after), 'cavalier')).toHaveLength(0)
    })

    it('ne laisse pas la Némésis agir pendant la phase d’Actions', () => {
        const s = board()
        const nem = addPiece(s, 0, 'nemesis', 0, 0)
        expect(kinds(skillActions(s, nem))).toEqual([])
        expect(only(legalActions(s), 'move').some((a) => (a as { piece: number }).piece === nem))
            .toBe(false)
    })
})
