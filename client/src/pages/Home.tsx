import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bug, Sparkles, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// ==========================================
// --- 1. 资产路径 ---
// ==========================================
const ASSETS = {
  shadow: "/assets/flower/shadow.png",
  stem: "/assets/flower/stem.png",
  leafLeft: "/assets/flower/leaf-left.png",
  leafRight: "/assets/flower/leaf-right.png",
  petals: "/assets/flower/petals.png",
  center: "/assets/flower/center.png",
  faceSmile:      "/assets/flower/face-smile.png",
  faceLaugh:      "/assets/flower/face-laugh.png",
  faceScared:     "/assets/flower/face-scared.png",
  faceSad:        "/assets/flower/face-sad.png",
  faceRolleyes:   "/assets/flower/face-rolleyes.png",
  faceShy:        "/assets/flower/face-shy.png",
  faceUnamused:   "/assets/flower/face-unamused.png",
  faceStarstruck: "/assets/flower/face-starstruck.png",
  faceBlink:      "/assets/flower/face-blink.png",
  blush:          "/assets/flower/face-blush.png",
};

// ==========================================
// --- 2. 已验收固化的黄金参数（禁止修改）---
// ==========================================
const P = {
  shadow:   { w: 180, h: 27,  x: 0,   y: 0,   r: 0  },
  stem:     { w: 32,  h: 240, x: 0,   y: 0,   r: 0  },
  leafLeft: { w: 63,  h: 91,  x: -76, y: -15, r: 12 },
  leafRight:{ w: 54,  h: 63,  x: 0,   y: -10, r: -12},
  petals:   { w: 155, h: 148, x: -20, y: 281, r: 0  },
  center:   { w: 53,  h: 50,  x: -21, y: 281, r: 0  },
  face:     { w: 53,  h: 50,  x: -20, y: 281, r: 0  },
};

// ==========================================
// --- 3. 尺寸插值（长按时间 → scale）---
// ==========================================
const SCALE_KF = [
  { t: 1.5, s: 0.25 }, { t: 2.0, s: 0.35 }, { t: 2.5, s: 0.50 },
  { t: 3.0, s: 0.62 }, { t: 3.5, s: 0.73 }, { t: 4.0, s: 0.83 },
  { t: 4.5, s: 0.92 }, { t: 5.0, s: 1.00 },
];
function eio(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
function calcScale(sec: number): number {
  const c = Math.min(Math.max(sec, 1.5), 5.0);
  for (let i = 0; i < SCALE_KF.length - 1; i++) {
    const a = SCALE_KF[i], b = SCALE_KF[i+1];
    if (c >= a.t && c <= b.t) {
      return a.s + (b.s - a.s) * eio((c - a.t) / (b.t - a.t));
    }
  }
  return 1.0;
}

// ==========================================
// --- 4. 基础表情随机分配（按概率）---
// ==========================================
type Expression = "smile" | "laugh" | "scared" | "sad" |
                  "rolleyes" | "shy" | "unamused" | "starstruck" | "blink";
type LifeState = "born" | "alive" | "dying";

const BASE_EXPR_TABLE: { expr: Expression; weight: number }[] = [
  { expr: "smile",      weight: 40 },
  { expr: "laugh",      weight: 15 },
  { expr: "shy",        weight: 12 },
  { expr: "starstruck", weight: 10 },
  { expr: "rolleyes",   weight: 8  },
  { expr: "unamused",   weight: 8  },
  { expr: "sad",        weight: 7  },
];
function pickBaseExpr(): Expression {
  const total = BASE_EXPR_TABLE.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const { expr, weight } of BASE_EXPR_TABLE) {
    r -= weight;
    if (r <= 0) return expr;
  }
  return "smile";
}

// ==========================================
// --- 5. Web Audio 合成器 ---
// ==========================================
let _ctx: AudioContext | null = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ==========================================
// --- 虫鸣背景音（Web Audio API 交叉淡入淡出无缝循环）---
// ==========================================
let _cricketsBuffer: AudioBuffer | null = null;
let _cricketsNodes: AudioBufferSourceNode[] = [];
let _cricketsGains: GainNode[] = [];
let _cricketsLoopTimer: ReturnType<typeof setTimeout> | null = null;
let _cricketsRunning = false;
const CRICKET_VOL = 0.18;
const CRICKET_CROSSFADE = 1.5; // 交叉淡入淡出时长（秒）

async function loadCricketsBuffer() {
  if (_cricketsBuffer) return;
  try {
    const resp = await fetch("/assets/crickets.ogg");
    const arrayBuf = await resp.arrayBuffer();
    _cricketsBuffer = await getCtx().decodeAudioData(arrayBuf);
  } catch (e) { console.warn("crickets load failed", e); }
}

