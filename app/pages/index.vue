<script setup lang="ts">
// Partie locale sur un même écran. Premier jalon jouable, et meilleur banc de
// test manuel du moteur avant de brancher le réseau.
import { useGameStore } from '../stores/game'

const store = useGameStore()
useHead({ title: 'Leaders' })
</script>

<template>
  <main class="page">
    <div class="stage">
      <h1>Leaders</h1>
      <HexBoard />
    </div>

    <SidePanel />

    <!-- Désambiguïsation : plusieurs actions mènent à la même case. -->
    <div v-if="store.choice" class="overlay" @click.self="store.choice = null">
      <div class="dialog">
        <h2>Quelle action ?</h2>
        <button
          v-for="(option, i) in store.choice.options"
          :key="i"
          class="opt"
          @click="store.play(option.action)"
        >
          {{ option.label }}
        </button>
        <button class="opt cancel" @click="store.choice = null">Annuler</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page {
  min-height: 100%; display: flex; gap: 40px; align-items: center;
  justify-content: center; padding: 28px 26px; flex-wrap: wrap;
}
.stage { display: flex; flex-direction: column; align-items: center; gap: 26px; }
h1 {
  font-size: 13px; letter-spacing: .3em; text-transform: uppercase;
  opacity: .45; margin: 0; font-weight: 600;
}

.overlay {
  position: fixed; inset: 0; display: grid; place-items: center;
  background: rgba(10, 12, 16, .66); backdrop-filter: blur(3px); z-index: 20;
}
.dialog {
  background: #1d222b; border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 14px; padding: 18px; width: 290px;
  display: flex; flex-direction: column; gap: 8px;
}
.dialog h2 {
  font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  opacity: .45; margin: 0 0 4px; font-weight: 600;
}
.opt {
  padding: 10px 14px; border-radius: 9px; cursor: pointer; text-align: left;
  background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 255, 255, .14);
  color: inherit; font-family: inherit; font-size: 13px;
}
.opt:hover { background: rgba(255, 255, 255, .15); }
.cancel { opacity: .5; text-align: center; }
</style>
