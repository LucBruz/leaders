// Client Supabase et accès aux parties.
//
// L'URL et la clé publishable sont destinées au navigateur : elles sont
// publiques par conception. La sécurité ne repose donc pas sur elles mais sur
// les politiques RLS, et sur le fait que l'identifiant d'un salon est un uuid
// non devinable.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** Le client, ou `null` si le projet n'est pas configuré. */
export function supabase(url: string, key: string): SupabaseClient | null {
    if (!url || !key) return null
    client ??= createClient(url, key, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 20 } },
    })
    return client
}

export interface GameRow {
    id: string
    seed: number
    mode: 'classic' | 'strategist'
    rematch_id: string | null
}

const CLIENT_TOKEN_KEY = 'leaders:client'

/**
 * Jeton identifiant ce navigateur.
 *
 * Il tient lieu d'identité : sans comptes, c'est lui qui permet de réclamer un
 * siège, et de le retrouver après rechargement. Il ne quitte jamais la machine
 * autrement que vers `claim_seat`.
 */
export function clientToken(): string {
    try {
        const kept = localStorage.getItem(CLIENT_TOKEN_KEY)
        if (kept && kept.length >= 16) return kept
        const fresh = crypto.randomUUID()
        localStorage.setItem(CLIENT_TOKEN_KEY, fresh)
        return fresh
    } catch {
        // Navigation privée ou stockage bloqué : jeton éphémère. Le siège sera
        // perdu au rechargement, mais la partie reste jouable.
        return crypto.randomUUID()
    }
}

/**
 * Réclame un siège. Rend `0`, `1`, ou `null` si les deux sont déjà pris —
 * auquel cas ce visiteur est spectateur.
 *
 * Remplace le siège passé dans l'URL, qui laissait deux personnes ouvrir le
 * même et se marcher dessus.
 */
export async function claimSeat(
    db: SupabaseClient,
    gameId: string,
    token: string,
): Promise<0 | 1 | null> {
    const { data, error } = await db.rpc('claim_seat', { p_game: gameId, p_token: token })
    if (error) throw new Error(`attribution du siège impossible : ${error.message}`)
    return (data as 0 | 1 | null) ?? null
}

/**
 * Crée la partie de revanche et l'attache à celle qui vient de finir.
 * Appelée par les deux joueurs sans risque : un seul salon est créé.
 */
export async function proposeRematch(
    db: SupabaseClient,
    gameId: string,
    seed: number,
): Promise<string | null> {
    const { data, error } = await db.rpc('propose_rematch', { p_game: gameId, p_seed: seed })
    if (error) throw new Error(`revanche impossible : ${error.message}`)
    return (data as string | null) ?? null
}

/** Prévient quand l'adversaire propose une revanche, pour l'y suivre. */
export function watchRematch(
    db: SupabaseClient,
    gameId: string,
    onRematch: (rematchId: string) => void,
) {
    return db
        .channel(`rematch:${gameId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
            (payload: { new: { rematch_id: string | null } }) => {
                if (payload.new.rematch_id) onRematch(payload.new.rematch_id)
            },
        )
        .subscribe()
}

export async function createRoom(
    db: SupabaseClient,
    seed: number,
    mode: 'classic' | 'strategist' = 'classic',
): Promise<GameRow> {
    const { data, error } = await db
        .from('games')
        .insert({ seed, mode })
        .select('id, seed, mode, rematch_id')
        .single()
    if (error) throw new Error(`création du salon impossible : ${error.message}`)
    return data as GameRow
}

export async function loadRoom(db: SupabaseClient, id: string): Promise<GameRow | null> {
    const { data, error } = await db
        .from('games')
        .select('id, seed, mode, rematch_id')
        .eq('id', id)
        .maybeSingle()
    if (error) throw new Error(`salon illisible : ${error.message}`)
    return (data as GameRow | null) ?? null
}
