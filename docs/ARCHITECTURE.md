# Architecture

Rangeur d'onglets est une extension Manifest V3 sans service worker : tout tourne dans deux pages de l'extension, la fenêtre (`popup.html`) et la page de tri des favoris (`bookmarks.html`). Il n'y a ni dépendance, ni compilation, ni serveur.

## Carte des fichiers

| Fichier | Rôle | Utilisé par |
|---|---|---|
| `ai.js` | Détecte Gemini Nano (`LanguageModel.availability`), ouvre une session avec une consigne système, borne chaque appel dans le temps. | popup, favoris |
| `heuristics.js` | Regroupement sans IA : familles d'outils connues (IA, Google Marketing, Stripe, Dev…), sinon domaine racine. Groupes de 2 onglets minimum. | popup |
| `popup.js` | Pipeline des onglets : doublons → groupes → mise en veille → affichage. | `popup.html` |
| `bookmarks.js` | Pipeline des favoris : collecte → classement par lots → aperçu → sauvegarde → application → restauration. | `bookmarks.html` |

## Pipeline des onglets

```
clic sur l'icône
  └─ onglets non épinglés de la fenêtre
       ├─ 1. doublons : clé = URL sans #ancre ; on garde l'onglet actif, sinon le premier
       ├─ 2. classement
       │     ├─ IA disponible → 1 appel Gemini Nano, sortie JSON contrainte
       │     │     └─ onglets oubliés par l'IA → heuristique, fusion par nom de groupe
       │     └─ sinon → heuristique seule
       ├─ 3. application : dégroupe tout, recrée les groupes (nom, couleur, repli)
       └─ 4. mise en veille : chrome.tabs.discard sur les groupes repliés
             (jamais l'onglet actif ni un onglet audible)
```

**Numéros courts plutôt qu'identifiants.** Le modèle reçoit `1 | site | titre`, et non les identifiants Chrome : un petit modèle se trompe beaucoup moins sur des numéros de 1 à 60. La réponse est ensuite revalidée : numéros inconnus ignorés, un onglet dans un seul groupe, groupes d'un seul onglet dissous.

**Sortie contrainte.** Les appels passent un schéma JSON (`responseConstraint`), ce qui évite d'avoir à analyser du texte libre.

**Échec de l'IA = pas d'échec du rangement.** Délai dépassé (90 s), JSON invalide, modèle absent : on bascule sur l'heuristique et on le signale dans la ligne de résultat.

## Pipeline des favoris

```
Analyser
  ├─ collecte : Barre de favoris + Autres favoris
  │    (liens posés directement dans la barre exclus par défaut, Favoris sur mobile jamais lus)
  ├─ classement par lots de 25
  │    ├─ chaque lot reçoit la liste des dossiers déjà créés → cohérence entre lots
  │    ├─ session clonée par lot → le contexte du modèle ne sature pas
  │    ├─ oubliés → 2e passage par lots de 10
  │    └─ toujours oubliés → gardent leur dossier actuel
  ├─ normalisation : 2 niveaux max, majuscule initiale, fusion à la casse près
  └─ plan : sous-dossier à 1 favori remonté au parent, dossier principal à 1 favori → « Divers »
Appliquer
  ├─ sauvegarde {id, parent, position, titre} de chaque nœud → chrome.storage.local
  ├─ dossiers principaux réutilisés s'ils existent déjà dans la barre, sinon créés
  ├─ déplacement des favoris, tri alphabétique (sous-dossiers d'abord)
  └─ suppression des dossiers devenus vides
Restaurer
  ├─ nœuds replacés parent par parent, par position croissante
  ├─ dossiers supprimés recréés (nouvel identifiant, correspondance tenue à jour)
  └─ dossiers créés par le tri, désormais vides, supprimés
```

### Garde-fous

- **Rien n'est modifié à l'analyse.** Seul *Appliquer* écrit, et toujours après la sauvegarde.
- **Déplacer, jamais supprimer un favori.** Seuls des dossiers *vides* sont supprimés.
- **Restauration testée** sur une copie d'un arbre réel (279 favoris, 38 dossiers) avec une fausse API `chrome.bookmarks` : structure, titres et ordre identiques à l'original après un tri puis une restauration. Seule différence : un dossier qui était vide revient avec un nouvel identifiant.
- **Limite connue** : un favori supprimé à la main entre le tri et la restauration n'est pas recréé.

## Choix de conception

| Choix | Pourquoi |
|---|---|
| Gemini Nano local plutôt qu'une API en ligne | Gratuit, sans clé ni quota, et les titres d'onglets (souvent sensibles : clients, factures, e-mails) ne quittent pas la machine. |
| Heuristique de secours obligatoire | Beaucoup de machines ne remplissent pas les conditions matérielles de Gemini Nano. Le rangement doit fonctionner partout. |
| Mise en veille explicite | Replier un groupe ne libère pas la mémoire, et l'Économiseur de mémoire épargne les applications web lourdes. `chrome.tabs.discard` est le seul levier fiable. |
| Aperçu + sauvegarde + restauration pour les favoris | Réorganiser des centaines de favoris doit rester réversible. Il n'y a pas de compte à protéger par mot de passe dans une extension locale : la réversibilité joue ce rôle. |
| Pas de service worker | Tout est déclenché par un clic dans une page de l'extension. Le téléchargement du modèle exige d'ailleurs un geste de l'utilisateur. |
| Page dédiée pour les favoris | L'analyse dure plusieurs minutes, or la fenêtre de l'extension se ferme dès qu'on clique ailleurs. |
