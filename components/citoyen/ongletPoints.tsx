// Onglet Points — Solde, équivalent FCFA, prochains seuils de déblocage
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Coupon {
  id: string;
  type: string;
  valeur: number;
  statut: "bloque" | "disponible" | "utilise";
  seuilDeblocage: number;
}

interface CoteQuartier {
  score: number;
  niveau: "VERT" | "ORANGE" | "ROUGE";
  couleurNiveau: string;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OngletPoints() {
  const [points, setPoints] = useState(0);
  const [quartier, setQuartier] = useState("");
  const [cote, setCote] = useState<CoteQuartier>({
    score: 0,
    niveau: "ROUGE",
    couleurNiveau: couleur.erreurClair,
  });
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [chargement, setChargement] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(
    function () {
      if (!uid) {
        setChargement(false);
        return;
      }

      // Écoute du profil citoyen en temps réel
      const desabonnerUser = onSnapshot(
        doc(db, "utilisateurs", uid),
        function (snap) {
          if (snap.exists()) {
            const data = snap.data();
            const pts = data.points || data.point || 0;
            const q = data.quartier || "";
            setPoints(pts);
            setQuartier(q);

            // Écoute de la côte du quartier
            if (q) {
              onSnapshot(doc(db, "cote", q), function (coteSnap) {
                if (coteSnap.exists()) {
                  const score =
                    coteSnap.data().score_total || coteSnap.data().score || 0;
                  let niveau: "VERT" | "ORANGE" | "ROUGE" = "ROUGE";
                  let couleurNiveau = couleur.erreurClair;

                  if (score >= 80) {
                    niveau = "VERT";
                    couleurNiveau = couleur.turquoise;
                  } else if (score >= 40) {
                    niveau = "ORANGE";
                    couleurNiveau = "#FFA500";
                  }

                  setCote({ score, niveau, couleurNiveau });
                }
              });
            }
          }
          setChargement(false);
        },
        function (erreur) {
          console.error("Erreur lecture points:", erreur);
          setChargement(false);
        },
      );

      // Écoute des coupons du citoyen pour afficher les seuils
      const desabonnerCoupons = onSnapshot(
        query(collection(db, "coupons"), where("id_citoyen", "==", uid)),
        function (snap) {
          const liste: Coupon[] = [];
          snap.forEach(function (docCoupon) {
            const data = docCoupon.data();
            liste.push({
              id: docCoupon.id,
              type: data.type || "petit",
              valeur: data.valeur || 0,
              statut: data.statut || "bloque",
              seuilDeblocage: data.seuilDeblocage || 0,
            });
          });
          setCoupons(liste);
        },
      );

      return function () {
        desabonnerUser();
        desabonnerCoupons();
      };
    },
    [uid],
  );

  if (chargement) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={couleur.dore} />
      </View>
    );
  }

  // Valeur du coupon selon la côte du quartier
  function valeurSelonCote(valeurBase: number): number {
    if (cote.niveau === "ROUGE") return Math.min(valeurBase, 100);
    if (cote.niveau === "VERT") return Math.round(valeurBase * 1.2);
    return valeurBase;
  }

  return (
    <ScrollView
      style={{ flex: 1, padding: 16 }}
      contentContainerStyle={{ paddingBottom: 30 }}
    >
      <Text style={stylesTitre.titre}>Mes Points</Text>

      {/* ── SOLDE PRINCIPAL ── */}
      <View
        style={{
          backgroundColor: "rgba(41,79,120,0.85)",
          borderRadius: 25,
          padding: 30,
          alignItems: "center",
          marginBottom: 20,
          borderWidth: 1,
          borderColor: couleur.dore,
        }}
      >
        <Ionicons name="star" size={36} color={couleur.dore} />
        <Text
          style={{
            color: couleur.doreClair,
            fontSize: 58,
            fontWeight: "900",
            marginTop: 8,
          }}
        >
          {points.toLocaleString("fr-FR")}
        </Text>
        <Text style={{ color: "#ccc", fontSize: 14 }}>points accumulés</Text>
        <View
          style={{
            marginTop: 12,
            backgroundColor: "rgba(78,205,196,0.15)",
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: couleur.turquoise,
          }}
        >
          <Text
            style={{
              color: couleur.turquoise,
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            = {points.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
      </View>

      {/* ── CÔTE DU QUARTIER ── */}
      <View
        style={{
          backgroundColor: "rgba(41,79,120,0.7)",
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: cote.couleurNiveau,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text style={{ color: "#ccc", fontSize: 12 }}>Côte du quartier</Text>
          <Text
            style={{ color: couleur.blanc, fontWeight: "bold", fontSize: 15 }}
          >
            {quartier || "Non défini"}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: cote.couleurNiveau + "33",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: cote.couleurNiveau,
          }}
        >
          <Text
            style={{
              color: cote.couleurNiveau,
              fontWeight: "bold",
              fontSize: 16,
            }}
          >
            {cote.niveau} • {cote.score}/100
          </Text>
        </View>
      </View>

      {/* ── PROCHAINS SEUILS DE DÉBLOCAGE ── */}
      <Text style={stylesTitre.sousTitre}>Progression vers vos coupons</Text>

      {coupons.length === 0 ? (
        <View
          style={{
            backgroundColor: "rgba(41,79,120,0.6)",
            padding: 20,
            borderRadius: 15,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(201,168,76,0.3)",
          }}
        >
          <Text style={{ color: "#ccc" }}>
            Aucun coupon associé à votre compte.
          </Text>
        </View>
      ) : (
        coupons.map(function (coupon) {
          const estDebloque = coupon.statut !== "bloque";
          const progression = Math.min(
            100,
            Math.round((points / coupon.seuilDeblocage) * 100),
          );
          const valeurAffichee = valeurSelonCote(coupon.valeur);

          return (
            <View
              key={coupon.id}
              style={{
                backgroundColor: "rgba(41,79,120,0.8)",
                borderRadius: 18,
                padding: 18,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: estDebloque
                  ? couleur.turquoise
                  : "rgba(201,168,76,0.3)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons
                    name={estDebloque ? "lock-open" : "lock-closed"}
                    size={18}
                    color={estDebloque ? couleur.turquoise : couleur.dore}
                  />
                  <Text
                    style={{
                      color: couleur.blanc,
                      fontWeight: "bold",
                      fontSize: 15,
                    }}
                  >
                    Coupon {coupon.type === "grand" ? "Grand" : "Petit"}
                  </Text>
                </View>
                <Text
                  style={{
                    color: couleur.dore,
                    fontWeight: "bold",
                    fontSize: 18,
                  }}
                >
                  {valeurAffichee} FCFA
                </Text>
              </View>

              {/* Barre de progression */}
              {!estDebloque && (
                <>
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      height: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: `${progression}%`,
                        backgroundColor:
                          progression >= 100 ? couleur.turquoise : couleur.dore,
                        borderRadius: 10,
                        height: 12,
                      }}
                    />
                  </View>
                  <Text style={{ color: "#ccc", fontSize: 12 }}>
                    {points} / {coupon.seuilDeblocage} pts ({progression}%)
                    {" — "}encore {Math.max(0, coupon.seuilDeblocage - points)}{" "}
                    pts nécessaires
                  </Text>
                </>
              )}

              {estDebloque && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={couleur.turquoise}
                  />
                  <Text
                    style={{
                      color: couleur.turquoise,
                      fontSize: 13,
                      fontWeight: "bold",
                    }}
                  >
                    {coupon.statut === "disponible"
                      ? "Débloqué — utilisable maintenant !"
                      : "Déjà utilise"}
                  </Text>
                </View>
              )}

              {/* Avertissement côte rouge */}
              {cote.niveau === "ROUGE" && coupon.valeur > 100 && (
                <Text
                  style={{
                    color: couleur.erreurClair,
                    fontSize: 11,
                    marginTop: 6,
                  }}
                >
                  ⚠️ Valeur limitée à 100 pts (côte ROUGE du quartier)
                </Text>
              )}

              {/* Bonus côte verte */}
              {cote.niveau === "VERT" && (
                <Text
                  style={{
                    color: couleur.turquoise,
                    fontSize: 11,
                    marginTop: 6,
                  }}
                >
                  ✅ Bonus +20% appliqué (côte VERTE du quartier)
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
