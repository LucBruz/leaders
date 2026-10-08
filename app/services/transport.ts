// Transport des coups entre deux clients.
//
// Le moteur étant déterministe, on ne transmet que des ACTIONS, jamais d'état :
// quelques octets par coup. Chaque entrée porte son numéro d'ordre, et c'est ce
// numéro qui fait foi — deux entrées ne peuvent pas partager le même `seq`.
//
// Deux implémentations ici :
//  — `MemoryTransport`, pour les tests ;
//  — `BroadcastTransport`, qui fait jouer deux onglets du même navigateur sans
//    aucun serveur. Il valide tout le protocole, mais n'arbitre rien : sans
//    autorité, deux clients peuvent revendiquer le même `seq`. L'adaptateur
//    Supabase, lui, s'appuiera sur la clé primaire (game_id, seq) de la table
//    `game_actions`, qui rejette le doublon et tranche l'ordre.

import type { Action, Seat } from '../../engine/types'

export interface LogEntry {
    /** Numéro d'ordre du coup. Premier coup = 0. */
    seq: number
    seat: Seat
    action: Action
}

export type SendResult =
    | { ok: true }
    /** Quelqu'un a déjà pris ce numéro : il faut resynchroniser puis rejouer. */
    | { ok: false; reason: 'conflict' }
    | { ok: false; reason: 'offline' }

export interface Transport {
    /** Journal complet, pour la reconnexion. */
    fetchAll(): Promise<LogEntry[]>
    send(entry: LogEntry): Promise<SendResult>
    subscribe(onEntry: (entry: LogEntry) => void): void
    close(): Promise<void>
}

// ─── Mémoire ──────────────────────────────────────────────────────────────────

/**
 * Journal partagé en mémoire, pour les tests. Le hub joue le rôle d'arbitre que
 * `BroadcastTransport` n'a pas : il refuse un `seq` déjà pris, exactement comme
 * le fera la clé primaire de la table `game_actions`.
 *
 * Un client n'est jamais notifié de son propre coup : il l'a déjà appliqué.
 */
export class MemoryHub {
    private readonly log: LogEntry[] = []
    private readonly clients = new Set<MemoryTransport>()

    client(): Transport {
        const transport = new MemoryTransport(this)
        this.clients.add(transport)
        return transport
    }

    /** @internal */
    all(): LogEntry[] {
        return this.log.slice()
    }

    /** @internal */
    publish(from: MemoryTransport, entry: LogEntry): SendResult {
        if (this.log.some((e) => e.seq === entry.seq)) return { ok: false, reason: 'conflict' }
        this.log.push(entry)
        this.log.sort((a, b) => a.seq - b.seq)
        for (const client of this.clients) if (client !== from) client.receive(entry)
        return { ok: true }
    }

    /** Coupe un client du réseau, pour éprouver la reconnexion. */
    detach(transport: Transport): void {
        this.clients.delete(transport as MemoryTransport)
    }

    attach(transport: Transport): void {
        this.clients.add(transport as MemoryTransport)
    }
}

export class MemoryTransport implements Transport {
    private readonly listeners = new Set<(entry: LogEntry) => void>()

    constructor(private readonly hub: MemoryHub) {}

    async fetchAll(): Promise<LogEntry[]> {
        return this.hub.all()
    }

    async send(entry: LogEntry): Promise<SendResult> {
        return this.hub.publish(this, entry)
    }

    subscribe(onEntry: (entry: LogEntry) => void): void {
        this.listeners.add(onEntry)
    }

    /** @internal */
    receive(entry: LogEntry): void {
        for (const listener of this.listeners) listener(entry)
    }

    async close(): Promise<void> {
        this.listeners.clear()
        this.hub.detach(this)
    }
}

// ─── Deux onglets, sans serveur ───────────────────────────────────────────────

/**
 * Transport de développement : deux onglets du même navigateur s'échangent
 * leurs coups par `BroadcastChannel`. Aucun serveur, aucune latence, et le
 * protocole complet est exercé — y compris la reprise de main de la Némésis au
 * milieu du tour adverse.
 *
 * Le journal est conservé dans `localStorage`, ce qui donne aussi la
 * reconnexion : un onglet rechargé rejoue et retrouve la partie.
 */
export class BroadcastTransport implements Transport {
    private readonly channel: BroadcastChannel
    private readonly listeners = new Set<(entry: LogEntry) => void>()
    private readonly key: string

    constructor(roomId: string) {
        this.key = `leaders:room:${roomId}`
        this.channel = new BroadcastChannel(`leaders:${roomId}`)
        this.channel.onmessage = (event: MessageEvent<LogEntry>) => {
            const entry = event.data
            this.remember(entry)
            for (const listener of this.listeners) listener(entry)
        }
    }

    private read(): LogEntry[] {
        try {
            return JSON.parse(localStorage.getItem(this.key) ?? '[]') as LogEntry[]
        } catch {
            return []
        }
    }

    private remember(entry: LogEntry): boolean {
        const log = this.read()
        if (log.some((e) => e.seq === entry.seq)) return false
        log.push(entry)
        log.sort((a, b) => a.seq - b.seq)
        try {
            localStorage.setItem(this.key, JSON.stringify(log))
        } catch {
            // Stockage plein ou bloqué : la partie continue en mémoire, seule
            // la reconnexion est perdue.
        }
        return true
    }

    async fetchAll(): Promise<LogEntry[]> {
        return this.read()
    }

    async send(entry: LogEntry): Promise<SendResult> {
        if (!this.remember(entry)) return { ok: false, reason: 'conflict' }
        this.channel.postMessage(entry)
        return { ok: true }
    }

    subscribe(onEntry: (entry: LogEntry) => void): void {
        this.listeners.add(onEntry)
    }

    async close(): Promise<void> {
        this.listeners.clear()
        this.channel.close()
    }

    /** Efface le journal d'un salon, pour repartir d'une partie neuve. */
    static forget(roomId: string): void {
        try {
            localStorage.removeItem(`leaders:room:${roomId}`)
        } catch {
            /* rien à faire */
        }
    }
}
