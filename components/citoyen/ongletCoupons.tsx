import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarCodeScanner } from "expo-barcode-scanner";
import {
    collection,
    getDocs,
    query,
    Timestamp,
    where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { couleur, stylesTitre } from "../../../constants/animation";
import { auth, db } from "../../../firebaseConfig";

interface Coupon {
  id: string;
  code: string;
  points: number;
  date: Date;
  status: "disponible" | "utilisé" | "expiré";
}

export default function OngletCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFake, setIsFake] = useState(false);
  const [scanning, setScanning] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    chargerCoupons();
  }, []);

  async function chargerCoupons() {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, "depots"), // or 'coupons' collection?
        where("uid_citoyen", "==", uid),
      );
      const snapshot = await getDocs(q);
      const liste: Coupon[] = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
          date: (doc.data().date as Timestamp).toDate(),
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      setCoupons(liste);
      await AsyncStorage.setItem("citoyen_coupons", JSON.stringify(liste));
      setIsFake(false);
    } catch (error) {
      console.log("Firebase coupons error:", error);
      try {
        const cached = await AsyncStorage.getItem("citoyen_coupons");
        if (cached) {
          setCoupons(JSON.parse(cached));
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
    const fakeCoupons: Coupon[] = [
      {
        id: "1",
        code: "CLEAN2024-001",
        points: 50,
        date: new Date(Date.now() - 86400000),
        status: "disponible" as const,
      },
      {
        id: "2",
        code: "CLEAN2024-002",
        points: 100,
        date: new Date(Date.now() - 2 * 86400000),
        status: "utilisé" as const,
      },
    ];
    setCoupons(fakeCoupons);
    setIsFake(true);
    Alert.alert("Info", "Coupons fictifs affichés");
  }

  const handleBarCodeScanned = ({ data }: any) => {
    setScanning(false);
    Alert.alert("Code scanné", data, [
      { text: "OK", onPress: () => chargerCoupons() },
    ]);
  };

  const renderCoupon = ({ item }: { item: Coupon }) => (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.1)",
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View>
        <Text style={{ color: couleur.doreClair, fontWeight: "bold" }}>
          {item.code}
        </Text>
        <Text style={{ color: couleur.blanc, fontSize: 14 }}>
          {item.points} points
        </Text>
        <Text style={{ color: "#ccc" }}>{item.date.toLocaleDateString()}</Text>
      </View>
      <View
        style={{
          backgroundColor:
            item.status === "disponible" ? couleur.turquoise : couleur.erreur,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
        }}
      >
        <Text style={{ color: couleur.blanc }}>{item.status}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={couleur.dore} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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

      <Text style={stylesTitre.titre}>Mes Coupons</Text>

      <TouchableOpacity
        style={{
          backgroundColor: couleur.dore,
          padding: 15,
          borderRadius: 20,
          alignItems: "center",
          marginBottom: 20,
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
        }}
        onPress={() => setScanning(true)}
      >
        <Ionicons name="qr-code" size={24} color={couleur.marine} />
        <Text
          style={{ color: couleur.marine, fontWeight: "bold", fontSize: 16 }}
        >
          Scanner un code
        </Text>
      </TouchableOpacity>

      {scanning && (
        <BarCodeScanner
          style={{ flex: 1 }}
          onBarCodeScanned={handleBarCodeScanned}
        />
      )}

      {!scanning && (
        <FlatList
          data={coupons}
          renderItem={renderCoupon}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
