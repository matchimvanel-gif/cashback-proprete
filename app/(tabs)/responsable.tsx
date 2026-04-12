import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { collection, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";

const STEPS = {
  SCAN_CITOYEN: "scan_citoyen",
  CATEGORIE: "categorie",
  POIDS: "poids",
  CONFIRMATION: "confirmation",
} as const;

type Step = (typeof STEPS)[keyof typeof STEPS];

type Configuration = {
  categorie_mini: number[];
  categorie_petit: number[];
  categorie_moyen: number[];
};

type Citoyen = {
  uid: string;
  nom: string;
  quartier: string;
  active: boolean;
};

export default function EcranResponsable() {
  const [step, setStep] = useState<Step>("scan_citoyen");
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedUid, setScannedUid] = useState("");
  const [citoyen, setCitoyen] = useState<Citoyen | null>(null);
  const [categorie, setCategorie] = useState("");
  const [poids, setPoids] = useState(0);
  const [bonusTri, setBonusTri] = useState(false);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [chargement, setChargement] = useState(false);
  const uidAgent = auth.currentUser?.uid;

  useEffect(function () {
    chargerConfig();
  }, []);

  async function chargerConfig() {
    try {
      const snapConfig = await getDoc(doc(db, "configuration", "barème"));
      if (snapConfig.exists()) {
        setConfig(snapConfig.data() as Configuration);
      }
    } catch (e) {
      console.log("Erreur config:", e);
    }
  }

  async function handleScan(scanningResult: { data: string }) {
    const data = scanningResult.data;

    setScannedUid(data);
    await chargerCitoyen(data);
  }

  async function chargerCitoyen(uid: string) {
    try {
      const snapCitoyen = await getDoc(doc(db, "utilisateurs", uid));
      if (snapCitoyen.exists()) {
        const data = snapCitoyen.data();
        if (data.role === "citoyen" && data.active !== false) {
          setCitoyen({
            uid,
            nom: data.nom || "Citoyen",
            quartier: data.quartier || "",
            active: true,
          });
          setStep("categorie");
        } else {
          Alert.alert("❌ Inéligible", "Ce compte n'est pas un citoyen actif.");
        }
      } else {
        Alert.alert("❌ Citoyen inconnu", "Aucun compte trouvé.");
      }
    } catch (e) {
      Alert.alert("Erreur", "Problème lecture citoyen.");
    }
  }

  async function calculerPoints(): Promise<number> {
    if (!config || !categorie || poids === 0) return 0;
    const options = config[
      `categorie_${categorie}` as keyof Configuration
    ] as number[];
    const pointBase = options[poids - 1] || 0;
    return bonusTri ? pointBase * 1.2 : pointBase;
  }

  async function confirmerDepot() {
    if (!citoyen || !categorie || poids === 0 || !uidAgent) return;

    setChargement(true);
    try {
      const points = await calculerPoints();
      if (points === 0) {
        Alert.alert("Erreur", "Configuration points manquante.");
        return;
      }

      // Appel Cloud Function (évite rules complexes)
      // Direct Firestore write (no Cloud Function needed)
      const depotRef = doc(collection(db, "depots"));
      await setDoc(depotRef, {
        id_citoyen: citoyen.uid,
        id_agent: uidAgent,
        categorie,
        poids,
        point: points,
        bonus_tri: bonusTri,
        date: Timestamp.now(),
      });
      Alert.alert(
        "✅ Dépôt enregistré",
        `+${points} points pour ${citoyen.nom}`,
      );
      resetForm();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Problème Cloud Function.");
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
    setScannedUid("");
  }

  const categories = ["mini", "petit", "moyen", "grand"] as const;

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: couleur.blanc, marginBottom: 20 }}>
          Permission caméra requise
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: couleur.dore,
            padding: 15,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: couleur.marine, fontWeight: "bold" }}>
            Accorder
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Text style={stylesTitre.titre}>Dépôt Responsable</Text>

      {step === "scan_citoyen" && (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <CameraView
            style={{ flex: 1, borderRadius: 20, marginBottom: 20 }}
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
          <Text style={{ color: couleur.blanc, textAlign: "center" }}>
            Scanner QR du citoyen
          </Text>
        </View>
      )}

      {step === "categorie" && citoyen && (
        <View>
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <Text
              style={{
                color: couleur.doreClair,
                fontWeight: "bold",
                fontSize: 18,
              }}
            >
              {citoyen.nom}
            </Text>
            <Text style={{ color: "#ccc" }}>{citoyen.quartier}</Text>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={couleur.turquoise}
            />
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
                    borderColor:
                      categorie === cat ? couleur.dore : "transparent",
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
      )}

      {step === "poids" && categorie && citoyen && config && (
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
            {(
              config[
                `categorie_${categorie}` as keyof Configuration
              ] as number[]
            ).map(function (p, index) {
              return (
                <TouchableOpacity
                  key={index}
                  style={{
                    backgroundColor: couleur.marineTransparent,
                    borderRadius: 12,
                    padding: 16,
                    minWidth: 80,
                    borderWidth: 2,
                    borderColor:
                      poids === index + 1 ? couleur.dore : "transparent",
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
      )}

      {step === "confirmation" && citoyen && categorie && poids > 0 && (
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
            <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
              Citoyen
            </Text>
            <Text style={{ color: "#ccc" }}>
              {citoyen.nom} - {citoyen.quartier}
            </Text>
            <Text
              style={{
                color: couleur.blanc,
                fontWeight: "bold",
                marginTop: 12,
              }}
            >
              Dépôt
            </Text>
            <Text style={{ color: "#ccc" }}>
              {categorie.toUpperCase()} - {poids}kg
            </Text>
            <Text
              style={{
                color: couleur.turquoise,
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 12,
              }}
            >
              {calculerPoints()} points
            </Text>
            {bonusTri && (
              <Text style={{ color: couleur.vert, fontSize: 12 }}>
                +20% bonus tri
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: bonusTri
                ? couleur.vert
                : couleur.marineTransparent,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderWidth: 2,
              borderColor: couleur.turquoise,
            }}
            onPress={function () {
              setBonusTri(!bonusTri);
            }}
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
            }}
            onPress={confirmerDepot}
            disabled={chargement}
          >
            {chargement ? (
              <ActivityIndicator color={couleur.marine} />
            ) : (
              <Text
                style={{
                  color: couleur.marine,
                  fontWeight: "bold",
                  fontSize: 18,
                }}
              >
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
              marginTop: 12,
            }}
            onPress={resetForm}
          >
            <Text style={{ color: couleur.blanc }}>Annuler</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}
