// Couche de présentation des personnages : noms affichés et textes de règle.
//
// Le moteur ne connaît que des identifiants et des drapeaux mécaniques. Tout ce
// qui est lisible par un humain vit ici. C'est cette séparation qui permettrait
// de rethématiser entièrement le jeu sans toucher une ligne de `engine/`.

import type { CharacterId } from '../../engine/characters'

export interface CharacterText {
    nom: string
    /** Texte de la compétence, repris de la règle officielle. */
    texte: string
}

export const FR: Record<CharacterId, CharacterText> = {
    leader: {
        nom: 'Leader',
        texte: "Capturez le Leader adverse pour gagner. Vous ne pouvez pas placer le vôtre là où il serait capturé ou encerclé.",
    },

    acrobate: {
        nom: 'Acrobate',
        texte: "Saute en ligne droite par-dessus un Personnage adjacent. Peut effectuer jusqu'à deux sauts consécutifs.",
    },
    cavalier: {
        nom: 'Cavalier',
        texte: 'Se déplace de deux cases en ligne droite.',
    },
    cogneur: {
        nom: 'Cogneur',
        texte: "Se déplace sur la case d'un ennemi adjacent et le pousse sur l'une des trois cases opposées de votre choix.",
    },
    gardeRoyal: {
        nom: 'Garde Royal',
        texte: "Se déplace, depuis n'importe quelle case, sur une case adjacente à votre Leader, puis peut ensuite se déplacer d'une case.",
    },
    illusionniste: {
        nom: 'Illusionniste',
        texte: 'Échange de position avec un Personnage visible en ligne droite et non-adjacent.',
    },
    lanceGrappin: {
        nom: 'Lance-Grappin',
        texte: "Se déplace jusqu'à un Personnage visible en ligne droite, ou l'attire jusqu'à lui.",
    },
    manipulatrice: {
        nom: 'Manipulatrice',
        texte: "Déplace d'une case un ennemi visible en ligne droite et non-adjacent.",
    },
    rodeuse: {
        nom: 'Rôdeuse',
        texte: "Se déplace sur n'importe quelle case non-adjacente à un ennemi.",
    },
    tavernier: {
        nom: 'Tavernier',
        texte: "Déplace d'une case un allié adjacent.",
    },

    archere: {
        nom: 'Archère',
        texte: "Participe à la capture du Leader adverse à une distance de deux cases en ligne droite, même si la vue est bloquée. Ne participe pas si elle lui est adjacente.",
    },
    assassin: {
        nom: 'Assassin',
        texte: 'Capture le Leader adverse à lui seul, sans autre allié participant.',
    },
    geolier: {
        nom: 'Geôlier',
        texte: "Les ennemis adjacents ayant une compétence active ne peuvent pas l'utiliser. N'interrompt pas une compétence déjà engagée.",
    },
    protecteur: {
        nom: 'Protecteur',
        texte: 'Les compétences des ennemis ne peuvent déplacer ni le Protecteur, ni ses alliés adjacents.',
    },
    vizir: {
        nom: 'Vizir',
        texte: "Votre Leader peut se déplacer d'une case supplémentaire lors de son action.",
    },

    vieilOurs: {
        nom: 'Vieil Ours et Ourson',
        texte: "Une seule carte, deux figurines, placées chacune sur une case de Recrutement. Vous pouvez déplacer l'une, l'autre, ou les deux. L'Ourson ne participe pas à la capture.",
    },
    nemesis: {
        nom: 'Némésis',
        texte: "Ne fait aucune action pendant sa phase d'Actions. À la fin de toute action qui déplace le Leader adverse, elle DOIT se déplacer de deux cases.",
    },
}

export const nomDe = (id: CharacterId): string => FR[id]?.nom ?? id

/**
 * Fichier du jeton. Le Leader a une variante par siège : la couleur du socle ne
 * suffit pas à distinguer les camps d'un coup d'œil.
 */
export function jetonDe(id: CharacterId, seat: 0 | 1, slot = 0): string {
    if (id === 'leader') return seat === 1 ? 'leader-p1' : 'leader'
    if (id === 'vieilOurs' && slot === 1) return 'ourson'
    return id
}
