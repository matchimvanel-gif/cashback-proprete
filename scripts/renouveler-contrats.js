import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

console.log("🚀 Début du renouvellement des contrats...");

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

const db = getFirestore();
const maintenant = new Date();
let nombreMisAJour = 0;

try {
  const snapshot = await db.collection('etablissements').get();

  console.log(`📊 ${snapshot.size} établissements trouvés dans la collection`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;

    console.log(`🔍 Vérification document : ${docId}`);

    let doitRenouveler = false;

    // Vérification sécurisée de la date
    let dateRenouvellement = null;
    if (data.dateRenouvellement) {
      try {
        dateRenouvellement = new Date(data.dateRenouvellement);
        if (isNaN(dateRenouvellement.getTime())) {
          dateRenouvellement = null; // date invalide
        }
      } catch (e) {
        dateRenouvellement = null;
      }
    }

    if (!dateRenouvellement) {
      console.log(`⚠️  Pas de date valide pour ${docId} → renouvellement forcé`);
      doitRenouveler = true;
    } else {
      const differenceJours = (maintenant - dateRenouvellement) / (1000 * 60 * 60 * 24);
      console.log(`📅 Date : ${dateRenouvellement.toISOString()} | Différence : ${differenceJours.toFixed(1)} jours`);

      if (differenceJours > 30) {
        doitRenouveler = true;
      }
    }

    if (doitRenouveler) {
      const nouvelleDate = new Date(maintenant);
      nouvelleDate.setDate(nouvelleDate.getDate() + 30);

      await doc.ref.set({
        montantContrat: 25000,
        dateRenouvellement: nouvelleDate,   // Firebase acceptera le Date object
        updatedAt: maintenant
      }, { merge: true });

      nombreMisAJour++;
      console.log(`✅ Contrat renouvelé pour ${docId}`);
    }
  }

  console.log(`🎉 FIN - ${nombreMisAJour} contrat(s) renouvelé(s)`);

} catch (error) {
  console.error("❌ Erreur générale :", error.message);
}