/**
 * scripts/renouveler-contrats.js
 *
 * Lancé par GitHub Actions tous les jours à minuit (heure Cameroun).
 * Pour chaque établissement dont le contrat est expire (> 30 jours),
 * remet le montantContrat à 25000 FCFA et prolonge de 30 jours.
 *
 * Variables d'environnement requises (GitHub Secrets) :
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

console.log("🚀 [Renouveler Contrats] Démarrage du script...");

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

async function executerRenouvellement() {
  console.log("📊 Vérification des contrats des établissements...");

  const maintenant = new Date();
  let compteur = 0;

  try {
    const snapshot = await db.collection("etablissements").get();
    console.log(`🔍 ${snapshot.size} établissement(s) trouvé(s)`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;

      let dateRenouvellement = null;

      if (data.dateRenouvellement) {
        // Support Timestamp Firestore et Date JS
        if (typeof data.dateRenouvellement.toDate === "function") {
          dateRenouvellement = data.dateRenouvellement.toDate();
        } else {
          try {
            dateRenouvellement = new Date(data.dateRenouvellement);
            if (Number.isNaN(dateRenouvellement.getTime()))
              dateRenouvellement = null;
          } catch (e) {
            console.log(
              `⚠️  Date invalide pour ${docId}, renouvellement forcé`,
            );
          }
        }
      }

      const joursEcoules = dateRenouvellement
        ? (maintenant - dateRenouvellement) / (1000 * 60 * 60 * 24)
        : 999; // Pas de date = renouveler immédiatement

      const doitRenouveler = joursEcoules >= 30;

      if (doitRenouveler) {
        const nouvelleDate = new Date(maintenant);
        nouvelleDate.setDate(nouvelleDate.getDate() + 30);

        await doc.ref.set(
          {
            montantContrat: 25000,
            dateRenouvellement: Timestamp.fromDate(nouvelleDate),
            updatedAt: Timestamp.fromDate(maintenant),
          },
          { merge: true },
        );

        compteur++;
        console.log(
          `✅ Contrat renouvelé → ${docId} | Prochain renouvellement: ${nouvelleDate.toLocaleDateString("fr-FR")}`,
        );
      }
    }

    console.log(
      `\n🎉 FIN — ${compteur} contrat(s) renouvelé(s) sur ${snapshot.size}`,
    );
  } catch (err) {
    console.error("❌ Erreur critique:", err.message);
    process.exit(1); // Signal d'échec pour GitHub Actions
  }
}

executerRenouvellement();
