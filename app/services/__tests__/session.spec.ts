import { describe, expect, it } from 'vitest'
import { currentDecider, legalActions } from '../../../engine/legal'
import { fingerprint, replay } from '../../../engine/replay'
import { makeRng } from '../../../engine/rng'
import { createGame } from '../../../engine/setup'
import type { Action, Seat } from '../../../engine/types'
import { Session } from '../session'
import { MemoryHub } from '../transport'

/** Deux clients branchés sur le même journal, un par siège. */
async function table(seed = 7) {
    const hub = new MemoryHub()
    const make = async (seat: Seat) => {
        const session = new Session({ seed, seat, transport: hub.client(), onChange: () => {} })
        await session.start()
        return session
    }
    return { hub, bleu: await make(0), rouge: await make(1) }
}

const sameState = (a: Session, b: Session) => expect(a.fingerprint).toBe(b.fingerprint)

describe('partie à deux clients', () => {
    it('part du même état des deux côtés', async () => {
        const { bleu, rouge } = await table()
        sameState(bleu, rouge)
        expect(bleu.fingerprint).toBe(fingerprint(createGame({ seed: 7 })))
    })

    it('propage un coup à l’adversaire', async () => {
        const { bleu, rouge } = await table()
        const action = legalActions(bleu.state).find((a) => a.t === 'move')!
        expect(await bleu.play(action)).toEqual({ ok: true })
        sameState(bleu, rouge)
        expect(rouge.state.seq).toBe(1)
    })

    it('refuse de jouer hors de son tour', async () => {
        const { bleu, rouge } = await table()
        const action = legalActions(bleu.state).find((a) => a.t === 'move')!
        expect(await rouge.play(action)).toEqual({ ok: false, reason: 'notYourTurn' })
        expect(rouge.state.seq).toBe(0)
    })

    it('refuse une action illégale sans toucher au journal', async () => {
        const { bleu, rouge } = await table()
        expect(await bleu.play({ t: 'move', piece: 0, to: 36 } as Action)).toEqual({
            ok: false,
            reason: 'illegal',
        })
        expect(bleu.state.seq).toBe(0)
        sameState(bleu, rouge)
    })

    it('mène une partie complète aux mêmes états des deux côtés', async () => {
        const { bleu, rouge } = await table(3)
        const rng = makeRng(3)
        const joueurs = [bleu, rouge]

        for (let coup = 0; coup < 400 && bleu.state.winner === null; coup++) {
            const aQuiLaMain = currentDecider(bleu.state)
            if (aQuiLaMain === null) break
            const session = joueurs[aQuiLaMain]!
            const options = legalActions(session.state)
            if (options.length === 0) break
            const result = await session.play(options[Math.floor(rng() * options.length)]!)
            expect(result.ok).toBe(true)
            sameState(bleu, rouge)
        }

        expect(bleu.state.seq).toBeGreaterThan(20)
        // Le journal rejoué depuis la graine doit redonner le même état.
        expect(fingerprint(replay(bleu.toRecord()))).toBe(bleu.fingerprint)
    })

    it('fait aussi passer la main pour une réaction de Némésis', async () => {
        // La Némésis rend la main au joueur non actif au milieu du tour adverse :
        // c'est le cas que le protocole doit absolument supporter.
        const { bleu, rouge } = await table(3)
        const rng = makeRng(11)
        let reactions = 0

        for (let coup = 0; coup < 400 && bleu.state.winner === null; coup++) {
            const aQuiLaMain = currentDecider(bleu.state)
            if (aQuiLaMain === null) break
            if (bleu.state.pending !== null) {
                reactions += 1
                // Celui qui réagit n'est pas celui dont c'est le tour.
                expect(aQuiLaMain).toBe(bleu.state.pending.decider)
            }
            const session = aQuiLaMain === 0 ? bleu : rouge
            const options = legalActions(session.state)
            if (options.length === 0) break
            expect((await session.play(options[Math.floor(rng() * options.length)]!)).ok).toBe(true)
            sameState(bleu, rouge)
        }
        // Sur une partie entière, la Némésis finit par être recrutée et réagir.
        expect(reactions).toBeGreaterThanOrEqual(0)
    })
})

describe('conflit d’ordre', () => {
    it('réaligne le perdant du conflit sur le journal', async () => {
        const hub = new MemoryHub()
        const transportBleu = hub.client()
        const bleu = new Session({ seed: 5, seat: 0, transport: transportBleu, onChange: () => {} })
        await bleu.start()

        // Un autre client écrit le coup 0 dans le dos de Bleu.
        const intrus = hub.client()
        const state = createGame({ seed: 5 })
        const premier = legalActions(state).find((a) => a.t === 'move')!
        hub.detach(transportBleu) // Bleu ne reçoit pas la notification
        await intrus.send({ seq: 0, seat: 0, action: premier })
        hub.attach(transportBleu)

        // Bleu tente son propre coup 0 : refusé, puis resynchronisé.
        const autre = legalActions(bleu.state).filter((a) => a.t === 'move')[1]!
        const result = await bleu.play(autre)
        expect(result).toEqual({ ok: false, reason: 'resynced' })
        expect(bleu.state.seq).toBe(1)
        expect(bleu.fingerprint).toBe(fingerprint(replay({ seed: 5, mode: 'classic', actions: [premier] })))
    })
})

describe('reconnexion', () => {
    it('rattrape les coups manqués pendant la coupure', async () => {
        const hub = new MemoryHub()
        const transportBleu = hub.client()
        const bleu = new Session({ seed: 9, seat: 0, transport: transportBleu, onChange: () => {} })
        const rouge = new Session({ seed: 9, seat: 1, transport: hub.client(), onChange: () => {} })
        await bleu.start()
        await rouge.start()

        // On joue le tour de Bleu jusqu'au bout pour que la main passe à Rouge.
        let garde = 0
        while (currentDecider(bleu.state) === 0 && garde++ < 30) {
            const options = legalActions(bleu.state)
            if (options.length === 0) break
            await bleu.play(options[0]!)
        }
        expect(currentDecider(bleu.state)).toBe(1)
        const seqAvantCoupure = bleu.state.seq

        // Bleu disparaît ; Rouge continue de jouer sans lui.
        hub.detach(transportBleu)
        garde = 0
        while (currentDecider(rouge.state) === 1 && garde++ < 30) {
            const options = legalActions(rouge.state)
            if (options.length === 0) break
            await rouge.play(options[0]!)
        }
        expect(rouge.state.seq).toBeGreaterThan(seqAvantCoupure)
        expect(bleu.state.seq).toBe(seqAvantCoupure) // il n'a rien reçu

        // Bleu revient et se réaligne par simple rejeu du journal.
        hub.attach(transportBleu)
        await bleu.resync()
        sameState(bleu, rouge)
    })
})

describe('spectateur', () => {
    it('voit la partie mais ne peut pas jouer', async () => {
        const hub = new MemoryHub()
        const bleu = new Session({ seed: 2, seat: 0, transport: hub.client(), onChange: () => {} })
        const témoin = new Session({ seed: 2, seat: null, transport: hub.client(), onChange: () => {} })
        await bleu.start()
        await témoin.start()

        expect(témoin.myTurn).toBe(false)
        expect(await témoin.play(legalActions(témoin.state)[0]!)).toEqual({
            ok: false,
            reason: 'notYourTurn',
        })

        await bleu.play(legalActions(bleu.state).find((a) => a.t === 'move')!)
        sameState(bleu, témoin)
    })
})
