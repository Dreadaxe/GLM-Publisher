# Installer GLM Publisher

## 1. Préparer Apps Script

1. Ouvrir le projet Apps Script **GLM Publisher** existant, ou créer un projet sur [script.google.com](https://script.google.com).
2. Copier les fichiers `Code.gs` et `Admin.html` dans le projet. Le fichier HTML doit s'appeler **Admin** dans l'éditeur.
3. Afficher le manifeste `appsscript.json` dans les paramètres du projet et y reprendre celui du dépôt.
4. Vérifier que les services avancés **Google Docs API v1** et **Google Drive API v3** sont activés.
5. Lors de la **première installation seulement**, enregistrer et exécuter `installerGLM()` depuis la barre d'outils Apps Script, puis autoriser les services demandés. Cette fonction crée le registre Google Sheets (onglets `Documents`, `Versions`, `Chunks`) et initialise l'administrateur.

**Mise à jour depuis une version précédente :** ne pas relancer `installerGLM()`; conserver le registre Sheets et les propriétés du script.

## 2. Deux déploiements Web distincts

### Administration

Dans **Déployer → Nouveau déploiement → Application Web** :

- Exécuter en tant que **l'utilisateur accédant à l'application**.
- Autoriser les comptes Google, mais vérifier les administrateurs explicitement autorisés dans la propriété `GLM_ADMIN_EMAILS`.
- Accéder à l'URL du déploiement suivie de `?admin=1`.

### Contenu public

Créer un **second déploiement** du même projet Apps Script :

- Exécuter en tant que **moi (propriétaire)**.
- Accès **Tout le monde**, uniquement si le contenu doit être accessible à tous.
- URL de publication : `https://script.google.com/macros/s/ID_PUBLIC/exec?page=cavalcade-maudite`.

**Ne jamais utiliser le déploiement public pour administrer le contenu.** Vérifier en navigation privée le refus de `?admin=1` et l'absence de données internes dans le HTML public.

## 3. Suivre un Google Doc

Dans le panneau d'administration :

1. Ajouter un Google Doc par URL et lui attribuer un identifiant de page en minuscules, chiffres et tirets (par exemple `cavalcade-maudite`).
2. Choisir l'onglet **VF** ou l'onglet éditorial souhaité. Le **Change-log** est réservé au suivi.
3. Analyser les modifications, vérifier l'aperçu et sélectionner les sections.
4. Publier explicitement ; les suggestions non acceptées ne sont pas publiées et les commentaires restent dans Google Docs.
5. Les publications antérieures restent dans le registre Sheets et peuvent être restaurées.

## 4. Intégration dans Google Sites

- Ouvrir la page Google Sites voulue.
- Choisir **Insérer → Intégrer → URL** et coller l'URL du **déploiement public** avec `?page=slug`.
- Ajuster le cadre, puis publier Google Sites.
- Tester les sections repliables sur ordinateur et mobile. Les longues sections peuvent provoquer une barre de défilement interne ou demander un redimensionnement du cadre.

Les bannières, images, liens PDF, crédits et menus natifs de Google Sites restent indépendants du script.

## 5. Mettre à jour depuis GitHub

Une fois les fichiers modifiés sur GitHub, **l'application déployée ne change pas automatiquement**.

Méthode manuelle : recopier `Code.gs`, `Admin.html` et le manifeste modifié dans Apps Script, enregistrer, puis mettre les **deux déploiements** sur **Nouvelle version**.

Méthode développeur : connecter le projet Apps Script à une copie Git via [clasp](https://github.com/google/clasp). Un exemple de `.clasp.json` est fourni ; ne jamais versionner le vrai fichier `.clasp.json` ni les identifiants de connexion. Un futur workflow de synchronisation peut être configuré séparément après vérification des permissions.

## 6. Vigilance

- La mise en forme Docs → HTML est une approximation, en particulier pour les tabulations, tableaux complexes, images et objets intégrés.
- `UnifrakturMaguntia` et `Merriweather` sont chargées depuis Google Fonts ; vérifier leur disponibilité réseau.
- Les commentaires et les discussions doivent rester **dans Google Docs**, même si une version est publiée.
- Lire [SECURITY.md](SECURITY.md) avant tout usage public.
