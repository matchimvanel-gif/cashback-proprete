import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../../firebaseConfig'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { couleur, stylesTitre } from '../../../constants/animation'

interface Stats {
  pointsAujourdhui: number
  couponsUtilises: number
  economies: number
  partenairesProches: number
}

export default function OngletAccueilCitoyen() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFake, setIsFake] = useState(false)
  const uid = auth.currentUser?.uid

  useEffect(() => {
    chargerStats()
  }, [])

  async function chargerStats() {
    if (!uid) {
      setLoading(false)
      return
    }

    try {
      // Try Firebase first
      setLoading(true)
      const userDoc = await getDoc(doc(db, 'utilisateurs', uid))
      const userData = userDoc.data()
      const quartier = userData?.quartier || 'Bafoussam'

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const qDepots = query(
        collection(db, 'depots'),
        where('uid_citoyen', '==', uid),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<=', Timestamp.fromDate(todayEnd))
      )
      const snapshotDepots = await getDocs(qDepots)
      
      const totalPoints = snapshotDepots.docs.reduce((sum, doc) => sum + (doc.data().points || 0), 0)
      const totalEconomie = snapshotDepots.docs.reduce((sum, doc) => sum + (doc.data().reduction || 0), 0)

      const realStats: Stats = {
        pointsAujourdhui: totalPoints,
        couponsUtilises: snapshotDepots.size,
        economies: totalEconomie,
        partenairesProches: 5 // TODO: query etablissements near quartier
      }

      setStats(realStats)
      // Cache
      await AsyncStorage.setItem('citoyen_stats', JSON.stringify(realStats))
      setIsFake(false)
    } catch (error) {
      console.log('Firebase error, trying cache:', error)
      try {
        const cached = await AsyncStorage.getItem('citoyen_stats')
        if (cached) {
          setStats(JSON.parse(cached))
          setIsFake(false)
        } else {
          utiliserDonneesFictives()
        }
      } catch (cacheError) {
        utiliserDonneesFictives()
      }
    } finally {
      setLoading(false)
    }
  }

  function utiliserDonneesFictives() {
    const fakeStats: Stats = {
      pointsAujourdhui: 150,
      couponsUtilises: 3,
      economies: 1250,
      partenairesProches: 8
    }
    setStats(fakeStats)
    setIsFake(true)
    Alert.alert('Info', 'Données fictives affichées (pas de connexion aux vraies données)')
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={couleur.dore} />
    </View>
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
      {isFake && <Text style={{ color: couleur.erreur, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' }}>
        ⚠️ Données fictives (vérifiez votre connexion)
      </Text>}
      
      <Text style={stylesTitre.titre}>Bonjour Citoyen ! 👋</Text>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 }}>
        <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 20, minWidth: 80 }}>
          <Text style={{ color: couleur.doreClair, fontSize: 28, fontWeight: 'bold' }}>{stats?.pointsAujourdhui || 0}</Text>
          <Text style={{ color: couleur.blanc, fontSize: 14 }}>Points aujourd'hui</Text>
        </View>
        <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 20, minWidth: 80 }}>
          <Text style={{ color: couleur.doreClair, fontSize: 28, fontWeight: 'bold' }}>{stats?.couponsUtilises || 0}</Text>
          <Text style={{ color: couleur.blanc, fontSize: 14 }}>Coupons</Text>
        </View>
        <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 20, minWidth: 80 }}>
          <Text style={{ color: couleur.turquoise, fontSize: 28, fontWeight: 'bold' }}>{stats?.economies || 0} FCFA</Text>
          <Text style={{ color: couleur.blanc, fontSize: 14 }}>Économies</Text>
        </View>
      </View>

      <Text style={stylesTitre.sousTitre}>Partenaires proches</Text>
      <Text style={{ color: couleur.dore, fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
        {stats?.partenairesProches || 0} boutiques à moins de 2km
      </Text>

      <Text style={stylesTitre.sousTitre}>Votre quartier</Text>
      <Text style={{ color: couleur.blanc, textAlign: 'center', fontSize: 18 }}>
        {userData?.quartier || 'Non défini'}
      </Text>
    </ScrollView>
  )
}
