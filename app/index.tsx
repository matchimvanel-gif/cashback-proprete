import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebaseConfig'

export default function Index() {
    const [route, setRoute] = useState<string | null>(null)

    useEffect(function() {
        onAuthStateChanged(auth, async function(user) {
            if (!user) {
                setRoute('/login')
                return
            }
            const docSnap = await getDoc(doc(db, 'utilisateurs', user.uid))
            const role = docSnap.data()?.role
            if (role === 'citoyen')       setRoute('/(tabs)/citoyen')
            if (role === 'responsable')   setRoute('/(tabs)/responsable')
            if (role === 'etablissement') setRoute('/(tabs)/etablissement')
            if (role === 'hyzakam')       setRoute('/(tabs)/hyzakam')
        })
    }, [])

    if (!route) return null // chargement
    return <Redirect href={route as any} />
}