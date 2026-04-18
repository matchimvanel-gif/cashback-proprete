/*
  Fichier partagé : initialise Firebase Admin une seule fois
  pour toutes les routes API Vercel.
  Chaque fichier dans api/ importe { db } depuis ce fichier.
*/
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
    }),
  });
}

export const db = admin.firestore();
export const fieldValue = admin.firestore.FieldValue;
export const timestamp = admin.firestore.Timestamp;
export default admin;
