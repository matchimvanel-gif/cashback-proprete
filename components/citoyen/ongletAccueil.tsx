// ============================================================
// ONGLET ACCUEIL — Tableau de bord du citoyen
// Fichier : components/citoyen/ongletAccueil.tsx
//
// Affiche :
//   1. Salutation personnalisée selon l'heure
//   2. Carte solde de pointss + équivalent FCFA
//   3. Côte du quartier en temps réel (VERT / ORANGE / ROUGE)
//   4. Alerte si côte ROUGE
//   5. Switch : "Mes dépôts" ↔ "Générer QR"
//   6. Modal QR Dépôt  → à présenter au Responsable
//   7. Modal QR Coupon → à présenter à l'Établissement
//
// MODULES REQUIS (à installer si absent) :
//   npx expo install react-native-qrcode-svg react-native-svg
// ============================================================

import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// react-native-qrcode-svg génère le QR Code côté client
// Dépendance : react-native-svg (déjà dans package.json)
import QRCode from "react-native-qrcode-svg";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Données du profil citoyen lues depuis Firestore en temps réel */
interface StatsCitoyen {
  nom: string;
  pointss: number;
  quartier: string;
}

/** Un dépôt récent affiché dans la liste des 5 derniers */
interface DepotRecent {
  id: string;
  date: string;
  categorie: string;
  poids: number;
  totalPoints: number;
  tri: boolean;
}

