// Représentation canonique d'une valeur, pour comparer deux actions.
//
// `JSON.stringify` dépend de l'ordre d'insertion des clés. Or une action fait
// l'aller-retour par Postgres en `jsonb`, qui réordonne les clés : le moteur
// produit {t, piece, to} et la base renvoie {t, to, piece}. La même action
// donne alors deux chaînes différentes, et une comparaison naïve la déclare
// illégale — ce qui casse tout le jeu en ligne, sans erreur visible.
//
// On trie donc les clés d'objet. Les tableaux, eux, gardent leur ordre : il
// porte du sens pour `jumps`, `cells` et `path`.

export function canonical(value: unknown): string {
    // `undefined` est assimilé à `null` : JSON ne sait pas le transporter, donc
    // les deux arrivent indistinguables sur le réseau. Les traiter séparément
    // ferait rejeter une action sur une différence qui ne peut pas exister.
    if (value === undefined) return 'null'
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    const entries = Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    return `{${entries.join(',')}}`
}

/** Deux valeurs décrivent-elles la même chose, à l'ordre des clés près ? */
export function sameValue(a: unknown, b: unknown): boolean {
    return canonical(a) === canonical(b)
}
