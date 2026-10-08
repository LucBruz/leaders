import { describe, expect, it } from 'vitest'
import { cellAt, distance } from '../board'
import { apply } from '../apply'
import { currentDecider, legalActions } from '../legal'
import type { Action, GameState, PieceId } from '../types'
import { addPiece, duel } from './fixtures'

const at = (q: number, r: number) => cellAt(q, r)
const cellOf = (s: GameState, p: PieceId) => s.pieces[p]!.cell

/** Le siège 0 joue, le siège 1 possède la Némésis. */
function setup() {
    const s = duel([0, 0], [-2, -1])
    s.turn = 0
    const nemesis = addPiece(s, 1, 'nemesis', 3, 0)
    return { s, nemesis }
}

function moveLeader(s: GameState): { state: GameState; action: Action } {
    const action = legalActions(s).find((a) => a.t === 'move')!
    return { state: apply(s, action).state, action }
}

describe('déclenchement', () => {
    it('se déclenche quand le Leader adverse se déplace', () => {
        const { s, nemesis } = setup()
        expect(s.pending).toBeNull()
        const { state } = moveLeader(s)
        expect(state.pending).toEqual({ kind: 'nemesis', decider: 1, piece: nemesis })
    })

    it('rend la main au propriétaire de la Némésis, pas au joueur actif', () => {
        const { s } = setup()
        const { state } = moveLeader(s)
        expect(state.turn).toBe(0)
        expect(currentDecider(state)).toBe(1)
    })

    it('ne propose plus que le déplacement de la Némésis', () => {
        const { s, nemesis } = setup()
        const { state } = moveLeader(s)
        const actions = legalActions(state)
        expect(actions.length).toBeGreaterThan(0)
        for (const a of actions) {
            expect(a.t).toBe('nemesis')
            expect((a as Action & { piece: number }).piece).toBe(nemesis)
        }
    })

    it('ne se déclenche pas sur le déplacement d’un autre Personnage', () => {
        const { s } = setup()
        const cav = addPiece(s, 0, 'cavalier', 0, 2)
        const action = legalActions(s).find(
            (a) => a.t === 'move' && (a as Action & { piece: number }).piece === cav,
        )!
        expect(apply(s, action).state.pending).toBeNull()
    })

    it('ne se déclenche pas sur le déplacement du Leader de son propre camp', () => {
        const s = duel([0, 0], [-2, -1])
        s.turn = 0
        addPiece(s, 0, 'nemesis', 3, 0) // la Némésis appartient au siège 0
        expect(moveLeader(s).state.pending).toBeNull()
    })

    it('se déclenche aussi pendant le tour de son propre propriétaire', () => {
        const s = duel([0, 0], [-2, -1])
        s.turn = 1
        const nemesis = addPiece(s, 0, 'nemesis', 3, 0)
        // Le siège 1 déplace son propre Leader ; la Némésis du siège 0 réagit.
        const action = legalActions(s).find((a) => a.t === 'move')!
        const after = apply(s, action).state
        expect(after.pending).toEqual({ kind: 'nemesis', decider: 0, piece: nemesis })
    })
})

describe('déplacement forcé', () => {
    it('se déplace de deux cases, sur une case d’arrivée différente du départ', () => {
        const { s, nemesis } = setup()
        const { state } = moveLeader(s)
        const depart = cellOf(state, nemesis)
        for (const a of legalActions(state)) {
            const path = (a as Action & { path: number[] }).path
            expect(path).toHaveLength(2)
            expect(path[1]).not.toBe(depart)
        }
        const after = apply(state, legalActions(state)[0]!).state
        expect(distance(depart, cellOf(after, nemesis))).toBeGreaterThan(0)
        expect(after.pending).toBeNull()
    })

    it('se rabat sur une seule case quand deux sont impossibles', () => {
        const s = duel([0, 0], [-2, -1])
        s.turn = 0
        const nemesis = addPiece(s, 1, 'nemesis', 3, 0)
        // On mure la Némésis dans le coin : une seule case libre, sans suite.
        addPiece(s, 1, 'cavalier', 2, 1, { addCard: false })
        addPiece(s, 1, 'cogneur', 3, -1, { addCard: false })
        addPiece(s, 1, 'rodeuse', 1, 1, { addCard: false })
        addPiece(s, 1, 'archere', 2, -1, { addCard: false })
        addPiece(s, 1, 'tavernier', 3, -2, { addCard: false })

        const { state } = moveLeader(s)
        const actions = legalActions(state)
        for (const a of actions) {
            expect((a as Action & { path: number[] }).path).toHaveLength(1)
        }
        expect(cellOf(apply(state, actions[0]!).state, nemesis)).toBe(at(2, 0))
    })

    it('ne se déplace pas du tout quand elle est bloquée', () => {
        const s = duel([0, 0], [-2, -1])
        s.turn = 0
        const nemesis = addPiece(s, 1, 'nemesis', 3, 0)
        for (const [q, r] of [[2, 0], [2, 1], [3, -1]] as [number, number][]) {
            addPiece(s, 1, 'cavalier', q, r, { addCard: false })
        }
        const { state } = moveLeader(s)
        const actions = legalActions(state)
        expect(actions).toHaveLength(1)
        expect((actions[0] as Action & { path: number[] }).path).toEqual([])

        const after = apply(state, actions[0]!).state
        expect(cellOf(after, nemesis)).toBe(at(3, 0))
        expect(after.pending).toBeNull()
    })

    it('ne consomme pas d’action : le joueur actif poursuit son tour', () => {
        const { s } = setup()
        const avant = legalActions(s).filter((a) => a.t === 'move').length
        const { state } = moveLeader(s)
        const reprise = apply(state, legalActions(state)[0]!).state
        expect(reprise.turn).toBe(0)
        expect(reprise.phase).toBe('actions')
        expect(avant).toBeGreaterThan(0)
    })
})

