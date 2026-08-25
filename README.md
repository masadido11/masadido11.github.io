# 🇧🇪 Belgian Election Simulator — V1

Base de travail pour un simulateur électoral belge hébergé sur GitHub Pages.

## Fonctionnalités de la V1

- Carte interactive basée sur `data/be.json`
- 11 circonscriptions de la Chambre
- Répartition des 150 sièges
- Seuil électoral de 5 %
- Méthode D'Hondt
- Pourcentages différents pour chaque circonscription
- Partis de base : MR, PS, N-VA, Vlaams Belang, CD&V, Vooruit, Groen
- Ajout, suppression et changement de couleur des partis directement dans le navigateur
- Calcul national cumulé des sièges

## Installation

Copier les fichiers dans le repository GitHub Pages :

```text
/
├── index.html
├── style.css
├── app.js
└── data/
    └── be.json
```

Le fichier `be.json` est déjà la carte fournie pour cette V1.

## GitHub Pages

Dans GitHub :

`Settings` → `Pages` → `Deploy from a branch` → choisir `main` et `/root`.

Après publication, l'application sera accessible depuis :

`https://masadido11.github.io/`

## Remarque sur le moteur électoral

La V1 applique D'Hondt séparément dans chaque circonscription, avec un seuil de 5 %, puis additionne les sièges. Les données de sièges par circonscription sont celles de l'élection fédérale 2024.

## Prochaine étape

Cette V1 utilise la carte provinciale comme interface. Pour une version plus proche de YAPms, on pourra ensuite ajouter :

- une carte de la Chambre en hémicycle ;
- sauvegarde/chargement de scénarios ;
- mode "voix" en plus du mode "%" ;
- historique des simulations ;
- résultats au niveau des communes/cantons ;
- affichage plus détaillé des circonscriptions ;
- gestion spécifique de Bruxelles ;
- import des résultats officiels.
