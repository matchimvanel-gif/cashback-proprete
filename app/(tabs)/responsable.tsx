import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { couleur, stylesTitre } from '../../constants/animation';
import { db } from '../../firebaseConfig';
import { Timestamp } from 'firebase/firestore';

type Bac = {
  id: string;
  capacite_max: number;
  remplissage_actuel: number;
  etat: 'disponible' | 'indisponible';
  derniere_collecte: Timestamp;
  localisation: string;
};

export default function ResponsableScreen() {
  const [bacs, setBacs] = useState<Bac[]>([]);
  const [depots, setDepots] = useState<number>(0);
  const [chargement, setChargement] = useState(true);
  const [alertesCount, setAlertesCount] = useState(0);

  useEffect(() => {
    chargerDonnees();
  }, []);

  async function chargerDonnees() {
    setChargement(true);
    try {
      // Récupérer bacs du responsable (id = uid)
import { onAuthStateChanged } from 'firebase/auth';\nimport { auth } from '../../../firebaseConfig';\n\n// Dans component:\nconst [uid, setUid] = useState<string | null>(null);\n\nuseEffect(() => {\n  const unsubscribe = onAuthStateChanged(auth, (user) => {\n    if (user) setUid(user.uid);\n  });\n  return unsubscribe;\n}, []);\n\n// Utiliser uid dans queries (if (!uid) return loading;)
      const bacSnapshot = await getDocs(query(collection(db, 'bacs'), where('__name__', '==', uid)));
      const listeBacs: Bac[] = [];
      for (const bacDoc of bacSnapshot.docs) {
        listeBacs.push(bacDoc.data() as Bac & { id: string });
      }
      setBacs(listeBacs);

      // Dépôts aujourd'hui
      const debutJour = Timestamp.fromDate(new Date(new Date().setHours(0, 0, 0, 0)));
      const finJour = Timestamp.fromDate(new Date(new Date().setHours(23, 59, 59, 999)));
      const depotsQuery = query(
        collection(db, 'depots'),
        where('id_agent', '==', uid),
        where('date', '>=', debutJour),
        where('date', '<=', finJour)
      );
      const depotsSnapshot = await getDocs(depotsQuery);
      setDepots(depotsSnapshot.size);

      // Alertes non traitées
      const alertesQuery = query(
        collection(db, 'alertes'),
        where('traite', '==', false)
        // Note: Pas de respoID, filtre manuel si besoin
      );
      const alertesSnapshot = await getDocs(alertesQuery);
      setAlertesCount(alertesSnapshot.size);

    } catch (e) {
      console.error('Erreur chargement responsable:', e);
    } finally {
      setChargement(false);
    }
  }

  if (chargement) {
    return <ActivityIndicator size='large' color={couleur.dore} style={{ flex: 1, justifyContent: 'center' }} />;
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={stylesTitre.titre}>Dashboard Responsable</Text>

      {/* Stats rapides */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <View style={{
          flex: 1,
          backgroundColor: couleur.marineTransparent,
          padding: 16,
          borderRadius: 15,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: couleur.dore,
        }}>
          <Ionicons name='trash-outline' size={30} color={couleur.dore} />
          <Text style={{ color: couleur.dore, fontSize: 24, fontWeight: 'bold' }}>{depots}</Text>
          <Text style={{ color: '#ccc' }}>Dépôts aujourd'hui</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: couleur.marineTransparent,
          padding: 16,
          borderRadius: 15,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: couleur.turquoise,
        }}>
          <Ionicons name='warning-outline' size={30} color={couleur.turquoise} />
          <Text style={{ color: couleur.turquoise, fontSize: 24, fontWeight: 'bold' }}>{alertesCount}</Text>
          <Text style={{ color: '#ccc' }}>Alertes actives</Text>
        </View>
      </View>

      {/* Liste bacs */}
      <Text style={stylesTitre.sousTitre}>Mes bacs</Text>
      {bacs.map((bac) => (
        <View key={bac.id} style={{
          backgroundColor: couleur.marineTransparent,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: bac.etat === 'disponible' ? couleur.turquoise : couleur.erreur,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: couleur.doreClair, fontWeight: 'bold' }}>Bac {bac.id.slice(-4)}</Text>
            <Text style={{ color: bac.etat === 'disponible' ? couleur.turquoise : couleur.erreur, fontWeight: 'bold' }}>
              {bac.etat}
            </Text>
          </View>
          <Text style={{ color: '#ccc', fontSize: 12 }}>Localisation: {bac.localisation}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text>Remplissage: {bac.remplissage_actuel}/{bac.capacite_max}kg</Text>
            <Text>Dernière collecte: {bac.derniere_collecte?.toDate().toLocaleDateString()}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: '#333', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
            <View style={{
              height: '100%',
              width: `${(bac.remplissage_actuel / bac.capacite_max) * 100}%`,
              backgroundColor: bac.remplissage_actuel > bac.capacite_max * 0.8 ? couleur.erreur : couleur.turquoise,
              borderRadius: 4,
            }} />
          </View>
        </View>
      ))}

      {bacs.length === 0 && (
        <Text style={{ color: '#ccc', textAlign: 'center', marginTop: 20 }}>
          Aucun bac assigné. Contactez Hyzakam.
        </Text>
      )}
    </ScrollView>
  );
}
