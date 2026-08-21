"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { GameAudio } from "./audio";
import { burst, updateParticles, type Particle } from "./particles";
import { FIELD, type GameState } from "./gameTypes";

const { width: W, height: H, paddleH: PH, fishR: R } = FIELD;
type Difficulty = "easy" | "normal" | "hard";
const AI_DIFFICULTY: Record<Difficulty, { speed: number; reactionTime: number; prediction: number; error: number; strikeVariation: number }> = {
  easy: { speed: 300, reactionTime: .22, prediction: .05, error: 48, strikeVariation: 0 },
  normal: { speed: 385, reactionTime: .12, prediction: .78, error: 18, strikeVariation: .18 },
  hard: { speed: 475, reactionTime: .065, prediction: .98, error: 6, strikeVariation: .48 },
};
function predictedImpactY(fishX: number, fishY: number, vx: number, vy: number) {
  if (vx <= 0) return H / 2;
  const travelTime = (W - 88 - fishX) / vx;
  const span = H - R * 2;
  const projected = fishY - R + vy * Math.max(0, travelTime);
  const cycle = ((projected % (span * 2)) + span * 2) % (span * 2);
  return R + (cycle <= span ? cycle : span * 2 - cycle);
}
function advanceVertical(y: number, vy: number, time: number) {
  const span = H - R * 2;
  const unfolded = y - R + vy * time;
  const cycle = ((unfolded % (span * 2)) + span * 2) % (span * 2);
  const descending = cycle > span;
  return { y: R + (descending ? span * 2 - cycle : cycle), vy: vy * (descending ? -1 : 1), hitWall: unfolded < 0 || unfolded > span };
}
const initial = (): GameState => ({ fish: { x: W / 2, y: H / 2, vx: 360 * (Math.random() > .5 ? 1 : -1), vy: (Math.random() - .5) * 170, angle: 0, trail: [] }, player: { y: H / 2, targetY: H / 2, velocity: 0, hit: 0 }, enemy: { y: H / 2, targetY: H / 2, velocity: 0, hit: 0 }, playerScore: 0, enemyScore: 0, winner: null, pointWinner: null, roundDelay: 0, message: "", aiTimer: 0, shake: 0 });

