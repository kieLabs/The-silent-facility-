'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createGame } from './game/engine.js';

const INITIAL_HUD = {
  chapter: 'THE DROWNED YARD',
  objective: 'Move the crate onto the pressure plate.',
  progress: 0,
  deaths: 0,
  hint: 'A quiet place. Keep moving.',
  plateActive: false,
  powerOn: false,
};

export default function Home() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const shellRef = useRef(null);
  const [screen, setScreen] = useState('intro');
  const [hud, setHud] = useState(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [finishStats, setFinishStats] = useState({ deaths: 0, time: 0 });
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setMobile(query.matches || window.innerWidth < 900);
    sync();
    query.addEventListener?.('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      query.removeEventListener?.('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = createGame(canvasRef.current, {
      onHud: setHud,
      onChapter: (chapter) => setHud((current) => ({ ...current, chapter })),
      onObjective: (objective) => setHud((current) => ({ ...current, objective })),
      onCheckpoint: () => setHud((current) => ({ ...current, hint: 'Checkpoint reached. You are safe here.' })),
      onDeath: (deaths) => setHud((current) => ({ ...current, deaths })),
      onFinish: (stats) => {
        setFinishStats(stats);
        setScreen('complete');
      },
      onPauseRequest: () => setScreen((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current),
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!gameRef.current) return;
    if (screen === 'playing') gameRef.current.resume();
    else gameRef.current.pause();
  }, [screen]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const startGame = useCallback(() => {
    setHud(INITIAL_HUD);
    setScreen('playing');
    gameRef.current?.start();
  }, []);

  const restartGame = useCallback(() => {
    setHud(INITIAL_HUD);
    setScreen('playing');
    gameRef.current?.restart();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const target = shellRef.current;
    if (!target) return;
    try {
      if (!document.fullscreenElement) await target.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch {
      setHud((current) => ({ ...current, hint: 'Fullscreen is not available in this browser.' }));
    }
  }, []);

  const toggleMute = () => {
    setMuted((value) => {
      gameRef.current?.setMuted(!value);
      return !value;
    });
  };

  const pressControl = (name, active) => (event) => {
    event.preventDefault();
    gameRef.current?.setInput(name, active);
  };

  return (
    <main className="app-shell" ref={shellRef}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">N</div>
          <div className="brand-copy">
            <span className="brand-name">NOCTURNE</span>
            <span className="brand-edition">A GAMERKIE ORIGINAL</span>
          </div>
        </div>
        <div className="topbar-right">
          <div className="chapter-mini"><span className="live-dot" /> {hud.chapter}</div>
          <button className="icon-button" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Mute sound'} title={muted ? 'Sound on' : 'Mute'}>
            {muted ? <SoundOffIcon /> : <SoundIcon />}
          </button>
          <button className="icon-button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
          </button>
          <button className="icon-button" onClick={() => setScreen((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)} aria-label="Pause game" title="Pause / resume">
            <PauseIcon />
          </button>
        </div>
      </header>

      <section className="game-area">
        <div className="game-frame" id="nocturne-game-frame">
          <canvas ref={canvasRef} className="game-canvas" aria-label="NOCTURNE puzzle platform game" />

          <div className="hud-top">
            <div className="hud-objective">
              <span className="hud-kicker">CURRENT OBJECTIVE</span>
              <span className="objective-text">{hud.objective}</span>
            </div>
            <div className="hud-progress">
              <div className="progress-label"><span>DESCENT</span><span>{hud.progress}%</span></div>
              <div className="progress-track"><span style={{ width: `${hud.progress}%` }} /></div>
            </div>
          </div>

          {hud.hint && screen === 'playing' && (
            <div className="hint-toast" aria-live="polite"><span className="hint-icon">✦</span>{hud.hint}</div>
          )}

          <div className="hud-bottom-left">
            <span className="status-pill"><i className={hud.plateActive ? 'status-led on' : 'status-led'} /> PLATE {hud.plateActive ? 'ACTIVE' : 'OFF'}</span>
            <span className="status-pill"><i className={hud.powerOn ? 'status-led on' : 'status-led'} /> POWER {hud.powerOn ? 'ON' : 'OFF'}</span>
          </div>
          <div className="hud-bottom-right">NOCTURNE <span>·</span> {String(hud.deaths).padStart(2, '0')} FALLS</div>

          {mobile && screen === 'playing' && (
            <div className="touch-controls" aria-label="Touch game controls">
              <div className="touch-move">
                <button className="touch-key" aria-label="Move left" onPointerDown={pressControl('left', true)} onPointerUp={pressControl('left', false)} onPointerCancel={pressControl('left', false)} onPointerLeave={pressControl('left', false)}>‹</button>
                <button className="touch-key" aria-label="Move right" onPointerDown={pressControl('right', true)} onPointerUp={pressControl('right', false)} onPointerCancel={pressControl('right', false)} onPointerLeave={pressControl('right', false)}>›</button>
              </div>
              <div className="touch-actions">
                <button className="touch-key small" aria-label="Crouch" onPointerDown={pressControl('crouch', true)} onPointerUp={pressControl('crouch', false)} onPointerCancel={pressControl('crouch', false)} onPointerLeave={pressControl('crouch', false)}>↓</button>
                <button className="touch-key action" aria-label="Interact" onPointerDown={pressControl('interact', true)} onPointerUp={pressControl('interact', false)} onPointerCancel={pressControl('interact', false)} onPointerLeave={pressControl('interact', false)}>E</button>
                <button className="touch-key jump" aria-label="Jump" onPointerDown={pressControl('jump', true)} onPointerUp={pressControl('jump', false)} onPointerCancel={pressControl('jump', false)} onPointerLeave={pressControl('jump', false)}>↑</button>
              </div>
            </div>
          )}

          {screen === 'intro' && (
            <div className="screen-overlay intro-screen">
              <div className="intro-content">
                <div className="eyebrow"><span /> A CINEMATIC PUZZLE PLATFORMER</div>
                <h1>NOCTURNE</h1>
                <p className="subtitle">THE SILENT FACILITY</p>
                <p className="intro-copy">An abandoned complex. A light that never stops searching. Find the way out.</p>
                <button className="primary-button" onClick={startGame}>BEGIN DESCENT <span>→</span></button>
                <div className="intro-foot">HEADPHONES RECOMMENDED <span>·</span> AUTO-SAVED CHECKPOINTS</div>
              </div>
              <div className="intro-side-note">CHAPTER 01 <span>—</span> THE DROWNED YARD</div>
            </div>
          )}

          {screen === 'paused' && (
            <div className="screen-overlay modal-screen">
              <div className="modal-card">
                <span className="eyebrow"><span /> GAME PAUSED</span>
                <h2>Take a breath.</h2>
                <p>The facility is still waiting.</p>
                <button className="primary-button" onClick={() => setScreen('playing')}>RESUME <span>→</span></button>
                <button className="text-button" onClick={restartGame}>RESTART FROM CHECKPOINT</button>
              </div>
            </div>
          )}

          {screen === 'complete' && (
            <div className="screen-overlay modal-screen">
              <div className="modal-card complete-card">
                <span className="eyebrow"><span /> FACILITY BREACHED</span>
                <h2>You made it out.</h2>
                <p>The silence is behind you. For now.</p>
                <div className="finish-stats">
                  <div><strong>{finishStats.deaths}</strong><span>FALLS</span></div>
                  <div><strong>{Math.floor(finishStats.time / 60)}:{String(finishStats.time % 60).padStart(2, '0')}</strong><span>TIME</span></div>
                </div>
                <button className="primary-button" onClick={restartGame}>PLAY AGAIN <span>↻</span></button>
              </div>
            </div>
          )}

          {mobile && screen === 'playing' && (
            <div className="rotate-message"><span>↻</span><b>ROTATE YOUR DEVICE</b><small>NOCTURNE is designed for landscape play.</small></div>
          )}
        </div>

        <div className="below-game">
          <div className="control-legend">
            <span><kbd>A</kbd><kbd>D</kbd> MOVE</span>
            <span><kbd>SPACE</kbd> JUMP</span>
            <span><kbd>S</kbd> CROUCH</span>
            <span><kbd>E</kbd> INTERACT</span>
            <span><kbd>R</kbd> CHECKPOINT</span>
          </div>
          <div className="chapter-caption">A WORLD WITHOUT ANSWERS <span>—</span> FIND YOUR OWN WAY</div>
        </div>
      </section>
      <footer className="page-footer"><span>© 2026 GAMERKIE</span><span>NOCTURNE · THE SILENT FACILITY</span><span>BUILT FOR THE WEB</span></footer>
    </main>
  );
}

function SoundIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a9 9 0 0 1 0 11" /></svg>;
}
function SoundOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="m17 9 5 6m0-6-5 6" /></svg>;
}
function ExpandIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5m13-5v5h-5" /></svg>;
}
function CompressIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5" /></svg>;
}
function PauseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>;
}
