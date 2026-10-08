import { describe, expect, it } from 'vitest'
import { canonical, sameValue } from '../canonical'
import { legalActions } from '../legal'
import { accepts, replay } from '../replay'
import { createGame } from '../setup'
import type { Action } from '../types'

/**
 * Imite l'aller-retour par Postgres : `jsonb` ne conserve pas l'ordre
 * d'insertion des clés, il le réordonne. C'est précisément ce qui faisait
 * rejeter des actions parfaitement légales reçues du réseau.
 */
function commeJsonb<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(commeJsonb) as unknown as T
    const melange: Record<string, unknown> = {}
    for (const key of Object.keys(value as object).reverse()) {
        melange[key] = commeJsonb((value as Record<string, unknown>)[key])
    }
    return melange as T
}

describe('forme canonique', () => {
    it('ignore l’ordre des clés', () => {
        expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }))
        expect(sameValue({ t: 'move', piece: 0, to: 14 }, { t: 'move', to: 14, piece: 0 })).toBe(true)
    })

    it('respecte l’ordre des tableaux, qui porte du sens', () => {
        // Pour l'Acrobate, [a, b] et [b, a] sont deux trajets différents.
        expect(sameValue({ jumps: [1, 2] }, { jumps: [2, 1] })).toBe(false)
    })

    it('distingue des valeurs réellement différentes', () => {
        expect(sameValue({ t: 'move', to: 1 }, { t: 'move', to: 2 })).toBe(false)
        expect(sameValue({ t: 'move' }, { t: 'cavalier' })).toBe(false)
    })

    it('assimile undefined à null, que JSON ne sait pas transporter', () => {
        // `gardeRoyal.then` vaut null quand il n'y a pas de pas supplémentaire :
        // un client qui enverrait undefined produirait le même JSON.
        expect(sameValue({ then: undefined }, { then: null })).toBe(true)
    })

    it('descend dans les structures imbriquées', () => {
        expect(sameValue({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } })).toBe(true)
    })
})

describe('actions revenues du réseau', () => {
    it('accepte une action dont les clés ont été réordonnées', () => {
        const state = createGame({ seed: 64009 })
        for (const action of legalActions(state)) {
            expect(accepts(state, commeJsonb(action))).toBe(true)
        }
    })

    it('rejoue un journal passé par jsonb', () => {
        const state = createGame({ seed: 64009 })
        const premier = legalActions(state).find((a) => a.t === 'move')!
        const journal = [commeJsonb(premier)] as Action[]
        expect(() => replay({ seed: 64009, mode: 'classic', actions: journal })).not.toThrow()
    })

    it('rejette toujours une action réellement illégale', () => {
        const state = createGame({ seed: 64009 })
        expect(accepts(state, commeJsonb({ t: 'move', piece: 1, to: 0 } as Action))).toBe(false)
    })
})
