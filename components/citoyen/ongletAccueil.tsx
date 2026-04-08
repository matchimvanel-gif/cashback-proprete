import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDoc, getDocs, query, limit, Timestamp, where, orderBy } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { couleur, stylesTitre } from "../../constants/animation";
import { auth, db } from "../../firebaseConfig";

interface UserStats {
  nom: string;
  total_points: number;
  total_reductions: number;
}

interface RecentDepot {
  id: string;
  date: string;
  code: string;
  points: number;
  reduction: number;
  partenaire: string;
}

export default function OngletAccueil() {
  const [stats, setStats] = useState<UserStats>({ nom: "", total_points: 0, total_reductions: 0 });
  const [recent, setRecent] = useState<RecentDepot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFake, setIsFake] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    chargerDashboard();
  }, []);

  async function chargerDashboard() {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, "utilisateurs", uid));
      const userData = userDoc.data();
      const realStats: UserStats = {
        nom: userData?.nom || "Citoyen",
        total_points: userData?.total_points || userData?.point || 0,
        total_reductions: userData?.total_reductions || 0,
      };

      const q = query(
        collection(db, "depots"),
        where("uid_citoyen", "==", uid),
        orderBy("date", "desc"),
        limit(5)
      );
      const snapshot = await getDocs(q);
      const listeRecent: RecentDepot[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          date: (data.date as Timestamp).toDate().toLocaleDateString(),
          code: data.code || "",
          points: data.points || 0,
          reduction: data.reduction || 0,
          partenaire: data.nom_etablissement || "Partenaire",
        };
      });

      const data = { stats: realStats, recent: listeRecent };
      setStats(realStats);
      setRecent(listeRecent);
      await AsyncStorage.setItem("citoyen_accueil", JSON.stringify(data));
      setIsFake(false);
    } catch (error) {
      console.log("Firebase dashboard error:", error);
      try {
        const cached = await AsyncStorage.getItem("citoyen_accueil");
        if (cached) {
          const data = JSON.parse(cached);
          setStats(data.stats);
          setRecent(data.recent);
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
    const fakeStats: UserStats = {
      nom: "John Doe",
      total_points: 1525,
      total_reductions: 4250,
    };
    const fakeRecent: RecentDepot[] = [
      {
        id: "1",
        date: "05/10/2024",
        code: "CLEAN2024-005",
        points: 75,
        reduction: 300,
        partenaire: "Clean Shop Bafoussam",
      },
      {
        id: "2",
        date: "04/10/2024",
        code: "CLEAN2024-004",
        points: 50,
        reduction: 200,
        partenaire: "Propreté Plus",
      },
    ];
    setStats(fakeStats);
    setRecent(fakeRecent);
    setIsFake(true);
    Alert.alert("Info", "Dashboard fictif affiché (mode démo)");
  }

  const renderRecent = ({ item }: { item: RecentDepot }) => (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.1)",
      padding: 15,
      borderRadius: 15,
      marginBottom: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <View>
        <Text style={{ color: couleur.doreClair, fontWeight: "bold" }}>
          {item.code}
        </Text>
        <Text style={{ color: couleur.blanc }}>{item.partenaire}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: couleur.turquoise, fontWeight: "bold" }}>
          +{item.points} pts
        </Text>
        <Text style={{ color: "#ccc" }}>-{item.reduction} FCFA</Text>
        <Text style={{ color: couleur.blanc, fontSize: 12 }}>{item.date}</Text>
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
    <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
      {isFake && (
        <Text style={{
          color: couleur.erreur,
          textAlign: "center",
          marginBottom: 20,
          fontWeight: "bold",
          padding: 10,
          backgroundColor: "rgba(255,0,0,0.1)",
          borderRadius: 10,
        }}>
          ⚠️ Données fictives (mode démo)
        </Text>
      )}

      {/* Welcome */}
      <Text style={stylesTitre.titre}>Bonjour, {stats.nom}!</Text>
      <Text style={stylesTitre.sousTitre}>Votre tableau de bord Cashback Propreté</Text>

      {/* Hero Balance Card */}
      <View style={{
        backgroundColor: "rgba(255,255,255,0.15)",
        padding: 30,
        borderRadius: 25,
        alignItems: "center",
        marginVertical: 25,
        borderWidth: 1,
        borderColor: couleur.dore,
      }}>
        <Text style={{ color: "#ccc", marginBottom: 10 }}>Solde total</Text>
        <Text style={{ 
          color: couleur.doreClair, 
          fontSize: 52, 
          fontWeight: "900",
          textAlign: "center"
        }}>
          {stats.total_points.toLocaleString()}
        </Text>
        <Text style={{ color: couleur.turquoise, fontSize: 18 }}>
          points ({stats.total_reductions.toLocaleString()} FCFA économisés)
        </Text>
      </View>

      {/* Quick Stats Cards */}
      <View style={{ flexDirection: "row", gap: 15, marginBottom: 25 }}>
        <View style={{
          flex: 1,
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 20,
          borderRadius: 20,
          alignItems: "center",
        }}>
          <Ionicons name="ticket-outline" size={32} color={couleur.turquoise} />
          <Text style={{ color: couleur.blanc, fontSize: 24, fontWeight: "bold" }}>
            {recent.length}
          </Text>
          <Text style={{ color: "#ccc", fontSize: 14 }}>Coupons récents</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 20,
          borderRadius: 20,
          alignItems: "center",
        }}>
          <Ionicons name="trending-up-outline" size={32} color={couleur.dore} />
          <Text style={{ color: couleur.blanc, fontSize: 24, fontWeight: "bold" }}>
            3.2%
          </Text>
          <Text style={{ color: "#ccc", fontSize: 14 }}>Progression</Text>
        </View>
      </View>

      {/* CTA Buttons */}
      <View style={{ gap: 15, marginBottom: 25 }}>
        <TouchableOpacity 
          style={{
            backgroundColor: couleur.dore,
            padding: 18,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
          onPress={() => router.push('/(tabs)/citoyen')}
        >
          <Ionicons name="qr-code" size={26} color={couleur.marine} />
          <Text style={{ color: couleur.marine, fontWeight: "bold", fontSize: 18 }}>
            Scanner un coupon
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{
            backgroundColor: couleur.turquoise,
            padding: 18,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
          onPress={chargerDashboard}
        >
          <Ionicons name="refresh" size={26} color={couleur.blanc} />
          <Text style={{ color: couleur.blanc, fontWeight: "bold", fontSize: 18 }}>
            Actualiser
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={stylesTitre.sousTitre}>Activité récente</Text>
      {recent.length === 0 ? (
        <Text style={{ color: "#ccc", textAlign: "center", padding: 40 }}>
          Aucune activité récente. Scanner votre premier coupon !
        </Text>
      ) : (
        <FlatList
          data={recent}
          renderItem={renderRecent}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}
    </ScrollView>
  );
}

