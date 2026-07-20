import React, { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Video, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// ==========================================
// --- 1. 100% 锁死已验收的黄金参数 (绝对禁止修改) ---
// ==========================================
const ASSETS = {
  shadow: "/assets/flower/shadow.png",
  stem: "/assets/flower/stem.png",
  leafLeft: "/assets/flower/leaf-left.png",
  leafRight: "/assets/flower/leaf-right.png",
  petals: "/assets/flower/petals.png",
  center: "/assets/flower/center.png",
  faceSmile: "/assets/flower/face-smile.png",
};

const LOCKED_PARAMS = {
  shadow: { w: 180, h: 27, x: 0, y: 0, r: 0 },
  stem: { w: 32, h: 240, x: 0, y: 0, r: 0 },
  leafLeft: { w: 63, h: 91, x: -76, y: -15, r: 12 },
  leafRight: { w: 54, h: 63, x: 0, y: -10, r: -12 },
  petals: { w: 155, h: 148, x: -20, y: 281, r: 0 },
  center: { w: 53, h: 50, x: -21, y: 281, r: 0 },
  face: { w: 53, h: 50, x: -20, y: 281, r: 0 }
};

// ==========================================
// --- 2. 独立 Demo 页面组件 ---
// ==========================================
export default function AnimationDemo() {
  const [playTrigger, setPlayTrigger] = useState(0); // 触发重播
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // 100% 锁死缩放为 1.0x
  const scale = 1.0;
  const flowerHeight = 900 * 0.42 * scale; // 整个 FlowerComponent 高度

  // 一键重播动画
  const handleReplay = () => {
    setPlayTrigger(prev => prev + 1);
  };

  // --- 3. 内置 WebRTC 屏幕录制器 (自动录制 5 秒 Demo 视频) ---
  const handleStartRecord = async () => {
    if (!containerRef.current) return;
    try {
      setIsRecording(true);
      setVideoUrl(null);
      recordedChunksRef.current = [];

      // 捕获页面 Canvas/Screen 流 (沙箱内免授权捕获 viewport)
      // @ts-ignore
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: false
      });

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop()); // 停止捕获
      };

      // 先播放动画，然后开始录制
      handleReplay();
      recorder.start();

      // 录制 5 秒后自动停止
      setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }, 5000);

    } catch (err) {
      console.error("Screen record failed:", err);
      setIsRecording(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-[#b2d2b1] to-[#92b991] flex flex-col items-center justify-center select-none font-sans text-slate-800"
    >
      {/* 顶栏控制面板 */}
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/40 border border-white/50 flex items-center justify-center backdrop-blur-md shadow-sm">
            <img
            src="/assets/flower-logo.png"
            className="w-8 h-8 object-contain"
            alt="花朵图标"
            />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase text-emerald-900">Flower Animation Demo</h1>
            <p className="text-[10px] text-emerald-800 tracking-widest uppercase">------ 整体生长动画（1000ms ease-out）</p>
          </div>
        </div>

        <div className="flex gap-3">
          {/* 录像控制 */}
          <Button
            variant="outline"
            className={`h-10 rounded-xl border-white/50 backdrop-blur-md flex items-center gap-2 shadow-sm ${
              isRecording ? "bg-red-500/30 text-red-900 border-red-400 animate-pulse" : "bg-white/40 text-slate-700"
            }`}
            onClick={handleStartRecord}
            disabled={isRecording}
          >
            <Video className="w-4 h-4" />
            <span>{isRecording ? "正在自动录制 5 秒..." : "一键录制 5 秒视频"}</span>
          </Button>

          {videoUrl && (
            <a 
              href={videoUrl} 
              download="flower-grow-animation.webm"
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm text-xs font-bold transition-all"
            >
              <Download className="w-4 h-4" />
              <span>下载录好的视频</span>
            </a>
          )}

          {/* 重播控制 */}
          <Button
            variant="outline"
            className="h-10 rounded-xl bg-white/40 border-white/50 text-slate-700 hover:bg-white/60 hover:text-slate-900 backdrop-blur-md flex items-center gap-2 shadow-sm"
            onClick={handleReplay}
          >
            <RotateCcw className="w-4 h-4" />
            <span>重播生长动画</span>
          </Button>
        </div>
      </header>

      {/* 2.5D 静态雏菊生长动画区 */}
      <main className="flex-1 w-full flex items-center justify-center">
        <div 
          className="relative flex items-center justify-center"
          style={{
            width: `${LOCKED_PARAMS.petals.w * 1.5 * scale}px`,
            height: `${LOCKED_PARAMS.stem.h * 1.5 * scale}px`,
            overflow: "visible",
          }}
        >
          {/* 
            【FlowerComponent 父容器】
            - 动画完全应用在父容器上！
            - 严格遵守 1000ms ease-out 缓动曲线
            - 初始状态：0% scaleY(0.05) scaleX(0.92) opacity(0)
            - 结束状态：100% scaleY(1) scaleX(1) opacity(1)
            - 轴心：bottom center
          */}
          <div 
            key={playTrigger} // 触发重绘并重播 CSS 动画
            className="absolute overflow-visible border border-dashed border-red-500/40 bg-red-500/5"
            style={{
              width: "2px",
              height: "2px",
              bottom: "20%", 
              left: "50%",
              transformOrigin: "bottom center", // 核心：轴心完全在底部中心
              animation: "flowerGrow 1000ms cubic-bezier(0.25, 1, 0.5, 1) forwards", // ease-out 缓动
            }}
          >
            {/* 调试边界：底部原点 O */}
            <div className="absolute w-4 h-4 rounded-full bg-red-600 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center justify-center shadow-md">
              <span className="absolute text-[9px] text-white font-bold">O</span>
            </div>

            {/* 1. 投影 (shadow: z-index 0) */}
            <div 
              className="absolute -translate-x-1/2 -translate-y-1/2 border border-slate-600 bg-slate-600/10"
              style={{
                width: `${LOCKED_PARAMS.shadow.w}px`,
                height: `${LOCKED_PARAMS.shadow.h}px`,
                left: `${LOCKED_PARAMS.shadow.x}px`,
                bottom: `${LOCKED_PARAMS.shadow.y}px`, 
                zIndex: 0,
                transform: `translate(-50%, 50%) rotate(${LOCKED_PARAMS.shadow.r}deg)`,
              }}
            >
              <img src={ASSETS.shadow} alt="shadow" className="w-full h-full object-contain" />
              <div className="absolute top-0 left-0 text-[8px] bg-slate-800 text-white px-1 py-0.5 rounded opacity-75">shadow (z:0)</div>
            </div>

            {/* 2. 右叶片 (leaf-right: z-index 5) */}
            <div 
              className="absolute border border-emerald-600 bg-emerald-600/10"
              style={{
                width: `${LOCKED_PARAMS.leafRight.w}px`,
                height: `${LOCKED_PARAMS.leafRight.h}px`,
                left: `${LOCKED_PARAMS.leafRight.x}px`,
                bottom: `${LOCKED_PARAMS.leafRight.y}px`,
                zIndex: 5, 
                transform: `rotate(${LOCKED_PARAMS.leafRight.r}deg)`,
                transformOrigin: "bottom left",
              }}
            >
              <img src={ASSETS.leafRight} alt="leaf-right" className="w-full h-full object-contain" />
              <div className="absolute top-0 left-0 text-[8px] bg-emerald-800 text-white px-1 py-0.5 rounded opacity-75">leaf-R (z:5)</div>
            </div>

            {/* 3. 花杆 (stem: z-index 10) */}
            <div 
              className="absolute border border-green-600 bg-green-600/10"
              style={{
                width: `${LOCKED_PARAMS.stem.w}px`,
                height: `${LOCKED_PARAMS.stem.h}px`,
                left: `${LOCKED_PARAMS.stem.x}px`,
                bottom: `${LOCKED_PARAMS.stem.y}px`, 
                zIndex: 10,
                transform: `translate(-50%, 0) rotate(${LOCKED_PARAMS.stem.r}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <img src={ASSETS.stem} alt="stem" className="w-full h-full object-fill" />
              <div className="absolute top-0 left-0 text-[8px] bg-green-800 text-white px-1 py-0.5 rounded opacity-75">stem (z:10)</div>
            </div>

            {/* 4. 左叶片 (leaf-left: z-index 20) */}
            <div 
              className="absolute border border-emerald-600 bg-emerald-600/10"
              style={{
                width: `${LOCKED_PARAMS.leafLeft.w}px`,
                height: `${LOCKED_PARAMS.leafLeft.h}px`,
                left: `${LOCKED_PARAMS.leafLeft.x}px`,
                bottom: `${LOCKED_PARAMS.leafLeft.y}px`, 
                zIndex: 20,
                transform: `rotate(${LOCKED_PARAMS.leafLeft.r}deg)`,
                transformOrigin: "bottom right",
              }}
            >
              <img src={ASSETS.leafLeft} alt="leaf-left" className="w-full h-full object-contain" />
              <div className="absolute top-0 left-0 text-[8px] bg-emerald-800 text-white px-1 py-0.5 rounded opacity-75">leaf-L (z:20)</div>
            </div>

            {/* 5. 花瓣 (petals: z-index 30) */}
            <div 
              className="absolute border border-amber-500 bg-amber-500/10"
              style={{
                width: `${LOCKED_PARAMS.petals.w}px`,
                height: `${LOCKED_PARAMS.petals.h}px`,
                left: `${LOCKED_PARAMS.petals.x}px`,
                bottom: `${LOCKED_PARAMS.petals.y}px`, 
                zIndex: 30,
                transform: `translate(-50%, 50%) rotate(${LOCKED_PARAMS.petals.r}deg)`,
              }}
            >
              <img src={ASSETS.petals} alt="petals" className="w-full h-full object-contain" />
              <div className="absolute top-0 left-0 text-[8px] bg-amber-800 text-white px-1 py-0.5 rounded opacity-75">petals (z:30)</div>
            </div>

            {/* 6. 黄色花心 (center: z-index 40) */}
            <div 
              className="absolute border border-yellow-500 bg-yellow-500/10"
              style={{
                width: `${LOCKED_PARAMS.center.w}px`,
                height: `${LOCKED_PARAMS.center.h}px`,
                left: `${LOCKED_PARAMS.center.x}px`,
                bottom: `${LOCKED_PARAMS.center.y}px`, 
                zIndex: 40,
                transform: `translate(-50%, 50%) rotate(${LOCKED_PARAMS.center.r}deg)`,
              }}
            >
              <img src={ASSETS.center} alt="center" className="w-full h-full object-contain" />
              <div className="absolute top-0 left-0 text-[8px] bg-yellow-800 text-white px-1 py-0.5 rounded opacity-75">center (z:40)</div>
            </div>

            {/* 7. 微笑表情 (face: z-index 50) */}
            <div 
              className="absolute border border-blue-500 bg-blue-500/10"
              style={{
                width: `${LOCKED_PARAMS.face.w}px`,
                height: `${LOCKED_PARAMS.face.h}px`,
                left: `${LOCKED_PARAMS.face.x}px`,
                bottom: `${LOCKED_PARAMS.face.y}px`, 
                zIndex: 50,
                transform: `translate(-50%, 50%) rotate(${LOCKED_PARAMS.face.r}deg)`,
              }}
            >
              <img src={ASSETS.faceSmile} alt="face-smile" className="w-full h-full object-contain" />
              <div className="absolute top-0 left-0 text-[8px] bg-blue-800 text-white px-1 py-0.5 rounded opacity-75">face (z:50)</div>
            </div>

            {/* 调试边界：花头中心点 C */}
            <div 
              className="absolute w-3 h-3 rounded-full bg-amber-600 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center justify-center shadow-md"
              style={{
                left: `${LOCKED_PARAMS.petals.x}px`,
                bottom: `${LOCKED_PARAMS.petals.y}px`,
              }}
            >
              <span className="text-[7px] text-white font-bold">C</span>
            </div>
          </div>
        </div>
      </main>

      {/* CSS Keyframes 动画注入 */}
      <style>{`
        @keyframes flowerGrow {
          0% {
            transform: translateX(-50%) scaleY(0.05) scaleX(0.92);
            opacity: 0;
          }
          100% {
            transform: translateX(-50%) scaleY(1) scaleX(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