/** Côte du quartier avec toutes les infos visuelles associées */
interface CoteQuartier {
  score: number;
  niveau: "VERT" | "ORANGE" | "ROUGE";
  couleurNiveau: string;
  icone: string;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/** Retourne "Bonjour", "Bon après-midi" ou "Bonsoir" selon l'heure locale */
function getSalutation(): string {
  const heure = new Date().getHours();
  if (heure >= 5 && heure < 12) return "Bonjour";
  if (heure >= 12 && heure < 18) return "Bon après-midi";
  return "Bonsoir";
}

/**
 * Extrait un prénom lisible depuis une adresse email.
 * ex: "matchim.vanelle@gmail.com" → "Matchim"
 */
function getPrenomDepuisEmail(email: string): string {
  if (!email || !email.includes("@")) return "Citoyen";
  const segment = email.split("@")[0].split(".")[0];
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

/**
 * Convertit un score /100 en objet CoteQuartier complet avec visuels.
 * Règle du cahier des charges :
 *   VERT   >= 80  → turquoise
 *   ORANGE 40–79  → orange
 *   ROUGE  < 40   → rouge erreur
 */
function scoreToCote(score: number): CoteQuartier {
  if (score >= 80) {
    return {
      score,
      niveau: "VERT",
      couleurNiveau: couleur.turquoise,
      icone: "🟢",
    };
  }
  if (score >= 40) {
    return { score, niveau: "ORANGE", couleurNiveau: "#FFA500", icone: "🟠" };
  }
  return {
    score,
    niveau: "ROUGE",
    couleurNiveau: couleur.erreurClair,
    icone: "🔴",
  };
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OngletAccueil() {
  // ── État du profil et données ──
  const [stats, setStats] = useState<StatsCitoyen>({
    nom: "",
    pointss: 0,
    quartier: "",
  });
  const [cote, setCote] = useState<CoteQuartier>(scoreToCote(0));
  const [depotsRecents, setDepotsRecents] = useState<DepotRecent[]>([]);
  const [chargement, setChargement] = useState(true);

  // ── Vue active dans le switch ──
  const [vueActive, setVueActive] = useState<"depots" | "qr">("depots");

  // ── État du modal QR Code ──
  const [modalQRVisible, setModalQRVisible] = useState(false);
  const [typeQR, setTypeQR] = useState<"depot" | "coupon">("depot");
  // qrData contient le JSON encodé dans le QR Code
  const [qrData, setQrData] = useState("");

  // Animation de pulsation du QR (signal visuel "QR actif")
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const uid = auth.currentUser?.uid;

  // ── Animation pulsation : démarre quand modal s'ouvre, s'arrête à la fermeture ──
  useEffect(() => {
    if (modalQRVisible) {
      // Boucle infinie : grossit légèrement puis revient
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [modalQRVisible]);

  // ── Écoute Firestore : profil citoyen + 5 derniers dépôts ──
  useEffect(() => {
    if (!uid) {
      setChargement(false);
      return;
    }

    // Écoute 1 — profil en temps réel (pointss, quartier, nom)
    const desabonnerProfil = onSnapshot(
      doc(db, "utilisateurs", uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setStats({
            // Préfère data.nom, sinon extrait depuis email
            nom: data.nom || getPrenomDepuisEmail(data.email || ""),
            pointss: data.pointss || data.points || 0,
            quartier: data.quartier || "",
          });
        }
        setChargement(false);
      },
      (err) => {
        console.error("[OngletAccueil] profil:", err);
        setChargement(false);
      },
    );

    // Écoute 2 — 5 derniers dépôts du citoyen (tri par date décroissante)
    const qDepots = query(
      collection(db, "depots"),
      where("id_citoyen", "==", uid),
      orderBy("date", "desc"),
      limit(5),
    );

    const desabonnerDepots = onSnapshot(
      qDepots,
      (snap) => {
        const liste: DepotRecent[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const dateDepot = data.date?.toDate ? data.date.toDate() : new Date();
          liste.push({
            id: d.id,
            date: dateDepot.toLocaleDateString("fr-FR"),
            categorie: data.categorie || "Inconnu",
            poids: data.poids || 0,
            // Compatibilité avec les deux noms de champ possibles
            totalPoints: data.totalPoints || data.points || data.pointss || 0,
            tri: data.tri || false,
          });
        });
        setDepotsRecents(liste);
      },
      (err) => console.error("[OngletAccueil] dépôts:", err),
    );

    return () => {
      desabonnerProfil();
      desabonnerDepots();
    };
  }, [uid]);

  // ── Écoute Firestore : côte du quartier (se relance si quartier change) ──
  useEffect(() => {
    // N'écoute que si le quartier est connu
    if (!stats.quartier) return;

    const desabonnerCote = onSnapshot(
      doc(db, "cote", stats.quartier),
      (snap) => {
        if (snap.exists()) {
          const score = snap.data().score_total || snap.data().score || 0;
          setCote(scoreToCote(score));
        }
      },
      (err) => console.error("[OngletAccueil] côte:", err),
    );

    return () => desabonnerCote();
  }, [stats.quartier]);

  // ─── Fonctions d'ouverture des modals QR ─────────────────────────────────

  /**
   * Ouvre le modal avec un QR Code de type DÉPÔT.
   * Le Responsable scanne ce QR pour identifier le citoyen
   * avant d'enregistrer un dépôt dans son écran.
   */
  function ouvrirQRDepot() {
    if (!uid) return;

    // On rend le JSON plus simple et plus fiable
    const qrObject = {
      type: "depot",
      id_citoyen: uid,
      timestamp: Date.now(),
    };

    setQrData(JSON.stringify(qrObject));
    setTypeQR("depot");
    setModalQRVisible(true);
  }

  function ouvrirQRCoupon() {
    if (!uid) return;

    const qrObject = {
      type: "coupon",
      id_citoyen: uid,
      timestamp: Date.now(),
    };

    setQrData(JSON.stringify(qrObject));
    setTypeQR("coupon");
    setModalQRVisible(true);
  }

  // ─── Écran de chargement ──────────────────────────────────────────────────

  if (chargement) {
    return (
      <View style={styles.centrer}>
        <ActivityIndicator size="large" color={couleur.dore} />
        <Text style={{ color: couleur.doreClair, marginTop: 12 }}>
          Chargement...
        </Text>
      </View>
    );
  }

  // ─── Rendu principal ──────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.conteneur}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── SALUTATION ── */}
      <Text style={stylesTitre.titre}>
        {getSalutation()}, {stats.nom} 👋
      </Text>

      {/* ════════════════════════════════════════
          CARTE SOLDE DE POINTS
          Bordure dorée + grand chiffre bien lisible
          ════════════════════════════════════════ */}
      <View style={styles.carteSolde}>
        <Text style={styles.labelSolde}>Solde de pointss</Text>

        {/* Nombre de pointss affiché en très grand */}
        <Text style={styles.montantPoints}>
          {stats.pointss.toLocaleString("fr-FR")}
        </Text>

        {/* Ligne dorée séparatrice */}
        <View style={styles.separateur} />

        {/* Équivalent en FCFA (1 points = 1 FCFA selon cahier des charges) */}
        <Text style={styles.equivalentFCFA}>
          ≈ {stats.pointss.toLocaleString("fr-FR")} FCFA
        </Text>

        <Text style={styles.reglePts}>1 points = 1 FCFA</Text>
      </View>

      {/* ════════════════════════════════════════
          CARTE CÔTE DU QUARTIER
          Bordure colorée dynamique selon VERT/ORANGE/ROUGE
          ════════════════════════════════════════ */}
      <View style={[styles.carteQuartier, { borderColor: cote.couleurNiveau }]}>
        {/* Gauche : nom + niveau */}
        <View style={{ flex: 1 }}>
          <Text style={styles.labelQuartier}>Côte de votre quartier</Text>
          <Text style={styles.nomQuartier}>
            {stats.quartier || "Quartier non défini"}
          </Text>
          <Text style={[styles.niveauTexte, { color: cote.couleurNiveau }]}>
            {cote.icone} {cote.niveau}
          </Text>
        </View>

        {/* Droite : cercle score /100 */}
        <View style={[styles.cerclScore, { borderColor: cote.couleurNiveau }]}>
          <Text style={[styles.scoreChiffre, { color: cote.couleurNiveau }]}>
            {cote.score}
          </Text>
          <Text style={styles.scoreSur100}>/100</Text>
        </View>
      </View>

      {/* ════════════════════════════════════════
          ALERTE CÔTE ROUGE
          Visible uniquement quand quartier en ROUGE
          ════════════════════════════════════════ */}
      {cote.niveau === "ROUGE" && (
        <View style={styles.alerteRouge}>
          <Ionicons
            name="warning-outline"
            size={22}
            color={couleur.erreurClair}
          />
          <Text style={styles.texteAlerteRouge}>
            Votre quartier est en côte{" "}
            <Text style={{ fontWeight: "bold" }}>ROUGE</Text>.{"\n"}
            Vos coupons sont limités à{" "}
            <Text style={{ fontWeight: "bold" }}>100 pts</Text> maximum. Déposez
            pour améliorer la côte collective !
          </Text>
        </View>
      )}

      {/* ════════════════════════════════════════
          EN-TÊTE SECTION + SWITCH VUE
          ════════════════════════════════════════ */}
      <Text style={[stylesTitre.sousTitre, { marginBottom: 10 }]}>
        {vueActive === "depots" ? "Mes derniers dépôts" : "Mes QR Codes"}
      </Text>

      {/* Switch "Mes dépôts" / "Générer QR" */}
      <View style={styles.switchBar}>
        <TouchableOpacity
          style={[
            styles.switchBtn,
            vueActive === "depots" && styles.switchBtnActif,
          ]}
          onPress={() => setVueActive("depots")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="list-outline"
            size={15}
            color={vueActive === "depots" ? couleur.marine : "#ccc"}
          />
          <Text
            style={[
              styles.switchTxt,
              { color: vueActive === "depots" ? couleur.marine : "#ccc" },
            ]}
          >
            Mes dépôts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.switchBtn,
            vueActive === "qr" && styles.switchBtnActif,
          ]}
          onPress={() => setVueActive("qr")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="qr-code-outline"
            size={15}
            color={vueActive === "qr" ? couleur.marine : "#ccc"}
          />
          <Text
            style={[
              styles.switchTxt,
              { color: vueActive === "qr" ? couleur.marine : "#ccc" },
            ]}
          >
            Générer QR
          </Text>
        </TouchableOpacity>
      </View>

      {/* ════════════════════════════════════════
          VUE 1 — LISTE DES DÉPÔTS RÉCENTS
          ════════════════════════════════════════ */}
      {vueActive === "depots" &&
        (depotsRecents.length === 0 ? (
          // État vide
          <View style={styles.carteVide}>
            <Ionicons name="trash-outline" size={46} color={couleur.dore} />
            <Text style={styles.texteVide}>
              Aucun dépôt encore.{"\n"}
              Déposez vos déchets pour gagner des pointss !
            </Text>
          </View>
        ) : (
          // Carte par dépôt
          depotsRecents.map((depot) => (
            <View key={depot.id} style={styles.carteDepot}>
              {/* Icône ronde + infos */}
              <View style={styles.depotGauche}>
                <View style={styles.depotIcone}>
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={couleur.dore}
                  />
                </View>
                <View>
                  <Text style={styles.depotCategorie}>{depot.categorie}</Text>
                  <Text style={styles.depotDate}>{depot.date}</Text>
                  {/* Badge vert si déchets triés */}
                  {depot.tri && (
                    <View style={styles.badgeTri}>
                      <Text style={styles.texteBadgeTri}>♻️ Trié</Text>
                    </View>
                  )}
                </View>
              </View>
              {/* Points à droite */}
              <Text style={styles.depotPts}>+{depot.totalPoints} pts</Text>
            </View>
          ))
        ))}

      {/* ════════════════════════════════════════
          VUE 2 — BOUTONS GÉNÉRER QR
          ════════════════════════════════════════ */}
      {vueActive === "qr" && (
        <View>
          {/* Info contextuelle */}
          <View style={styles.infoQR}>
            <Ionicons
              name="information-circle-outline"
              size={17}
              color={couleur.turquoise}
            />
            <Text style={styles.texteInfoQR}>
              Choisis le QR adapté à ton action du moment.
            </Text>
          </View>

          {/* ── Bouton QR DÉPÔT ── fond doré */}
          <TouchableOpacity
            style={styles.carteQRDepot}
            onPress={ouvrirQRDepot}
            activeOpacity={0.85}
          >
            <View style={styles.qrBoutonIcone}>
              <Ionicons name="trash-outline" size={36} color={couleur.marine} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrBoutonTitre}>QR Code Dépôt</Text>
              <Text style={styles.qrBoutonSousTitre}>
                À présenter au Responsable pour enregistrer un dépôt
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={couleur.marine} />
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          {/* ── Bouton QR COUPON ── fond turquoise */}
          <TouchableOpacity
            style={styles.carteQRCoupon}
            onPress={ouvrirQRCoupon}
            activeOpacity={0.85}
          >
            <View style={styles.qrBoutonIcone}>
              <Ionicons name="card-outline" size={36} color={couleur.marine} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrBoutonTitre}>QR Code Coupon</Text>
              <Text style={styles.qrBoutonSousTitre}>
                À présenter à l'Établissement pour utiliser une réduction
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={couleur.marine} />
          </TouchableOpacity>

          {/* Note ROUGE si applicable */}
          {cote.niveau === "ROUGE" && (
            <Text style={styles.noteQRRouge}>
              🔴 Côte ROUGE active — seuls les coupons ≤ 100 pts sont acceptés.
            </Text>
          )}
        </View>
      )}

      {/* ════════════════════════════════════════
          MODAL QR CODE
          Slide depuis le bas — style bottom sheet
          ════════════════════════════════════════ */}
      <Modal
        visible={modalQRVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalQRVisible(false)}
      >
        {/* Zone sombre tapable pour fermer */}
        <TouchableOpacity
          style={styles.modalFond}
          activeOpacity={1}
          onPress={() => setModalQRVisible(false)}
        >
          {/* Carte du modal — stopPropagation évite la fermeture en tapant dessus */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalCarte}
          >
            {/* ── Poignée de glissement (décoration) ── */}
            <View style={styles.modalPoignee} />

            {/* ── En-tête : icône + titre + bouton fermer ── */}
            <View style={styles.modalEntete}>
              <View
                style={[
                  styles.modalIconeCercle,
                  {
                    backgroundColor:
                      typeQR === "depot" ? couleur.dore : couleur.turquoise,
                  },
                ]}
              >
                <Ionicons
                  name={typeQR === "depot" ? "trash-outline" : "card-outline"}
                  size={26}
                  color={couleur.marine}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.modalTitre}>
                  {typeQR === "depot" ? "QR Code Dépôt" : "QR Code Coupon"}
                </Text>
                <Text style={styles.modalSousTitre}>
                  {typeQR === "depot"
                    ? "Montre ce code au Responsable"
                    : "Montre ce code à l'Établissement"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setModalQRVisible(false)}
                style={styles.modalBtnFermerCoin}
              >
                <Ionicons name="close" size={20} color={couleur.dore} />
              </TouchableOpacity>
            </View>

