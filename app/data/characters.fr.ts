// Couche de présentation des personnages : noms affichés et textes de règle.
//
// Le moteur ne connaît que des identifiants et des drapeaux mécaniques. Tout ce
// qui est lisible par un humain vit ici. C'est cette séparation qui permettrait
// de rethématiser entièrement le jeu sans toucher une ligne de `engine/`.

import type { CharacterId } from '../../engine/characters'

export interface CharacterText {
    nom: string
    /**
     * Description de la compétence, rédigée pour ce projet.
     *
     * Volontairement reformulée plutôt que recopiée du livret : les règles d'un
     * jeu ne sont pas protégeables en droit d'auteur, leur rédaction l'est.
     * Le sens doit rester strictement fidèle — en cas de doute sur un cas
     * limite, c'est le livret qui tranche, pas ce texte.
     */
    texte: string
}

export const FR: Record<CharacterId, CharacterText> = {
    leader: {
        nom: 'Leader',
        texte: "Faites tomber celui d'en face et la partie est à vous. Attention : il vous est interdit de conduire le vôtre là où il se ferait prendre ou enfermer.",
    },

    acrobate: {
        nom: 'Acrobate',
        texte: "Franchit d'un bond une figurine voisine et retombe juste derrière elle, en ligne droite. Peut enchaîner un second bond dans la foulée.",
    },
    cavalier: {
        nom: 'Cavalier',
        texte: "Couvre deux cases d'affilée dans une même direction. La case traversée doit être dégagée.",
    },
    cogneur: {
        nom: 'Cogneur',
        texte: "Bouscule un adversaire à son contact : il prend sa place, et l'autre recule d'une case — à vous de choisir laquelle parmi les trois situées derrière lui.",
    },
    gardeRoyal: {
        nom: 'Garde Royal',
        texte: "Rallie son Leader où qu'il se trouve, en venant se poster à ses côtés, et peut encore faire un pas dans la foulée.",
    },
    illusionniste: {
        nom: 'Illusionniste',
        texte: "Permute sa place avec n'importe quelle figurine qu'il aperçoit en ligne droite, pourvu qu'elle ne soit pas collée à lui.",
    },
    lanceGrappin: {
        nom: 'Lance-Grappin',
        texte: "Accroche une figurine aperçue en ligne droite : au choix, il se hisse jusqu'à elle ou la ramène à lui. Dans les deux cas, on s'arrête juste avant le contact.",
    },
    manipulatrice: {
        nom: 'Manipulatrice',
        texte: "Contraint à distance un adversaire qu'elle aperçoit en ligne droite à faire un pas, dans la direction de votre choix. Sans le toucher, et sans bouger elle-même.",
    },
    rodeuse: {
        nom: 'Rôdeuse',
        texte: "Se faufile n'importe où sur le plateau, à la seule condition de ne pas se poser au contact d'un adversaire.",
    },
    tavernier: {
        nom: 'Tavernier',
        texte: "Pousse d'une case un compagnon qui se tient juste à côté de lui.",
    },

    archere: {
        nom: 'Archère',
        texte: "Compte dans une prise à deux cases de distance, en ligne droite, même si quelqu'un lui bouche la vue. En revanche, collée au Leader, elle ne sert plus à rien : il lui faut du recul.",
    },
    assassin: {
        nom: 'Assassin',
        texte: "Lui seul suffit. Nul besoin d'un second pour faire tomber le Leader d'en face.",
    },
    geolier: {
        nom: 'Geôlier',
        texte: "Les adversaires à son contact ne peuvent plus déclencher leur pouvoir. Une manœuvre déjà entamée va toutefois jusqu'à son terme.",
    },
    protecteur: {
        nom: 'Protecteur',
        texte: "Aucun pouvoir adverse ne parvient à le déplacer, ni lui ni les compagnons qui l'entourent.",
    },
    vizir: {
        nom: 'Vizir',
        texte: "Tant qu'il est en jeu, votre Leader gagne une case de portée à chacun de ses déplacements.",
    },

    vieilOurs: {
        nom: 'Vieil Ours et Ourson',
        texte: "Une seule carte pour deux figurines, posées chacune sur un emplacement de recrutement. Dans le tour, faites bouger l'une, l'autre, ou les deux. L'Ourson, lui, ne compte jamais dans une prise.",
    },
    nemesis: {
        nom: 'Némésis',
        texte: "Jamais d'action de son plein gré. Mais au moindre déplacement du Leader adverse, où qu'il survienne et même pendant son tour, elle est forcée d'avancer de deux cases.",
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
