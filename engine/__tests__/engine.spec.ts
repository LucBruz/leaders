import { describe, expect, it } from 'vitest'
import { CELL_COUNT, cellAt } from '../board'
import { CHAMPIONS, HAND_LIMIT, MARKET_SIZE } from '../characters'
import { CROWN, recruitCells } from '../layout'
import { apply } from '../apply'
import { legalActions } from '../legal'
import { createGame } from '../setup'
import type { Action, GameState } from '../types'
import { captureContributors, isCaptured, isEncircled, leaderOf } from '../victory'
import { addPiece, duel, fillCells, game } from './fixtures'

// Petit utilitaire : joue la première action d'un type donné.
function play(state: GameState, pick: (a: Action) => boolean): GameState {
    const action = legalActions(state).find(pick)
    if (!action) throw new Error('aucune action correspondante')
    return apply(state, action).state
}

describe('mise en place', () => {
    it('pose les deux Leaders sur leurs cases couronne', () => {
        const s = game()
        expect(s.pieces).toHaveLength(2)
        expect(s.pieces[leaderOf(s, 0)]!.cell).toBe(CROWN[0])
        expect(s.pieces[leaderOf(s, 1)]!.cell).toBe(CROWN[1])
        expect(s.board.filter((x) => x !== null)).toHaveLength(2)
        expect(s.board).toHaveLength(CELL_COUNT)
    })

    it('ne met que le Leader dans chaque main', () => {
        const s = game()
        expect(s.hands[0]).toEqual(['leader'])
        expect(s.hands[1]).toEqual(['leader'])
    })

    it('révèle 3 cartes et garde les 13 autres en pioche', () => {
        const s = game()
        expect(s.market).toHaveLength(MARKET_SIZE)
        expect(s.deck).toHaveLength(CHAMPIONS.length - MARKET_SIZE)
        expect(new Set([...s.market, ...s.deck]).size).toBe(CHAMPIONS.length)
    })

    it('ouvre tout le marché en mode Stratège', () => {
        const s = game(1, 'strategist')
        expect(s.market).toHaveLength(CHAMPIONS.length)
        expect(s.deck).toHaveLength(0)
    })

    it('est déterministe : même graine, même pioche', () => {
        expect(createGame({ seed: 42 }).deck).toEqual(createGame({ seed: 42 }).deck)
        expect(createGame({ seed: 42 }).deck).not.toEqual(createGame({ seed: 43 }).deck)
    })

    it('place les deux zones de Recrutement sans chevauchement', () => {
        const a = new Set(recruitCells(0))
        const b = new Set(recruitCells(1))
        expect([...a].some((c) => b.has(c))).toBe(false)
        // Il faut pouvoir poser jusqu'à 5 figurines : 4 recrues dont le Vieil Ours.
        expect(a.size).toBeGreaterThanOrEqual(5)
        expect(b.size).toBeGreaterThanOrEqual(5)
        expect(a.has(CROWN[0])).toBe(false)
    })
})

describe('phase d’Actions', () => {
    it('permet de déplacer le Leader sur une case adjacente vide', () => {
        const s = game()
        const moves = legalActions(s).filter((a) => a.t === 'move')
        expect(moves.length).toBeGreaterThan(0)
        const after = apply(s, moves[0]!).state
        expect(after.pieces[leaderOf(after, 0)]!.cell).toBe((moves[0] as { to: number }).to)
    })

    it('laisse toujours la possibilité de cesser d’agir', () => {
        const s = game()
        expect(legalActions(s).some((a) => a.t === 'endActions')).toBe(true)
    })

    it('interdit à une figurine d’agir deux fois dans le même tour', () => {
        const s = game()
        const first = legalActions(s).find((a) => a.t === 'move') as Action & { piece: number }
        const after = apply(s, first).state
        expect(after.acted).toContain(first.piece)
        expect(legalActions(after).some((a) => a.t === 'move' && a.piece === first.piece)).toBe(false)
    })

    it('donne une case supplémentaire au Leader quand le Vizir est en jeu', () => {
        const base = duel([0, 0], [0, -3])
        base.turn = 0
        const sansVizir = legalActions(base).filter((a) => a.t === 'move').length

        const avec = duel([0, 0], [0, -3])
        avec.turn = 0
        avec.hands[0].push('vizir')
        addPiece(avec, 0, 'vizir', 3, 0)
        const avecVizir = legalActions(avec).filter(
            (a) => a.t === 'move' && a.piece === leaderOf(avec, 0),
        ).length

        expect(sansVizir).toBe(6)
        expect(avecVizir).toBeGreaterThan(6)
    })
})