describe('déclenchements multiples', () => {
    it('réagit à chaque action distincte ayant déplacé le Leader adverse', () => {
        const { s } = setup()
        // Un Tavernier allié pourra redéplacer le Leader dans le même tour.
        addPiece(s, 0, 'tavernier', 0, 1)

        const premier = moveLeader(s).state
        expect(premier.pending).not.toBeNull()
        const apresPremier = apply(premier, legalActions(premier)[0]!).state
        expect(apresPremier.pending).toBeNull()

        // Seconde action du tour : le Tavernier pousse le Leader allié.
        const pousse = legalActions(apresPremier).find((a) => a.t === 'tavernier')
        if (pousse) {
            const apresSecond = apply(apresPremier, pousse).state
            expect(apresSecond.pending).not.toBeNull()
        }
    })

    it('ne réagit qu’une fois pour une action qui déplace le Leader de deux cases', () => {
        const s = duel([0, 0], [-2, -1])
        s.turn = 0
        s.hands[0].push('vizir')
        addPiece(s, 0, 'vizir', 0, 3)
        addPiece(s, 1, 'nemesis', 3, 0)

        const leader = s.pieces.findIndex((p) => p.owner === 0 && p.character === 'leader')
        const deuxCases = legalActions(s).find(
            (a) =>
                a.t === 'move' &&
                (a as Action & { piece: number }).piece === leader &&
                distance(at(0, 0), (a as Action & { to: number }).to) === 2,
        )!
        const after = apply(s, deuxCases).state
        expect(after.pending).not.toBeNull()
        // Une seule attente, pas deux empilées.
        const resolu = apply(after, legalActions(after)[0]!).state
        expect(resolu.pending).toBeNull()
    })
})

describe('fin de partie', () => {
    it('ne déclenche rien si l’action a déjà conclu la partie', () => {
        const s = duel([0, 0], [1, -1])
        s.turn = 0
        addPiece(s, 1, 'nemesis', 3, 0)
        // Deux alliés du siège 0 encadrent déjà le Leader adverse en (1,-1) :
        // la capture est acquise dès que l'action se termine.
        addPiece(s, 0, 'cavalier', 2, -1, { addCard: false })
        addPiece(s, 0, 'cogneur', 1, -2, { addCard: false })
        const after = apply(s, { t: 'endActions' }).state
        expect(after.winner).toBe(0)
        expect(after.pending).toBeNull()
        expect(currentDecider(after)).toBeNull()
    })

    it('peut capturer en se déplaçant', () => {
        const s = duel([0, 0], [-2, -1])
        s.turn = 0
        // Un ennemi touche déjà le Leader du siège 0 : il suffit que la Némésis
        // vienne à son tour l'effleurer pour que la capture soit acquise.
        addPiece(s, 1, 'cavalier', 1, 0, { addCard: false })
        const nemesis = addPiece(s, 1, 'nemesis', -2, 1)

        // On place directement l'attente plutôt que de la provoquer par un
        // déplacement de Leader : celui-ci s'éloignerait du cavalier, et le
        // scénario ne tiendrait plus.
        s.pending = { kind: 'nemesis', decider: 1, piece: nemesis }
        expect(currentDecider(s)).toBe(1)

        const gagnante = legalActions(s).find(
            (a) => distance((a as Action & { path: number[] }).path.at(-1)!, at(0, 0)) === 1,
        )!
        expect(gagnante).toBeDefined()
        expect(apply(s, gagnante).state.winner).toBe(1)
    })
})
