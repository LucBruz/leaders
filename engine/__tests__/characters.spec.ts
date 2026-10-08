import { describe, expect, it } from 'vitest'
import { CHAMPIONS, CHARACTERS, HAND_LIMIT, isCub } from '../characters'

describe('registre des personnages', () => {
    it('compte 16 cartes Champion, Leader exclu', () => {
        expect(CHAMPIONS).toHaveLength(16)
        expect(CHAMPIONS).not.toContain('leader')
    })

    it('compte 17 figurines Champion, car le Vieil Ours en pose deux', () => {
        const figurines = CHAMPIONS.reduce((n, id) => n + CHARACTERS[id].pieces, 0)
        expect(figurines).toBe(17)
    })

    it('répartit les compétences en 9 actives, 5 passives et 2 spéciales', () => {
        const parType = (kind: string) =>
            CHAMPIONS.filter((id) => CHARACTERS[id].skill === kind).length
        expect(parType('active')).toBe(9)
        expect(parType('passive')).toBe(5)
        expect(parType('special')).toBe(2)
    })

    it('ne donne aucune compétence au Leader et une seule figurine', () => {
        expect(CHARACTERS.leader.skill).toBe('none')
        expect(CHARACTERS.leader.pieces).toBe(1)
    })

    it('garde chaque identifiant cohérent avec sa clé', () => {
        for (const [cle, def] of Object.entries(CHARACTERS)) expect(def.id).toBe(cle)
    })

    it('limite une main à 5 cartes, Leader inclus', () => {
        expect(HAND_LIMIT).toBe(5)
    })

    it('ne reconnaît comme Ourson que la seconde figurine du Vieil Ours', () => {
        expect(isCub('vieilOurs', 1)).toBe(true)
        expect(isCub('vieilOurs', 0)).toBe(false)
        expect(isCub('cavalier', 1)).toBe(false)
    })
})
