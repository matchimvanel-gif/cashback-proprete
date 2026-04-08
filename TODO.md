# TODO Nouvelle vue Responsables ongletStatistiques.tsx

Étapes :

- [ ] 1. Ajouter vue 'responsables' nav (5ème onglet, icône 'people').
- [ ] 2. Interface Responsable {id, nom, pointsDepot, depotsToday: number, moyenneDay: number}.
- [ ] 3. chargerResponsables() : query collection responsables, forEach query depots today count.
- [ ] 4. Tableau FlatList styler (glassmorphism, colonnes Nom/Points/Depos Today/Alerts, rouge >3x moyenne).
- [ ] 5. Alertes : if depotsToday > 3\*pointsDepot/100 → createDoc 'alertes' {respoID, nom, valeur: ratio, traite:false}, sync ongletAcceuil.
- [ ] Test realtime.

Lié ongletAcceuil.tsx alertes collection.