function scheduleCricketsLoop() {
  if (!_cricketsBuffer || !_cricketsRunning) return;
  const ctx = getCtx();
  const duration = _cricketsBuffer.duration;
  const now = ctx.currentTime;

  // 创建新的声源节点
  const src = ctx.createBufferSource();
  src.buffer = _cricketsBuffer;
  const gain = ctx.createGain();
  src.connect(gain);
  gain.connect(ctx.destination);

  // 渐入：开始 0 到 CRICKET_VOL
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(CRICKET_VOL, now + CRICKET_CROSSFADE);
  // 渐出：在结束前 CRICKET_CROSSFADE 秒开始渐出到 0
  gain.gain.setValueAtTime(CRICKET_VOL, now + duration - CRICKET_CROSSFADE);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  src.start(now);
  src.stop(now + duration);

  _cricketsNodes.push(src);
  _cricketsGains.push(gain);

  // 在渐出开始时（duration - CRICKET_CROSSFADE 秒后）启动下一个循环，实现交叉淡入淡出
  const nextStart = (duration - CRICKET_CROSSFADE) * 1000;
  _cricketsLoopTimer = setTimeout(() => {
    // 清理已结束的节点
    _cricketsNodes = _cricketsNodes.filter(n => { try { return true; } catch { return false; } });
    scheduleCricketsLoop();
  }, nextStart);
}

async function initCrickets() {
  await loadCricketsBuffer();
}

async function playCrickets() {
  await loadCricketsBuffer();
  if (_cricketsRunning) return;
  _cricketsRunning = true;
  scheduleCricketsLoop();
}

function stopCrickets() {
  _cricketsRunning = false;
  if (_cricketsLoopTimer) { clearTimeout(_cricketsLoopTimer); _cricketsLoopTimer = null; }
  const ctx = getCtx();
  const now = ctx.currentTime;
  _cricketsGains.forEach(g => {
    g.gain.cancelScheduledValues(now);
    g.gain.linearRampToValueAtTime(0, now + 0.5);
  });
  setTimeout(() => {
    _cricketsNodes.forEach(n => { try { n.stop(); } catch {} });
    _cricketsNodes = [];
    _cricketsGains = [];
  }, 600);
}

function playDuang(vol = 1.0, pitch = 1.0, delay = 0) {
  const ctx = getCtx(), now = ctx.currentTime + delay;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(90 * pitch, now + 0.35);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.28 * vol, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.7);
}

const NOTES = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
let activeVoices = 0;
function playKalimba(noteIdx: number) {
  if (activeVoices >= 6) return;
  const ctx = getCtx(), now = ctx.currentTime;
  const freq = NOTES[noteIdx % NOTES.length];
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.22, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + 1.5);
  activeVoices++;
  setTimeout(() => { activeVoices = Math.max(0, activeVoices - 1); }, 1500);
}

function playWhimper() {
  const ctx = getCtx(), now = ctx.currentTime;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.55);
}

let humOsc: OscillatorNode | null = null, humGain: GainNode | null = null;
function startHum() {
  if (humOsc) return;
  const ctx = getCtx(), now = ctx.currentTime;
  humGain = ctx.createGain(); humGain.gain.setValueAtTime(0, now);
  humGain.gain.linearRampToValueAtTime(0.055, now + 2.5);
  humOsc = ctx.createOscillator(); humOsc.type = "sine";
  humOsc.frequency.setValueAtTime(261.63, now);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.type = "sine"; lfo.frequency.setValueAtTime(0.12, now);
  lg.gain.setValueAtTime(7, now);
  lfo.connect(lg); lg.connect(humOsc.frequency); lfo.start(now);
  humOsc.connect(humGain); humGain.connect(ctx.destination); humOsc.start(now);
}
function stopHum() {
  if (!humOsc || !humGain) return;
  const ctx = getCtx(), now = ctx.currentTime;
  humGain.gain.linearRampToValueAtTime(0, now + 1.2);
  humOsc.stop(now + 1.3); humOsc = null; humGain = null;
}

// ==========================================
// --- 6. 类型定义 ---
// ==========================================
interface FlowerData {
  id: string;
  x: number; y: number;
  scale: number;
  baseExpr: Expression;   // 生成时固定的基础表情
  expression: Expression; // 当前显示的表情（风力可临时覆盖）
  lifeState: LifeState;
  bornAt: number;
  noteIdx: number;
  tilt: number;
  windFactor: number;
  dyingDir: number;
  // 呼吸动画参数（每株独立）
  breathPeriod: number;   // 呼吸周期 3000~5000ms
  breathOffset: number;   // 呼吸相位偏移 0~1（随机起始时间）
  // 花头延迟参数
  headDelay: number;      // 花头跟随延迟 0.05~0.25s
}

