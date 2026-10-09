// État de la partie côté interface.
//
// Le store ne contient AUCUNE règle : il délègue tout à `engine/`. Son rôle est
// la sélection, le journal et la file d'animations. C'est ce qui garantit que
// le surlignage affiché et la validation d'un coup ne peuvent pas diverger —
// ils sortent du même `legalActions`.

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { CellId } from '../../engine/board'
import { apply } from '../../engine/apply'
import { currentDecider, legalActions } from '../../engine/legal'
import { createGame } from '../../engine/setup'
import type { CharacterId } from '../../engine/characters'
import type { Action, GameEvent, GameState, PieceId, Seat } from '../../engine/types'
import type { Session } from '../services/session'
import type { Transport } from '../services/transport'
import { anchorsFor, labelOf } from '../utils/actionAnchor'
import { nomDe } from '../data/characters.fr'

export const useGameStore = defineStore('game', () => {
    const state = shallowRef<GameState>(createGame({ seed: 1 }))
    const selected = ref<PieceId | null>(null)

    // ── Mode de jeu ───────────────────────────────────────────────────────────
    // En local, les deux joueurs partagent l'écran et jouent à tour de rôle. En
    // ligne, une Session détient l'état et le store la suit. Le reste de
    // l'interface ne fait pas la différence : seule `canAct` change.

    const session = shallowRef<Session | null>(null)
    const mySeat = ref<Seat | null>(null)
    const connectionNote = ref<string | null>(null)

    const online = computed(() => session.value !== null)

    /** Ce client peut-il agir maintenant ? En local, toujours. */
    const canAct = computed(() => !online.value || mySeat.value === decider.value)

    async function connect(options: {
        transport: Transport
        seat: Seat | null
        seed: number
        mode?: 'classic' | 'strategist'
    }) {
        const { Session } = await import('../services/session')
        const created = new Session({
            seed: options.seed,
            mode: options.mode,
            seat: options.seat,
            transport: options.transport,
            onChange: (next, applied) => {
                state.value = next
                // Le journal doit porter les coups des DEUX joueurs. Il était
                // auparavant alimenté dans `play()`, donc seul son auteur les
                // voyait ; c'est ici que passent aussi ceux de l'adversaire.
                if (applied) {
                    log.value = [
                        describe(applied.action, applied.seat, applied.before),
                        ...log.value,
                    ].slice(0, 60)
                    announceWinner(next)
                } else {
                    // Resynchronisation : on ne sait pas ce qui a changé, on
                    // reconstruit l'historique depuis le journal d'actions.
                    log.value = rebuildLog(created)
                }
                if (selected.value !== null && !actionable.value.has(selected.value)) {
                    selected.value = null
                }
            },
        })
        mySeat.value = options.seat
        session.value = created
        await created.start()
        state.value = created.state
    }

    async function disconnect() {
        await session.value?.close()
        session.value = null
        mySeat.value = null
    }
    const log = ref<string[]>([])
    /** Événements du dernier coup, consommés par le plateau pour animer. */
    const lastEvents = shallowRef<GameEvent[]>([])

    const legal = computed(() => legalActions(state.value))
    const decider = computed(() => currentDecider(state.value))
    const over = computed(() => state.value.winner !== null)

    /** Figurines du joueur qui a la main et qui peuvent encore agir. */
    const actionable = computed(() => {
        const pieces = new Set<PieceId>()
        for (const action of legal.value) {
            if ('piece' in action) pieces.add(action.piece)
        }
        return pieces
    })

    const anchors = computed<Map<CellId, Action[]>>(() =>
        selected.value === null
            ? new Map()
            : anchorsFor(state.value, legal.value, selected.value),
    )

    /** Plusieurs actions possibles sur la case cliquée : il faut trancher. */
    const choice = ref<{ cell: CellId; options: { action: Action; label: string }[] } | null>(null)

    // ── Recrutement ───────────────────────────────────────────────────────────
    // Une recrue n'a pas de figurine source : on choisit d'abord une carte au
    // marché, puis une case de pose. Le Vieil Ours en demande deux, d'où la
    // sélection progressive.

    const recruitPick = ref<CharacterId | null>(null)
    const chosenCells = ref<CellId[]>([])

    /** Recrutements encore possibles pour la carte choisie et les cases déjà prises. */
    const matchingRecruits = computed(() =>
        legal.value.filter(
            (a): a is Extract<Action, { t: 'recruit' }> =>
                a.t === 'recruit' &&
                a.character === recruitPick.value &&
                chosenCells.value.every((c) => a.cells.includes(c)),
        ),
    )

    /** Cases de pose encore proposées. L'ordre des clics n'a pas d'importance. */
    const recruitAnchors = computed<Map<CellId, Action[]>>(() => {
        const map = new Map<CellId, Action[]>()
        if (state.value.phase !== 'recruit' || recruitPick.value === null) return map
        for (const action of matchingRecruits.value) {
            for (const cell of action.cells) {
                if (chosenCells.value.includes(cell)) continue
                const bucket = map.get(cell)
                if (bucket) bucket.push(action)
                else map.set(cell, [action])
            }
        }
        return map
    })

    /** Cartes du marché réellement recrutables, placement compris. */
    const recruitable = computed(() => {
        const ids = new Set<CharacterId>()
        for (const action of legal.value) if (action.t === 'recruit') ids.add(action.character)
        return ids
    })

    function pickCharacter(character: CharacterId | null) {
        chosenCells.value = []
        recruitPick.value =
            character !== null && recruitable.value.has(character) ? character : null
    }

    function clickRecruitCell(cell: CellId) {
        if (!recruitAnchors.value.has(cell)) return
        const chosen = [...chosenCells.value, cell]
        const complete = matchingRecruits.value.find(
            (a) => a.cells.length === chosen.length && chosen.every((c) => a.cells.includes(c)),
        )
        if (complete) {
            play(complete)
            recruitPick.value = null
            chosenCells.value = []
            return
        }
        chosenCells.value = chosen
    }

    function select(piece: PieceId | null) {
        choice.value = null
        selected.value =
            piece !== null && actionable.value.has(piece) ? piece : null
    }

    // ── Consultation ──────────────────────────────────────────────────────────
    // Indépendante du jeu : on consulte le pouvoir de n'importe quelle figurine,
    // la sienne comme celle d'en face, à son tour ou non. C'est un jeu à
    // information parfaite, rien n'est caché.

    const inspected = ref<CharacterId | null>(null)

    function inspect(character: CharacterId | null) {
        inspected.value = character
    }

    function inspectPiece(piece: PieceId) {
        inspected.value = state.value.pieces[piece]?.character ?? null
    }

    const nomSiege = (seat: Seat) => (seat === 0 ? 'Bleu' : 'Rouge')

    /**
     * Phrase du journal pour un coup.
     *
     * Le siège et l'état sont explicites, et non déduits du store : il faut
     * pouvoir décrire un coup reçu de l'adversaire, à partir de l'état qui
     * précédait — après coup, les figurines ont bougé.
     */
    function describe(action: Action, seat: Seat, before: GameState = state.value): string {
        const qui = nomSiege(seat)
        if (action.t === 'recruit') return `${qui} recrute ${nomDe(action.character)}`
        if (action.t === 'skipRecruit') return `${qui} ne peut pas recruter`
        if (action.t === 'banish') return `${qui} bannit ${nomDe(action.character)}`
        if (action.t === 'endActions') return `${qui} termine ses actions`
        const piece = 'piece' in action ? before.pieces[action.piece] : null
        const nom = piece ? nomDe(piece.character) : '?'
        return `${qui} — ${nom} : ${labelOf(before, action, nomDe)}`
    }

    function announceWinner(next: GameState) {
        if (next.winner === null) return
        log.value = [`Victoire du joueur ${nomSiege(next.winner)}`, ...log.value]
    }

    /**
     * Reconstruit tout l'historique en rejouant le journal d'actions.
     *
     * Chemin froid, réservé aux resynchronisations : on ne sait alors pas quels
     * coups ont été manqués, donc on repart de zéro plutôt que de deviner.
     */
    function rebuildLog(active: Session): string[] {
        const record = active.toRecord()
        const lines: string[] = []
        let cursor = createGame({ seed: record.seed, mode: record.mode })
        for (const action of record.actions) {
            const seat = cursor.pending?.decider ?? cursor.turn
            lines.unshift(describe(action, seat, cursor))
            cursor = apply(cursor, action).state
        }
        if (cursor.winner !== null) lines.unshift(`Victoire du joueur ${nomSiege(cursor.winner)}`)
        return lines.slice(0, 60)
    }

    function play(action: Action) {
        if (!canAct.value) return

        if (session.value) {
            // En ligne, la Session applique le coup et nous rappelle par
            // `onChange` — c'est lui qui tient le journal, pour les deux
            // joueurs. Ici on ne traite que le refus éventuel.
            void session.value.play(action).then((outcome) => {
                if (!outcome.ok) {
                    connectionNote.value =
                        outcome.reason === 'resynced'
                            ? 'Coup refusé : la partie a été resynchronisée.'
                            : outcome.reason === 'notYourTurn'
                              ? "Ce n'est pas votre tour."
                              : 'Coup refusé.'
                    return
                }
                connectionNote.value = null
            })
            choice.value = null
            return
        }

        // En local, pas de Session : le store applique et journalise lui-même.
        const seat = decider.value ?? state.value.turn
        const line = describe(action, seat, state.value)
        const result = apply(state.value, action)
        state.value = result.state
        lastEvents.value = result.events
        log.value = [line, ...log.value].slice(0, 60)
        choice.value = null
        // On garde la figurine sélectionnée si elle peut encore agir.
        if (selected.value !== null && !actionable.value.has(selected.value)) {
            selected.value = null
        }
        announceWinner(state.value)
    }

    function reset(seed = Date.now() & 0xffff) {
        state.value = createGame({ seed })
        selected.value = null
        choice.value = null
        recruitPick.value = null
        chosenCells.value = []
        lastEvents.value = []
        log.value = []
    }

    /**
     * Toutes les cases cliquables à cet instant. Vide quand ce n'est pas à ce
     * client de jouer : sans cela on surlignerait les coups de l'adversaire,
     * cliquables en apparence mais sans effet.
     */
    const highlighted = computed<Map<CellId, Action[]>>(() => {
        if (!canAct.value) return new Map()
        return state.value.phase === 'recruit' ? recruitAnchors.value : anchors.value
    })

    function clickCell(cell: CellId) {
        if (state.value.phase === 'recruit') {
            clickRecruitCell(cell)
            return
        }
        const options = anchors.value.get(cell)
        if (!options || options.length === 0) return
        if (options.length === 1) {
            play(options[0]!)
            return
        }
        choice.value = {
            cell,
            options: options.map((action) => ({
                action,
                label: labelOf(state.value, action, nomDe),
            })),
        }
    }

    return {
        state,
        inspected,
        inspect,
        inspectPiece,
        online,
        mySeat,
        canAct,
        connectionNote,
        connect,
        disconnect,
        recruitPick,
        chosenCells,
        recruitAnchors,
        recruitable,
        highlighted,
        pickCharacter,
        selected,
        log,
        lastEvents,
        legal,
        decider,
        over,
        actionable,
        anchors,
        choice,
        select,
        play,
        clickCell,
        reset,
        describe,
    }
})
