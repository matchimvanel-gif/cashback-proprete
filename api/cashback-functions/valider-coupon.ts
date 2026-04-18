/*
  POST /api/valider-coupon
  Appelée depuis l'app établissement quand il scanne le QR d'un coupon.
  Corps JSON attendu :
    { "couponId": "id Firestore du coupon" }
  Réponse :
    { "success": true, "message": "...", "pointsDeduits": 1, "nomOffre": "..." }
*/

import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin, { db, fieldValue, timestamp } from "../../api/cashback-functions/_firebase";

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

  /* ── Vérification rôle établissement ── */
  const snapEtab = await db.collection("utilisateurs").doc(tokenDecode.uid).get();
  if (!snapEtab.exists || snapEtab.data()?.role !== "etablissement") {
    return res.status(403).json({ success: false, error: "Seuls les établissements peuvent valider des coupons." });
  }

  const { couponId } = req.body;
  if (!couponId) {
    return res.status(400).json({ success: false, error: "couponId est obligatoire." });
  }

  /* ── Récupérer le coupon ── */
  const snapCoupon = await db.collection("coupons").doc(couponId).get();
  if (!snapCoupon.exists) {
    return res.status(404).json({ success: false, error: "Ce coupon n'existe pas." });
  }
  const coupon = snapCoupon.data()!;

  /* ── Vérification 1 : déjà utilisé ? ── */
  if (coupon.utilise === true || coupon.statut !== "disponible") {
    return res.status(400).json({ success: false, error: "Ce coupon est déjà utilisé ou n'est plus disponible." });
  }

  /* ── Vérification 2 : citoyen a assez de points ? ── */
  const snapCitoyen = await db.collection("utilisateurs").doc(coupon.id_citoyen).get();
  if (!snapCitoyen.exists) {
    return res.status(404).json({ success: false, error: "Citoyen propriétaire introuvable." });
  }
  const pointsCitoyen = snapCitoyen.data()?.point || 0;
  const seuilCoupon = coupon.points || 0;

  if (pointsCitoyen < seuilCoupon) {
    return res.status(400).json({
      success: false,
      error: `Points insuffisants. Le citoyen a ${pointsCitoyen} pts, ce coupon requiert ${seuilCoupon} pts.`,
    });
  }

  /* ── Vérification 3 : un autre coupon déjà utilisé ? ── */
  const snapAutre = await db.collection("coupons")
    .where("id_citoyen", "==", coupon.id_citoyen)
    .where("utilise", "==", true)
    .limit(1)
    .get();

  if (!snapAutre.empty) {
    return res.status(400).json({ success: false, error: "Un coupon de ce citoyen a déjà été utilisé. Les autres sont bloqués." });
  }

  try {
    /* ── Batch atomique : marquer utilisé + déduire points ── */
    const batch = db.batch();

    batch.update(snapCoupon.ref, {
      utilise: true,
      statut: "utilisé",
      id_etablissement: tokenDecode.uid,
      date_utilisation: timestamp.now(),
    });

    batch.update(snapCitoyen.ref, {
      point: fieldValue.increment(-seuilCoupon),
      total_reductions: fieldValue.increment(seuilCoupon),
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      message: `Coupon validé. ${seuilCoupon} point(s) déduits.`,
      pointsDeduits: seuilCoupon,
      nomOffre: coupon.offre,
    });

  } catch (erreur: any) {
    console.error("Erreur valider-coupon:", erreur);
    return res.status(500).json({ success: false, error: erreur.message });
  }
}