describe('phase de Recrutement', () => {
    it('s’enchaîne après la fin des actions', () => {
        const s = play(game(), (a) => a.t === 'endActions')
        expect(s.phase).toBe('recruit')
        expect(s.recruitsLeft).toBe(1)
        expect(legalActions(s).every((a) => a.t === 'recruit')).toBe(true)
    })

    it('ajoute la carte en main, pose la figurine et complète le marché', () => {
        const s = play(game(), (a) => a.t === 'endActions')
        const before = s.market.length
        const after = play(s, (a) => a.t === 'recruit')
        expect(after.hands[0]).toHaveLength(2)
        expect(after.market).toHaveLength(before)
        expect(after.pieces.length).toBeGreaterThan(2)
    })

    it('ne pose les recrues que sur les cases dorées de son propre camp', () => {
        const s = play(game(), (a) => a.t === 'endActions')
        const zone = new Set(recruitCells(0))
        for (const a of legalActions(s)) {
            if (a.t !== 'recruit') continue
            for (const c of a.cells) expect(zone.has(c)).toBe(true)
        }
    })

    it('fait recruter deux fois le second joueur à son premier tour', () => {
        let s = play(game(), (a) => a.t === 'endActions')
        s = play(s, (a) => a.t === 'recruit')
        expect(s.turn).toBe(1)

        s = play(s, (a) => a.t === 'endActions')
        expect(s.recruitsLeft).toBe(2)
        expect(s.secondPlayerBonusUsed).toBe(true)

        s = play(s, (a) => a.t === 'recruit')
        expect(s.turn).toBe(1) // il recrute encore
        s = play(s, (a) => a.t === 'recruit')
        expect(s.hands[1]).toHaveLength(3) // Leader + 2 recrues
        expect(s.turn).toBe(0)
    })

    it('ne donne le bonus qu’une seule fois', () => {
        let s = game()
        s.secondPlayerBonusUsed = true
        s.turn = 1
        s = play(s, (a) => a.t === 'endActions')
        expect(s.recruitsLeft).toBe(1)
    })

    it('pose deux figurines pour la seule carte du Vieil Ours', () => {
        const s = play(game(), (a) => a.t === 'endActions')
        s.market = ['vieilOurs']
        const action = legalActions(s).find((a) => a.t === 'recruit') as Action & { cells: number[] }
        expect(action.cells).toHaveLength(2)
        const after = apply(s, action).state
        expect(after.hands[0]).toEqual(['leader', 'vieilOurs'])
        expect(after.pieces.filter((p) => p.character === 'vieilOurs')).toHaveLength(2)
    })

    it('saute la phase quand la main est pleine', () => {
        const s = game()
        s.hands[0] = ['leader', 'acrobate', 'cavalier', 'cogneur', 'rodeuse']
        expect(s.hands[0]).toHaveLength(HAND_LIMIT)
        const after = play(s, (a) => a.t === 'endActions')
        expect(after.phase).toBe('actions')
        expect(after.turn).toBe(1)
    })

    it('saute le recrutement quand plus aucune case dorée n’est libre', () => {
        const s = play(game(), (a) => a.t === 'endActions')
        fillCells(s, 1, recruitCells(0))
        const actions = legalActions(s)
        expect(actions).toEqual([{ t: 'skipRecruit' }])
        expect(apply(s, actions[0]!).state.turn).toBe(1)
    })
})

