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

export const ROLE_ROUTES: Record<Role, '/(tabs)/citoyen' | '/(tabs)/responsable' | '/(tabs)/etablissement' | '/(tabs)/hyzakam'> = {
  [ROLES.citoyen]: '/(tabs)/citoyen',
  [ROLES.responsable]: '/(tabs)/responsable',
  [ROLES.etablissement]: '/(tabs)/etablissement',
  [ROLES.hyzakam]: '/(tabs)/hyzakam',
}

export const INSCRIPTION_ROLES = [
  ROLES.citoyen,
  ROLES.responsable,
  ROLES.etablissement,
] as const
