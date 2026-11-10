export interface Lugar {
  nome: string;
  latitude: number;
  longitude: number;
}
export const GEOCODIFICADOR = Symbol('GEOCODIFICADOR');
export interface Geocodificador {
  search(query: string): Promise<Lugar[]>;
}
