export default defineNuxtConfig({
  compatibilityDate: '2026-10-08',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],

  // Enregistre les composants par leur nom de fichier, sans préfixe de dossier.
  // Sans cela, components/board/HexBoard.vue s'appelle BoardHexBoard et le
  // composant ne se résout pas — piège déjà rencontré sur ce projet.
  components: [{ path: '~/components', pathPrefix: false }],

  // `ssr: false` produit une page blanche avec Nuxt 4.5.2 et Vite 8.3.3 —
  // le rendu échoue sur « Either manifest or precomputed data must be
  // provided ». On garde donc le rendu serveur, qui fonctionne.

  // Ces valeurs sont lues AU DÉMARRAGE du serveur, pas au build : le serveur
  // de production doit donc disposer de NUXT_PUBLIC_SUPABASE_URL et
  // NUXT_PUBLIC_SUPABASE_KEY dans son environnement. Sans elles, le jeu
  // bascule silencieusement sur le transport BroadcastChannel, qui ne relie
  // que deux onglets du même navigateur — d'où le contrôle après déploiement.
  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseKey: '',
    },
  },

  app: {
    head: {
      titleTemplate: '%s',
      // Annonce le thème sombre dès le HTML servi : aucune feuille de style
      // n'est encore résolue à ce moment-là, c'est la seule chose qui évite
      // un flash blanc au premier rendu.
      meta: [
        { name: 'color-scheme', content: 'dark' },
        { name: 'theme-color', content: '#1b2029' },
        {
          name: 'description',
          content:
            'Leaders — jeu de duel sur plateau hexagonal. Recrutez quatre champions et capturez le Leader adverse.',
        },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
