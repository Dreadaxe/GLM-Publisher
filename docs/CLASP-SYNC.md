# Synchronisation GitHub → Google Apps Script avec clasp

Le workflow `.github/workflows/apps-script.yml` synchronise **uniquement le code brouillon** du projet Apps Script existant. Il **ne met pas automatiquement les versions publiques en production**, n'affecte pas les propriétés du script et ne modifie pas le Google Sheets contenant les publications.

## 1. Ce qui est déjà en place

- Contrôle syntaxique de `Code.gs`, présence de `Admin.html` et vérification du manifeste par `scripts/verify-source.mjs`.
- Workflow GitHub Actions pour GitHub → Apps Script.
- Envoi strictement limité à `Code.gs`, `Admin.html` et `appsscript.json` grâce au répertoire temporaire `.clasp-stage`.
- Version fixée de clasp : `@google/clasp@3.4.1`, avec Node.js 22.
- Aucun `clasp push` exécuté tant que les paramètres Google ne sont pas configurés.

## 2. Autoriser l'API Apps Script

Ouvrir [les paramètres Apps Script](https://script.google.com/home/usersettings), puis activer **API Google Apps Script**.

Cette option autorise clasp à gérer le projet Apps Script via l'API. Elle ne rend pas le projet public.

## 3. Authentification sur Windows (PowerShell)

Installer Node.js 22 ou une version LTS plus récente, puis dans PowerShell :

```powershell
node --version
npm install --global @google/clasp@3.4.1
clasp login
clasp show-authorized-user
```

La commande `clasp login` ouvre Google dans le navigateur : sélectionner le même compte qui possède le projet **GLM Publisher**. Les identifiants restent localement dans `$HOME\.clasprc.json`.

**Ne jamais transmettre ce fichier ni ses jetons dans une conversation, un ticket, un commit ou un dépôt GitHub.** Ils autorisent des opérations sur le compte Apps Script.

Pour préparer sa valeur secrète dans le presse-papiers, sur **ton ordinateur Windows seulement** :

```powershell
Get-Content "$HOME\.clasprc.json" -Raw | Set-Clipboard
```

## 4. Configurer GitHub

Ouvrir le dépôt : [Paramètres Actions](https://github.com/Dreadaxe/GLM-Publisher/settings/secrets/actions).

Dans **Settings → Secrets and variables → Actions** :

### Secret du dépôt

Onglet **Secrets** → **New repository secret** :

- Nom exact : `CLASPRC_JSON`
- Valeur : contenu intégral de `$HOME\.clasprc.json` copié depuis ton ordinateur.
- Ne pas afficher cette valeur dans les messages de discussion ni dans les journaux.

### Identifiant du projet Apps Script

Dans l'éditeur **GLM Publisher → Paramètres du projet (roue dentée) → Identifiant de script**, copier l'identifiant du **projet** et non celui d'un déploiement Web.

Onglet **Variables** → **New repository variable** :

- Nom : `GLM_SCRIPT_ID`
- Valeur : l'identifiant du projet Apps Script existant.

### Activer plus tard la synchronisation automatique

Une fois le premier essai validé, créer une seconde **variable** GitHub :

- Nom : `GLM_CLASP_AUTO_SYNC`
- Valeur : `true`

Tant que cette variable n'est pas exactement `true`, les commits sur `main` déclenchent la **vérification**, mais pas l'envoi vers Apps Script.

## 5. Premier test manuel avant l'automatisation

Important : clasp remplace **l'ensemble des fichiers de code du projet Apps Script ciblé**, pas un fichier individuel. Si le code de l'éditeur contient des changements plus récents que GitHub, sauvegarder ces changements avant le premier envoi.

1. Vérifier que le projet Apps Script en ligne correspond au code v0.5 du dépôt.
2. Ouvrir l'onglet [Actions](https://github.com/Dreadaxe/GLM-Publisher/actions).
3. Choisir **Vérifier et synchroniser Apps Script**.
4. Cliquer sur **Run workflow → Run workflow** pour la branche `main`.
5. Vérifier que **Vérifier les sources** puis **Synchroniser le brouillon Apps Script** sont verts.
6. Ouvrir l'éditeur Apps Script existant et vérifier que les fichiers y figurent et sont à jour.
7. Tester le panneau d'administration et vérifier le fonctionnement en lecture.

Après cette vérification, activer `GLM_CLASP_AUTO_SYNC=true`.

## 6. Ce qui se passe ensuite

Un commit sur `main` modifiant les sources, le contrôle ou le workflow provoque :

```text
GitHub → contrôle syntaxique → clasp push → brouillon Apps Script
```

La **version publique en ligne reste inchangée** tant qu'un administrateur ne crée pas une nouvelle version des deux déploiements dans **Apps Script → Déployer → Gérer les déploiements**.

Ceci conserve les URLs de déploiement existantes et évite de déployer involontairement des essais.

## 7. Retour vers GitHub (optionnel, pour le développeur)

Clasp sait aussi lire les fichiers Apps Script avec `clasp pull`, mais **aucune synchronisation automatique Apps Script → GitHub** n'est installée. En cas d'édition directe dans l'interface Apps Script :

1. Télécharger une copie locale par `clasp pull`.
2. Comparer les différences et faire un commit dans GitHub.
3. Éviter de modifier directement le projet en ligne une fois GitHub devenu la source de vérité.

La synchronisation automatique bidirectionnelle est volontairement exclue pour éviter les conflits et les écrasements silencieux.

## 8. Problèmes fréquents

- **Script API has not been used / disabled** : activer l'API Apps Script dans les paramètres du compte.
- **401 / authentication failed** : refaire `clasp login`, puis mettre à jour le secret `CLASPRC_JSON`.
- **Identifiant invalide** : vérifier `GLM_SCRIPT_ID` ; ce n'est ni un identifiant de Google Sheets ni un ID de déploiement.
- **Push réussi mais page inchangée** : normal ! Le brouillon a changé, mais le déploiement public doit encore être actualisé.
- **Fichiers disparus de l'éditeur** : clasp remplace le contenu entier du projet. Restaurer les fichiers sauvegardés ; conserver tous les fichiers sources dans GitHub avant de relancer.

Documentation officielle : [Google — Utiliser clasp](https://developers.google.com/apps-script/guides/clasp) et [clasp sur GitHub](https://github.com/google/clasp).
