const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialisation avec les secrets GitHub (configurés dans ton YAML)
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

const db = getFirestore(app);

async function executerRenouvellement() {
  console.log("Vérification des contrats établissements...");
  const maintenant = new Date();
  let compteur = 0;

  try {
    const snapshot = await db.collection('etablissements').get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      let expiration = data.dateRenouvellement ? new Date(data.dateRenouvellement) : null;

      // Si pas de date ou si la date est dépassée (30 jours)
      if (!expiration || (maintenant - expiration) / (1000 * 60 * 60 * 24) >= 30) {
        const nouvelleDate = new Date();
        nouvelleDate.setDate(nouvelleDate.getDate() + 30);

        await doc.ref.set({
          montantContrat: 25000,
          dateRenouvellement: nouvelleDate.toISOString(),
          updatedAt: maintenant.toISOString()
        }, { merge: true });

        compteur++;
        console.log(`Contrat mis à jour : ${doc.id}`);
      }
    }
    console.log(`Opération terminée. ${compteur} contrats renouvelés.`);
  } catch (err) {
    console.error("Erreur lors du renouvellement :", err.message);
    process.exit(1);
  }
}

executerRenouvellement();
