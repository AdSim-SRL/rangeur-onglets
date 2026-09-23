# Politique de sécurité

## Versions prises en charge

Seule la dernière version publiée sur la branche `main` reçoit des correctifs de sécurité.

| Version | Prise en charge |
|---|---|
| 1.2.x | ✅ |
| < 1.2 | ❌ |

## Signaler une vulnérabilité

**N'ouvrez pas d'issue publique.** Utilisez le signalement privé de GitHub :

1. Onglet **Security** du dépôt → **Report a vulnerability** ;
2. décrivez le problème, les étapes pour le reproduire, la version de Chrome et l'impact possible.

Nous accusons réception sous 7 jours et vous tenons informé de la correction. Une fois le correctif publié, nous vous créditons dans l'avis de sécurité, sauf si vous préférez rester anonyme.

## Ce qui entre dans le périmètre

L'extension a accès aux onglets et aux favoris, et elle n'envoie rien sur le réseau. Sont notamment concernés :

- toute fuite de titres, d'adresses d'onglets ou de favoris hors de la machine ;
- toute exécution de code ou injection via le titre d'un onglet ou d'un favori (par exemple dans l'aperçu du tri) ;
- toute perte de données non réversible (favoris supprimés, sauvegarde corrompue) ;
- une permission plus large que nécessaire.

Hors périmètre : les vulnérabilités de Chrome lui-même ou du modèle Gemini Nano, à signaler à [Google](https://bughunters.google.com/).
