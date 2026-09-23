# Contribuer à Rangeur d'onglets

Merci de votre intérêt ! Les issues, idées et pull requests sont les bienvenues. En participant, vous acceptez le [code de conduite](CODE_OF_CONDUCT.md).

## Signaler un bug ou proposer une idée

Ouvrez une [issue](https://github.com/AdSim-SRL/rangeur-onglets/issues/new/choose) avec le modèle adapté. Pour un bug, indiquez toujours :

- la version de Chrome (`chrome://version`) et votre système ;
- l'état de l'IA affiché en haut de la fenêtre de l'extension (*IA locale prête*, *IA indisponible*…) ;
- la ligne de résultat affichée après le rangement ;
- les messages `[Rangeur]` de la console (clic droit sur l'icône → *Inspecter la fenêtre*).

N'y collez pas la liste de vos onglets ou favoris : elle contient souvent des informations privées.

Une faille de sécurité ne se signale pas dans une issue publique : voir [SECURITY.md](SECURITY.md).

## Environnement de développement

Aucune installation : pas de dépendance, pas de compilation.

```bash
git clone https://github.com/AdSim-SRL/rangeur-onglets.git
```

1. `chrome://extensions` → **Mode développeur** → **Charger l'extension non empaquetée** → le dossier cloné.
2. Après chaque modification, cliquez sur ↻ dans `chrome://extensions`, puis rouvrez la fenêtre de l'extension.
3. Console du popup : clic droit sur l'icône → *Inspecter la fenêtre*. Console de la page des favoris : `Cmd+Option+I` / `Ctrl+Maj+I` sur la page.

Pour tester l'IA, vérifiez l'état du modèle dans `chrome://on-device-internals`. Pour tester le **secours sans IA**, décochez *Utiliser l'IA* dans la fenêtre de l'extension.

Commencez par [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : il décrit chaque fichier et chaque étape.

## Règles du projet

- **Zéro dépendance, zéro build.** Du JavaScript que Chrome exécute tel quel. Une bibliothèque ne sera acceptée que si elle est indispensable.
- **Rien ne quitte l'ordinateur.** Aucune requête réseau, aucune API en ligne, aucune télémétrie. C'est la promesse centrale de l'extension.
- **L'extension doit fonctionner sans IA.** Toute fonction d'IA a un comportement de secours, ou un message clair quand elle est indisponible.
- **Aucune perte de données.** Une opération qui modifie les favoris doit rester réversible (sauvegarde + restauration). Une opération qui ferme des onglets doit épargner l'onglet actif et les onglets épinglés.
- **Permissions minimales.** Toute nouvelle permission dans `manifest.json` doit être justifiée dans la pull request et ajoutée au tableau du README.
- **Style** : JavaScript moderne sans framework, fonctions courtes, commentaires en français pour expliquer le *pourquoi*, interface en français.

## Pull requests

1. Une pull request = un sujet. Créez une branche depuis `main`.
2. Testez à la main : rangement avec IA, rangement sans IA, et, si vous touchez aux favoris, *Appliquer* puis *Restaurer*.
3. Mettez à jour le README et `docs/ARCHITECTURE.md` si le comportement change.
4. Si la version change, incrémentez `version` dans `manifest.json`.
5. Remplissez le modèle de pull request.

Merci !
