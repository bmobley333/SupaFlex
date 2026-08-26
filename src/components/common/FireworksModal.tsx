// src/components/common/FireworksModal.tsx
// 2D Fireworks Simulation with Web Audio API Sound Synthesizer & 3x Barrage Density

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Rocket, X } from 'lucide-react';

interface FireworksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#38bdf8', // Cyan
  '#fbbf24', // Amber gold
  '#34d399', // Emerald
  '#f43f5e', // Ruby Rose
  '#c084fc', // Violet
  '#38ef7d', // Neon Green
  '#ff7675', // Bright Coral
  '#f59e0b', // Electric Amber
  '#ec4899', // Arcane Pink
];

interface RocketItem {
  x: number;
  y: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
}

interface ParticleItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
  gravity: number;
  friction: number;
  hasCrackle: boolean;
}

export const FireworksModal: React.FC<FireworksModalProps> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  soundEnabledRef.current = isSoundEnabled;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const animIdRef = useRef<number | null>(null);

  const rocketsRef = useRef<RocketItem[]>([]);
  const particlesRef = useRef<ParticleItem[]>([]);

  // Initialize Web Audio API Synthesizer
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Synthesized Rocket Launch Whistle with Stereo Panning
  const playLaunchSound = useCallback((xRatio: number) => {
    if (!soundEnabledRef.current || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.45);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      if (panner) {
        panner.pan.setValueAtTime((xRatio - 0.5) * 1.6, now);
        osc.connect(panner);
        panner.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (_) {}
  }, []);

  // Synthesized Explosion Boom & Crackle Noise Burst
  const playExplosionSound = useCallback((xRatio: number, power: number = 1) => {
    if (!soundEnabledRef.current || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime((xRatio - 0.5) * 1.5, now);
        panner.connect(ctx.destination);
      }
      const outputNode = panner || ctx.destination;

      // 1. Sub-bass Resonant Boom
      const boomOsc = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boomOsc.type = 'triangle';
      boomOsc.frequency.setValueAtTime(130, now);
      boomOsc.frequency.exponentialRampToValueAtTime(28, now + 0.55);

      boomGain.gain.setValueAtTime(0.28 * power, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      boomOsc.connect(boomGain);
      boomGain.connect(outputNode);
      boomOsc.start(now);
      boomOsc.stop(now + 0.6);

      // 2. White-Noise Filtered Crackle Burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.45);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.22 * power, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(outputNode);

      noise.start(now);
      noise.stop(now + 0.45);
    } catch (_) {}
  }, []);

  const createRocket = useCallback(
    (startX?: number, targetX?: number, targetY?: number) => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;

      const x = startX !== undefined ? startX : Math.random() * (w * 0.85) + w * 0.075;
      const tY = targetY !== undefined ? targetY : Math.random() * (h * 0.45) + h * 0.12;
      const tX = targetX !== undefined ? targetX : x + (Math.random() - 0.5) * 140;

      const vy = -(Math.sqrt(2 * 0.2 * (h - tY)) * 0.78 + Math.random() * 2);
      const vx = (tX - x) / (Math.abs(vy) * 2.2);

      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      rocketsRef.current.push({
        x,
        y: h,
        targetY: tY,
        vx,
        vy,
        color,
        trail: [],
      });

      playLaunchSound(x / w);
    },
    [playLaunchSound]
  );

  const explode = useCallback(
    (x: number, y: number, color: string) => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.width;
      const count = 110 + Math.floor(Math.random() * 50);

      playExplosionSound(x / w, 1.25);

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7.0 + 1.2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        particlesRef.current.push({
          x,
          y,
          vx,
          vy,
          color,
          alpha: 1,
          decay: Math.random() * 0.015 + 0.011,
          size: Math.random() * 2.8 + 1.5,
          gravity: 0.065,
          friction: 0.965,
          hasCrackle: Math.random() > 0.55,
        });
      }
    },
    [playExplosionSound]
  );

  // Launch 3x Denser Barrage (15 rockets)
  const launchMultipleRockets = useCallback(
    (count: number = 15) => {
      initAudio();
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (canvasRef.current) {
            createRocket();
          }
        }, i * 140);
      }
    },
    [createRocket, initAudio]
  );

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    initAudio();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    explode(x, y, color);
  };

  const resizeCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.width = window.innerWidth;
    canvasRef.current.height = window.innerHeight;
  }, []);

  const animate = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Update & Render Rockets
    for (let i = rocketsRef.current.length - 1; i >= 0; i--) {
      const r = rocketsRef.current[i];
      r.trail.push({ x: r.x, y: r.y, alpha: 1 });
      if (r.trail.length > 9) r.trail.shift();

      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.08;

      for (let t = 0; t < r.trail.length; t++) {
        const pt = r.trail[t];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = r.color;
        ctx.globalAlpha = (t / r.trail.length) * 0.75;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      if (r.y <= r.targetY || r.vy >= -0.5) {
        explode(r.x, r.y, r.color);
        rocketsRef.current.splice(i, 1);
      }
    }

    // Update & Render Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = 7;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    animIdRef.current = requestAnimationFrame(animate);
  }, [explode]);

  useEffect(() => {
    if (!isOpen) {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      return;
    }

    initAudio();
    resizeCanvas();
    rocketsRef.current = [];
    particlesRef.current = [];

    // Trigger initial 3x fireworks wave on open
    launchMultipleRockets(15);
    animIdRef.current = requestAnimationFrame(animate);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [isOpen, initAudio, resizeCanvas, launchMultipleRockets, animate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/95 flex flex-col items-center justify-between overflow-hidden select-none animate-fadeIn cursor-crosshair">
      {/* Fullscreen HTML5 2D Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        aria-label="Interactive 2D Fireworks Simulation Canvas"
        role="img"
        className="absolute inset-0 w-full h-full block"
      />

      {/* Glassmorphic Header & Control Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 mt-4 px-5 py-3 w-[94%] max-w-4xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4 cursor-default"
      >
        {/* Brand & Instructions */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xl flex items-center justify-center shadow-md">
            🎆
          </div>
          <div>
            <h3 className="font-outfit font-extrabold text-base tracking-wide bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
              2D Fireworks Simulation
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Click anywhere on screen to detonate custom bursts
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Launch Wave Button */}
          <button
            type="button"
            onClick={() => launchMultipleRockets(15)}
            className="px-4 py-2 rounded-xl text-xs font-outfit font-extrabold bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-md shadow-amber-500/30 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Rocket className="w-4 h-4 text-slate-950" />
            <span>Launch Wave (15x)</span>
          </button>

          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={() => {
              initAudio();
              setIsSoundEnabled(!isSoundEnabled);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-outfit font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isSoundEnabled
                ? 'bg-sky-950/80 border-sky-500/60 text-sky-300 shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4" />}
            <span>{isSoundEnabled ? 'Sound: ON' : 'Muted'}</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-outfit font-extrabold bg-slate-800 hover:bg-rose-900/80 border border-slate-700 hover:border-rose-500 text-slate-200 hover:text-white transition-all shadow-sm cursor-pointer flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            <span>Close (Esc)</span>
          </button>
        </div>
      </div>

      {/* Bottom Hint Footer Pill */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 mb-4 px-4 py-1.5 bg-slate-900/80 border border-slate-700/60 backdrop-blur-md rounded-full shadow-lg text-[11px] font-mono text-slate-300 flex items-center gap-2 pointer-events-none"
      >
        <span>⚡</span>
        <span>
          <strong>Interactive FX:</strong> HTML5 2D Particle Engine with Web Audio API Synthesizer (3× Barrage)
        </span>
      </div>
    </div>
  );
};
