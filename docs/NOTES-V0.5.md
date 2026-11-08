# GLM Publisher v0.5 — notes de rendu

L'objectif est de rapprocher l'affichage de la traduction intégrée de celui des pages historiques de La Grande Librairie de Mordheim.

## Changements

- Chargement explicite de la police `UnifrakturMaguntia` utilisée dans les titres de Google Docs, et de `Merriweather` pour les paragraphes.
- Sections repliables centrées, séparateurs fins et chevrons discrets à droite.
- Sections fermées par défaut ; comportement accessible avec `details` et `summary`.
- Suppression du titre de document artificiel, du sommaire généré et des boutons de déploiement global.
- Suppression de l'accordéon faisant doublon avec le titre principal de la page, tout en conservant son contenu éditorial.
- Le changement d'habillage concerne le **rendu public**, pas les données historiques du registre Sheets.

## Contrôles à réaliser sur le site réel

- Vérifier le rendu de **Cavalcade Maudite** sur ordinateur et sur téléphone, après actualisation du déploiement public Apps Script.
- Ouvrir les sections et vérifier que le contenu long n'est pas coupé par la hauteur du cadre Google Sites.
- Comparer les tableaux de caractéristiques, les espacements et les tabulations avec le Google Doc original.
- Vérifier que le menu du site, le bandeau noir, les PDF et les illustrations restent gérés dans Google Sites.

Les polices chargées par le site hôte ne sont pas automatiquement accessibles à l'intérieur de l'iframe Apps Script. Le script doit charger les polices dans son propre document HTML. Aucun fichier de police n'est redistribué dans ce dépôt.

## Limites

Le code ne reproduit pas un Google Doc au pixel près. Les images, équations, objets flottants, tabulations complexes et tableaux fusionnés peuvent nécessiter des corrections spécifiques. Aucun commentaire ou suggestion ne doit être effacé du Google Doc lors d'une publication.
