// Transport Supabase : le journal d'actions vit dans Postgres.
//
// C'est la table `game_actions` qui arbitre l'ordre, via sa clé primaire
// (game_id, seq). Deux clients ne peuvent pas prendre le même numéro : le
// second reçoit une violation d'unicité, que l'on traduit en conflit, et la
// Session se resynchronise. C'est ce qui remplace une autorité serveur sans
// qu'on ait à en écrire une.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Action } from '../../engine/types'
import type { LogEntry, SendResult, Transport } from './transport'

/** Violation de contrainte d'unicité en Postgres. */
const UNIQUE_VIOLATION = '23505'

interface ActionRow {
    seq: number
    seat: 0 | 1
    action: Action
}

export class SupabaseTransport implements Transport {
    private channel: ReturnType<SupabaseClient['channel']> | null = null
    private readonly listeners = new Set<(entry: LogEntry) => void>()

    constructor(
        private readonly db: SupabaseClient,
        private readonly gameId: string,
    ) {}

    async fetchAll(): Promise<LogEntry[]> {
        const { data, error } = await this.db
            .from('game_actions')
            .select('seq, seat, action')
            .eq('game_id', this.gameId)
            .order('seq', { ascending: true })
        if (error) throw new Error(`journal illisible : ${error.message}`)
        return (data ?? []) as LogEntry[]
    }

    async send(entry: LogEntry): Promise<SendResult> {
        const { error } = await this.db.from('game_actions').insert({
            game_id: this.gameId,
            seq: entry.seq,
            seat: entry.seat,
            action: entry.action,
        })
        if (!error) return { ok: true }
        // Numéro déjà pris : l'adversaire a joué avant nous.
        if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: 'conflict' }
        return { ok: false, reason: 'offline' }
    }

    subscribe(onEntry: (entry: LogEntry) => void): void {
        this.listeners.add(onEntry)
        this.channel ??= this.db
            .channel(`game:${this.gameId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'game_actions',
                    filter: `game_id=eq.${this.gameId}`,
                },
                (payload: { new: ActionRow }) => {
                    const row = payload.new
                    const received: LogEntry = {
                        seq: row.seq,
                        seat: row.seat,
                        action: row.action,
                    }
                    for (const listener of this.listeners) listener(received)
                },
            )
            .subscribe()
    }

    async close(): Promise<void> {
        this.listeners.clear()
        if (this.channel) {
            await this.db.removeChannel(this.channel)
            this.channel = null
        }
    }
}
