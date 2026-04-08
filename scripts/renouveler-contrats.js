import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialiser Firebase
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

// Récupérer tous les établissements
const snapshot = await db.collection('etablissements').get();

for (const doc of snapshot.docs) {
  const data = doc.data();
  let doitRenouveler = false;

  if (!data.dateRenouvellement) {
    // Le champ n'existe pas encore
    doitRenouveler = true;
    console.log('Champ manquant pour : ' + doc.id);
  } else {
    const dateRenouvellement = new Date(data.dateRenouvellement);
    const differenceJours = (maintenant - dateRenouvellement) / (1000 * 60 * 60 * 24);
    if (differenceJours > 30) {
      doitRenouveler = true;
    }
  }

  if (doitRenouveler) {
    const nouvelleDate = new Date(maintenant);
    nouvelleDate.setDate(nouvelleDate.getDate() + 30);

    await doc.ref.set({
      montantContrat: 25000,
      dateRenouvellement: nouvelleDate.toISOString(),
      updatedAt: maintenant.toISOString()
    }, { merge: true });

    nombreMisAJour++;
    console.log('Contrat renouvelé : ' + doc.id);
  }
}

console.log('Terminé - ' + nombreMisAJour + ' contrat(s) renouvelé(s)');
// ... le reste de ton code reste pareil ...

if (differenceJours > 30) {

  const nouvelleDate = new Date();
  nouvelleDate.setDate(nouvelleDate.getDate() + 30);

  try {
    await databases.updateDocument(
      process.env.APPWRITE_DATABASE_ID || 'cashback-proprete',   // ← change si ton Database ID est différent
      'etablissements',
      doc.$id,
      {
        montantContrat: 25000,
        dateRenouvellement: nouvelleDate,           // ← on envoie directement le Date object
        updatedAt: new Date()
      }
    );
    nombreMisAJour++;
    log('✅ Contrat renouvelé pour : ' + doc.$id);
  } catch (err) {
    error('Erreur mise à jour ' + doc.$id + ' : ' + err.message);
  }
}