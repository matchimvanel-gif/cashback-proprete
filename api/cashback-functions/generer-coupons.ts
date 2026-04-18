/*
  POST /api/generer-coupons
  Appelée UNE SEULE FOIS juste après l'inscription d'un citoyen.
  Depuis l'app (inscription.tsx), après le setDoc utilisateur.
  Corps JSON : { "uid": "uid Firebase du citoyen" }
  Réponse    : { "success": true, "coupons": ["id1", "id2"] }
*/

import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin, { db, timestamp } from "../../api/cashback-functions/_firebase";

function genererCode(prefixe: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = prefixe + "-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Utilisez POST." });
  }

  /* ── Vérification token ── */
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Token manquant." });
  }
  let tokenDecode: admin.auth.DecodedIdToken;
  try {
    tokenDecode = await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch {
    return res.status(401).json({ success: false, error: "Token invalide." });
  }

  const { uid } = req.body;

  /* L'uid dans le body doit correspondre au token (le citoyen génère ses propres coupons) */
  if (!uid || uid !== tokenDecode.uid) {
    return res.status(403).json({ success: false, error: "L'uid ne correspond pas au token." });
  }

  /* ── Vérifier que c'est bien un citoyen ── */
  const snapUser = await db.collection("utilisateurs").doc(uid).get();
  if (!snapUser.exists || snapUser.data()?.role !== "citoyen") {
    return res.status(403).json({ success: false, error: "Seuls les citoyens peuvent générer des coupons." });
  }

  /* ── Vérifier qu'il n'a pas déjà des coupons ── */
  const snapExistants = await db.collection("coupons")
    .where("id_citoyen", "==", uid)
    .limit(1)
    .get();

  if (!snapExistants.empty) {
    return res.status(400).json({ success: false, error: "Des coupons existent déjà pour ce citoyen." });
  }

  try {
    const batch = db.batch();
    const ids: string[] = [];

    /* Coupon Standard — seuil 1 pt */
    const refPetit = db.collection("coupons").doc();
    batch.set(refPetit, {
      id_citoyen: uid,
      code: genererCode("CPT"),
      points: 1,
      statut: "disponible",
      offre: "Réduction standard — à présenter dans un établissement partenaire",
      utilise: false,
      id_etablissement: "",
      date_creation: timestamp.now(),
    });
    ids.push(refPetit.id);

    /* Coupon Premium — seuil 100 pts */
    const refGrand = db.collection("coupons").doc();
    batch.set(refGrand, {
      id_citoyen: uid,
      code: genererCode("CPG"),
      points: 100,
      statut: "disponible",
      offre: "Réduction premium — à présenter dans un établissement partenaire",
      utilise: false,
      id_etablissement: "",
      date_creation: timestamp.now(),
    });
    ids.push(refGrand.id);

    await batch.commit();

    return res.status(200).json({ success: true, coupons: ids });

  } catch (erreur: any) {
    console.error("Erreur generer-coupons:", erreur);
    return res.status(500).json({ success: false, error: erreur.message });
  }
}
