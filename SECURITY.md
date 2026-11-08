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
