import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

console.log("🚀 [Renouveler Contrats] Démarrage du script...");

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

const db = getFirestore(app);

async function executerRenouvellement() {
  console.log("📊 Vérification des contrats des établissements...");

  const maintenant = new Date();
  let compteur = 0;

  try {
    const snapshot = await db.collection('etablissements').get();

    console.log(`🔍 ${snapshot.size} documents trouvés dans la collection etablissements`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;

      let dateRenouvellement = null;
      if (data.dateRenouvellement) {
        try {
          dateRenouvellement = new Date(data.dateRenouvellement);
        } catch (e) {
          console.log(`⚠️  Date invalide pour ${docId}, renouvellement forcé`);
        }
      }

      const doitRenouveler = !dateRenouvellement || 
                            (maintenant - dateRenouvellement) / (1000 * 60 * 60 * 24) >= 30;

      if (doitRenouveler) {
        const nouvelleDate = new Date(maintenant);
        nouvelleDate.setDate(nouvelleDate.getDate() + 30);

        await doc.ref.set({
          montantContrat: 25000,
          dateRenouvellement: nouvelleDate,        // Firebase accepte directement un Date
          updatedAt: maintenant
        }, { merge: true });

        compteur++;
        console.log(`✅ Contrat renouvelé → ${docId} | Nouveau montant : 25000 FCFA`);
      }
    }

    console.log(`🎉 FIN DU SCRIPT - ${compteur} contrat(s) ont été renouvelés avec succès.`);

  } catch (err) {
    console.error("❌ Erreur critique lors du renouvellement :", err.message);
    process.exit(1);   // Important pour que GitHub sache qu'il y a eu une erreur
  }
}

// Lancement
executerRenouvellement();