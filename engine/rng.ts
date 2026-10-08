// Générateur pseudo-aléatoire déterministe.
//
// C'est la pièce qui rend le online possible sans autorité serveur : la pioche
// est mélangée une seule fois à partir d'une graine partagée, et les deux
// clients en dérivent exactement le même ordre. Aucun `Math.random` ne doit
// jamais apparaître ailleurs dans le moteur.

/** mulberry32 — court, rapide, et surtout reproductible d'une machine à l'autre. */
export function makeRng(seed: number): () => number {
    let a = seed >>> 0
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Mélange de Fisher-Yates. Ne modifie pas le tableau d'origine. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const tmp = out[i]!
        out[i] = out[j]!
        out[j] = tmp
    }
    return out
}

/** Transforme une chaîne (identifiant de partie, lien de salon) en graine. */
export function seedFrom(text: string): number {
    let h = 2166136261 >>> 0
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}
