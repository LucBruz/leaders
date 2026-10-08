// Registre des 16 cartes Personnage, plus le Leader.
//
// Ce fichier ne contient QUE des données mécaniques : identifiants et drapeaux
// dont le moteur a besoin. Aucun nom affiché, aucun texte de règle, aucune
// illustration — tout cela vit dans `app/data/`. Cette séparation est ce qui
// permettrait de rethématiser le jeu sans toucher une ligne de moteur.

export type CharacterId =
    | 'leader'
    // Compétences actives
    | 'acrobate'
    | 'cavalier'
    | 'cogneur'
    | 'gardeRoyal'
    | 'illusionniste'
    | 'lanceGrappin'
    | 'manipulatrice'
    | 'rodeuse'
    | 'tavernier'
    // Compétences passives
    | 'archere'
    | 'assassin'
    | 'geolier'
    | 'protecteur'
    | 'vizir'
    // Compétences spéciales
    | 'vieilOurs'
    | 'nemesis'

export type SkillKind = 'active' | 'passive' | 'special' | 'none'

export interface CharacterDef {
    id: CharacterId
    skill: SkillKind
    /** Nombre de figurines posées sur le plateau par cette carte. */
    pieces: 1 | 2
}

function def(id: CharacterId, skill: SkillKind, pieces: 1 | 2 = 1): CharacterDef {
    return { id, skill, pieces }
}

export const CHARACTERS: Readonly<Record<CharacterId, CharacterDef>> = {
    leader: def('leader', 'none'),

    acrobate: def('acrobate', 'active'),
    cavalier: def('cavalier', 'active'),
    cogneur: def('cogneur', 'active'),
    gardeRoyal: def('gardeRoyal', 'active'),
    illusionniste: def('illusionniste', 'active'),
    lanceGrappin: def('lanceGrappin', 'active'),
    manipulatrice: def('manipulatrice', 'active'),
    rodeuse: def('rodeuse', 'active'),
    tavernier: def('tavernier', 'active'),

    archere: def('archere', 'passive'),
    assassin: def('assassin', 'passive'),
    geolier: def('geolier', 'passive'),
    protecteur: def('protecteur', 'passive'),
    vizir: def('vizir', 'passive'),

    // Une seule carte, deux figurines : le Vieil Ours (slot 0) et l'Ourson (slot 1).
    vieilOurs: def('vieilOurs', 'special', 2),
    nemesis: def('nemesis', 'special'),
} as const

/** Les 16 cartes recrutables, Leader exclu. L'ordre fixe la pioche de référence. */
export const CHAMPIONS: readonly CharacterId[] = (
    Object.keys(CHARACTERS) as CharacterId[]
).filter((id) => id !== 'leader')

/** Nombre maximal de cartes devant un joueur, Leader inclus. */
export const HAND_LIMIT = 5

/** Nombre de cartes visibles au marché en mode classique. */
export const MARKET_SIZE = 3

/**
 * L'Ourson est la seconde figurine du Vieil Ours. Il se déplace comme lui mais
 * ne participe pas à la Capture du Leader adverse.
 */
export function isCub(character: CharacterId, slot: number): boolean {
    return character === 'vieilOurs' && slot === 1
}
