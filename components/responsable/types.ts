/* Types partagés pour les composants responsable */

export type CitoyenScanne = {
  uid: string;
  nom: string;
  quartier: string;
  email: string;
  point: number;
};

export type DepotEnregistrement = {
  id: string;
  id_citoyen: string;
  id_agent: string;
  categorie: string;
  poids: number;
  point: number;
  bonus_tri: boolean;
  date: any;
};

export type BacInfo = {
  id: string;
  capacite_max: number;
  remplissage_actuel: number;
  etat: string;
  localisation: string;
  derniere_collecte: any;
};

export type Configuration = {
  categorie_mini: number[];
  categorie_petit: number[];
  categorie_moyen: number[];
  categorie_grand: number[];
};