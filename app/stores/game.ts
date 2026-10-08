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

    async function connect(options: { roomId: string; seat: Seat | null; seed: number }) {
        const { BroadcastTransport } = await import('../services/transport')
        const { Session } = await import('../services/session')
        const created = new Session({
            seed: options.seed,
            seat: options.seat,
            transport: new BroadcastTransport(options.roomId),
            onChange: (next) => {
                state.value = next
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

    function describe(action: Action): string {
        const seat = decider.value === 0 ? 'Bleu' : 'Rouge'
        if (action.t === 'recruit') return `${seat} recrute ${nomDe(action.character)}`
        if (action.t === 'skipRecruit') return `${seat} ne peut pas recruter`
        if (action.t === 'banish') return `${seat} bannit ${nomDe(action.character)}`
        if (action.t === 'endActions') return `${seat} termine ses actions`
        const piece = 'piece' in action ? state.value.pieces[action.piece] : null
        const qui = piece ? nomDe(piece.character) : '?'
        return `${seat} — ${qui} : ${labelOf(state.value, action, nomDe)}`
    }

    function play(action: Action) {
        if (!canAct.value) return
        const line = describe(action)

        if (session.value) {
            // En ligne, la Session applique le coup et nous rappelle via
            // onChange. Un refus est signalé plutôt que silencieux.
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
                log.value = [line, ...log.value].slice(0, 60)
            })
            choice.value = null
            return
        }

        const result = apply(state.value, action)
        state.value = result.state
        lastEvents.value = result.events
        log.value = [line, ...log.value].slice(0, 60)
        choice.value = null
        // On garde la figurine sélectionnée si elle peut encore agir.
        if (selected.value !== null && !actionable.value.has(selected.value)) {
            selected.value = null
        }
        if (state.value.winner !== null) {
            log.value = [`Victoire du joueur ${state.value.winner === 0 ? 'Bleu' : 'Rouge'}`, ...log.value]
        }
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
