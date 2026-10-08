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
}

export async function createRoom(
    db: SupabaseClient,
    seed: number,
    mode: 'classic' | 'strategist' = 'classic',
): Promise<GameRow> {
    const { data, error } = await db
        .from('games')
        .insert({ seed, mode })
        .select('id, seed, mode')
        .single()
    if (error) throw new Error(`création du salon impossible : ${error.message}`)
    return data as GameRow
}

export async function loadRoom(db: SupabaseClient, id: string): Promise<GameRow | null> {
    const { data, error } = await db
        .from('games')
        .select('id, seed, mode')
        .eq('id', id)
        .maybeSingle()
    if (error) throw new Error(`salon illisible : ${error.message}`)
    return (data as GameRow | null) ?? null
}