function penguin(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 1 | -1, velocity: number, hit: number, pose: "play" | "win" | "lose", clock: number) {
  const moving = Math.abs(velocity) > 30, step = moving ? Math.sin(clock * .018) : 0;
  const lean = pose === "win" ? -.1 * direction : pose === "lose" ? .13 * direction : Math.max(-.13, Math.min(.13, velocity / 1600));
  ctx.save(); ctx.translate(x, y + (pose === "lose" ? 7 : 0)); ctx.scale(direction, 1); ctx.rotate(lean);
  ctx.fillStyle = "rgba(3,42,59,.2)"; ctx.beginPath(); ctx.ellipse(-2, 50, 43, 12, 0, 0, Math.PI * 2); ctx.fill();
  // Rear flipper: raised for a hit or victory, lowered in defeat.
  ctx.save(); ctx.translate(-18, -1); const wing = pose === "win" ? -1.7 : pose === "lose" ? .75 : hit > 0 ? -1.15 : .45; ctx.rotate(wing);
  ctx.fillStyle = "#162e3b"; ctx.beginPath(); ctx.ellipse(-2, 22, 11, 34, -.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // Clear side-profile silhouette with a slightly forward head.
  ctx.fillStyle = "#0c202c"; ctx.beginPath(); ctx.ellipse(-2, 6, 35, 49, -.08, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(13, -30, 27, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f6fbf2"; ctx.beginPath(); ctx.ellipse(10, 13, 23, 34, -.12, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(19, -25, 15, 18, 0, 0, Math.PI * 2); ctx.fill();
  // Eye and orange beak point toward the ice rink.
  ctx.fillStyle = "#08131a"; ctx.beginPath(); ctx.arc(24, -31, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ff9b35"; ctx.beginPath(); ctx.moveTo(35, -25); ctx.lineTo(55, -18); ctx.lineTo(34, -10); ctx.closePath(); ctx.fill();
  // Red scarf, with a readable trailing tail.
  ctx.fillStyle = "#d93645"; ctx.beginPath(); ctx.ellipse(7, -10, 29, 9, -.05, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-12, -7); ctx.lineTo(-34, 9 + step * 2); ctx.lineTo(-12, 18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#9f2032"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-27, 9); ctx.stroke();
  // Small Santa hat with a white cuff and pom-pom.
  ctx.fillStyle = "#e13b48"; ctx.beginPath(); ctx.moveTo(-5, -49); ctx.quadraticCurveTo(9, -72, 29, -54); ctx.lineTo(28, -45); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff8ea"; ctx.beginPath(); ctx.roundRect(-8, -51, 39, 10, 5); ctx.fill(); ctx.beginPath(); ctx.arc(30, -53, 7, 0, Math.PI * 2); ctx.fill();
  // Feet alternate while sliding; celebration lifts the front foot.
  ctx.fillStyle = "#ff982f"; const frontY = pose === "win" ? 39 : 48 + step * 4, rearY = pose === "lose" ? 52 : 48 - step * 4;
  ctx.beginPath(); ctx.ellipse(18, frontY, 16, 7, -.12, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(-12, rearY, 15, 7, .12, 0, Math.PI * 2); ctx.fill();
  if (pose === "lose") { ctx.strokeStyle = "#5d2230"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(21, -32); ctx.lineTo(27, -29); ctx.stroke(); }
  ctx.restore();
}
function fish(ctx: CanvasRenderingContext2D, state: GameState) { const f = state.fish; for (let i = 0; i < f.trail.length; i++) { const p = f.trail[i]; ctx.globalAlpha = (i / f.trail.length) * .2; ctx.fillStyle = "#6ee7ff"; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + i / 2, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle); ctx.fillStyle = "rgba(0,37,62,.22)"; ctx.beginPath(); ctx.ellipse(4, 10, 26, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ff9b38"; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-34, -12); ctx.lineTo(-31, 12); ctx.closePath(); ctx.fill(); const g = ctx.createLinearGradient(-15, -12, 18, 12); g.addColorStop(0, "#e8fbff"); g.addColorStop(1, "#69d9ed"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 23, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#12212b"; ctx.beginPath(); ctx.arc(12, -3, 2.7, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

export function PenguinPong({ mode, difficulty, started, paused, sound, onStart, registerRestart }: { mode: "ai" | "local"; difficulty: Difficulty; started: boolean; paused: boolean; sound: boolean; onStart: () => void; registerRestart: (fn: () => void) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), state = useRef(initial()), keys = useRef(new Set<string>()), particles = useRef<Particle[]>([]), audio = useRef(new GameAudio()), [scores, setScores] = useState([0, 0]), [winner, setWinner] = useState<string | null>(null);
  const reset = useCallback(() => { state.current = initial(); particles.current = []; setScores([0, 0]); setWinner(null); }, []);
  useEffect(() => registerRestart(reset), [registerRestart, reset]);
  useEffect(() => { reset(); keys.current.clear(); }, [mode, reset]);
  useEffect(() => { const down = (e: KeyboardEvent) => { if (["KeyW", "KeyS", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault(); keys.current.add(e.code); }; const up = (e: KeyboardEvent) => keys.current.delete(e.code); const clear = () => keys.current.clear(); addEventListener("keydown", down); addEventListener("keyup", up); addEventListener("blur", clear); return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", clear); }; }, []);
  useEffect(() => { const c = canvas.current; if (!c) return; const ctx = c.getContext("2d")!; let frame = 0, last = performance.now();
    const serve = (dir: number) => { const s = state.current; s.fish = { x: W / 2, y: H / 2, vx: dir * (350 + Math.random() * 35), vy: (Math.random() - .5) * 190, angle: 0, trail: [] }; s.player.y = s.enemy.y = H / 2; s.roundDelay = .75; };
    const score = (player: boolean) => { const s = state.current; player ? s.playerScore++ : s.enemyScore++; s.pointWinner = player ? "player" : "enemy"; setScores([s.playerScore, s.enemyScore]); burst(particles.current, player ? W - 25 : 25, s.fish.y, 35, "#ffb24a"); audio.current.tone(sound, 180, .35, "sawtooth", .07); s.message = "FISH ESCAPED!"; s.roundDelay = .8; const win = s.playerScore >= 7 ? "PLAYER 1 WINS!" : s.enemyScore >= 7 ? (mode === "ai" ? "PENGUIN AI WINS" : "PLAYER 2 WINS!") : null; if (win) { s.winner = s.playerScore >= 7 ? "player" : "enemy"; setWinner(win); audio.current.tone(sound, s.winner === "player" ? 660 : 130, .7, "triangle", .09); } else serve(player ? -1 : 1); };
    const update = (d: number) => { const s = state.current; if (!started || paused || s.winner) return; s.message = s.roundDelay > .25 ? s.message : ""; if (s.roundDelay > 0) { s.roundDelay -= d; updateParticles(particles.current, d); return; } s.pointWinner = null;
      const move = (keys.current.has("KeyW") ? -1 : 0) + (keys.current.has("KeyS") ? 1 : 0); s.player.velocity += (move * 520 - s.player.velocity) * Math.min(1, d * 12); s.player.y = Math.max(PH / 2 + 14, Math.min(H - PH / 2 - 14, s.player.y + s.player.velocity * d));
      if (mode === "local") { const move2 = (keys.current.has("ArrowUp") ? -1 : 0) + (keys.current.has("ArrowDown") ? 1 : 0); s.enemy.velocity += (move2 * 520 - s.enemy.velocity) * Math.min(1, d * 12); } else { const config = AI_DIFFICULTY[difficulty]; s.aiTimer -= d; if (s.aiTimer <= 0) { if (s.fish.vx > 0) { const forecast = predictedImpactY(s.fish.x, s.fish.y, s.fish.vx, s.fish.vy); const predicted = s.fish.y + (forecast - s.fish.y) * config.prediction; const strike = config.strikeVariation ? (Math.random() < .55 ? 0 : Math.random() > .5 ? 1 : -1) * PH * config.strikeVariation : 0; s.enemy.targetY = predicted - strike + (Math.random() - .5) * config.error * 2; } else { s.enemy.targetY = H / 2 + (Math.random() - .5) * config.error; } s.aiTimer = config.reactionTime * (.9 + Math.random() * .25); } const rallyBoost = difficulty === "easy" ? 0 : Math.min(difficulty === "hard" ? 70 : 35, Math.max(0, Math.hypot(s.fish.vx, s.fish.vy) - 430) * .16); const aiMax = config.speed + rallyBoost; s.enemy.velocity = Math.max(-aiMax, Math.min(aiMax, (s.enemy.targetY - s.enemy.y) * (difficulty === "hard" ? 6 : difficulty === "normal" ? 4.8 : 3.7))); } s.enemy.y = Math.max(PH / 2 + 14, Math.min(H - PH / 2 - 14, s.enemy.y + s.enemy.velocity * d));
      const f = s.fish; f.trail.push({ x: f.x, y: f.y }); if (f.trail.length > 11) f.trail.shift(); f.angle += d * Math.hypot(f.vx, f.vy) / 55;
      const rebound = (p: GameState["player"], left: boolean) => { const offset = Math.max(-1, Math.min(1, (f.y - p.y) / (PH / 2))); const speed = Math.hypot(f.vx, f.vy) * 1.06; const angle = offset * .75 + (Math.random() - .5) * .08; f.vx = (left ? 1 : -1) * Math.cos(angle) * speed; f.vy = Math.sin(angle) * speed; p.hit = .12; s.shake = 5; burst(particles.current, f.x, f.y, 15); audio.current.tone(sound, 520 + Math.log2(1 + speed) * 30, .08, "square", .045); };
      let remaining = d, events = 0, scored = false, wallSound = false;
      while (remaining > .0000001 && events < 64) {
        events += 1; const right = f.vx > 0; const paddlePlane = right ? W - 88 - 39 - R : 88 + 39 + R; const goalPlane = right ? W + R : -R;
        const paddleAhead = right ? f.x < paddlePlane : f.x > paddlePlane; const eventX = paddleAhead ? paddlePlane : goalPlane; const eventTime = (eventX - f.x) / f.vx;
        const travel = eventTime >= 0 && eventTime <= remaining ? eventTime : remaining; const vertical = advanceVertical(f.y, f.vy, travel); f.x += f.vx * travel; f.y = vertical.y; f.vy = vertical.vy; wallSound ||= vertical.hitWall; remaining -= travel;
        if (eventTime < 0 || eventTime > travel + .0000001) break;
        if (!paddleAhead) { score(!right); scored = true; break; }
        const target = right ? s.enemy : s.player; if (Math.abs(f.y - target.y) <= PH / 2 + R) { rebound(target, !right); f.x += f.vx > 0 ? .001 : -.001; } else { f.x += right ? .001 : -.001; }
      }
      if (wallSound) audio.current.tone(sound, 310, .05, "triangle", .045);
      s.player.hit = Math.max(0, s.player.hit - d); s.enemy.hit = Math.max(0, s.enemy.hit - d); s.shake = Math.max(0, s.shake - d * 28); updateParticles(particles.current, d); if (scored) return;
    };
    const draw = () => { const s = state.current; ctx.clearRect(0, 0, W, H); ctx.save(); if (s.shake) ctx.translate((Math.random() - .5) * s.shake, (Math.random() - .5) * s.shake); const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#bfeaf0"); bg.addColorStop(.5, "#e2f7f5"); bg.addColorStop(1, "#8dcdd9"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = .18; ctx.strokeStyle = "#2f91a2"; ctx.lineWidth = 2; for (const [x,y] of [[260,130],[760,400],[460,455],[920,105]]) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+35,y-21); ctx.lineTo(x+62,y-13); ctx.moveTo(x+35,y-21); ctx.lineTo(x+28,y-48); ctx.stroke(); } ctx.globalAlpha = 1; ctx.setLineDash([10, 15]); ctx.strokeStyle = "rgba(21,95,112,.25)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2, 30); ctx.lineTo(W / 2, H - 30); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = "rgba(255,255,255,.48)"; ctx.lineWidth = 10; ctx.strokeRect(5, 5, W - 10, H - 10); const deciding = s.winner ?? s.pointWinner; const playerPose = deciding ? (deciding === "player" ? "win" : "lose") : "play"; const enemyPose = deciding ? (deciding === "enemy" ? "win" : "lose") : "play"; const clock = performance.now(); penguin(ctx, 88, s.player.y, 1, s.player.velocity, s.player.hit, playerPose, clock); penguin(ctx, W - 88, s.enemy.y, -1, s.enemy.velocity, s.enemy.hit, enemyPose, clock); fish(ctx, s); for (const p of particles.current) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1; ctx.restore(); };
    const loop = (now: number) => { const d = Math.min(.025, (now - last) / 1000); last = now; update(d); draw(); frame = requestAnimationFrame(loop); }; frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, [mode, difficulty, started, paused, sound]);
  const touchDown = (code: string, event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); keys.current.add(code); };
  const touchUp = (code: string, event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); keys.current.delete(code); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const touchButton = (code: string, label: string, icon: string) => <button type="button" aria-label={label} onPointerDown={event => touchDown(code, event)} onPointerUp={event => touchUp(code, event)} onPointerCancel={event => touchUp(code, event)} onLostPointerCapture={() => keys.current.delete(code)} onContextMenu={event => event.preventDefault()}>{icon}</button>;
  return <><div className="canvas-wrap"><canvas ref={canvas} width={W} height={H} />
    <div className="scorebar"><div><span>PLAYER 1</span><b>{scores[0]}</b></div><i>❄</i><div><b>{scores[1]}</b><span>{mode === "ai" ? "PENGUIN AI" : "PLAYER 2"}</span></div></div>
    {!started && <div className="game-overlay"><div className="mini-fish">❯</div><h2>READY TO SLIDE?</h2><p>{mode === "ai" ? `Player 1: W / S · ${difficulty.toUpperCase()} AI` : "P1: W / S  ·  P2: ↑ / ↓"}</p><button className="play-button" onClick={onStart}>PLAY <span>▶</span></button></div>}
    {paused && started && !winner && <div className="game-overlay compact"><h2>PAUSED</h2><p>Press Space or the play button to continue.</p></div>}
    {winner && <div className="game-overlay"><div className="trophy">❄</div><h2>{winner}</h2><p>Final score {scores[0]} — {scores[1]}</p><button className="play-button" onClick={() => { reset(); onStart(); }}>PLAY AGAIN <span>↻</span></button></div>}
  </div>
    {started && !paused && !winner && <div className="touch-controls" aria-label="Touch controls"><div className="touch-control-group touch-control-left" aria-label="Player 1 controls">{touchButton("KeyW", "Player 1 up", "▲")}{touchButton("KeyS", "Player 1 down", "▼")}</div>{mode === "local" && <div className="touch-control-group touch-control-right" aria-label="Player 2 controls">{touchButton("ArrowUp", "Player 2 up", "▲")}{touchButton("ArrowDown", "Player 2 down", "▼")}</div>}</div>}
  </>;
}
