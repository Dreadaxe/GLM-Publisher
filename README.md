# GLM Publisher

Assistant de publication pour **La Grande Librairie de Mordheim** : Google Docs → validation manuelle → instantanés Google Sheets → affichage dans Google Sites.

**Version actuelle : v0.5** — Prototype en cours de validation sur Google Sites.

## Fonctionnement

- **Google Docs** : onglet `VF` pour le texte ; `Change-log` pour le suivi éditorial.
- **Administration** : analyse et comparaison du contenu, validation explicite et sélection des sections à publier.
- **Google Sheets** : conservation des versions publiées et restauration.
- **Google Sites** : intégration d’une application Web Apps Script de lecture, sans modifier les blocs natifs de Sites.
- **Commentaires et suggestions** : les commentaires restent dans Google Docs ; les suggestions non acceptées ne figurent pas dans la version publique.
- **Présentation** : sections repliables et styles avec `UnifrakturMaguntia` / `Merriweather`.

## Sources

- `Code.gs` — moteur Apps Script, conversion Docs → HTML, publication et versions.
- `Admin.html` — interface d'administration.
- `appsscript.json` — manifeste et services Google requis.
- `INSTALLATION.md` — installation, déploiement et synchronisation.
- `CHANGELOG.md` — évolution des versions.
- `SECURITY.md` — précautions de confidentialité et d’accès.

Consultez [INSTALLATION.md](INSTALLATION.md) avant toute mise en production.

## Limites

Le rendu de Google Docs n’est pas un export au pixel près (tabulations, images et tableaux complexes). La hauteur de l’iframe Google Sites peut nécessiter un réglage manuel. Après chaque modification des sources, il faut créer une nouvelle version des déploiements Apps Script. Les commentaires et les documents privés ne doivent jamais être publiés dans ce dépôt.

**Licence :** aucune licence libre n’est accordée à ce stade.
