import { describe, expect, it } from 'vitest'
import { apply } from '../apply'
import { legalActions } from '../legal'
import { ReplayError, accepts, advance, fingerprint, replay } from '../replay'
import { makeRng } from '../rng'
import { createGame } from '../setup'
import type { Action, GameState } from '../types'

/** Joue une partie aléatoire et renvoie le journal, comme le ferait un salon. */
function record(seed: number, maxActions = 400) {
    const rng = makeRng(seed)
    let state = createGame({ seed })
    const actions: Action[] = []
    while (state.winner === null && actions.length < maxActions) {
        const options = legalActions(state)
        if (options.length === 0) break
        const action = options[Math.floor(rng() * options.length)]!
        actions.push(action)
        state = apply(state, action).state
    }
    return { record: { seed, mode: 'classic' as const, actions }, final: state }
}

describe('rejeu', () => {
    it('reconstruit exactement l’état final depuis la graine et le journal', () => {
        for (const seed of [1, 7, 42, 1234]) {
            const { record: log, final } = record(seed)
            expect(fingerprint(replay(log))).toBe(fingerprint(final))
        }
    })

    it('donne le même résultat à chaque rejeu', () => {
        const { record: log } = record(99)
        expect(fingerprint(replay(log))).toBe(fingerprint(replay(log)))
    })

    it('s’arrête où on le lui demande, ce qui donne la rediffusion', () => {
        const { record: log } = record(5)
        expect(log.actions.length).toBeGreaterThan(10)
        const milieu = replay(log, 10)
        expect(milieu.seq).toBe(10)
        expect(fingerprint(milieu)).not.toBe(fingerprint(replay(log)))
    })

    it('part d’une mise en place vierge pour un journal vide', () => {
        const vierge = replay({ seed: 3, mode: 'classic', actions: [] })
        expect(fingerprint(vierge)).toBe(fingerprint(createGame({ seed: 3 })))
    })
})

describe('validation', () => {
    it('refuse un journal dont une action est illégale', () => {
        const { record: log } = record(11)
        const falsifie = {
            ...log,
            actions: [{ t: 'move', piece: 0, to: 0 } as Action, ...log.actions],
        }
        expect(() => replay(falsifie)).toThrow(ReplayError)
    })

    it('situe précisément l’action fautive', () => {
        const { record: log } = record(13)
        const actions = log.actions.slice(0, 6)
        actions.splice(3, 0, { t: 'endActions' } as Action)
        try {
            replay({ ...log, actions })
            expect.unreachable('le rejeu aurait dû échouer')
        } catch (error) {
            expect(error).toBeInstanceOf(ReplayError)
            expect((error as ReplayError).index).toBeGreaterThanOrEqual(3)
        }
    })

    it('refuse une action jouée après la fin de la partie', () => {
        const { record: log, final } = record(17)
        if (final.winner === null) return // partie non conclue, cas sans objet
        expect(() =>
            replay({ ...log, actions: [...log.actions, { t: 'endActions' } as Action] }),
        ).toThrow(ReplayError)
    })

    it('reconnaît une action légale et rejette une action inventée', () => {
        const state = createGame({ seed: 2 })
        expect(accepts(state, legalActions(state)[0]!)).toBe(true)
        expect(accepts(state, { t: 'move', piece: 0, to: 36 })).toBe(false)
    })
})

describe('avancée d’un cran', () => {
    it('donne le même état que le rejeu complet', () => {
        const { record: log } = record(23)
        let pas = createGame({ seed: log.seed })
        for (const action of log.actions) pas = advance(pas, action)
        expect(fingerprint(pas)).toBe(fingerprint(replay(log)))
    })

    it('rejette une action illégale sans modifier l’état', () => {
        const state = createGame({ seed: 4 })
        expect(() => advance(state, { t: 'move', piece: 1, to: 0 })).toThrow()
    })
})

describe('empreinte', () => {
    it('diffère dès que la position change', () => {
        const state = createGame({ seed: 8 })
        const bouge = apply(state, legalActions(state).find((a) => a.t === 'move')!).state
        expect(fingerprint(bouge)).not.toBe(fingerprint(state))
    })

    it('ignore l’ordre des cartes en main, qui n’influe pas sur la partie', () => {
        const a = createGame({ seed: 8 })
        const b: GameState = { ...a, hands: [[...a.hands[0]].reverse(), a.hands[1]] }
        expect(fingerprint(b)).toBe(fingerprint(a))
    })

    it('ne dépend pas de la pioche, qui dérive de la graine', () => {
        const a = createGame({ seed: 8 })
        const b: GameState = { ...a, deck: [...a.deck].reverse() }
        expect(fingerprint(b)).toBe(fingerprint(a))
    })

    it('distingue à qui est la main pendant une réaction de Némésis', () => {
        const a = createGame({ seed: 8 })
        const b: GameState = { ...a, pending: { kind: 'nemesis', decider: 1, piece: 0 } }
        expect(fingerprint(b)).not.toBe(fingerprint(a))
    })
})
