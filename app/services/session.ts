// Une partie en ligne : l'état local, le transport, et la discipline d'ordre.
//
// Principe : le journal fait foi. On joue de façon optimiste pour que
// l'interface réponde tout de suite, mais le moindre doute sur l'ordre
// déclenche une resynchronisation — on relit le journal et on rejoue. Il n'y a
// donc jamais deux versions de la vérité à réconcilier à la main.

import { currentDecider } from '../../engine/legal'
import { accepts, advance, fingerprint, replay } from '../../engine/replay'
import type { GameRecord } from '../../engine/replay'
import type { Action, GameState, Seat } from '../../engine/types'
import type { LogEntry, Transport } from './transport'

export type PlayOutcome =
    | { ok: true }
    | { ok: false; reason: 'notYourTurn' | 'illegal' | 'resynced' | 'offline' }

export interface SessionOptions {
    seed: number
    mode?: 'classic' | 'strategist'
    /** Siège occupé par CE client. `null` pour un spectateur. */
    seat: Seat | null
    transport: Transport
    onChange: (state: GameState) => void
}

export class Session {
    state: GameState
    readonly seat: Seat | null
    private readonly record: { seed: number; mode: 'classic' | 'strategist'; actions: Action[] }
    private readonly transport: Transport
    private readonly onChange: (state: GameState) => void
    private resyncing = false

    constructor(options: SessionOptions) {
        this.seat = options.seat
        this.transport = options.transport
        this.onChange = options.onChange
        this.record = { seed: options.seed, mode: options.mode ?? 'classic', actions: [] }
        this.state = replay(this.record)
    }

    /** Rattrape le journal existant, puis écoute les coups suivants. */
    async start(): Promise<void> {
        this.transport.subscribe((entry) => void this.receive(entry))
        await this.resync()
    }

    /** C'est à ce client de jouer ? Pendant une réaction de Némésis, ce n'est
     *  pas forcément le joueur dont c'est le tour. */
    get myTurn(): boolean {
        return this.seat !== null && currentDecider(this.state) === this.seat
    }

    async play(action: Action): Promise<PlayOutcome> {
        if (!this.myTurn) return { ok: false, reason: 'notYourTurn' }
        if (!accepts(this.state, action)) return { ok: false, reason: 'illegal' }

        const entry: LogEntry = { seq: this.state.seq, seat: this.seat!, action }
        const before = this.state

        // Optimiste : l'interface bouge tout de suite.
        this.commit(advance(before, action), action)

        const result = await this.transport.send(entry)
        if (result.ok) return { ok: true }

        // Refusé : quelqu'un a pris ce numéro d'ordre avant nous, ou le réseau
        // est tombé. Dans les deux cas le journal fait foi, on s'y réaligne.
        await this.resync()
        return { ok: false, reason: result.reason === 'conflict' ? 'resynced' : 'offline' }
    }

    /** Coup reçu de l'adversaire. */
    private async receive(entry: LogEntry): Promise<void> {
        if (this.resyncing) return
        if (entry.seq < this.state.seq) return // déjà connu
        if (entry.seq > this.state.seq) {
            // Un coup nous a échappé : on ne devine pas, on relit tout.
            await this.resync()
            return
        }
        if (!accepts(this.state, entry.action)) {
            await this.resync()
            return
        }
        this.commit(advance(this.state, entry.action), entry.action)
    }

    /** Relit le journal et rejoue. Seul chemin de réconciliation. */
    async resync(): Promise<void> {
        if (this.resyncing) return
        this.resyncing = true
        try {
            const entries = (await this.transport.fetchAll()).sort((a, b) => a.seq - b.seq)
            this.record.actions = entries.map((e) => e.action)
            this.state = replay(this.record)
            this.onChange(this.state)
        } finally {
            this.resyncing = false
        }
    }

    private commit(next: GameState, action: Action): void {
        this.record.actions = [...this.record.actions.slice(0, this.state.seq), action]
        this.state = next
        this.onChange(next)
    }

    /** Journal complet, pour la rediffusion ou l'export. */
    toRecord(): GameRecord {
        return { seed: this.record.seed, mode: this.record.mode, actions: [...this.record.actions] }
    }

    get fingerprint(): string {
        return fingerprint(this.state)
    }

    async close(): Promise<void> {
        await this.transport.close()
    }
}
