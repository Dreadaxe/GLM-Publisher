# Sécurité et confidentialité

Ce dépôt contient le code de GLM Publisher, **pas** les données éditoriales ou les identifiants d'un déploiement réel.

- Ne jamais publier de token OAuth, clé API, identifiant personnel d'administrateur, registre Google Sheets, commentaire privé ou export de Google Docs non publié.
- `GLM_SPREADSHEET_ID` et `GLM_ADMIN_EMAILS` sont conservés dans `PropertiesService` (propriétés du script Apps Script), et non dans ce dépôt.
- Le déploiement Web **public** s'exécute avec les permissions du propriétaire et ne doit servir que les versions déjà validées.
- Le déploiement **administration** s'exécute comme *utilisateur accédant à l'application*, avec vérification de l'adresse autorisée **côté serveur**.
- Vérifier en navigation privée le refus d'accès à `?admin=1` sur le déploiement public.
- Le contrôle d'identité dépend du comportement des sessions Google ; tester avec des comptes autorisés et non autorisés avant d'utiliser l'application en production.
- Ne jamais confondre une publication GitHub et un déploiement Apps Script : les commits GitHub ne mettent pas le site public à jour automatiquement.

Le projet est encore un prototype et **n'a pas subi d'audit de sécurité indépendant**. Définir une licence avant de solliciter des contributions externes.

## Synchronisation GitHub Actions

Le workflow n'utilise les identifiants Google que sur les exécuteurs GitHub Actions, via le secret `CLASPRC_JSON`. **Ce secret contient un jeton d'actualisation sensible** : ne jamais l'afficher, le copier dans une issue ou le commiter. La variable `GLM_SCRIPT_ID` désigne le projet Apps Script et **ne doit pas être confondue avec les identifiants de publication**. Le push automatique est désactivé par défaut ; il nécessite `GLM_CLASP_AUTO_SYNC=true`.

Seuls cinq fichiers sont transférés vers Apps Script : `Code.gs`, `Admin.html`, `Publication.gs`, `Search.gs` et `appsscript.json`. La création d'une version de déploiement Web reste manuelle. La synchronisation écrase l'ensemble des fichiers de code du **brouillon Apps Script cible** : sauvegarder les modifications non commitées avant activation.

## Contenu public v0.6

La « Fiche de publication » peut contenir des noms, URL et illustrations : l'administrateur doit valider la diffusion de chaque élément et vérifier que les liens PDF et images sont publics. Les commentaires et suggestions Google Docs restent internes. `SearchIndex` ne doit être rempli que depuis les instantanés publiés ; les résultats sont filtrés sur la version active de chaque publication.