const EXPR_SRC: Record<Expression, string> = {
  smile:      ASSETS.faceSmile,
  laugh:      ASSETS.faceLaugh,
  scared:     ASSETS.faceScared,
  sad:        ASSETS.faceSad,
  rolleyes:   ASSETS.faceRolleyes,
  shy:        ASSETS.faceShy,
  unamused:   ASSETS.faceUnamused,
  starstruck: ASSETS.faceStarstruck,
  blink:      ASSETS.faceBlink,
};

// ==========================================
// --- 7. FlowerComponent（5层容器架构 + 呼吸 + 花杆/花头分离摇摆）---
// ==========================================
interface FlowerProps {
  flower: FlowerData;
  windAngle: number;
  autoSway: boolean;
  swayDelay: number;
  onHeadEnter: (id: string) => void;
  onHeadLeave: (id: string) => void;
}

function FlowerComponent({ flower, windAngle, autoSway, swayDelay, onHeadEnter, onHeadLeave }: FlowerProps) {
  const { id, scale, expression, lifeState, tilt, windFactor, dyingDir, breathPeriod, breathOffset, headDelay } = flower;

  const isAlive = lifeState === "alive";
  const isDying = lifeState === "dying";
  const isBorn  = lifeState === "born";

  // 眨眼：仅微笑表情时，随机间隔（3~7秒）短暂切换为 blink 帧（150ms）
  const [isBlinking, setIsBlinking] = React.useState(false);
  const blinkTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!isAlive || expression !== "smile") { setIsBlinking(false); return; }
    const schedule = () => {
      blinkTimerRef.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => { setIsBlinking(false); schedule(); }, 150);
      }, 3000 + Math.random() * 4000);
    };
    schedule();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, [isAlive, expression]);

  // 当前显示的表情：微笑时可能切换为眨眼帧
  const displayExpr = isBlinking && expression === "smile" ? "blink" : expression;

  const bornKey = `born-${id}`;

  // 呼吸感：使用 CSS animation，每株独立周期和起始偏移
  const breathAnimName = `breath-${id}`;
  const breathDuration = `${breathPeriod}ms`;
  // 通过 animation-delay 实现随机起始时间（负值 = 已经进行了一段时间）
  const breathDelay = `-${(breathOffset * breathPeriod).toFixed(0)}ms`;

  // 花杆摇摆：直接响应 windAngle（快速）
  const stemAngle = isAlive ? windAngle * windFactor + tilt : tilt;
  // 花头摇摆：同样角度但 transition 更慢（延迟跟随）
  const headAngle = stemAngle;

  // 自动慢摇 CSS animation 参数
  const swayAnimName = `sway-${id}`;
  const swayAmpDeg = (2.5 + scale * 4.5).toFixed(1); // scale 0.25→3°，scale 1.0→7°
  const swayPeriod = (3.5 + scale * 1.5).toFixed(1); // 大花周期稍长，小花稍短

  const dyingTransform = isDying
    ? `translate(-50%, -100%) rotate(${dyingDir * 10}deg) scaleY(0.92)`
    : undefined;

  return (
    <>
      {isBorn && (
        <style>{`
          @keyframes ${bornKey} {
            0%   { transform: translate(-50%,-100%) scale(0);     opacity:0; }
            55%  { transform: translate(-50%,-100%) scaleX(0.97) scaleY(1.08); opacity:1; }
            80%  { transform: translate(-50%,-100%) scaleX(1.02) scaleY(0.96); }
            92%  { transform: translate(-50%,-100%) scaleX(0.99) scaleY(1.02); }
            100% { transform: translate(-50%,-100%) scale(1);     opacity:1; }
          }
        `}</style>
      )}
      {isAlive && (
        <style>{`
          @keyframes ${breathAnimName} {
            0%,100% { transform: scale(1); }
            50%     { transform: scale(1.02); }
          }
        `}</style>
      )}
      {autoSway && isAlive && (
        <style>{`
          @keyframes ${swayAnimName} {
            0%   { transform: rotate(0deg); }
            25%  { transform: rotate(${swayAmpDeg}deg); }
            75%  { transform: rotate(-${swayAmpDeg}deg); }
            100% { transform: rotate(0deg); }
          }
        `}</style>
      )}

      {/* Layer 1: position-wrapper */}
      <div className="absolute overflow-visible pointer-events-none"
        style={{ left: flower.x, top: flower.y, width: 2, height: 2, zIndex: Math.round(flower.y + 10000) }}
      >
        {/* Layer 2: lifecycle-wrapper — 出生 & 消失 */}
        <div className="absolute overflow-visible"
          style={{
            left: 0, top: 0, width: 2, height: 2,
            transformOrigin: "bottom center",
            animation: isBorn ? `${bornKey} 0.85s cubic-bezier(0.22,1,0.36,1) forwards` : undefined,
            transform: isDying ? dyingTransform : isBorn ? undefined : "translate(-50%,-100%)",
            opacity: isDying ? 0 : 1,
            transition: isDying ? "transform 0.65s ease-in, opacity 0.65s ease-in" : undefined,
          }}
        >
          {/* Layer 3: scale-wrapper — 等比例尺寸 */}
          <div className="absolute overflow-visible"
            style={{ left: 0, top: 0, width: 2, height: 2, transformOrigin: "bottom center", transform: `scale(${scale})` }}
          >
            {/* 投影放在 Layer 3 内、Layer 4 外面，不受 autoSway 旋转影响，始终固定不动 */}
            <div style={{ position:"absolute", width:P.shadow.w, height:P.shadow.h,
              left:P.shadow.x, bottom:P.shadow.y, zIndex:0,
              transform:`translate(-50%,50%) rotate(${P.shadow.r}deg)` }}>
              <img src={ASSETS.shadow} alt="" className="w-full h-full object-contain" />
            </div>

            {/* Layer 4: breath-wrapper — 呼吸缩放 + 自动摇摆（每株独立，transform-origin: bottom center） */}
            <div className="absolute overflow-visible"
              style={{
                left: 0, top: 0, width: 2, height: 2,
                transformOrigin: "bottom center",
                // autoSway 激活时：叠加摇摆 animation（保留呼吸 animation）
                animation: isAlive
                  ? autoSway
                    ? `${breathAnimName} ${breathDuration} ease-in-out ${breathDelay} infinite, ${swayAnimName} ${swayPeriod}s ease-in-out ${swayDelay.toFixed(2)}s infinite`
                    : `${breathAnimName} ${breathDuration} ease-in-out ${breathDelay} infinite`
                  : undefined,
              }}
            >
              {/* Layer 5: calibrated-daisy-model */}
              <div className="absolute overflow-visible" style={{ left: 0, top: 0, width: 2, height: 2 }}>

                {/* 右叶 z:5 */}
                <div style={{ position:"absolute", width:P.leafRight.w, height:P.leafRight.h,
                  left:P.leafRight.x, bottom:P.leafRight.y, zIndex:5,
                  transform:`rotate(${P.leafRight.r}deg)`, transformOrigin:"bottom left" }}>
                  <img src={ASSETS.leafRight} alt="" className="w-full h-full object-contain" />
                </div>

                {/* 花杆 z:10 — 快速响应风力（花杆根部弯曲）*/}
                <div style={{ position:"absolute", width:P.stem.w, height:P.stem.h,
                  left:P.stem.x, bottom:P.stem.y, zIndex:10,
                  transformOrigin:"bottom center",
                  transform:`translate(-50%,0) rotate(${stemAngle}deg)`,
                  transition: isAlive ? "transform 0.3s ease-out" : "transform 0.6s ease-out",
                }}>
                  <img src={ASSETS.stem} alt="" className="w-full h-full object-fill" />
                </div>

                {/* 左叶 z:20 */}
                <div style={{ position:"absolute", width:P.leafLeft.w, height:P.leafLeft.h,
                  left:P.leafLeft.x, bottom:P.leafLeft.y, zIndex:20,
                  transform:`rotate(${P.leafLeft.r}deg)`, transformOrigin:"bottom right" }}>
                  <img src={ASSETS.leafLeft} alt="" className="w-full h-full object-contain" />
                </div>

                {/* 花头组 z:25 — 跟随花杆顶端移动 + 惯性延迟 */}
                <div className="absolute overflow-visible pointer-events-auto"
                  style={{
                    width:P.petals.w, height:P.petals.h,
                    left:P.petals.x, bottom:P.petals.y,
                    zIndex: 25,
                    transformOrigin: "50% 100%",
                    // 花头跟随花杆顶端：
                    // 1. translate(-50%, 50%) 是原始居中定位
                    // 2. translateX/Y 计算花杆旋转后顶端的实际偏移量，让花头跟随顶端
                    // 3. 花头再叠加轻微惯性旋转（比花杆慢）
                    transform: `translate(-50%, 50%) translateX(${Math.sin(stemAngle * Math.PI / 180) * P.stem.h}px) translateY(${-(P.stem.h - P.stem.h * Math.cos(stemAngle * Math.PI / 180))}px) rotate(${headAngle * 0.15}deg)`,
                    // 花头 transition 比花杆慢，实现延迟跟随感
                    transition: isAlive
                      ? `transform ${(0.3 + headDelay).toFixed(2)}s ease-out`
                      : "transform 0.7s ease-out",
                    cursor:"pointer",
                  }}
                  onMouseEnter={() => onHeadEnter(id)}
                  onMouseLeave={() => onHeadLeave(id)}
                >
                  {/* 花瓣 z:30 */}
                  <div style={{ position:"absolute", inset:0, zIndex:30 }}>
                    <img src={ASSETS.petals} alt="" className="w-full h-full object-contain" />
                  </div>
                  {/* 花心 z:40 */}
                  <div style={{ position:"absolute", width:P.center.w, height:P.center.h,
                    left:"50%", top:"50%", transform:"translate(-50%,-50%)", zIndex:40 }}>
                    <img src={ASSETS.center} alt="" className="w-full h-full object-contain" />
                  </div>
                  {/* 腮红叠加层 z:49（所有表情都显示） */}
                  {isAlive && (
                    <div style={{ position:"absolute", width:P.face.w, height:P.face.h,
                      left:"50%", top:"50%", transform:"translate(-50%,-50%)", zIndex:49 }}>
                      <img src={ASSETS.blush} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                  {/* 表情 z:50 */}
                  <div style={{ position:"absolute", width:P.face.w, height:P.face.h,
                    left:"50%", top:"50%", transform:"translate(-50%,-50%)", zIndex:50 }}>
                    <img src={EXPR_SRC[displayExpr]} alt="" className="w-full h-full object-contain" />
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==========================================
// --- 8. 消失光晕组件 ---
// ==========================================
function GlowEffect({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute pointer-events-none" style={{
      left: x, top: y, transform: "translate(-50%, -50%)",
      width: 60, height: 60, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(255,240,180,0.9) 0%, transparent 70%)",
      animation: "glowFade 0.35s ease-out forwards",
      zIndex: 99990,
    }} />
  );
}

