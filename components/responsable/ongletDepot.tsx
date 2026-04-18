import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";
import { CitoyenScanne, Configuration } from "./types";
import { appelAddDepot } from "../../constants/api";


/* Les 4 étapes du processus de dépôt */
const STEPS = {
  SCAN_CITOYEN: "scan_citoyen",
  CATEGORIE: "categorie",
  POIDS: "poids",
  CONFIRMATION: "confirmation",
} as const;

type Step = (typeof STEPS)[keyof typeof STEPS];

export default function OngletDepot() {
  const [step, setStep] = useState<Step>("scan_citoyen");
  const [permission, requestPermission] = useCameraPermissions();
  const [citoyen, setCitoyen] = useState<CitoyenScanne | null>(null);
  const [categorie, setCategorie] = useState("");
  const [poids, setPoids] = useState(0);
  const [bonusTri, setBonusTri] = useState(false);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [chargement, setChargement] = useState(false);
  const [pointsCalcules, setPointsCalcules] = useState(0);
  /* Saisie manuelle de l'uid pour les tests */
  const [saisieManuelle, setSaisieManuelle] = useState("");
  const [modeManuel, setModeManuel] = useState(false);
  /* Empeche de scanner plusieurs fois d'affilée */
  const dejaScanne = useRef(false);
  const uidAgent = auth.currentUser?.uid;

  const categories = ["mini", "petit", "moyen", "grand"] as const;

  useEffect(function () {
    chargerConfig();
  }, []);

  /* Remet le verrou de scan a zero quand on revient a l'etape scan */
  useEffect(function () {
    if (step === "scan_citoyen") {
      dejaScanne.current = false;
    }
  }, [step]);

  /* Recalcule les points a chaque changement de selection */
  useEffect(function () {
    if (config && categorie && poids > 0) {
      const cle = ("categorie_" + categorie) as keyof Configuration;
      const options = config[cle] as number[];
      const pointBase = options[poids - 1] || 0;
      if (bonusTri) {
        setPointsCalcules(Math.round(pointBase * 1.2));
      } else {
        setPointsCalcules(pointBase);
      }
    }
  }, [poids, categorie, bonusTri, config]);

  async function chargerConfig() {
    try {
      const snapConfig = await getDoc(doc(db, "configuration", "barème"));
      if (snapConfig.exists()) {
        setConfig(snapConfig.data() as Configuration);
      }
    } catch (erreur) {
      console.log("Erreur chargement config:", erreur);
    }
  }

  async function handleScan(scanningResult: { data: string }) {
    /* On ignore si on a deja scanne recemment */
    if (dejaScanne.current) {
      return;
    }
    dejaScanne.current = true;
    const valeur = scanningResult.data.trim();
    await chargerCitoyen(valeur);
  }

  async function handleSaisieManuelle() {
    const valeur = saisieManuelle.trim();
    if (!valeur) {
      Alert.alert("Erreur", "Veuillez entrer un identifiant citoyen.");
      return;
    }
    await chargerCitoyen(valeur);
  }

  async function chargerCitoyen(uid: string) {
    try {
      const snapCitoyen = await getDoc(doc(db, "utilisateurs", uid));

      if (!snapCitoyen.exists()) {
        /* On affiche l'uid dans le message pour aider au diagnostic */
        Alert.alert(
          "Citoyen introuvable",
          "Aucun compte trouvé pour l'identifiant :\n" + uid + "\n\nVérifiez que le QR code est bien celui du citoyen.",
          [{ text: "Réessayer", onPress: function () { dejaScanne.current = false; } }]
        );
        return;
      }

      const data = snapCitoyen.data();

      if (data.role !== "citoyen") {
        Alert.alert(
          "Compte inéligible",
          "Ce compte a le rôle \"" + data.role + "\". Seuls les comptes citoyens sont acceptés.",
          [{ text: "Réessayer", onPress: function () { dejaScanne.current = false; } }]
        );
        return;
      }

      if (data.active === false) {
        Alert.alert(
          "Compte désactivé",
          "Ce compte citoyen est désactivé.",
          [{ text: "Réessayer", onPress: function () { dejaScanne.current = false; } }]
        );
        return;
      }

      /* Citoyen valide */
      setCitoyen({
        uid,
        nom: data.nom || "(sans nom)",
        quartier: data.quartier || "",
        email: data.email || "",
        point: data.point || 0,
      });
      setStep("categorie");

    } catch (erreur) {
      console.log("Erreur chargerCitoyen:", erreur);
      Alert.alert("Erreur", "Problème de connexion. Réessayez.");
      dejaScanne.current = false;
    }
  }

  async function confirmerDepot() {
    if (!citoyen || !categorie || poids === 0 || !uidAgent) {
      return;
    }
    if (pointsCalcules === 0) {
      Alert.alert("Erreur", "Configuration points manquante.");
      return;
    }

    setChargement(true);
    try {
      const resultat = await appelAddDepot({
        id_citoyen: citoyen.uid,
        id_agent: uidAgent,
        categorie,
        poids,
        point: pointsCalcules,
        bonus_tri: bonusTri,
      });
      const depotRef = doc(collection(db, "depots"));
      await setDoc(depotRef,resultat);
      Alert.alert(
        "Dépôt enregistré",
        "+" + pointsCalcules + " points pour " + citoyen.nom
      );
      resetForm();
    } catch (erreur: any) {
      Alert.alert("Erreur", erreur.message || "Problème enregistrement.");
    } finally {
      setChargement(false);
    }
  }

  function resetForm() {
    setStep("scan_citoyen");
    setCitoyen(null);
    setCategorie("");
    setPoids(0);
    setBonusTri(false);
    setPointsCalcules(0);
    setSaisieManuelle("");
    setModeManuel(false);
  }

  function renduEtapeScan() {
    /* Mode saisie manuelle (utile en mode web ou si le scan ne fonctionne pas) */
    if (modeManuel) {
      return (
        <View style={{ flex: 1 }}>
          <Text style={stylesTitre.sousTitre}>Saisie manuelle de l'identifiant</Text>
          <Text style={{ color: "#ccc", fontSize: 12, marginBottom: 16 }}>
            Entrez l'UID Firebase du citoyen (visible dans son profil ou Firebase Console)
          </Text>
          <TextInput
            value={saisieManuelle}
            onChangeText={setSaisieManuelle}
            placeholder="ex: aBcDeFgHiJ123456..."
            placeholderTextColor="#999"
            style={{
              backgroundColor: couleur.marineTransparent,
              color: couleur.blanc,
              borderRadius: 10,
              padding: 14,
              fontSize: 14,
              borderWidth: 1,
              borderColor: couleur.dore,
              marginBottom: 16,
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={{
              backgroundColor: couleur.dore,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              marginBottom: 12,
            }}
            onPress={handleSaisieManuelle}
          >
            <Text style={{ color: couleur.marine, fontWeight: "bold" }}>
              Rechercher le citoyen
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              borderRadius: 12,
              padding: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#ccc",
            }}
            onPress={function () { setModeManuel(false); }}
          >
            <Text style={{ color: "#ccc" }}>Revenir au scanner</Text>
          </TouchableOpacity>
        </View>
      );
    }

    /* Mode scanner QR */
    return (
      <View style={{ flex: 1 }}>
        <Text style={stylesTitre.sousTitre}>Scanner QR Citoyen</Text>
        <View
          style={{
            height: 300,
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 16,
            borderWidth: 2,
            borderColor: couleur.dore,
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
        </View>
        <Text style={{ color: couleur.blanc, textAlign: "center", fontSize: 14, marginBottom: 16 }}>
          Pointez la caméra vers le QR code du citoyen
        </Text>
        {/* Bouton de fallback pour les tests sur web */}
        <TouchableOpacity
          style={{
            borderRadius: 10,
            padding: 12,
            alignItems: "center",
            borderWidth: 1,
            borderColor: couleur.dore,
          }}
          onPress={function () { setModeManuel(true); }}
        >
          <Text style={{ color: couleur.dore, fontSize: 13 }}>
            Saisir l'identifiant manuellement
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renduEtapeCategorie() {
    if (!citoyen) {
      return null;
    }
    return (
      <View>
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <Ionicons name="checkmark-circle" size={48} color={couleur.turquoise} />
          <Text
            style={{
              color: couleur.doreClair,
              fontWeight: "bold",
              fontSize: 18,
              marginTop: 12,
            }}
          >
            {citoyen.nom}
          </Text>
          <Text style={{ color: "#ccc", fontSize: 14 }}>{citoyen.quartier}</Text>
          <Text style={{ color: couleur.turquoise, fontSize: 12, marginTop: 4 }}>
            {citoyen.point} points actuels
          </Text>
        </View>

        <Text style={stylesTitre.sousTitre}>Catégorie de déchets</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
        >
          {categories.map(function (cat) {
            return (
              <TouchableOpacity
                key={cat}
                style={{
                  backgroundColor: couleur.marineTransparent,
                  borderRadius: 12,
                  padding: 16,
                  marginRight: 12,
                  minWidth: 100,
                  borderWidth: 2,
                  borderColor: categorie === cat ? couleur.dore : "transparent",
                }}
                onPress={function () {
                  setCategorie(cat);
                  setStep("poids");
                }}
              >
                <Text
                  style={{
                    color: couleur.blanc,
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function renduEtapePoids() {
    if (!config || !categorie) {
      return null;
    }
    const cle = ("categorie_" + categorie) as keyof Configuration;
    const options = config[cle] as number[];

    return (
      <View>
        <Text style={stylesTitre.sousTitre}>
          Poids ({categorie.toUpperCase()})
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 20,
            justifyContent: "center",
          }}
        >
          {options.map(function (p, index) {
            return (
              <TouchableOpacity
                key={index}
                style={{
                  backgroundColor: couleur.marineTransparent,
                  borderRadius: 12,
                  padding: 16,
                  minWidth: 80,
                  borderWidth: 2,
                  borderColor: poids === index + 1 ? couleur.dore : "transparent",
                }}
                onPress={function () {
                  setPoids(index + 1);
                  setStep("confirmation");
                }}
              >
                <Text
                  style={{
                    color: couleur.blanc,
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {p} pts
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function renduEtapeConfirmation() {
    if (!citoyen) {
      return null;
    }
    return (
      <View>
        <Text style={stylesTitre.sousTitre}>Confirmer le dépôt</Text>

        <View
          style={{
            backgroundColor: couleur.marineTransparent,
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: couleur.dore,
          }}
        >
          <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>Citoyen</Text>
          <Text style={{ color: "#ccc", marginTop: 4 }}>
            {citoyen.nom} - {citoyen.quartier}
          </Text>

          <Text style={{ color: couleur.blanc, fontWeight: "bold", marginTop: 16 }}>
            Dépôt
          </Text>
          <Text style={{ color: "#ccc", marginTop: 4 }}>
            {categorie.toUpperCase()} - {poids} kg
          </Text>

          <Text
            style={{
              color: couleur.turquoise,
              fontSize: 18,
              fontWeight: "bold",
              marginTop: 16,
            }}
          >
            {pointsCalcules} points
          </Text>

          {bonusTri && (
            <Text style={{ color: couleur.vert, fontSize: 12, marginTop: 8 }}>
              +20% bonus tri appliqué
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: bonusTri ? couleur.vert : couleur.marineTransparent,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 2,
            borderColor: couleur.turquoise,
          }}
          onPress={function () { setBonusTri(!bonusTri); }}
        >
          <Ionicons
            name={bonusTri ? "checkmark-circle" : "radio-button-off"}
            size={24}
            color={couleur.turquoise}
          />
          <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
            Bonus tri sélectif (+20%)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: couleur.dore,
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
            marginBottom: 12,
          }}
          onPress={confirmerDepot}
          disabled={chargement}
        >
          {chargement ? (
            <ActivityIndicator color={couleur.marine} />
          ) : (
            <Text style={{ color: couleur.marine, fontWeight: "bold", fontSize: 16 }}>
              Confirmer le dépôt
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: couleur.erreur,
            borderRadius: 12,
            padding: 12,
            alignItems: "center",
          }}
          onPress={resetForm}
        >
          <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renduContenu() {
    if (step === "scan_citoyen") {
      return renduEtapeScan();
    }
    if (step === "categorie") {
      return renduEtapeCategorie();
    }
    if (step === "poids") {
      return renduEtapePoids();
    }
    if (step === "confirmation") {
      return renduEtapeConfirmation();
    }
    return null;
  }

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Ionicons name="camera-outline" size={48} color={couleur.dore} />
        <Text style={{ color: couleur.blanc, fontSize: 14, textAlign: "center", marginVertical: 20 }}>
          Permission caméra requise pour scanner le QR code
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: couleur.dore,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: couleur.marine, fontWeight: "bold" }}>
            Autoriser la caméra
          </Text>
        </TouchableOpacity>
        {/* Fallback si la caméra est refusée */}
        <TouchableOpacity
          onPress={function () { setModeManuel(true); }}
          style={{
            borderRadius: 8,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: couleur.dore,
          }}
        >
          <Text style={{ color: couleur.dore, fontSize: 13 }}>
            Saisir l'identifiant manuellement
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 20 }}
    >
      {renduContenu()}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
