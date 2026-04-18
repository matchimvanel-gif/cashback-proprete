import {Href} from 'expo-router'
export const ROLES = {
  citoyen: 'citoyen',
  responsable: 'responsable',
  etablissement: 'etablissement',
  hyzakam: 'hyzakam',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.citoyen]: 'Citoyen',
  [ROLES.responsable]: 'Responsable Propreté',
  [ROLES.etablissement]: 'Établissement / Partenaire',
  [ROLES.hyzakam]: 'Hyzakam',
}

export const ROLE_ROUTES= {
  [ROLES.citoyen]: '/(tabs)/citoyen' as const,
  [ROLES.responsable]: '/(tabs)/responsable' as const,
  [ROLES.etablissement]: '/(tabs)/etablissement'as const,
  [ROLES.hyzakam]: '/(tabs)/hyzakam'as const,
} as const 

export const INSCRIPTION_ROLES = [
  ROLES.citoyen,
  ROLES.responsable,
  ROLES.etablissement,
] as const
