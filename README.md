# FranceStudent mobile

Le projet Capacitor commun se trouve dans `mobile/` :

- `mobile/www/` : interface et logique partagées par Android et iPhone ;
- `mobile/android-native/` : sources natives Android, copiées dans le projet Android généré et ignoré par Git (`mobile/android/`) ;
- `mobile/ios/` : projet natif iPhone versionné ;
- `mobile/scripts/` et `mobile/test-*.cjs` : scripts et vérifications communs ou propres aux plateformes.

Depuis `mobile/`, installer les dépendances avec `npm ci`. Voir [Android](mobile/README-ANDROID.md) et [iPhone](mobile/README-IPHONE.md) pour les commandes et les limites.

Les workflows GitHub Actions sont indépendants : les changements Android seuls déclenchent la compilation Android, les changements iPhone seuls la compilation iPhone, et les changements partagés déclenchent les deux. Le workflow Android fournit un APK debug de vérification ; il ne publie pas de mise à jour Android. Le workflow iPhone construit un IPA et tente de le publier sur SideStore. Les numéros et la distribution restent propres à chaque plateforme. La publication iPhone a rencontré une erreur 403 malgré `contents: write` ; elle doit être vérifiée après correction de sa cause.

La source SideStore publiée conserve ses liens vers les anciennes versions. Une nouvelle source est générée à partir de chaque IPA avec une icône liée au commit de construction.
