// ============================================================================
// CYBERANTE: Procedural Wireframe Vector Card Geometry
// ============================================================================

import * as THREE from 'three';
import { Card, Suit } from '@cyberante/shared';

const SUIT_COLORS: Record<Suit, number> = {
  SPADES: 0x00f3ff,   // Electric Cyan
  HEARTS: 0xff0055,   // Hot Magenta
  DIAMONDS: 0xffb700, // Amber Gold
  CLUBS: 0x00ff66,    // Laser Green
};

export class ProceduralCard {
  public group: THREE.Group;
  public cardData: Card;
  private borderLine: THREE.LineLoop;

  constructor(card: Card, width: number = 3.6, height: number = 5.2) {
    this.cardData = card;
    this.group = new THREE.Group();

    const halfW = width / 2;
    const halfH = height / 2;
    const radius = 0.3;

    // Rounded rectangle perimeter points
    const points: THREE.Vector3[] = [];
    const segments = 6;

    const addCorner = (cx: number, cy: number, startAngle: number) => {
      for (let i = 0; i <= segments; i++) {
        const theta = startAngle + (i / segments) * (Math.PI / 2);
        points.push(new THREE.Vector3(cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius, 0));
      }
    };

    addCorner(halfW - radius, halfH - radius, 0);
    addCorner(-halfW + radius, halfH - radius, Math.PI / 2);
    addCorner(-halfW + radius, -halfH + radius, Math.PI);
    addCorner(halfW - radius, -halfH + radius, (3 * Math.PI) / 2);

    const borderGeo = new THREE.BufferGeometry().setFromPoints(points);
    const suitColor = SUIT_COLORS[card.suit];

    const borderMat = new THREE.LineBasicMaterial({
      color: suitColor,
      linewidth: 2,
      blending: THREE.AdditiveBlending,
    });

    this.borderLine = new THREE.LineLoop(borderGeo, borderMat);
    this.group.add(this.borderLine);

    // Inner glowing diamond pattern
    const innerPoints = [
      new THREE.Vector3(0, halfH * 0.45, 0),
      new THREE.Vector3(halfW * 0.45, 0, 0),
      new THREE.Vector3(0, -halfH * 0.45, 0),
      new THREE.Vector3(-halfW * 0.45, 0, 0),
    ];
    const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPoints);
    const innerLine = new THREE.LineLoop(innerGeo, new THREE.LineBasicMaterial({
      color: suitColor,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    }));
    this.group.add(innerLine);
  }

  public setHighlight(active: boolean): void {
    const mat = this.borderLine.material as THREE.LineBasicMaterial;
    mat.color.setHex(active ? 0xffffff : SUIT_COLORS[this.cardData.suit]);
  }
}
