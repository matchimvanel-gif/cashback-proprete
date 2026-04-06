import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";
import { couleur, stylesTitre } from "../../../constants/animation";
import { auth, db } from "../../../firebaseConfig";

interface Transaction {
  id: string;
  date: string;
  partenaire: string;
  produit: string;
  reduction: number;
  points: number;
  status: "validé" | "en_attente" | "refusé";
}

export default function OngletHistorique() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFake, setIsFake] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    chargerHistorique();
  }, []);

  async function chargerHistorique() {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, "depots"),
        where("uid_citoyen", "==", uid),
        orderBy("date", "desc"),
        // limit(20)
      );
      const snapshot = await getDocs(q);
      const liste: Transaction[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date.toDate().toLocaleDateString(),
          partenaire: data.nom_etablissement || "Inconnu",
          produit: data.produit || "Non spécifié",
          reduction: data.reduction || 0,
          points: data.points || 0,
          status: data.statut || "validé",
        };
      });

      setTransactions(liste);
      await AsyncStorage.setItem("citoyen_historique", JSON.stringify(liste));
      setIsFake(false);
    } catch (error) {
      console.log("Firebase historique error:", error);
      try {
        const cached = await AsyncStorage.getItem("citoyen_historique");
        if (cached) {
          setTransactions(JSON.parse(cached));
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
    const fakeTransactions: Transaction[] = [
      {
        id: "1",
        date: "01/10/2024",
        partenaire: "Boutique Propre Bafoussam",
        produit: "Savon Luxe",
        reduction: 250,
        points: 50,
        status: "validé",
      },
      {
        id: "2",
        date: "02/10/2024",
        partenaire: "Clean Shop",
        produit: "Détergent Standard",
        reduction: 100,
        points: 25,
        status: "validé",
      },
      {
        id: "3",
        date: "03/10/2024",
        partenaire: "Hygiène Plus",
        produit: "Eau de Javel",
        reduction: 75,
        points: 20,
        status: "en_attente",
      },
    ];
    setTransactions(fakeTransactions);
    setIsFake(true);
    Alert.alert("Info", "Historique fictif affiché");
  }

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.1)",
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: couleur.doreClair, fontWeight: "bold", fontSize: 16 }}
        >
          {item.produit} chez {item.partenaire}
        </Text>
        <View
          style={{
            backgroundColor:
              item.status === "validé" ? couleur.turquoise : couleur.erreur,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 15,
          }}
        >
          <Text style={{ color: couleur.blanc, fontWeight: "bold" }}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text
        style={{
          color: couleur.turquoise,
          fontSize: 18,
          fontWeight: "bold",
          marginTop: 5,
        }}
      >
        -{item.reduction} FCFA + {item.points} pts
      </Text>
      <Text style={{ color: "#ccc", fontSize: 14 }}>{item.date}</Text>
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

      <Text style={stylesTitre.titre}>Mon Historique</Text>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
