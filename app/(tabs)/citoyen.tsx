// Citoyen Dashboard - Cashback Propreté
import { useState } from 'react'
import { View, Text, TouchableOpacity, ImageBackground, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { couleur } from '../../../constants/animation'
import OngletAccueil from '../../../components/citoyen/ongletAccueil'
import OngletCoupons from '../../../components/citoyen/ongletCoupons'
import OngletPoints from '../../../components/citoyen/ongletPoints'
import OngletHistorique from '../../../components/citoyen/ongletHistorique'
import { router, useSegments } from 'expo-router'
import { signOut } from 'firebase/auth'
import { auth } from '../../../firebaseConfig'

export default function EcranCitoyen() {
  const [ongletActif, setOngletActif] = useState('accueil')
  const [menuOuvert, setMenuOuvert] = useState(false)
  const segments = useSegments()

  const onglets = [
    { id: 'accueil', icone: 'home-outline', iconeActif: 'home', label: 'Accueil' },
    { id: 'coupons', icone: 'ticket-outline', iconeActif: 'ticket', label: 'Coupons' },
    { id: 'points', icone: 'star-outline', iconeActif: 'star', label: 'Points' },
    { id: 'historique', icone: 'time-outline', iconeActif: 'time', label: 'Historique' },
  ]

  function renduContenu() {
    switch (ongletActif) {
      case 'accueil': return <OngletAccueil />
      case 'coupons': return <OngletCoupons />
      case 'points': return <OngletPoints />
      case 'historique': return <OngletHistorique />
      default: return null
    }
  }

  async function deconnexion() {
    try {
      await signOut(auth)
      router.replace('/login')
    } catch (error) {
      console.error('Erreur déconnexion:', error)
    }
  }

  return (
    <ImageBackground
      source={require('../../../image/decalage-arriere-plan-abstrait-conception-coloree_677411-3431.jpg')}
      resizeMode="cover"
      style={{ flex: 1, width: '100%', height: '100%' }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 15,
          borderBottomWidth: 1,
          borderBottomColor: couleur.dore,
        }}>
          <Text style={{
            color: couleur.doreClair,
            fontSize: 18,
            fontWeight: 'bold',
            marginTop: 15
          }}>
            Cashback Propreté - Citoyen
          </Text>

          <TouchableOpacity onPress={() => setMenuOuvert(!menuOuvert)}>
            <Ionicons name="menu" size={28} color={couleur.dore} style={{ marginTop: 15 }} />
          </TouchableOpacity>
        </View>

        {/* Menu hamburger */}
        {menuOuvert && (
          <View style={{
            position: 'absolute',
            top: 65,
            right: 0,
            backgroundColor: couleur.marine,
            borderLeftWidth: 1,
            borderBottomWidth: 1,
            borderColor: couleur.dore,
            borderBottomLeftRadius: 20,
            paddingVertical: 10,
            zIndex: 999,
            width: 200,
          }}>
            <TouchableOpacity style={{ padding: 15, flexDirection: 'row', gap: 10 }}>
              <Ionicons name="settings-outline" size={20} color={couleur.dore} />
              <Text style={{ color: couleur.blanc }}>Paramètres</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 15 }} />
            <TouchableOpacity style={{ padding: 15, flexDirection: 'row', gap: 10 }} onPress={deconnexion}>
              <Ionicons name="log-out-outline" size={20} color={couleur.erreur} />
              <Text style={{ color: couleur.erreur }}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contenu onglet */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1 }}>
            {renduContenu()}
          </View>
        </ScrollView>

        {/* Barre onglets bas */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: couleur.marine,
          borderTopWidth: 1,
          borderTopColor: couleur.dore,
          paddingBottom: 10,
          paddingTop: 8,
        }}>
          {onglets.map((onglet) => (
            <TouchableOpacity
              key={onglet.id}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 5 }}
              onPress={() => setOngletActif(onglet.id)}
            >
              <Ionicons 
                name={(ongletActif === onglet.id ? onglet.iconeActif : onglet.icone) as any}
                size={22}
                color={ongletActif === onglet.id ? couleur.dore : '#ccc'}
              />
              <Text style={{
                fontSize: 10,
                color: ongletActif === onglet.id ? couleur.dore : '#ccc',
                fontWeight: ongletActif === onglet.id ? 'bold' : 'normal',
                marginTop: 2
              }}>
                {onglet.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </ImageBackground>
  )
}
