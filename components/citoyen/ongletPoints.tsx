import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
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

interface PointHistory {
  date: string;
  points: number;
  source: string;
  description: string;
}

export default function OngletPoints() {
  const [solde, setSolde] = useState(0);
  const [historique, setHistorique] = useState<PointHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFake, setIsFake] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    chargerPoints();
  }, []);

  async function chargerPoints() {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, "utilisateurs", uid));
      const userData = userDoc.data();
      const realSolde = userData?.point || 0;

      // Fetch history from transactions or depots
      // Simplified: use user point history if exists
      const history: PointHistory[] = [
        // TODO: real query
      ];

      const data = { solde: realSolde, historique: history };
      setSolde(realSolde);
      setHistorique(history);
      await AsyncStorage.setItem("citoyen_points", JSON.stringify(data));
      setIsFake(false);
    } catch (error) {
      console.log("Firebase points error:", error);
      try {
        const cached = await AsyncStorage.getItem("citoyen_points");
        if (cached) {
          const data = JSON.parse(cached);
          setSolde(data.solde);
          setHistorique(data.historique);
          setIsFake(false);
        } else {
          utiliserDonneesFictives();
        }
      } catch {
        utiliserDonneesFictives();
      }
    } finally {
      setLoading(false);
    }
  }

  function utiliserDonneesFictives() {
    setSolde(1250);
    const fakeHistory: PointHistory[] = [
      {
        date: "2024-10-01",
        points: 50,
        source: "Coupon CLEAN001",
        description: "Achat savon",
      },
      {
        date: "2024-10-02",
        points: 100,
        source: "Coupon CLEAN002",
        description: "Achat détergent luxe",
      },
    ];
    setHistorique(fakeHistory);
    setIsFake(true);
    Alert.alert("Info", "Points fictifs affichés");
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={couleur.dore} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      {isFake && (
        <Text
          style={{
            color: couleur.erreur,
            textAlign: "center",
            marginBottom: 20,
            fontWeight: "bold",
            padding: 10,
          }}
        >
          ⚠️ Données fictives
        </Text>
      )}

      <Text style={stylesTitre.titre}>Mes Points</Text>

      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 30,
          borderRadius: 25,
          alignItems: "center",
          marginBottom: 30,
        }}
      >
        <Text
          style={{ color: couleur.turquoise, fontSize: 48, fontWeight: "bold" }}
        >
          {solde}
        </Text>
        <Text style={{ color: couleur.blanc, fontSize: 18 }}>
          Points disponibles
        </Text>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: couleur.dore,
          padding: 15,
          borderRadius: 20,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Text
          style={{ color: couleur.marine, fontWeight: "bold", fontSize: 16 }}
        >
          Échanger mes points
        </Text>
      </TouchableOpacity>

      <Text style={stylesTitre.sousTitre}>Historique récent</Text>
      {historique.map((item, index) => (
        <View
          key={index}
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            padding: 15,
            borderRadius: 15,
            marginBottom: 10,
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: couleur.doreClair, fontWeight: "bold" }}>
              +{item.points} pts
            </Text>
            <Text style={{ color: couleur.blanc }}>{item.date}</Text>
          </View>
          <Text style={{ color: "#ccc" }}>{item.source}</Text>
          <Text style={{ color: couleur.blanc, fontSize: 12 }}>
            {item.description}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
