export type Vec = { x: number; y: number };
export type Fish = Vec & { vx: number; vy: number; angle: number; trail: Vec[] };
export type Penguin = { y: number; targetY: number; velocity: number; hit: number };
export type GameState = { fish: Fish; player: Penguin; enemy: Penguin; playerScore: number; enemyScore: number; winner: "player" | "enemy" | null; pointWinner: "player" | "enemy" | null; roundDelay: number; message: string; aiTimer: number; shake: number };
export const FIELD = { width: 1120, height: 560, paddleW: 64, paddleH: 116, fishR: 19 };
