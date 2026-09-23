<p align="center">
  <img src="icons/128.png" width="96" alt="">
</p>

<h1 align="center">Rangeur d'onglets</h1>

<p align="center">
  Extension Chrome qui range vos onglets par projet en un clic, ferme les doublons,
  libère la mémoire et trie vos favoris, grâce à l'IA <strong>intégrée à Chrome</strong>.<br>
  Gratuite, sans compte, sans clé API, et rien ne quitte votre ordinateur.
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-1a73e8">
  <img alt="Chrome 138+" src="https://img.shields.io/badge/Chrome-138%2B-1e8e3e">
  <img alt="IA locale" src="https://img.shields.io/badge/IA-Gemini%20Nano%20(locale)-9334e6">
  <img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-5f6368">
</p>

---

## Pourquoi

Soixante onglets ouverts, c'est vite 10 Go de mémoire, une machine qui compresse et écrit sur le disque sans arrêt, et une batterie qui fond. L'Économiseur de mémoire de Chrome aide, mais il épargne justement les applications web les plus lourdes (Google Docs, Analytics, Gemini, SharePoint…), et regrouper ses onglets à la main prend du temps.

Rangeur d'onglets fait le tri à votre place :

| En un clic | Ce que ça change |
|---|---|
| **Regroupe les onglets par projet, client ou sujet** | Des sites différents qui parlent du même client atterrissent dans le même groupe, avec un nom court et une couleur. |
| **Ferme les onglets en double** | Même adresse (à l'ancre `#` près) : on garde l'onglet actif, sinon le premier. |
| **Met en veille les groupes repliés** | Les pages sont retirées de la mémoire mais restent dans la barre ; elles se rechargent au clic. C'est ce qui libère réellement de la RAM. |
| **Trie vos favoris** | L'IA propose un classement par thème, fusionne les dossiers en double, corrige les noms. Aperçu avant d'appliquer, sauvegarde et restauration en un clic. |

## Installation

L'extension n'est pas (encore) sur le Chrome Web Store. Installation en 1 minute :

```bash
git clone https://github.com/AdSim-SRL/rangeur-onglets.git
```

1. Ouvrez `chrome://extensions`.
2. Activez le **Mode développeur** (en haut à droite).
3. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier `rangeur-onglets`.
4. Épinglez l'icône : icône puzzle 🧩 de la barre d'outils → épingle.

**Mettre à jour** : `git pull` dans le dossier, puis la flèche ↻ de l'extension dans `chrome://extensions`.

## Utilisation

### Ranger les onglets

Cliquez sur l'icône : le rangement démarre tout de suite, sur la fenêtre en cours. Le résultat s'affiche dans la fenêtre de l'extension, par exemple :

> 53 onglets : 41 rangés en 9 groupes (IA locale), 12 laissés seuls. 6 doublons fermés. 27 mis en veille.

| Option | Par défaut | Effet |
|---|---|---|
| Fermer les onglets en double | ✅ | Ferme les doublons avant de ranger. |
| Replier les groupes sauf celui de l'onglet actif | ✅ | Barre d'onglets lisible, même avec 60 onglets. |
| Mettre en veille les groupes repliés | ✅ | Décharge ces onglets de la mémoire. |
| Utiliser l'IA | ✅ | Décochée : regroupement par site et par famille d'outils. |

Les onglets épinglés ne sont jamais touchés. **Tout dégrouper** remet la fenêtre à plat.

> **Premier usage** : si le bouton *Activer l'IA locale* apparaît, cliquez dessus une fois. Chrome télécharge le modèle Gemini Nano (plusieurs Go, une seule fois). En attendant, l'extension range par site.

### Trier les favoris

Fenêtre de l'extension → **Trier mes favoris…** ouvre une page dédiée.

1. **Analyser** : l'IA lit chaque favori (titre, site, dossier actuel) et propose un classement : 8 à 15 dossiers principaux, deux niveaux au maximum, noms corrigés, doublons fusionnés. Comptez quelques minutes pour quelques centaines de favoris ; gardez la page ouverte.
2. **Vérifier** : l'aperçu montre chaque dossier et, pour chaque favori, son dossier d'origine. Rien n'est encore modifié. Pas convaincu ? *Relancer l'analyse*.
3. **Appliquer** : l'état actuel est sauvegardé, puis les favoris sont déplacés, triés par ordre alphabétique, et les dossiers devenus vides sont supprimés.
4. **Revenir en arrière** : *Restaurer les favoris d'avant le tri* remet tout en place. La sauvegarde peut aussi être téléchargée en JSON.

**Périmètre** : la *Barre de favoris* et les *Autres favoris*. Les liens posés directement dans la barre restent à leur place (sauf option cochée) et les *Favoris sur mobile* ne sont jamais touchés.

## L'IA : laquelle, et à quel prix ?

L'extension utilise **Gemini Nano**, le modèle d'IA que Google intègre à Chrome, via la [Prompt API](https://developer.chrome.com/docs/ai/prompt-api).

- **Gratuit** : pas de compte, pas de clé API, pas de quota.
- **Local** : le modèle tourne sur votre machine. Titres et adresses de vos onglets et favoris ne sont jamais envoyés sur Internet.
- **Sobre** : il ne travaille que quelques secondes, au moment du clic.

### Configuration requise pour l'IA

| | Minimum |
|---|---|
| Navigateur | Chrome 138 ou plus récent, sur ordinateur |
| Système | macOS 13+, Windows 10/11, Linux, ou Chromebook Plus |
| Espace disque | 22 Go libres sur le volume du profil Chrome |
| Matériel | Carte graphique avec plus de 4 Go de mémoire vidéo, ou processeur 4 cœurs et 16 Go de RAM |

Sans ces conditions, le rangement des onglets fonctionne quand même, par site et par famille d'outils (IA, Google Marketing, Stripe, Dev, SEO…). Le tri des favoris, lui, nécessite l'IA.

## Confidentialité

- Aucune donnée ne sort de votre ordinateur : pas de serveur, pas d'analytics, pas de requête réseau.
- Seules les options et la sauvegarde des favoris sont stockées, dans `chrome.storage.local`, sur votre machine.

| Permission | Pourquoi |
|---|---|
| `tabs` | Lire le titre et l'adresse des onglets, fermer les doublons, les mettre en veille. |
| `tabGroups` | Créer, nommer, colorer et replier les groupes. |
| `bookmarks` | Lire, déplacer et restaurer les favoris. |
| `storage` | Retenir vos options et la sauvegarde des favoris. |

## Dépannage

| Symptôme | Solution |
|---|---|
| Le badge indique *IA indisponible* | Vérifiez la configuration requise. `chrome://on-device-internals` indique l'état du modèle et la raison d'un refus. |
| Le bouton *Activer l'IA locale* ne progresse pas | Le téléchargement exige une connexion non limitée et l'espace disque requis. Laissez la fenêtre ouverte ; il reprend au clic suivant. |
| Un onglet n'est pas mis en veille | Chrome refuse de mettre en veille l'onglet actif ; l'extension épargne aussi ceux qui jouent du son. |
| Un groupe ne me convient pas | *Regrouper à nouveau* relance l'IA ; *Tout dégrouper* annule. |
| Le tri des favoris ne me plaît pas | *Restaurer les favoris d'avant le tri*, sur la page des favoris. |
| Un onglet fermé par erreur | `Cmd+Maj+T` (Mac) ou `Ctrl+Maj+T` (Windows/Linux). |

> ⚠️ Un onglet mis en veille ou fermé comme doublon perd un texte saisi mais non enregistré. Enregistrez avant de ranger.

## Fonctionnement technique

JavaScript sans dépendance ni étape de compilation : ce que vous clonez est ce que Chrome exécute.

```
rangeur-onglets/
├── manifest.json     Manifest V3, permissions
├── ai.js             Accès à Gemini Nano (disponibilité, session, délai max)
├── heuristics.js     Regroupement de secours par famille d'outils et par domaine
├── popup.html/css/js Fenêtre de l'extension : doublons, groupes, mise en veille
├── bookmarks.html/css/js  Page de tri des favoris : analyse, aperçu, sauvegarde, restauration
└── icons/
```

Le détail (pipeline, garde-fous, choix de conception) est dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Contribuer

Les issues et pull requests sont bienvenues. Pour tester une modification : rechargez l'extension dans `chrome://extensions` (↻), puis clic droit sur l'icône → *Inspecter la fenêtre* pour ouvrir la console du popup. Les messages de l'extension sont préfixés `[Rangeur]`.

Idées ouvertes : publication sur le Chrome Web Store, noms de groupes personnalisables, interface en anglais.

## Licence

[MIT](LICENSE) © 2026 [AdSim](https://adsim.be)
