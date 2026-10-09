// Déclaration pm2 de l'application, à déposer dans /home/projets/leaders/.
//
// Ce fichier vit à la RACINE du dossier applicatif, donc en dehors du .output/
// que rsync remplace à chaque déploiement : l'environnement survit aux mises à
// jour, et il n'y a rien à refaire après un déploiement.
//
// Les deux valeurs Supabase y figurent en clair, et c'est voulu : l'URL et la
// clé publishable sont servies à chaque visiteur dans le HTML de la page. Elles
// sont publiques par conception. Le mot de passe de la base, lui, n'a rien à
// faire ici — l'application ne s'en sert pas.
//
// Sans ces variables, le jeu démarre, le plateau s'affiche et les parties
// locales fonctionnent, mais le mode en ligne bascule silencieusement sur
// BroadcastChannel, qui ne relie que deux onglets du même navigateur. Aucune
// erreur n'apparaît : c'est pour cela que le workflow vérifie, après
// redémarrage, que l'URL Supabase est bien présente dans le HTML servi.

module.exports = {
  apps: [
    {
      name: 'leaders',
      script: '.output/server/index.mjs',
      cwd: '/home/projets/leaders',
      env: {
        // encore-game occupe le 3001 et on-va-ou-v2 le 3002.
        PORT: 3003,
        NUXT_PUBLIC_SUPABASE_URL: 'https://qzhrlrnvbuocwcxaluxl.supabase.co',
        NUXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_6H_90HdZ4s1I4Qms07S16w_wxFKuY3n',
      },
    },
  ],
}