// ==========================================
// --- 9. 主页面 ---
// ==========================================
const MAX_FLOWERS = 50;

export default function Home() {
  const [flowers, setFlowers] = useState<FlowerData[]>([]);
  const [glows, setGlows] = useState<{ id: string; x: number; y: number }[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);

  const [pressing, setPressing] = useState(false);
  const [pressX, setPressX] = useState(0);
  const [pressY, setPressY] = useState(0);
  const [holdSec, setHoldSec] = useState(0);
  const pressStartRef = useRef(0);
  const pressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 风力状态
  const [windAngle, setWindAngle] = useState(0);
  const [windLevel, setWindLevel] = useState(0);
  const windTargetRef = useRef(0);
  const windLevelRef = useRef(0);
  const lastMouseRef = useRef({ x: 0, y: 0, t: 0 });
  const windDecayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exprTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windRafRef = useRef<number>(0);

  // 静置3秒自动慢摇状态
  const [autoSway, setAutoSway] = useState(false);
  const autoSwayRef = useRef(false);
  const autoSwayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isHumming, setIsHumming] = useState(false);
  const [idleRemain, setIdleRemain] = useState(15);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCountRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHummingRef = useRef(false);

  const headCoolRef = useRef<Map<string, number>>(new Map());
  const [dbg, setDbg] = useState({ holdSec: 0, nextScale: 0, speed: 0, windLv: 0, count: 0, note: "" });

  useEffect(() => {
    Object.values(ASSETS).forEach(url => { const i = new Image(); i.src = url; });
    const style = document.createElement("style");
    style.textContent = `@keyframes glowFade { 0%{transform:translate(-50%,-50%) scale(0.5);opacity:1} 100%{transform:translate(-50%,-50%) scale(2.5);opacity:0} }`;
    document.head.appendChild(style);
    // 预加载虫鸣音频
    initCrickets();
    // 用户首次交互后自动解锁并播放
    const unlock = () => { playCrickets(); document.removeEventListener("pointerdown", unlock); };
    document.addEventListener("pointerdown", unlock);
    resetIdle();
    return () => {
      clearIdle();
      stopCrickets();
      document.removeEventListener("pointerdown", unlock);
    };
  }, []);

  function clearIdle() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleCountRef.current) clearInterval(idleCountRef.current);
  }
  const resetIdle = useCallback(() => {
    clearIdle();
    if (isHummingRef.current) { isHummingRef.current = false; setIsHumming(false); /* stopHum(); */ }
    let r = 15; setIdleRemain(15);
    idleCountRef.current = setInterval(() => { r -= 1; setIdleRemain(r); if (r <= 0 && idleCountRef.current) clearInterval(idleCountRef.current); }, 1000);
    idleTimerRef.current = setTimeout(() => {
      // isHummingRef.current = true; setIsHumming(true); startHum(); // 已禁用15秒哼唱
    }, 15000);
  }, []);

  // 风力 RAF 平滑更新
  useEffect(() => {
    const tick = () => {
      setWindAngle(prev => {
        const diff = windTargetRef.current - prev;
        return Math.abs(diff) < 0.01 ? windTargetRef.current : prev + diff * 0.12;
      });
      windRafRef.current = requestAnimationFrame(tick);
    };
    windRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(windRafRef.current);
  }, []);

  // 鼠标移动 → 风力（更新摇摆幅度：无风1°/小风4°/中风9°/大风16°）
  // 鼠标移动时解除自动摇摆，并重新启动3秒计时
  const resetAutoSway = useCallback(() => {
    if (autoSwayRef.current) { autoSwayRef.current = false; setAutoSway(false); }
    if (autoSwayTimerRef.current) clearTimeout(autoSwayTimerRef.current);
    autoSwayTimerRef.current = setTimeout(() => {
      autoSwayRef.current = true;
      setAutoSway(true);
    }, 3000);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    resetAutoSway();
    const now = performance.now();
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    const dt = now - lastMouseRef.current.t;
    if (dt > 0 && dt < 200) {
      const speed = Math.sqrt(dx*dx + dy*dy) / dt * 1000;
      const dir = dx >= 0 ? 1 : -1;
      let lv = 0, ang = 0;
      // 无风待机：1°～3°；小风：3°～6°；中风：7°～12°；大风：13°～20°
      if (speed < 150)       { lv = 0; ang = dir * 2; }   // 无风中间值
      else if (speed < 500)  { lv = 1; ang = dir * 5; }   // 小风中间值
      else if (speed < 1000) { lv = 2; ang = dir * 9; }   // 中风中间值
      else                   { lv = 3; ang = dir * 16; }  // 大风中间值
      windTargetRef.current = ang;
      windLevelRef.current = lv;
      setWindLevel(lv);
      setDbg(d => ({ ...d, speed: Math.round(speed), windLv: lv }));

      if (exprTimerRef.current) clearTimeout(exprTimerRef.current);
      exprTimerRef.current = setTimeout(() => {
        windLevelRef.current = lv;
        // 风力临时覆盖表情：小风保持基础表情，中风→开心大笑，大风→害怕
        setFlowers(prev => prev.map(f => {
          if (f.lifeState !== "alive") return f;
          let expr: Expression;
          if (lv <= 1) expr = f.baseExpr;       // 小风/无风：恢复基础表情
          else if (lv === 2) expr = "laugh";     // 中风：开心大笑
          else expr = "scared";                  // 大风：害怕
          return { ...f, expression: expr };
        }));
      }, 120);

      if (windDecayRef.current) clearTimeout(windDecayRef.current);
      windDecayRef.current = setTimeout(() => {
        windTargetRef.current = 0;
        windLevelRef.current = 0;
        setWindLevel(0);
        // 风停后恢复各自基础表情
        setFlowers(prev => prev.map(f =>
          f.lifeState === "alive" ? { ...f, expression: f.baseExpr } : f
        ));
      }, 300);
    }
    lastMouseRef.current = { x: e.clientX, y: e.clientY, t: now };
    resetIdle();
  }, [resetIdle]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const tgt = e.target as HTMLElement;
    if (tgt.closest("button") || tgt.closest("a") || tgt.closest(".ui-zone")) return;
    resetAutoSway(); // 点击时解除自动摇摆
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setPressing(true);
    setPressX(e.clientX - rect.left);
    setPressY(e.clientY - rect.top);
    pressStartRef.current = performance.now();
    setHoldSec(0);
    pressTimerRef.current = setInterval(() => {
      const s = Math.min((performance.now() - pressStartRef.current) / 1000, 5);
      setHoldSec(s);
      setDbg(d => ({ ...d, holdSec: parseFloat(s.toFixed(2)), nextScale: s >= 1.5 ? parseFloat(calcScale(s).toFixed(3)) : 0 }));
    }, 50);
    resetIdle();
  }, [resetIdle]);

  const spawnFlower = useCallback((cx: number, cy: number, elapsed: number) => {
    if (elapsed < 1.5) return;
    const base = calcScale(elapsed);
    const finalScale = Math.min(1.0, Math.max(0.23, base * (1 + (Math.random()-0.5)*0.1)));
    const tilt = (Math.random()-0.5) * 6;
    const windFactor = 0.9 + Math.random() * 0.2;
    const dyingDir = Math.random() < 0.5 ? 1 : -1;
    const baseExpr = pickBaseExpr();
    const breathPeriod = 3000 + Math.random() * 2000;  // 3000~5000ms
    const breathOffset = Math.random();                  // 0~1 随机相位
    const headDelay = 0.05 + Math.random() * 0.2;       // 0.05~0.25s

    const newF: FlowerData = {
      id: `f${Date.now()}${Math.random().toString(36).slice(2,6)}`,
      x: cx, y: cy, scale: finalScale,
      baseExpr, expression: baseExpr,
      lifeState: "born", bornAt: Date.now(),
      noteIdx: Math.floor(Math.random() * NOTES.length),
      tilt, windFactor, dyingDir,
      breathPeriod, breathOffset, headDelay,
    };

    const pf = 0.8 + finalScale * 0.4;
    playDuang(1.0, pf, 0.3);
    playDuang(0.6, pf*1.1, 0.52);
    playDuang(0.3, pf*1.2, 0.74);

    setFlowers(prev => {
      let arr = [...prev, newF];
      const alive = arr.filter(f => f.lifeState !== "dying");
      if (alive.length > MAX_FLOWERS) {
        const oldest = alive[0];
        arr = arr.map(f => f.id === oldest.id ? { ...f, lifeState: "dying" as LifeState, expression: "sad" } : f);
        playWhimper();
        setTimeout(() => {
          setFlowers(p => p.map(f => f.id === oldest.id ? { ...f } : f));
        }, 400);
        setTimeout(() => {
          setGlows(g => [...g, { id: `glow-${oldest.id}`, x: oldest.x, y: oldest.y }]);
          setTimeout(() => setGlows(g => g.filter(gl => gl.id !== `glow-${oldest.id}`)), 400);
        }, 1900);
        setTimeout(() => {
          setFlowers(p => p.filter(f => f.id !== oldest.id));
        }, 2300);
      }
      return arr;
    });

    setTimeout(() => {
      setFlowers(p => p.map(f => f.id === newF.id && f.lifeState === "born" ? { ...f, lifeState: "alive" } : f));
    }, 900);

    setDbg(d => ({ ...d, count: d.count + 1 }));
    resetIdle();
  }, [resetIdle]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pressing) return;
    setPressing(false);
    if (pressTimerRef.current) clearInterval(pressTimerRef.current);
    const elapsed = (performance.now() - pressStartRef.current) / 1000;
    spawnFlower(pressX, pressY, elapsed);
    setHoldSec(0);
  }, [pressing, pressX, pressY, spawnFlower]);

  const handlePointerLeave = useCallback(() => {
    if (pressing) {
      setPressing(false);
      if (pressTimerRef.current) clearInterval(pressTimerRef.current);
      setHoldSec(0);
    }
  }, [pressing]);

  const handleHeadEnter = useCallback((id: string) => {
    const now = performance.now();
    const last = headCoolRef.current.get(id) ?? 0;
    if (now - last < 180) return;
    headCoolRef.current.set(id, now);
    const f = flowers.find(fl => fl.id === id);
    if (!f || f.lifeState !== "alive") return;
    playKalimba(f.noteIdx);
    setDbg(d => ({ ...d, note: NOTES[f.noteIdx % NOTES.length].toFixed(0) + "Hz" }));
    resetIdle();
  }, [flowers, resetIdle]);

  const handleHeadLeave = useCallback((_id: string) => {}, []);

  useEffect(() => {
    const alive = flowers.filter(f => f.lifeState !== "dying").length;
    setDbg(d => ({ ...d, count: alive }));
  }, [flowers]);

  const chargeP = Math.min(holdSec / 5, 1);
  const isCharged = holdSec >= 1.5;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-[#b2d2b1] to-[#92b991] select-none font-sans text-slate-800">

<header className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-[99999] pointer-events-none ui-zone">
  <div className="flex items-center gap-3 pointer-events-auto">
    <div className="w-9 h-9 rounded-xl bg-white/40 border border-white/50 flex items-center justify-center backdrop-blur-md shadow-sm">
      <img
        src="/assets/flower-logo.png"
        className="w-8 h-8 object-contain"
        alt="花朵图标"
      />
    </div>
    <div>
      <h1 className="text-xs font-black tracking-wider uppercase text-emerald-900">SOLOMAN</h1>
      <p className="text-[9px] text-emerald-800 tracking-widest uppercase">慢小花互动花园</p>
    </div>
  </div>
  <div className="flex gap-2 pointer-events-auto">
    <Button variant="outline" size="sm"
      className="h-8 rounded-xl bg-white/40 border-white/50 text-slate-700 hover:bg-white/60 backdrop-blur-md flex items-center gap-1.5 shadow-sm text-xs"
      onClick={() => { setFlowers([]); resetIdle(); }}>
      <RotateCcw className="w-3.5 h-3.5" /> 清除
    </Button>
    <Button variant="outline" size="sm"
      className="h-8 rounded-xl bg-white/40 border-white/50 text-slate-700 hover:bg-white/60 backdrop-blur-md flex items-center gap-1.5 shadow-sm text-xs"
      onClick={() => setDebugOpen(v => !v)}>
      <Bug className="w-3.5 h-3.5" /> 调试
      {debugOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </Button>
  </div>
</header>

      <div className="absolute inset-0 w-full h-full z-10"
        style={{ cursor: pressing ? "crosshair" : "pointer" }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onMouseMove={handleMouseMove}
      >
        {flowers.map((f) => {
          // swayDelay: 基于 x 坐标归一化到 0~1.5 秒，实现从左到右有序错开
          const allX = flowers.map(fl => fl.x);
          const minX = Math.min(...allX), maxX = Math.max(...allX);
          const xRange = maxX - minX || 1;
          const swayDelay = ((f.x - minX) / xRange) * 1.5;
          return (
          <FlowerComponent key={f.id} flower={f} windAngle={windAngle}
            autoSway={autoSway} swayDelay={swayDelay}
            onHeadEnter={handleHeadEnter} onHeadLeave={handleHeadLeave} />
          );
        })}
        {glows.map(g => <GlowEffect key={g.id} x={g.x} y={g.y} />)}
      </div>

      {pressing && (
        <div className="absolute pointer-events-none z-[99998]"
          style={{
            left: pressX, top: pressY,
            transform: "translate(-50%, -50%)",
            width: 36 + chargeP * 64, height: 36 + chargeP * 64,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,255,180,${isCharged ? 0.5 : 0.2}) 0%, transparent 70%)`,
            boxShadow: isCharged ? `0 0 ${18 + chargeP * 28}px rgba(255,215,80,${0.25 + chargeP * 0.3})` : undefined,
            transition: "all 0.1s ease-out",
          }} />
      )}

      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-[99999] pointer-events-none">
        <div className="px-5 py-2.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-md shadow-inner text-[11px] text-emerald-900 font-bold tracking-wider">
          {pressing
            ? holdSec < 1.5
              ? `🌱 继续按住… ${(1.5 - holdSec).toFixed(1)}s`
              : `🌸 松开左键即可种花！scale: ${calcScale(holdSec).toFixed(2)}`
            : isHumming
              ? "🎵 花丛正在轻声哼唱…移动鼠标唤醒"
              : "🌸 长按鼠标左键 1.5 秒以上，等待一朵慢小花长大"}
        </div>
      </div>

      {debugOpen && (
        <div className="absolute bottom-20 right-5 w-64 p-4 rounded-2xl bg-white/85 border border-white/60 backdrop-blur-xl z-[99999] text-[10px] text-slate-700 shadow-2xl ui-zone">
          <div className="font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1.5">🐛 调试面板</div>
          <div className="grid grid-cols-2 gap-y-1 gap-x-3">
            <span className="text-slate-500">长按时间</span><span className="font-bold">{dbg.holdSec}s</span>
            <span className="text-slate-500">即将 scale</span><span className="font-bold">{dbg.nextScale || "—"}</span>
            <span className="text-slate-500">鼠标速度</span><span className="font-bold">{dbg.speed} px/s</span>
            <span className="text-slate-500">风力等级</span><span className="font-bold">{["静止","小风","中风","大风"][dbg.windLv]}</span>
            <span className="text-slate-500">存活花朵</span><span className="font-bold">{dbg.count} / {MAX_FLOWERS}</span>
            <span className="text-slate-500">花头音符</span><span className="font-bold">{dbg.note || "—"}</span>
            <span className="text-slate-500">无操作倒计时</span><span className="font-bold">{idleRemain}s</span>
            <span className="text-slate-500">集体哼唱</span><span className="font-bold">{isHumming ? "🎵 播放中" : "关闭"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
