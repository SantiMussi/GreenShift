/**
 * Etiquetas DOM ancladas a objetos 3D.
 *
 * En lugar de crear una raíz de React por etiqueta (drei <Html>), la escena
 * registra objetos ancla y un único proyector mueve elementos DOM normales
 * cada frame. Más liviano y sin pelearse con el ciclo de render de React.
 */
import type * as THREE from "three";

export const anchorObjects = new Map<string, THREE.Object3D>();
export const labelElements = new Map<string, HTMLElement>();

export function registerLabel(id: string) {
  return (el: HTMLElement | null) => {
    if (el) labelElements.set(id, el);
    else labelElements.delete(id);
  };
}

export function registerAnchor(id: string) {
  return (obj: THREE.Object3D | null) => {
    if (obj) anchorObjects.set(id, obj);
    else anchorObjects.delete(id);
  };
}
