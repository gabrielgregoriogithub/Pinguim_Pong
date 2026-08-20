"use client";
import { useEffect, useRef, useState } from "react";
import { PenguinPong } from "../components/PenguinPong";
export default function Home() {
  const [started, setStarted] = useState(false), [sound, setSound] = useState(true), [paused, setPaused] = useState(false);
  const restartRef = useRef<() => void>(() => {});
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.code === "Space" && started) { e.preventDefault(); setPaused(v => !v); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [started]);
  return <main className="game-shell"><div className="aurora aurora-one" /><div className="aurora aurora-two" />
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">P</span><span>PENGUIN PONG</span></a><div className="top-actions"><button className="icon-button" onClick={() => setPaused(v => !v)} disabled={!started}>{paused ? "▶" : "Ⅱ"}</button><button className="icon-button" onClick={() => restartRef.current()} disabled={!started}>↻</button><button className="sound-button" onClick={() => setSound(v => !v)}><span>{sound ? "◖))" : "◖×"}</span><span className="sound-label">SOUND {sound ? "ON" : "OFF"}</span></button></div></header>
    <section className="hero"><div className="eyebrow"><span /> THE COOLEST BATTLE ON EARTH <span /></div><h1>PENGUIN <em>PONG</em></h1><p>One fish. Two penguins. No chill.</p></section>
    <section className="game-frame"><div className="corner corner-tl" /><div className="corner corner-tr" /><div className="corner corner-bl" /><div className="corner corner-br" /><PenguinPong started={started} paused={paused} sound={sound} onStart={() => { setStarted(true); setPaused(false); }} registerRestart={restart => { restartRef.current = restart; }} /></section>
    <footer><div className="control-hint"><kbd>W</kbd><kbd>S</kbd><span>TO MOVE</span></div><div className="tip">FIRST TO <strong>7</strong> WINS</div><div className="control-hint"><kbd>SPACE</kbd><span>TO PAUSE</span></div></footer>
  </main>;
}