describe('capture', () => {
    it('capture avec deux ennemis adjacents, pas avec un seul', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'cavalier', 1, 0)
        expect(isCaptured(s, 0)).toBe(false)
        addPiece(s, 1, 'cogneur', 0, 1)
        expect(isCaptured(s, 0)).toBe(true)
    })

    it('ne compte pas les alliés adjacents', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 0, 'cavalier', 1, 0)
        addPiece(s, 0, 'cogneur', 0, 1)
        expect(isCaptured(s, 0)).toBe(false)
    })

    it('laisse l’Assassin capturer seul', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'assassin', 1, 0)
        expect(isCaptured(s, 0)).toBe(true)
    })

    it('fait participer l’Archère à deux cases en ligne droite', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'archere', 2, 0) // alignée, distance 2
        addPiece(s, 1, 'cavalier', 0, 1)
        expect(isCaptured(s, 0)).toBe(true)
    })

    it('ignore l’Archère hors ligne droite', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'archere', 2, -1) // distance 2 mais pas alignée
        addPiece(s, 1, 'cavalier', 0, 1)
        expect(isCaptured(s, 0)).toBe(false)
    })

    it('ignore l’Archère quand elle est adjacente', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'archere', 1, 0)
        addPiece(s, 1, 'cavalier', 0, 1)
        expect(captureContributors(s, 0)).toHaveLength(1)
        expect(isCaptured(s, 0)).toBe(false)
    })

    it('fait participer l’Archère même si la vue est bloquée', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'archere', 2, 0)
        addPiece(s, 0, 'cavalier', 1, 0) // écran entre l’Archère et le Leader
        addPiece(s, 1, 'cogneur', 0, 1)
        expect(isCaptured(s, 0)).toBe(true)
    })

    it('exclut l’Ourson de la capture', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'vieilOurs', 1, 0, { slot: 1 }) // l’Ourson
        addPiece(s, 1, 'cavalier', 0, 1)
        expect(isCaptured(s, 0)).toBe(false)
    })

    it('compte le Vieil Ours lui-même', () => {
        const s = duel([0, 0], [0, -3])
        addPiece(s, 1, 'vieilOurs', 1, 0, { slot: 0 })
        addPiece(s, 1, 'cavalier', 0, 1)
        expect(isCaptured(s, 0)).toBe(true)
    })
})

describe('encerclement', () => {
    it('encercle un Leader dont toutes les cases adjacentes sont occupées', () => {
        const s = duel([0, 0], [0, -3])
        expect(isEncircled(s, 0)).toBe(false)
        const autour: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
        autour.forEach(([q, r], i) =>
            addPiece(s, i % 2 === 0 ? 1 : 0, 'cavalier', q, r, { addCard: false }),
        )
        expect(isEncircled(s, 0)).toBe(true)
    })

    it('encercle plus vite dans un coin, qui a moins de voisins', () => {
        const s = duel([3, 0], [0, -3])
        addPiece(s, 0, 'cavalier', 2, 0, { addCard: false })
        addPiece(s, 1, 'cogneur', 2, 1, { addCard: false })
        addPiece(s, 1, 'rodeuse', 3, -1, { addCard: false })
        expect(isEncircled(s, 0)).toBe(true)
    })
})

describe('interdiction d’auto-capture', () => {
    it('retire les déplacements qui livreraient son propre Leader', () => {
        const s = duel([0, 0], [0, -3])
        s.turn = 0
        // Deux ennemis encadrent la case (1, 0) : y aller serait se faire capturer.
        addPiece(s, 1, 'cavalier', 2, 0, { addCard: false })
        addPiece(s, 1, 'cogneur', 1, 1, { addCard: false })
        const piege = cellAt(1, 0)
        const leader = leaderOf(s, 0)
        expect(isCaptured(s, 0)).toBe(false)
        expect(
            legalActions(s).some((a) => a.t === 'move' && a.piece === leader && a.to === piege),
        ).toBe(false)
        // Les autres cases restent jouables.
        expect(legalActions(s).some((a) => a.t === 'move' && a.piece === leader)).toBe(true)
    })
})

describe('fin de partie', () => {
    it('désigne le vainqueur dès que la capture est réalisée', () => {
        const s = duel([0, 0], [1, -1])
        s.turn = 1
        addPiece(s, 1, 'cavalier', 0, 1, { addCard: false })
        // Le Leader adverse est déjà adjacent ; le cavalier l’est aussi : capture.
        const after = apply(s, { t: 'endActions' }).state
        expect(after.winner).toBe(1)
        expect(after.phase).toBe('over')
        expect(legalActions(after)).toEqual([])
    })
})
