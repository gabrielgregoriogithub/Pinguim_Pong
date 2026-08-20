import type { Vec } from "./gameTypes";
export type Particle = Vec & { vx: number; vy: number; life: number; size: number; color: string };
export function burst(list: Particle[], x: number, y: number, count: number, color = "#dffcff") { for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 180; list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .4 + Math.random() * .45, size: 2 + Math.random() * 5, color }); } }
export function updateParticles(list: Particle[], d: number) { for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.x += p.vx * d; p.y += p.vy * d; p.vy += 55 * d; p.life -= d; if (p.life <= 0) list.splice(i, 1); } }
