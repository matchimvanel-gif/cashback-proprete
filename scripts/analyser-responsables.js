/**
 * scripts/analyser-responsables.js
 *
 * Lancé par GitHub Actions toutes les heures.
 * Analyse les dépôts du jour et crée des alertes si un responsable
 * enregistre beaucoup plus de dépôts que sa moyenne habituelle.
 *
 * Variables d'environnement requises (GitHub Secrets) :
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

console.log("🔍 [Analyser Responsables] Démarrage...");

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

function cleJour(date) {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

function convertirEnDate(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur;
  if (typeof valeur.toDate === "function") return valeur.toDate();
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function analyser() {
  const maintenant = new Date();
  const debutAujourdHui = new Date(maintenant);
  debutAujourdHui.setHours(0, 0, 0, 0);
  const finAujourdHui = new Date(maintenant);
  finAujourdHui.setHours(23, 59, 59, 999);

  // Dépôts du jour
  const snapshotJour = await db
    .collection("depots")
    .where("date", ">=", Timestamp.fromDate(debutAujourdHui))
    .where("date", "<=", Timestamp.fromDate(finAujourdHui))
    .get();

  const comptesDuJour = {};
  snapshotJour.forEach((doc) => {
    const depot = doc.data();
    const respoId = depot.id_agent || depot.id_agent || depot.respoID || null;
    if (!respoId) return;
    comptesDuJour[respoId] = (comptesDuJour[respoId] || 0) + 1;
  });

  const responsables = Object.keys(comptesDuJour);
  console.log(`📊 ${responsables.length} responsables actifs aujourd'hui`);
  let alertes = 0;

  for (const respoId of responsables) {
    const depotsJour = comptesDuJour[respoId];
    if (depotsJour < 5) continue;

    // Historique 7 jours
    const debutHisto = new Date(debutAujourdHui);
    debutHisto.setDate(debutHisto.getDate() - 7);
    const finHisto = new Date(debutAujourdHui);
    finHisto.setMilliseconds(finHisto.getMilliseconds() - 1);

    const snapshotHisto = await db
      .collection("depots")
      .where("date", ">=", Timestamp.fromDate(debutHisto))
      .where("date", "<=", Timestamp.fromDate(finHisto))
      .get();

    const compteParJour = {};
    snapshotHisto.forEach((doc) => {
      const depot = doc.data();
      const id = depot.id_agent || depot.id_agent || depot.respoID || null;
      if (id !== respoId) return;
      const d = convertirEnDate(depot.date);
      if (!d) return;
      const jour = cleJour(d);
      compteParJour[jour] = (compteParJour[jour] || 0) + 1;
    });

    const jours = Object.keys(compteParJour);
    if (jours.length < 2) continue;

    const total = jours.reduce((acc, j) => acc + compteParJour[j], 0);
    const moyenne = total / jours.length;
    const multiplicateur = Number((depotsJour / moyenne).toFixed(2));

    if (multiplicateur < 2) continue;

    // Récupérer le nom du responsable
    let nom = "Responsable inconnu";
    try {
      const userDoc = await db.collection("utilisateurs").doc(respoId).get();
      if (userDoc.exists) nom = userDoc.data().nom || nom;
    } catch (e) {
      // silencieux
    }

    const alerteId = `${respoId}_${cleJour(maintenant)}`;
    await db
      .collection("alertes")
      .doc(alerteId)
      .set(
        {
          nom,
          id_agent: respoId,
          multiplicateur,
          occurence: depotsJour,
          depotsAujourdHui: depotsJour,
          moyenneHabituelle: Number(moyenne.toFixed(2)),
          traite: false,
          date: Timestamp.fromDate(maintenant),
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true },
      );

    alertes++;
    console.log(
      `⚠️  ALERTE: ${nom} — ${depotsJour} dépôts (${multiplicateur}x la moyenne de ${moyenne.toFixed(1)})`,
    );
  }

  console.log(
    `✅ Analyse terminée — ${alertes} alerte(s) créée(s) ou mise(s) à jour`,
  );
}

analyser().catch((err) => {
  console.error("❌ Erreur fatale:", err.message);
  process.exit(1);
});
