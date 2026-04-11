import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebaseConfig'
import { ROLE_ROUTES, type Role } from '../constants/roles'

export default function Index() {
    const [route, setRoute] = useState<string | null>(null)

    useEffect(function() {
        onAuthStateChanged(auth, async function(user) {
            if (!user) {
                setRoute('/login')
                return
            }
            const docSnap = await getDoc(doc(db, 'utilisateurs', user.uid))
            const role = docSnap.data()?.role as Role | undefined
            if (role && role in ROLE_ROUTES) {
                setRoute(ROLE_ROUTES[role])
            }
        })
    }, [])

    if (!route) return null // chargement
    return <Redirect href={route as any} />
}
