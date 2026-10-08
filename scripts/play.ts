// Harnais de parties automatiques.
//
// Joue des milliers de parties en coups aléatoires et échoue sur le premier
// plantage, état incohérent ou blocage. C'est le filet qui attrape les
// interactions de compétences qu'aucun test unitaire n'aura prévues : les tests
// vérifient ce à quoi on a pensé, celui-ci balaie ce à quoi on n'a pas pensé.
//
//   npx tsx scripts/play.ts [parties] [--mode=classic|strategist] [--verbose]

import { CELL_COUNT, onBoard } from '../engine/board'
import { HAND_LIMIT } from '../engine/characters'
import { apply } from '../engine/apply'
import { legalActions } from '../engine/legal'
import { makeRng } from '../engine/rng'
import { createGame } from '../engine/setup'
import type { Action, GameState } from '../engine/types'

/** Plafond de sécurité : une partie qui dépasse ce nombre d'actions est suspecte. */
const MAX_ACTIONS = 4000

function invariants(state: GameState, context: string): void {
    const fail = (why: string) => {
        throw new Error(`${context} — invariant rompu : ${why}`)
    }

    for (let id = 0; id < state.pieces.length; id++) {
        const piece = state.pieces[id]!
        if (!onBoard(piece.cell)) fail(`figurine ${id} hors plateau (case ${piece.cell})`)
        if (state.board[piece.cell] !== id) {
            fail(`figurine ${id} en case ${piece.cell}, occupée par ${state.board[piece.cell]}`)
        }
    }

    for (let cell = 0; cell < CELL_COUNT; cell++) {
        const id = state.board[cell]
        if (id === null) continue
        if (state.pieces[id]?.cell !== cell) fail(`case ${cell} référence la figurine ${id} à tort`)
    }

    for (const seat of [0, 1] as const) {
        const hand = state.hands[seat]
        if (hand.length > HAND_LIMIT) fail(`main du siège ${seat} à ${hand.length} cartes`)
        if (new Set(hand).size !== hand.length) fail(`carte en double dans la main ${seat}`)
        if (!hand.includes('leader')) fail(`siège ${seat} sans carte Leader`)
    }

    const toutes = [...state.hands[0], ...state.hands[1], ...state.market, ...state.deck, ...state.banned]
    const champions = toutes.filter((c) => c !== 'leader')
    if (new Set(champions).size !== champions.length) fail('un Champion existe en double exemplaire')
    if (champions.length !== 16) fail(`${champions.length} Champions au total au lieu de 16`)
}

interface Outcome {
    winner: 0 | 1 | null
    actions: number
}

function playOne(seed: number, mode: 'classic' | 'strategist'): Outcome {
    const rng = makeRng(seed)
    let state = createGame({ seed, mode })
    invariants(state, `graine ${seed}, mise en place`)

    for (let n = 0; n < MAX_ACTIONS; n++) {
        if (state.winner !== null) return { winner: state.winner, actions: n }

        const actions = legalActions(state)
        if (actions.length === 0) {
            // Aucun coup légal et pas de vainqueur : le moteur est coincé.
            throw new Error(
                `graine ${seed}, coup ${n} — aucune action légale en phase « ${state.phase} » ` +
                    `pour le siège ${state.turn}, sans vainqueur`,
            )
        }

        const action: Action = actions[Math.floor(rng() * actions.length)]!
        try {
            state = apply(state, action).state
        } catch (error) {
            throw new Error(
                `graine ${seed}, coup ${n} — ${JSON.stringify(action)} a échoué : ${(error as Error).message}`,
            )
        }
        invariants(state, `graine ${seed}, coup ${n} après ${action.t}`)
    }

    return { winner: null, actions: MAX_ACTIONS }
}

// ─── Entrée ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 2000)
const mode = (args.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'classic') as
    | 'classic'
    | 'strategist'
const verbose = args.includes('--verbose')

const wins = [0, 0]
let timeouts = 0
let total = 0
const started = Date.now()

for (let seed = 1; seed <= count; seed++) {
    const { winner, actions } = playOne(seed, mode)
    total += actions
    if (winner === null) {
        timeouts += 1
        if (verbose) console.log(`graine ${seed} : aucune conclusion en ${MAX_ACTIONS} actions`)
    } else {
        wins[winner] += 1
    }
}

const seconds = (Date.now() - started) / 1000
console.log(`${count} parties en mode ${mode}, ${seconds.toFixed(1)} s`)
console.log(`  siège 0 : ${wins[0]} victoires (${((wins[0]! / count) * 100).toFixed(1)} %)`)
console.log(`  siège 1 : ${wins[1]} victoires (${((wins[1]! / count) * 100).toFixed(1)} %)`)
console.log(`  sans conclusion : ${timeouts}`)
console.log(`  longueur moyenne : ${(total / count).toFixed(1)} actions`)

if (timeouts > 0) {
    console.error(`\n${timeouts} partie(s) sans conclusion — à examiner.`)
    process.exit(1)
}