            {/* ── QR Code avec pulsation ── */}
            {/* Fond blanc obligatoire pour que les scanners le lisent correctement */}
            <Animated.View
              style={[
                styles.qrZone,
                {
                  borderColor:
                    typeQR === "depot" ? couleur.dore : couleur.turquoise,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={210}
                  color={couleur.marine} // Modules du QR en bleu marine
                  backgroundColor="#ffffff" // Fond blanc obligatoire
                  quietZone={12} // Marge blanche autour du QR
                />
              ) : (
                // Ne devrait pas arriver mais fallback propre
                <ActivityIndicator size="large" color={couleur.marine} />
              )}
            </Animated.View>

            {/* ── Instruction colorée ── */}
            <View style={styles.modalInstruction}>
              <Ionicons
                name="scan-outline"
                size={18}
                color={typeQR === "depot" ? couleur.dore : couleur.turquoise}
              />
              <Text
                style={[
                  styles.modalInstructionTxt,
                  {
                    color:
                      typeQR === "depot" ? couleur.dore : couleur.turquoise,
                  },
                ]}
              >
                {typeQR === "depot"
                  ? "Le Responsable scanne ce code avant le dépôt"
                  : "L'Établissement scanne ce code à la caisse"}
              </Text>
            </View>

            {/* ── Ligne pointss actuels ── */}
            <View style={styles.modalLignePoints}>
              <Text style={styles.modalLigneLabel}>Points actuels</Text>
              <Text style={styles.modalLigneValeur}>
                {stats.pointss.toLocaleString("fr-FR")} pts
              </Text>
            </View>

            {/* ── Bouton Fermer principal ── */}
            <TouchableOpacity
              onPress={() => setModalQRVisible(false)}
              style={[
                styles.modalBtnFermer,
                {
                  backgroundColor:
                    typeQR === "depot" ? couleur.dore : couleur.turquoise,
                },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color={couleur.marine} />
              <Text style={styles.modalBtnFermerTxt}>Fermer</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  centrer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // ── Carte solde ──
  carteSolde: {
    backgroundColor: "rgba(41,79,120,0.7)",
    padding: 26,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: couleur.dore,
  },
  labelSolde: {
    color: "#aaa",
    fontSize: 13,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  montantPoints: {
    color: couleur.doreClair,
    fontSize: 54,
    fontWeight: "900",
    letterSpacing: -1,
  },
  separateur: {
    width: 55,
    height: 2,
    backgroundColor: couleur.dore,
    marginVertical: 10,
    borderRadius: 2,
  },
  equivalentFCFA: {
    color: couleur.turquoise,
    fontSize: 16,
    fontWeight: "600",
  },
  reglePts: {
    color: "#666",
    fontSize: 11,
    marginTop: 5,
  },

  // ── Carte quartier ──
  carteQuartier: {
    backgroundColor: "rgba(41,79,120,0.5)",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
  },
  labelQuartier: {
    color: "#aaa",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  nomQuartier: {
    color: couleur.blanc,
    fontWeight: "bold",
    fontSize: 15,
    marginTop: 3,
  },
  niveauTexte: {
    fontWeight: "bold",
    fontSize: 19,
    marginTop: 5,
  },
  cerclScore: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  scoreChiffre: {
    fontSize: 22,
    fontWeight: "bold",
  },
  scoreSur100: {
    color: "#888",
    fontSize: 10,
  },

  // ── Alerte ROUGE ──
  alerteRouge: {
    backgroundColor: "rgba(94,41,35,0.65)",
    padding: 13,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: couleur.erreur,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  texteAlerteRouge: {
    color: couleur.blanc,
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Switch ──
  switchBar: {
    flexDirection: "row",
    backgroundColor: "rgba(41,79,120,0.5)",
    borderRadius: 13,
    padding: 4,
    marginBottom: 14,
  },
  switchBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  switchBtnActif: {
    backgroundColor: couleur.dore,
  },
  switchTxt: {
    fontWeight: "bold",
    fontSize: 13,
  },

  // ── Carte vide ──
  carteVide: {
    alignItems: "center",
    backgroundColor: "rgba(41,79,120,0.35)",
    padding: 32,
    borderRadius: 18,
    marginTop: 6,
  },
  texteVide: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },

  // ── Carte dépôt ──
  carteDepot: {
    backgroundColor: "rgba(41,79,120,0.45)",
    padding: 13,
    borderRadius: 14,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  depotGauche: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  depotIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(201,168,76,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.25)",
  },
  depotCategorie: {
    color: couleur.blanc,
    fontWeight: "600",
    fontSize: 14,
  },
  depotDate: {
    color: "#888",
    fontSize: 11,
    marginTop: 2,
  },
  badgeTri: {
    backgroundColor: "rgba(45,106,79,0.4)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  texteBadgeTri: {
    color: "#52b788",
    fontSize: 10,
    fontWeight: "600",
  },
  depotPts: {
    color: couleur.dore,
    fontWeight: "bold",
    fontSize: 15,
  },

  // ── Vue QR (boutons) ──
  infoQR: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "rgba(78,205,196,0.08)",
    padding: 10,
    borderRadius: 10,
  },
  texteInfoQR: {
    color: couleur.turquoise,
    fontSize: 12.5,
    flex: 1,
  },
  carteQRDepot: {
    backgroundColor: couleur.dore,
    padding: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  carteQRCoupon: {
    backgroundColor: couleur.turquoise,
    padding: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qrBoutonIcone: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(0,0,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  qrBoutonTitre: {
    color: couleur.marine,
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 3,
  },
  qrBoutonSousTitre: {
    color: couleur.marine,
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 17,
  },
  noteQRRouge: {
    color: couleur.erreurClair,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 17,
  },

  // ── Modal QR ──
  modalFond: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-end",
  },
  modalCarte: {
    backgroundColor: couleur.marine,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 36,
    borderTopWidth: 2,
    borderColor: couleur.dore,
  },
  modalPoignee: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalEntete: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  modalIconeCercle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitre: {
    color: couleur.doreClair,
    fontSize: 19,
    fontWeight: "bold",
  },
  modalSousTitre: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
  modalBtnFermerCoin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Zone blanche contenant le QR — indispensable pour la lecture scanner
  qrZone: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 18,
    borderWidth: 3,
    marginBottom: 18,
    // Ombre pour effet carte flottante
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  modalInstruction: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalInstructionTxt: {
    fontSize: 13.5,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  modalLignePoints: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 13,
    borderRadius: 11,
    marginBottom: 18,
  },
  modalLigneLabel: {
    color: "#aaa",
    fontSize: 13,
  },
  modalLigneValeur: {
    color: couleur.doreClair,
    fontWeight: "bold",
    fontSize: 15,
  },
  modalBtnFermer: {
    flexDirection: "row",
    gap: 7,
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  modalBtnFermerTxt: {
    color: couleur.marine,
    fontWeight: "bold",
    fontSize: 16,
  },
});
