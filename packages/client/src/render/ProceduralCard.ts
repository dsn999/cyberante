import * as THREE from 'three';
import { SUIT_COLORS, type Card, type Suit } from '@cyberante/shared';

type Stroke = readonly [number, number, number, number];
const SEGMENTS: readonly Stroke[] = [
  [0, 1, 1, 1], [1, 1, 1, 0.5], [1, 0.5, 1, 0], [0, 0, 1, 0],
  [0, 0, 0, 0.5], [0, 0.5, 0, 1], [0, 0.5, 1, 0.5],
];
const DIGITS = ['012345', '12', '01643', '01263', '5612', '05623', '056432', '012', '0123456', '012356'];
const LETTERS: Record<string, readonly Stroke[]> = {
  A: [[0,0,0.5,1],[0.5,1,1,0],[0.2,0.4,0.8,0.4]],
  J: [[0,1,1,1],[0.8,1,0.8,0.15],[0.8,0.15,0.4,0],[0.4,0,0,0.2]],
  Q: [[0,0.1,0,0.9],[0,0.9,0.5,1],[0.5,1,1,0.9],[1,0.9,1,0.1],[1,0.1,0.5,0],[0.5,0,0,0.1],[0.6,0.3,1.15,-0.1]],
  K: [[0,0,0,1],[0,0.5,1,1],[0,0.5,1,0]],
};

/** Stroke geometry only: no font textures, images or models. Reuses one buffer. */
export class ProceduralCard {
  public readonly group = new THREE.Group();
  private data: Card;
  private readonly positions = new Float32Array(4096 * 3);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false });
  private readonly face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private cursor = 0;
  private faceDown = false;
  private highlighted = false;
  private readonly tint = new THREE.Color();

  constructor(card: Card, private readonly width = 3.6, private readonly height = 5.2) {
    this.data = { ...card };
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(width, height));
    this.group.add(new THREE.LineSegments(this.geometry, this.material));
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0x07091a }));
    this.face.position.z = -0.01;
    this.group.add(this.face);
    this.redraw();
  }
  public get cardData(): Card { return { ...this.data }; }
  public setCard(card: Card): void {
    if (card.id === this.data.id && card.rank === this.data.rank && card.suit === this.data.suit) return;
    this.data = { ...card }; this.redraw();
  }
  public setFaceDown(enabled: boolean): void { if (this.faceDown !== enabled) { this.faceDown = enabled; this.redraw(); } }
  public setHighlight(active: boolean): void { this.highlighted = active; this.applyColor(); }
  public setTint(hex?: number): void { this.tint.set(hex === undefined ? SUIT_COLORS[this.data.suit] : hex); this.applyColor(); }
  private applyColor(): void { this.material.color.copy(this.highlighted ? new THREE.Color(0xffffff) : this.tint); }
  private line(x1: number, y1: number, x2: number, y2: number): void {
    const i = this.cursor * 3;
    this.positions[i] = x1; this.positions[i + 1] = y1; this.positions[i + 2] = 0;
    this.positions[i + 3] = x2; this.positions[i + 4] = y2; this.positions[i + 5] = 0;
    this.cursor += 2;
  }
  private glyph(character: string, x: number, y: number, scale: number): void {
    const strokes = LETTERS[character] ?? Array.from(DIGITS[Number(character)] ?? '').map(index => SEGMENTS[Number(index)]);
    for (const [ax, ay, bx, by] of strokes) this.line(x + ax * scale, y + ay * scale, x + bx * scale, y + by * scale);
  }
  private suit(suit: Suit, x: number, y: number, size: number): void {
    if (suit === 'DIAMONDS') {
      this.line(x, y + size, x + size * 0.65, y); this.line(x + size * 0.65, y, x, y - size);
      this.line(x, y - size, x - size * 0.65, y); this.line(x - size * 0.65, y, x, y + size); return;
    }
    if (suit === 'CLUBS') {
      for (const [cx, cy] of [[0,0.4],[-0.35,-0.05],[0.35,-0.05]]) {
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
          this.line(x + (cx + Math.cos(a) * 0.38) * size, y + (cy + Math.sin(a) * 0.38) * size,
            x + (cx + Math.cos(b) * 0.38) * size, y + (cy + Math.sin(b) * 0.38) * size);
        }
      }
    } else {
      const flip = suit === 'SPADES' ? -1 : 1;
      const heart = (angle: number): [number, number] => [Math.pow(Math.sin(angle), 3),
        (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) / 16];
      for (let i = 0; i < 32; i++) {
        const a = heart(i * Math.PI / 16), b = heart((i + 1) * Math.PI / 16);
        this.line(x + a[0] * size * 0.7, y + a[1] * size * flip * 0.7,
          x + b[0] * size * 0.7, y + b[1] * size * flip * 0.7);
      }
    }
    if (suit !== 'HEARTS') {
      this.line(x, y, x - size * 0.2, y - size * 0.9); this.line(x - size * 0.2, y - size * 0.9, x + size * 0.2, y - size * 0.9);
      this.line(x + size * 0.2, y - size * 0.9, x, y);
    }
  }
  private redraw(): void {
    this.cursor = 0;
    const w = this.width / 2, h = this.height / 2;
    this.line(-w,-h,w,-h); this.line(w,-h,w,h); this.line(w,h,-w,h); this.line(-w,h,-w,-h);
    if (this.faceDown) {
      for (let i = -2; i <= 2; i++) {
        this.line(-w * 0.7, i * h * 0.2, 0, h * 0.7 + i * h * 0.2);
        this.line(0, h * 0.7 + i * h * 0.2, w * 0.7, i * h * 0.2);
        this.line(w * 0.7, i * h * 0.2, 0, -h * 0.7 + i * h * 0.2);
        this.line(0, -h * 0.7 + i * h * 0.2, -w * 0.7, i * h * 0.2);
      }
      this.tint.setHex(0xff0055);
    } else {
      const rank = this.data.rank === 14 ? 'A' : this.data.rank === 13 ? 'K' : this.data.rank === 12 ? 'Q' : this.data.rank === 11 ? 'J' : String(this.data.rank);
      for (let i = 0; i < rank.length; i++) this.glyph(rank[i], -w + 0.25 + i * 0.95, h - 1.1, 0.8);
      this.suit(this.data.suit, 0, 0, 1.15);
      this.suit(this.data.suit, w - 0.45, -h + 0.55, 0.3);
      this.tint.set(SUIT_COLORS[this.data.suit]);
    }
    this.geometry.setDrawRange(0, this.cursor);
    this.geometry.attributes.position.needsUpdate = true;
    this.applyColor();
  }
  public dispose(): void { this.geometry.dispose(); this.material.dispose(); this.face.geometry.dispose(); this.face.material.dispose(); this.group.clear(); }
}
