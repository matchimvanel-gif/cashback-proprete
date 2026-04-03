import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCIHJ6J7vlL6HlbD1afDXRWraneOkx9A-M',
  authDomain: 'cash-back-de-proprete.firebaseapp.com',
  projectId: 'cash-back-de-proprete',
  storageBucket: 'cash-back-de-proprete.firebasestorage.app',
  messagingSenderId: '151809705203',
  appId: '1:151809705203:web:0f025782aa0220d0a92386'
}

const app = initializeApp(firebaseConfig)

export const db   = getFirestore(app)
export const auth = getAuth(app)