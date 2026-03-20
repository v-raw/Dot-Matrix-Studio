import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Upload, Download, Type, Clock, 
  Image as ImageIcon, Music, Zap, Settings, Video, Check, RotateCcw, 
  Camera, X, Palette, Radio, Layers, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, Volume2, Gamepad2, Sun, Moon, Search
} from 'lucide-react';

// Polyfill to prevent tailwind ReferenceError in certain execution environments
if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || { config: {} };
}

const BITMAP_DIGITS = {
  '0': [1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1],
  '1': [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1],
  '2': [1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1],
  '3': [1,1,1, 0,0,1, 1,1,1, 0,0,1, 1,1,1],
  '4': [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
  '5': [1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1],
  '6': [1,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1],
  '7': [1,1,1, 0,0,1, 0,1,0, 0,1,0, 0,1,0],
  '8': [1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1],
  '9': [1,1,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1]
};

const BAYER_MATRIX = [
  [ 0,  8,  2, 10], [12,  4, 14,  6], [ 3, 11,  1,  9], [15,  7, 13,  5]
];

const UI_THEMES = {
  red: { id: 'red', color: '#ef4444', label: 'Nothing Red' },
  cyan: { id: 'cyan', color: '#06b6d4', label: 'Cyber Cyan' },
  green: { id: 'green', color: '#10b981', label: 'Matrix Green' },
  white: { id: 'white', color: '#ffffff', label: 'Pure White' },
};

const TEXTURE_DEFAULTS = {
  noise: { params: { scale: 2.0, speed: 1.0, offsetX: 0, offsetY: 0, threshold: 0.5, warp: 0.2, intensity: 1.0 }, links: { scale: 'none', speed: 'none', offsetX: 'time', offsetY: 'none', threshold: 'lfo', warp: 'none', intensity: 'none' } },
  voronoi: { params: { scale: 3.0, speed: 0.8, offsetX: 0, offsetY: 0, threshold: 0.2, warp: 0.0, intensity: 1.0 }, links: { scale: 'none', speed: 'none', offsetX: 'none', offsetY: 'time', threshold: 'none', warp: 'none', intensity: 'none' } },
  wave: { params: { scale: 1.5, speed: 2.0, offsetX: 0, offsetY: 0, threshold: 0.5, warp: 0.0, intensity: 0.5 }, links: { scale: 'none', speed: 'none', offsetX: 'time', offsetY: 'none', threshold: 'none', warp: 'none', intensity: 'none' } }
};

const TEXTURE_INPUTS = [
  { id: 'scale', label: 'Scale Details', min: 0.1, max: 10, step: 0.1 }, { id: 'speed', label: 'Time Offset', min: 0, max: 5, step: 0.1 }, { id: 'offsetX', label: 'Pan X', min: -5, max: 5, step: 0.1 }, { id: 'offsetY', label: 'Pan Y', min: -5, max: 5, step: 0.1 }, { id: 'threshold', label: 'Contrast Gate', min: 0, max: 1, step: 0.05 }, { id: 'warp', label: 'UV Distortion', min: 0, max: 2, step: 0.05 }, { id: 'intensity', label: 'Intensity Multiplier', min: 0, max: 3, step: 0.1 }
];

const AUDIO_FX_DEFAULTS = {
  oscilloscope: {}, rings: {}, particles: {}, spectrum: {}, fractal: {}, grid: {}, laser: {}, tetris: {}, kaleidoscope: {},
  launchpad: {}, launchpad_eq: {}, launchpad_cross: {}, launchpad_pulse: {}, launchpad_split: {}, supernova: {},
  hyperspace: {}, dna_helix: {}, hologram: {}, cyber_web: {}, cymatics: {}, lissajous_knot: {}, radar_sweep: {},
  barcode: {}, audio_eclipse: {}, quantum_foam: {}, vortex_tunnel: {}, solar_flare: {}, neon_heartbeat: {},
  fractal_tree: {}, glitch_blocks: {}
};

const VJ_MODES = Object.keys(AUDIO_FX_DEFAULTS);

const MODULATOR_COLORS = { none: 'transparent', time: '#eab308', lfo: '#ec4899' };

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60).toString().padStart(2, '0'); return `${m}:${s}`;
};

const fract = x => x - Math.floor(x);
const hash = (x, y) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123);
const noise2D = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = fract(x), fy = fract(y);
    const ux = fx * fx * (3.0 - 2.0 * fx), uy = fy * fy * (3.0 - 2.0 * fy);
    const n00 = hash(ix, iy), n10 = hash(ix + 1, iy);
    const n01 = hash(ix, iy + 1), n11 = hash(ix + 1, iy + 1);
    return n00 + ux * (n10 - n00) + uy * (n01 - n00) + ux * uy * (n00 - n10 - n01 + n11);
};
const voronoi = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y); let minDist = 1.0;
    for(let j=-1; j<=1; j++) {
        for(let i=-1; i<=1; i++) {
            const cx = ix + i, cy = iy + j; const h = hash(cx, cy); 
            const px = cx + fract(h * 43758.5453) - x; const py = cy + fract(h * 12345.6789) - y;
            const d = px*px + py*py; if (d < minDist) minDist = d;
        }
    }
    return Math.sqrt(minDist);
};

const OptimizedSlider = React.memo(({ value, onChange, min, max, step, activeColor, className, disabled }) => {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => { setLocalVal(value); }, [value]);
  return <input type="range" min={min} max={max} step={step} value={localVal} onChange={(e) => { const v = Number(e.target.value); setLocalVal(v); onChange(v); }} disabled={disabled} style={{ accentColor: activeColor }} className={`${className} ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`} />;
});

const OptimizedTextInput = React.memo(({ value, onChange, placeholder, className }) => {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => { setLocalVal(value); }, [value]);
  return <input type="text" value={localVal} onChange={(e) => { setLocalVal(e.target.value); onChange(e.target.value); }} className={className} placeholder={placeholder} />;
});

const loadDefault = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(`matrix_studio_${key}`);
  if (saved !== null) {
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    if (!isNaN(saved)) return Number(saved);
    return saved;
  }
  return fallback;
};

const MatrixRainSwitch = ({ isAudioMode, onToggle, activeColor }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); let animationFrameId;
    const columns = Math.floor(canvas.width / 8); const drops = Array(columns).fill(0);
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = activeColor; ctx.font = '10px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = String.fromCharCode(Math.random() * 128); ctx.fillText(text, i * 8, drops[i] * 10);
        if (drops[i] * 10 > canvas.height && Math.random() > 0.95) drops[i] = 0;
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(animationFrameId);
  }, [activeColor]);

  return (
    <div onClick={onToggle} className="relative w-full h-10 bg-black border border-white/20 rounded-xl cursor-pointer overflow-hidden flex items-center group shadow-[0_0_15px_rgba(0,0,0,0.5)]">
      <canvas ref={canvasRef} width={340} height={40} className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${isAudioMode ? 'opacity-100' : 'opacity-0'}`} />
      <div className="absolute h-[80%] top-[10%] w-[48%] bg-white/10 backdrop-blur-md rounded-lg transition-transform duration-500 ease-out border border-white/30" style={{ transform: isAudioMode ? 'translateX(104%)' : 'translateX(4%)', boxShadow: isAudioMode ? `0 0 15px ${activeColor}40` : '0 0 10px rgba(255,255,255,0.1)' }} />
      <div className={`relative z-10 w-1/2 text-center text-xs font-bold tracking-widest transition-colors duration-500 ${!isAudioMode ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]' : 'text-gray-500'}`}>MATH FX</div>
      <div className={`relative z-10 w-1/2 text-center text-xs font-bold tracking-widest transition-colors duration-500 ${isAudioMode ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]' : 'text-gray-500'}`}>AUDIO FX</div>
    </div>
  );
};

const MatrixStudio = () => {
  const canvasRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const textOffscreenCanvasRef = useRef(null); 
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const audioDestRef = useRef(null); 
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const beatState = useRef({ lastTime: 0, intervals: [], bpm: 120, pulse: 0, beatCount: 0, lastUiUpdate: 0, history: [] });
  const padTriggersRef = useRef([]);
  const lastTriggerRef = useRef({}); 
  const [padPanX, setPadPanX] = useState(0);
  const [padPanY, setPadPanY] = useState(0);

  const [uiTheme, setUiTheme] = useState('white');
  const activeColor = UI_THEMES[uiTheme].color;
  const [activeTab, setActiveTab] = useState('synth'); 
  const [resolution, setResolution] = useState(15); 
  const [dotShape, setDotShape] = useState('square');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [notification, setNotification] = useState('');
  const [bloom, setBloom] = useState(false);
  const [globalBrightness, setGlobalBrightness] = useState(1);
  const [globalContrast, setGlobalContrast] = useState(2); 

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState('image'); 
  const [exportImgFormat, setExportImgFormat] = useState(() => loadDefault('exportImgFormat', 'image/png'));
  const [exportScale, setExportScale] = useState(() => loadDefault('exportScale', 1));
  const [exportTransparent, setExportTransparent] = useState(() => loadDefault('exportTransparent', false));
  const exportTransparentRef = useRef(loadDefault('exportTransparent', false));
  const [exportVidFormat, setExportVidFormat] = useState(() => loadDefault('exportVidFormat', 'video/webm;codecs=vp9,opus'));
  const [exportFps, setExportFps] = useState(() => loadDefault('exportFps', 60));
  const [exportBitrate, setExportBitrate] = useState(() => loadDefault('exportBitrate', 8000000)); 
  const [exportAudio, setExportAudio] = useState(() => loadDefault('exportAudio', true));

  const handleSaveDefaults = () => {
    localStorage.setItem('matrix_studio_exportImgFormat', exportImgFormat);
    localStorage.setItem('matrix_studio_exportScale', exportScale);
    localStorage.setItem('matrix_studio_exportTransparent', exportTransparent);
    localStorage.setItem('matrix_studio_exportVidFormat', exportVidFormat);
    localStorage.setItem('matrix_studio_exportFps', exportFps);
    localStorage.setItem('matrix_studio_exportBitrate', exportBitrate);
    localStorage.setItem('matrix_studio_exportAudio', exportAudio);
    setNotification('Export settings saved as default!');
    setTimeout(() => setNotification(''), 3000);
  };

  // SYSTEM FONTS STATE
  const [fontFamily, setFontFamily] = useState('Arial');
  const [systemFonts, setSystemFonts] = useState(['Arial', 'Impact', 'Consolas', 'Verdana']);
  const [fontSearch, setFontSearch] = useState('');

  useEffect(() => {
    async function getLocalFonts() {
      const fallbackFonts = [
        'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Cambria Math', 'Candara', 
        'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima', 
        'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'HoloLens MDL2 Assets', 
        'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 
        'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya', 
        'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 
        'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti', 
        'MingLiU-ExtB', 'Mongolian Baiti', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 
        'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Historic', 
        'Segoe UI Emoji', 'Segoe UI Symbol', 'SimSun', 'Sitka Small', 'Sylfaen', 'Symbol', 
        'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 
        'Yu Gothic'
      ];

      try {
        if ('queryLocalFonts' in window) {
          const fonts = await window.queryLocalFonts();
          const uniqueFonts = Array.from(new Set(fonts.map(f => f.family))).sort();
          if (uniqueFonts.length > 0) {
            setSystemFonts(uniqueFonts);
            return;
          }
        }
      } catch (err) {
        // Silently catch to prevent React error overlays when Permissions Policy blocks queryLocalFonts
      }
      
      // Fallback if API fails or is restricted
      setSystemFonts(fallbackFonts.sort());
    }
    getLocalFonts();
  }, []);

  const [textInput, setTextInput] = useState('STUDIO');
  const [textSpeed, setTextSpeed] = useState(0.05);
  const [textAnimation, setTextAnimation] = useState('scroll-left');
  const [textScale, setTextScale] = useState(1.0);
  const [textPanX, setTextPanX] = useState(0);
  const [textPanY, setTextPanY] = useState(0);
  const [textWaveAmp, setTextWaveAmp] = useState(0.3);
  const [textWaveFreq, setTextWaveFreq] = useState(0.4);
  const [textWaveSpeed, setTextWaveSpeed] = useState(1.0);
  const [textBlinkRate, setTextBlinkRate] = useState(1.0);
  const [typewriterCursor, setTypewriterCursor] = useState('_');
  const [decryptComplexity, setDecryptComplexity] = useState(1);
  const [cubeDistance, setCubeDistance] = useState(1.8);
  const [cubeSpeed, setCubeSpeed] = useState(1.5);
  const [vhsFrequency, setVhsFrequency] = useState(0.15);
  const [vhsIntensity, setVhsIntensity] = useState(0.6);

  const [generativeMode, setGenerativeMode] = useState('ringtone');
  const [hourglassDuration, setHourglassDuration] = useState(60); 
  const [rippleSpeed, setRippleSpeed] = useState(0.5); 
  const [rippleCount, setRippleCount] = useState(3);
  const [rippleThickness, setRippleThickness] = useState(0.08);
  const [rippleCenterPulse, setRippleCenterPulse] = useState(true);

  const [colors, setColors] = useState({ bg: '#0f0f0f', unlit: '#1f1f1f', lit: '#ffffff' });

  const [mediaFile, setMediaFile] = useState(null);
  const [isVideoMedia, setIsVideoMedia] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [mediaBrightness, setMediaBrightness] = useState(1);
  const [mediaContrast, setMediaContrast] = useState(1);
  const [mediaScale, setMediaScale] = useState(1);
  const [mediaPanX, setMediaPanX] = useState(0);
  const [mediaPanY, setMediaPanY] = useState(0);
  const [mediaRotation, setMediaRotation] = useState(0);
  const [audioSyncMode, setAudioSyncMode] = useState('none'); 
  const [mediaFx, setMediaFx] = useState('none'); 
  
  const [audioFile, setAudioFile] = useState(null);
  const [audioAnimMode, setAudioAnimMode] = useState('liquid'); 
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioSensitivity, setAudioSensitivity] = useState(1.5);

  const [synthEngineMode, setSynthEngineMode] = useState('texture'); 
  const [synthMode, setSynthMode] = useState('noise'); 
  const [audioFxMode, setAudioFxMode] = useState('oscilloscope');

  const [allSynthConfig, setAllSynthConfig] = useState(() => JSON.parse(JSON.stringify(TEXTURE_DEFAULTS)));
  const allSynthConfigRef = useRef(allSynthConfig);
  const [allAudioFxConfig, setAllAudioFxConfig] = useState(() => JSON.parse(JSON.stringify(AUDIO_FX_DEFAULTS)));
  const allAudioFxConfigRef = useRef(allAudioFxConfig);

  const [isAutoVj, setIsAutoVj] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false); 
  const autoVjState = useRef({ 
    mode: 'spectrum', prevMode: 'spectrum', lastSwitch: 0, transitionPulse: 0, forceNextSwitch: false, badFramesStart: null
  });

  const prevDataArrayRef = useRef({ peaks: new Float32Array(256), history: new Float32Array(256) });

  const engineModeRef = useRef(synthEngineMode);
  useEffect(() => { engineModeRef.current = synthEngineMode; }, [synthEngineMode]);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  const executeActionsRef = useRef({});

  const trailCanvasRef = useRef(null);
  const glitchState = useRef({ vhs: false, trails: false, strobe: false, slowmo: false, crush: false, smoothWarp: false, roll: false, waveWarp: false, kill: false });
  const vTimeRef = useRef({ real: 0, virtual: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();

      if (key === 'f1') {
          e.preventDefault();
          if (executeActionsRef.current.image) executeActionsRef.current.image();
      }
      if (key === 'f2') {
          e.preventDefault();
          if (isRecordingRef.current && executeActionsRef.current.stop) {
              executeActionsRef.current.stop();
          } else if (executeActionsRef.current.video) {
              executeActionsRef.current.video(false);
          }
      }
      if (key === 'f3') {
          e.preventDefault();
          if (isRecordingRef.current && executeActionsRef.current.stop) {
              executeActionsRef.current.stop();
          } else if (executeActionsRef.current.video) {
              executeActionsRef.current.video(true);
          }
      }

      if (key === 'q') glitchState.current.vhs = true;
      if (key === 'w') glitchState.current.trails = true;
      if (key === 'e') glitchState.current.strobe = true;
      if (key === 'a') glitchState.current.slowmo = true;
      if (key === 's') glitchState.current.crush = true;
      if (key === 'd') glitchState.current.smoothWarp = true;
      if (key === 'z') glitchState.current.roll = true;
      if (key === 'x') glitchState.current.waveWarp = true;
      if (key === 'c') glitchState.current.kill = true;

      if (key === '`' || key === '~') {
         e.preventDefault();
         if (engineModeRef.current === 'audio') {
            setAudioFxMode(prev => {
               const nextIdx = (VJ_MODES.indexOf(prev) + 1) % VJ_MODES.length;
               return VJ_MODES[nextIdx];
            });
         } else if (engineModeRef.current === 'texture') {
            const synthModes = ['noise', 'voronoi', 'wave'];
            setSynthMode(prev => {
               const nextIdx = (synthModes.indexOf(prev) + 1) % synthModes.length;
               return synthModes[nextIdx];
            });
         }
      }

      const keyMap = {
        '1': { col: 0, row: 2, type: 'pulse_ring' }, '2': { col: 1, row: 2, type: 'cross_strike' }, '3': { col: 2, row: 2, type: 'x_strike' },
        '4': { col: 0, row: 1, type: 'ripple_fill' }, '5': { col: 1, row: 1, type: 'smooth_ripple' }, '6': { col: 2, row: 1, type: 'pulse_ring' },
        '7': { col: 0, row: 0, type: 'cross_strike' }, '8': { col: 1, row: 0, type: 'x_strike' }, '9': { col: 2, row: 0, type: 'ripple_fill' },
      };
      const numpadMap = { 'Numpad1': '1', 'Numpad2': '2', 'Numpad3': '3', 'Numpad4': '4', 'Numpad5': '5', 'Numpad6': '6', 'Numpad7': '7', 'Numpad8': '8', 'Numpad9': '9' };
      
      let mappedKey = key; if (numpadMap[e.code]) mappedKey = numpadMap[e.code];
      if (keyMap[mappedKey]) {
        e.preventDefault();
        const now = performance.now();
        if (!e.repeat || (now - (lastTriggerRef.current[mappedKey] || 0) > 100)) {
            lastTriggerRef.current[mappedKey] = now;
            padTriggersRef.current.push({ id: Math.random(), birth: now, ...keyMap[mappedKey] });
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'q') glitchState.current.vhs = false;
      if (key === 'w') glitchState.current.trails = false;
      if (key === 'e') glitchState.current.strobe = false;
      if (key === 'a') glitchState.current.slowmo = false;
      if (key === 's') glitchState.current.crush = false;
      if (key === 'd') glitchState.current.smoothWarp = false;
      if (key === 'z') glitchState.current.roll = false;
      if (key === 'x') glitchState.current.waveWarp = false;
      if (key === 'c') glitchState.current.kill = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
       window.removeEventListener('keydown', handleKeyDown);
       window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const sandSimRef = useRef(null);
  const hourglassDurationRef = useRef(hourglassDuration);
  const particlesRef = useRef([]); 
  const starsRef = useRef([]);
  const matrixRainRef = useRef([]);
  const radarPingsRef = useRef([]);
  const golGridRef = useRef([]);
  
  const lastActiveTabRef = useRef('synth');
  if (activeTab !== 'settings') lastActiveTabRef.current = activeTab;
  const currentRenderTab = activeTab === 'settings' ? lastActiveTabRef.current : activeTab;
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    hourglassDurationRef.current = hourglassDuration;
    if (sandSimRef.current) sandSimRef.current.duration = hourglassDuration;
  }, [hourglassDuration]);

  const initHourglass = useCallback(() => {
    const res = resolution; const grid = new Uint8Array(res * res);
    const cx = Math.floor(res / 2); const cy = Math.floor(res / 2);
    let sandCount = 0;
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        let inside = false;
        if (y > 0 && y < cy) { if (x >= y && x <= res - 1 - y) inside = true; }
        else if (y > cy && y < res - 1) { if (x >= res - 1 - y && x <= y) inside = true; }
        else if (y === cy) { if (x === cx) inside = true; }
        grid[y * res + x] = inside ? 0 : 2;
      }
    }
    const gridCopy = new Uint8Array(grid);
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        if (gridCopy[y * res + x] === 2) {
          let isBorder = false;
          if (x > 0 && gridCopy[y * res + x - 1] === 0) isBorder = true;
          if (x < res - 1 && gridCopy[y * res + x + 1] === 0) isBorder = true;
          if (y > 0 && gridCopy[(y - 1) * res + x] === 0) isBorder = true;
          if (y < res - 1 && gridCopy[(y + 1) * res + x] === 0) isBorder = true;
          if (y === 0 && x > 0 && x < res - 1) isBorder = true;
          if (y === res - 1 && x > 0 && x < res - 1) isBorder = true;
          if (isBorder) grid[y * res + x] = 3;
        }
      }
    }
    for (let y = 1; y < cy; y++) {
      for (let x = 1; x < res - 1; x++) {
        if (grid[y * res + x] === 0) { grid[y * res + x] = 1; sandCount++; }
      }
    }
    sandSimRef.current = { grid, sandCount, droppedCount: 0, dropsPending: 0, lastTime: null, res, duration: hourglassDurationRef.current };
  }, [resolution]);

  const handleRestartHourglass = (e) => { if (e) e.preventDefault(); initHourglass(); if (!isPlaying) setIsPlaying(true); };

  useEffect(() => {
    try {
      offscreenCanvasRef.current = document.createElement('canvas');
      textOffscreenCanvasRef.current = document.createElement('canvas');
    } catch (err) {}
    return () => { 
      if (audioContextRef.current) audioContextRef.current.close(); 
      if (videoRef.current && videoRef.current.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => { if (activeTab === 'generative' && generativeMode === 'hourglass') initHourglass(); }, [activeTab, generativeMode, resolution, initHourglass]);
  useEffect(() => { allSynthConfigRef.current = allSynthConfig; }, [allSynthConfig]);

  const handleSynthParamChange = useCallback((id, val) => {
    if (synthEngineMode === 'texture') setAllSynthConfig(prev => ({ ...prev, [synthMode]: { ...prev[synthMode], params: { ...prev[synthMode].params, [id]: val } } }));
  }, [synthEngineMode, synthMode]);

  const handleSynthLinkChange = useCallback((id, val) => {
    if (synthEngineMode === 'texture') setAllSynthConfig(prev => ({ ...prev, [synthMode]: { ...prev[synthMode], links: { ...prev[synthMode].links, [id]: val } } }));
  }, [synthEngineMode, synthMode]);

  const handleResetEffect = () => {
    if (synthEngineMode === 'texture') {
       setAllSynthConfig(prev => ({ ...prev, [synthMode]: JSON.parse(JSON.stringify(TEXTURE_DEFAULTS[synthMode])) }));
       setNotification(`${synthMode.toUpperCase()} Reset`);
    }
    setTimeout(() => setNotification(''), 2000);
  };

  useEffect(() => {
    // FIX: Play/Pause separation. Auto-pause MP3 when MP4 is active on the Media Tab
    if (videoRef.current && videoRef.current.tagName === 'VIDEO') {
      if (currentRenderTab === 'media' && isPlaying) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }
    if (audioRef.current) {
      const isMediaTabWithVideo = currentRenderTab === 'media' && isVideoMedia;
      const isAudioNeeded = currentRenderTab === 'audio' || 
                            currentRenderTab === 'synth' || 
                            (currentRenderTab === 'media' && audioSyncMode !== 'none' && !isMediaTabWithVideo);
      
      if (isAudioNeeded && isPlaying) {
         audioContextRef.current?.resume();
         audioRef.current.play().catch(() => {});
      } else {
         audioRef.current.pause();
      }
    }
  }, [currentRenderTab, isPlaying, audioSyncMode, isVideoMedia]);

  const toggleWebcam = async () => {
    if (isWebcamActive) {
      if (videoRef.current && videoRef.current.srcObject) { videoRef.current.srcObject.getTracks().forEach(track => track.stop()); videoRef.current.srcObject = null; }
      setIsWebcamActive(false); setIsVideoMedia(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!videoRef.current || videoRef.current.tagName !== 'VIDEO') videoRef.current = document.createElement('video');
        videoRef.current.srcObject = stream; videoRef.current.play();
        setIsWebcamActive(true); setIsVideoMedia(true); setIsPlaying(true);
      } catch (err) {
        setNotification("Webcam access denied."); setTimeout(() => setNotification(''), 3000);
      }
    }
  };

  const handleTransparentChange = (val) => { setExportTransparent(val); exportTransparentRef.current = val; };

  const renderFrame = useCallback((rawTime) => {
    const dt = rawTime - (vTimeRef.current.real || rawTime);
    vTimeRef.current.real = rawTime;
    
    if (glitchState.current.slowmo) {
        vTimeRef.current.virtual += dt * 0.05;
    } else {
        vTimeRef.current.virtual += dt;
    }
    const time = vTimeRef.current.virtual;

    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    const width = canvas.width; const height = canvas.height;

    if (offscreen.width !== resolution) { offscreen.width = resolution; offscreen.height = resolution; }
    offCtx.clearRect(0, 0, resolution, resolution);
    offCtx.fillStyle = 'black'; offCtx.fillRect(0, 0, resolution, resolution);

    let globalBass = 0, globalMid = 0, globalHigh = 0, spectralFlux = 0, dataArray = null, bufferLength = 0;
    const sens = audioSensitivity;
    const getAudioVal = (idx) => { if (!dataArray) return 0; return Math.min(1.0, prevDataArrayRef.current.peaks[idx]); };

    // --- FIX: Now actively checks if EITHER Audio or Video is currently playing ---
    const isAudioTabOrSynth = currentRenderTab === 'audio' || currentRenderTab === 'synth';
    const isMediaTab = currentRenderTab === 'media';
    const isMp3Active = (isAudioTabOrSynth || (isMediaTab && !isVideoMedia)) && !!(audioFile && audioRef.current && !audioRef.current.paused);
    const isMp4Active = isMediaTab && isVideoMedia && !!(videoRef.current && !videoRef.current.paused);
    const isAudioIdle = !isPlaying || (!isMp3Active && !isMp4Active);

    if (analyserRef.current && !isAudioIdle) {
      bufferLength = analyserRef.current.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
    } else if (currentRenderTab === 'audio' || (currentRenderTab === 'synth' && synthEngineMode === 'audio')) {
      bufferLength = 256; dataArray = new Uint8Array(bufferLength);
      for (let i = 0; i < bufferLength; i++) {
         dataArray[i] = Math.max(0, (Math.sin(time * 0.0005 + i * 0.05) + Math.cos(time * 0.0003 - i * 0.02)) * 60);
      }
    }

    if (dataArray) {
      const third = Math.floor(bufferLength / 3);
      let bSum = 0, mSum = 0, hSum = 0, fluxSum = 0;
      for (let i = 0; i < bufferLength; i++) {
         const rawVal = Math.pow(dataArray[i] / 255, 2.5) * sens;
         if (rawVal > prevDataArrayRef.current.peaks[i]) prevDataArrayRef.current.peaks[i] = rawVal; 
         else prevDataArrayRef.current.peaks[i] *= isAudioIdle ? 0.95 : 0.65;
         const envVal = prevDataArrayRef.current.peaks[i];
         if (i < third) bSum += envVal; else if (i < third * 2) mSum += envVal; else hSum += envVal;
         fluxSum += Math.max(0, dataArray[i] - prevDataArrayRef.current.history[i]);
         prevDataArrayRef.current.history[i] = dataArray[i];
      }
      globalBass = Math.min(1.5, (bSum / third)); globalMid = Math.min(1.5, (mSum / third));
      globalHigh = Math.min(1.5, (hSum / (bufferLength - third * 2))); spectralFlux = Math.min(1.5, (fluxSum / 2000) * sens); 
    }

    let bState = beatState.current; bState.pulse *= 0.85; 
    bState.history.push(globalBass + (spectralFlux * 0.5)); 
    if (bState.history.length > 60) bState.history.shift();
    const validHistory = bState.history.filter(v => !isNaN(v));
    const localAvg = validHistory.length > 0 ? validHistory.reduce((a,b)=>a+b,0) / validHistory.length : 0;
    const dynamicThreshold = Math.max(0.15, localAvg * 1.2);

    if ((globalBass + spectralFlux * 0.5) > dynamicThreshold && globalBass > 0.1 && time - bState.lastTime > 350) { 
        bState.lastTime = time; bState.pulse = 1.0; bState.beatCount++;
        const interval = time - bState.lastTime;
        if (interval < 2000) { 
            bState.intervals.push(interval); if (bState.intervals.length > 6) bState.intervals.shift();
            bState.bpm = Math.round(60000 / (bState.intervals.reduce((a,b)=>a+b,0) / bState.intervals.length));
        }
    }

    if (time - bState.lastUiUpdate > 250) {
        const bpmBadge = document.getElementById('bpm-ai-badge');
        if (bpmBadge) bpmBadge.innerText = `${bState.bpm} BPM`; bState.lastUiUpdate = time;
    }

    const speedMult = Math.max(0.5, Math.min(3.5, (bState.bpm / 120) * (1.0 + spectralFlux)));
    const beatGlow = bState.pulse * 1.5;

    if (currentRenderTab === 'text') {
      const textCanvas = textOffscreenCanvasRef.current;
      if (!textCanvas) return;
      if (textCanvas.width !== resolution) { textCanvas.width = resolution; textCanvas.height = resolution; }
      const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });
      textCtx.clearRect(0, 0, resolution, resolution);
      
      // Use the newly installed System Font
      textCtx.fillStyle = 'white'; 
      textCtx.font = `bold ${resolution * 0.8 * textScale}px "${fontFamily}"`; 
      textCtx.textAlign = 'center'; textCtx.textBaseline = 'middle';

      let displayStr = textInput;
      if (textAnimation === 'typewriter') {
        const progress = (time * textSpeed * 0.05) % (textInput.length + 15);
        displayStr = textInput.slice(0, Math.max(0, Math.min(Math.floor(progress), textInput.length))) + ((Math.floor(time * 0.003) % 2 === 0 && progress < textInput.length + 10) ? (typewriterCursor === 'none' ? '' : typewriterCursor) : '');
      } else if (textAnimation === 'decrypt') {
        const currentCycle = (time * textSpeed * 0.03) % (textInput.length + 25);
        displayStr = textInput.split('').map((char, i) => {
            if (char === ' ') return ' '; if (i < currentCycle - 5) return char;
            if (i < currentCycle + 10) return String.fromCharCode(33 + Math.floor(Math.random() * (30 + decryptComplexity * 30)));
            return '';
        }).join('');
      }

      const textWidth = textCtx.measureText(displayStr).width;
      let xOffset = resolution / 2; const centerY = resolution / 2;
      const isBlinking = textAnimation.includes('blink');
      const showText = !isBlinking || (Math.floor(time * textSpeed * textBlinkRate * 10) % 2 === 0);
      const scaledTextSpeed = textSpeed * (resolution / 15);

      if (showText) {
        if (['scroll-left', 'cube', 'sine-wave', 'vhs', 'decrypt', 'scroll-left-blink'].includes(textAnimation)) {
          textCtx.fillText(displayStr, Math.floor(resolution - ((time * scaledTextSpeed) % (resolution + textWidth)) + textWidth/2 + textPanX), Math.floor(centerY + textPanY));
        } else if (['scroll-right', 'scroll-right-blink'].includes(textAnimation)) {
          textCtx.fillText(displayStr, Math.floor(-textWidth + ((time * scaledTextSpeed) % (resolution + textWidth)) + textWidth/2 + textPanX), Math.floor(centerY + textPanY));
        } else {
          textCtx.fillText(displayStr, Math.floor(resolution / 2 + textPanX), Math.floor(centerY + textPanY));
        }
      }

      if (textAnimation === 'cube') {
        const R = resolution * 0.5; const D = resolution * cubeDistance; const t = time * 0.001 * cubeSpeed; 
        const corners = [];
        for(let i=0; i<4; i++) { const angle = t + (i * Math.PI / 2) + Math.PI/4; corners.push({ x: Math.sin(angle) * R * 1.414, z: Math.cos(angle) * R * 1.414 }); }
        for(let i=0; i<4; i++) {
            const c1 = corners[i]; const c2 = corners[(i+1)%4];
            if (c1.z + c2.z > 0) { 
                const xLeft = Math.min(c1.x, c2.x); const xRight = Math.max(c1.x, c2.x); const isSwapped = c1.x > c2.x;
                for (let x = 0; x < resolution; x++) {
                    const screenX = x - resolution/2;
                    if (screenX >= xLeft && screenX <= xRight && (xRight - xLeft >= 0.1)) {
                        const u_raw = (screenX - xLeft) / (xRight - xLeft); const u = isSwapped ? 1 - u_raw : u_raw;
                        const z = c1.z + (isSwapped ? (1-u_raw) : u_raw) * (c2.z - c1.z);
                        const drawH = Math.max(1, Math.floor(resolution * (D / (D - z))));
                        offCtx.globalAlpha = Math.max(0.2, Math.min(1, ((c1.z + c2.z) / (R * 2.828)) * 1.5)); 
                        offCtx.drawImage(textCanvas, Math.floor(u * resolution), 0, 1, resolution, x, Math.floor((resolution - drawH) / 2), 1, drawH);
                    }
                }
            }
        }
        offCtx.globalAlpha = 1.0;
      } else if (textAnimation === 'sine-wave') {
        for (let x = 0; x < resolution; x++) offCtx.drawImage(textCanvas, x, 0, 1, resolution, x, Math.floor(Math.sin((x / resolution) * Math.PI * 10 * textWaveFreq + time * 0.005 * textWaveSpeed) * (resolution * textWaveAmp)), 1, resolution);
      } else if (textAnimation === 'vhs') {
        offCtx.drawImage(textCanvas, 0, 0);
        if (Math.random() < vhsFrequency) { 
            const gY = Math.floor(Math.random() * resolution); const gH = Math.floor(Math.random() * (resolution * 0.4)) + 1;
            offCtx.clearRect(0, gY, resolution, gH);
            offCtx.drawImage(textCanvas, 0, gY, resolution, gH, (Math.random() - 0.5) * resolution * vhsIntensity, gY, resolution, gH);
            offCtx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8})`; offCtx.fillRect(0, gY + Math.random()*gH, resolution, 1);
        }
      } else { offCtx.drawImage(textCanvas, 0, 0); }

    } else if (currentRenderTab === 'clock') {
      const date = new Date(); const h = date.getHours().toString().padStart(2, '0'); const m = date.getMinutes().toString().padStart(2, '0');
      offCtx.fillStyle = 'white';
      const drawDigit = (char, startX, startY) => {
        const pixels = BITMAP_DIGITS[char];
        if (!pixels) return;
        for (let i = 0; i < 15; i++) {
          if (pixels[i]) {
            const px = startX + (i % 3) * (resolution / 15);
            const py = startY + Math.floor(i / 3) * (resolution / 15);
            offCtx.fillRect(px, py, Math.max(1, resolution / 15), Math.max(1, resolution / 15));
          }
        }
      };
      const sx = (resolution - 7 * (resolution / 15)) / 2; const sy = (resolution - 11 * (resolution / 15)) / 2;
      drawDigit(h[0], sx, sy); drawDigit(h[1], sx + 4 * (resolution / 15), sy);
      drawDigit(m[0], sx, sy + 6 * (resolution / 15)); drawDigit(m[1], sx + 4 * (resolution / 15), sy + 6 * (resolution / 15));
      if (Math.floor(time / 500) % 2 === 0) offCtx.fillRect(sx + 3 * (resolution / 15), sy + 5 * (resolution / 15), Math.max(1, resolution / 15), Math.max(1, resolution / 15));

    } else if (currentRenderTab === 'synth') {
      if (synthEngineMode === 'texture') {
        const imgDataSynth = offCtx.createImageData(resolution, resolution);
        const cfg = allSynthConfigRef.current[synthMode];
        const getMod = (p, b, s = 1) => { const mod = cfg.links[p]; return mod === 'time' ? b + (time * 0.001) * s : mod === 'lfo' ? b + Math.sin(time * 0.002) * s : b; };

        const sScale = getMod('scale', cfg.params.scale, 2); const sOffset = getMod('speed', cfg.params.speed, 2); 
        const sPanX = getMod('offsetX', cfg.params.offsetX, 5); const sPanY = getMod('offsetY', cfg.params.offsetY, 5);
        const sThresh = getMod('threshold', cfg.params.threshold, 0.4); const sWarp = getMod('warp', cfg.params.warp, 3); const sInt = getMod('intensity', cfg.params.intensity, 4);

        for(let y=0; y<resolution; y++){
          for(let x=0; x<resolution; x++){
            let u = (x / resolution) * sScale + sPanX; let v = (y / resolution) * sScale + sPanY;
            if (sWarp > 0) { u += Math.sin(v * 5 + sOffset) * sWarp; v += Math.cos(u * 5 - sOffset) * sWarp; }
            let val = synthMode === 'noise' ? noise2D(u, v + sOffset) : synthMode === 'voronoi' ? voronoi(u + sOffset, v) : (Math.sin(Math.sqrt(u*u + v*v) * 10 - sOffset * 5) + 1) / 2;
            if (sThresh > 0.05 && sThresh < 0.95) { const e0 = sThresh - 0.1; const e1 = sThresh + 0.1; const t = Math.max(0, Math.min(1, (val - e0) / (e1 - e0))); val = t * t * (3 - 2 * t); }
            val = Math.max(0, Math.min(1, val * sInt));
            const c = val * 255; const idx = (y * resolution + x) * 4;
            imgDataSynth.data[idx] = c; imgDataSynth.data[idx+1] = c; imgDataSynth.data[idx+2] = c; imgDataSynth.data[idx+3] = 255;
          }
        }
        offCtx.putImageData(imgDataSynth, 0, 0);

      } else if (synthEngineMode === 'audio') {
        if (isAutoVj) {
            const msPerBeat = 60000 / Math.max(60, Math.min(200, bState.bpm || 120)); 
            if (autoVjState.current.forceNextSwitch || (bState.pulse > 0.85 && time - autoVjState.current.lastSwitch > msPerBeat * 4)) {
                autoVjState.current.forceNextSwitch = false; autoVjState.current.lastSwitch = time;
                autoVjState.current.prevMode = autoVjState.current.mode; autoVjState.current.transitionPulse = 1.0; 
                let newMode = VJ_MODES[Math.floor(Math.random() * VJ_MODES.length)];
                while (newMode === autoVjState.current.mode) newMode = VJ_MODES[Math.floor(Math.random() * VJ_MODES.length)];
                autoVjState.current.mode = newMode;
            }
        }

        const activeFxMode = isAutoVj ? autoVjState.current.mode : audioFxMode;
        
        const aAmp = 1.0 + (globalBass * 1.5);
        const aThick = 1.0 + (globalMid * 1.0);
        const aComp = 2.0 + (globalHigh * 5.0) + (Math.sin(time * 0.001) * 2.0); 
        const aGlow = 0.5 + (globalHigh * 2.0);

        const dynamicGlow = Math.min(1.5, aGlow + (beatGlow * 0.4) + (spectralFlux * 0.5));
        const baseThick = Math.max(1, aThick * (resolution * 0.05));

        offCtx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, dynamicGlow)})`; offCtx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, dynamicGlow)})`;
        offCtx.lineWidth = baseThick; offCtx.lineCap = 'round'; offCtx.lineJoin = 'round';

        const animTime = time * speedMult; const cx = resolution/2, cy = resolution/2;

        const drawAudioFx = (mode) => {
            if (mode === 'oscilloscope' && dataArray) {
                offCtx.beginPath(); const step = Math.floor(bufferLength / resolution);
                for(let i=0; i<=resolution; i++) {
                    const val = getAudioVal(Math.min(i * step, bufferLength - 1));
                    const punch = Math.min(1.5, val * aAmp) * (resolution/2); 
                    const y = cy + ((punch + Math.sin((i/resolution) * Math.PI * aComp * 3 + animTime * 0.005) * baseThick * 2) * (i % 2 === 0 ? 1 : -1));
                    if (i===0) offCtx.moveTo(i, y); else offCtx.lineTo(i, Math.max(-resolution, Math.min(resolution*2, y)));
                }
                offCtx.stroke();
            } else if (mode === 'rings') {
                const rings = Math.floor(Math.max(1, aComp * 2)); offCtx.setLineDash([Math.max(1, resolution * 0.15), Math.max(1, resolution * 0.1)]);
                for(let i=0; i<rings; i++) {
                   const val = getAudioVal(Math.floor((i/rings)*(bufferLength/3))); 
                   const r = Math.max(0.1, (i + 1) * (resolution/(rings*2)) * Math.abs(aAmp) * (1 + val * 0.5));
                   const spin = animTime * 0.002 * aThick * (i % 2 === 0 ? 1 : -1);
                   offCtx.globalAlpha = Math.min(1, dynamicGlow * (0.3 + val)); offCtx.beginPath(); offCtx.arc(cx, cy, r, spin, Math.PI*2 + spin); offCtx.stroke();
                }
                offCtx.setLineDash([]); offCtx.globalAlpha = 1.0;
            } else if (mode === 'particles') {
                const count = Math.floor(Math.max(1, aComp * 8));
                for(let i=0; i<count; i++) {
                   const val = getAudioVal(Math.floor((i/count)*(bufferLength/2))); const angle = (i / count) * Math.PI * 2 + (animTime * 0.002 * aThick);
                   const dist = aAmp * (resolution * 0.25) * (i % 2 === 0 ? 1 : 0.6) * (1 + val * 0.5);
                   offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.2); offCtx.beginPath(); offCtx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, Math.max(1, aGlow * 1.5 * val * (resolution * 0.08)), 0, Math.PI*2); offCtx.fill();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'spectrum' && dataArray) {
                const points = Math.floor(Math.max(3, aComp * 4)); offCtx.beginPath();
                for(let i=0; i<=points; i++) {
                    const val = getAudioVal(Math.floor((i/points) * (bufferLength/2))); const r = Math.max(0.1, (resolution * 0.15) + Math.min(resolution*0.8, val * Math.abs(aAmp) * (resolution * 0.3)));
                    const angle = (i / points) * Math.PI * 2 + (animTime * 0.001);
                    if (i===0) offCtx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r); else offCtx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                }
                offCtx.closePath(); offCtx.stroke(); offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, Math.min(resolution/2, globalBass * Math.abs(aAmp) * resolution * 0.2)), 0, Math.PI*2); offCtx.fill();
            } else if (mode === 'fractal') {
                const sides = Math.floor(Math.max(3, aComp * 2));
                for(let i=0; i<3; i++) {
                    const val = getAudioVal(Math.floor((i/3)*(bufferLength/3))); const r = Math.max(0.1, (resolution * 0.4) * (1 - i*0.25) * (1 + Math.min(1.5, globalBass * aAmp * 0.5) + val*0.2));
                    const rot = animTime * 0.001 * (i%2===0?1:-1) + (globalMid * aComp);
                    offCtx.beginPath();
                    for(let j=0; j<=sides; j++) {
                        const angle = (j/sides) * Math.PI * 2 + rot;
                        if(j===0) offCtx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r); else offCtx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                    }
                    offCtx.stroke();
                }
            } else if (mode === 'grid' && dataArray) {
                const cols = Math.floor(Math.max(3, aComp * 1.5)) | 1; const spacing = resolution / cols;
                for(let x=0; x<cols; x++) {
                    for(let y=0; y<cols; y++) {
                        const val = getAudioVal(Math.floor(((x+y)/(cols*2)) * (bufferLength/2))); const size = Math.max(0.5, Math.min(spacing - 0.5, val * aAmp * spacing * 0.8));
                        const px = x * spacing + spacing/2; const py = y * spacing + spacing/2;
                        offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.2);
                        if (aThick > 2.5) offCtx.strokeRect(px - size/2, py - size/2, size, size); else { offCtx.beginPath(); offCtx.arc(px, py, size/2, 0, Math.PI*2); offCtx.fill(); }
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'laser' && dataArray) {
                const lines = Math.floor(Math.max(1, aComp * 2));
                for(let i=0; i<lines; i++) {
                    const val = getAudioVal(Math.floor((i/lines) * (bufferLength/3))); const safeAmp = Math.min(2.0, aAmp);
                    offCtx.globalAlpha = Math.min(1, val * dynamicGlow); offCtx.lineWidth = Math.max(1, baseThick * val * 3);
                    offCtx.beginPath(); offCtx.moveTo(0, cy + Math.sin(animTime*0.002 + i) * (resolution*0.4) * safeAmp); offCtx.lineTo(resolution, cy + Math.sin(animTime*0.002 + i) * (resolution*0.4) * safeAmp); offCtx.stroke();
                    offCtx.beginPath(); offCtx.moveTo(cx + Math.cos(animTime*0.0015 + i) * (resolution*0.4) * safeAmp, 0); offCtx.lineTo(cx + Math.cos(animTime*0.0015 + i) * (resolution*0.4) * safeAmp, resolution); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'tetris' && dataArray) {
                const cols = Math.floor(Math.max(3, aComp * 2)) | 1; const colWidth = resolution / cols; const centerCol = Math.floor(cols / 2);
                for(let i=0; i<cols; i++) {
                    const dist = Math.abs(i - centerCol); const val = getAudioVal(Math.floor((dist / centerCol) * (bufferLength/3)));
                    const dropY = (animTime * 0.003 * aThick + dist * (resolution * 0.5)) % (resolution * 1.5) - (resolution * 0.5);
                    const blockSize = Math.max(2, val * aAmp * (resolution/2));
                    const blockW = colWidth * 0.85; const blockX = i * colWidth + (colWidth - blockW)/2;
                    offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.2); offCtx.fillRect(blockX, dropY, blockW, blockSize);
                    if (i % 2 === 0) offCtx.fillRect(blockX + blockW*0.25, dropY + blockSize, blockW*0.5, blockW*0.5);
                }
                const gHeight = Math.min(resolution*0.6, globalBass * aAmp * (resolution * 0.4));
                offCtx.globalAlpha = Math.min(1, globalBass * dynamicGlow * 1.5); offCtx.fillRect(0, resolution - gHeight, resolution, gHeight); offCtx.globalAlpha = 1.0;
            } else if (mode === 'kaleidoscope' && dataArray) {
                const segments = Math.floor(Math.max(4, aComp * 2)); offCtx.translate(cx, cy); offCtx.rotate(animTime * 0.0005 * aThick); 
                for (let s = 0; s < segments; s++) {
                    offCtx.rotate((Math.PI * 2) / segments); offCtx.beginPath();
                    for (let i = 0; i < resolution/2; i++) {
                        const val = getAudioVal(Math.floor((i / (resolution/2)) * (bufferLength/4)));
                        const r = Math.max(0.1, i + Math.min(resolution*0.8, val * aAmp * (resolution * 0.3)));
                        const theta = (val * Math.PI / 4) * (s % 2 === 0 ? 1 : -1);
                        if (i===0) offCtx.moveTo(Math.cos(theta) * r, Math.sin(theta) * r); else offCtx.lineTo(Math.cos(theta) * r, Math.sin(theta) * r);
                    }
                    offCtx.globalAlpha = Math.min(1, getAudioVal(0) * dynamicGlow + 0.3); offCtx.lineWidth = Math.max(1, globalHigh * (resolution * 0.05)); offCtx.stroke();
                }
                offCtx.resetTransform(); offCtx.globalAlpha = 1.0;
            } else if (mode === 'launchpad' && dataArray) {
                const gridCells = Math.floor(Math.max(3, aComp * 2)) | 1; const cellW = resolution / gridCells; const centerP = Math.floor(gridCells / 2);
                for(let gx=0; gx<gridCells; gx++) {
                    for(let gy=0; gy<gridCells; gy++) {
                        const val = getAudioVal(Math.floor((Math.sqrt(Math.pow(gx-centerP, 2) + Math.pow(gy-centerP, 2)) / (Math.sqrt(centerP*centerP*2) || 1)) * (bufferLength / 3)));
                        if (val * Math.abs(aAmp) * 1.5 > 0.05) {
                            offCtx.globalAlpha = Math.min(1, val * Math.abs(aAmp) * 1.5 * dynamicGlow); const padSize = Math.max(1, cellW * (aThick > 1.5 ? 0.85 : 0.5));
                            offCtx.fillRect(gx * cellW + (cellW - padSize)/2, gy * cellW + (cellW - padSize)/2, padSize, padSize);
                        }
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'launchpad_eq' && dataArray) {
                const gridCells = Math.floor(Math.max(3, aComp * 2)) | 1; const cellW = resolution / gridCells; const centerP = Math.floor(gridCells / 2);
                for(let gx=0; gx<gridCells; gx++) {
                    const val = getAudioVal(Math.floor((Math.abs(gx - centerP) / centerP) * (bufferLength / 3))); const activeRows = Math.floor((val * Math.abs(aAmp) * 1.5 + 0.1) * gridCells);
                    for(let gy=0; gy<gridCells; gy++) {
                        if (gridCells - 1 - gy < activeRows) {
                            offCtx.globalAlpha = Math.min(1, dynamicGlow * 0.8 + (val * 0.5)); const padSize = Math.max(1, cellW * (aThick > 1.5 ? 0.85 : 0.5));
                            offCtx.fillRect(gx * cellW + (cellW - padSize)/2, gy * cellW + (cellW - padSize)/2, padSize, padSize);
                        }
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'launchpad_cross' && dataArray) {
                const gridCells = Math.floor(Math.max(3, aComp * 2)) | 1; const cellW = resolution / gridCells; const centerP = Math.floor(gridCells / 2);
                for(let gx=0; gx<gridCells; gx++) {
                    for(let gy=0; gy<gridCells; gy++) {
                        let active = false; let intensity = 0;
                        if (gx === centerP || gy === centerP) { if (globalBass * Math.abs(aAmp) * 1.5 > 0.1) { active = true; intensity = globalBass * Math.abs(aAmp) * 1.5; } }
                        if (gx === gy || gx === (gridCells - 1 - gy)) { if (globalMid * Math.abs(aAmp) * 1.5 > 0.1) { active = true; intensity = globalMid * Math.abs(aAmp) * 1.5; } }
                        if ((gx === 0 || gx === gridCells-1) && (gy === 0 || gy === gridCells-1)) { if (globalHigh * Math.abs(aAmp) * 1.5 > 0.15) { active = true; intensity = globalHigh * Math.abs(aAmp) * 1.5; } }
                        if (active) {
                            offCtx.globalAlpha = Math.min(1, intensity * dynamicGlow); const padSize = Math.max(1, cellW * (aThick > 1.5 ? 0.85 : 0.5));
                            offCtx.fillRect(gx * cellW + (cellW - padSize)/2, gy * cellW + (cellW - padSize)/2, padSize, padSize);
                        }
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'launchpad_pulse' && dataArray) {
                const gridCells = Math.floor(Math.max(3, aComp * 2)) | 1; const cellW = resolution / gridCells; const centerP = Math.floor(gridCells / 2);
                for(let gx=0; gx<gridCells; gx++) {
                    for(let gy=0; gy<gridCells; gy++) {
                        const ringDist = Math.max(Math.abs(gx-centerP), Math.abs(gy-centerP)); const val = getAudioVal(Math.floor((ringDist / centerP) * (bufferLength / 3)));
                        if (val * Math.abs(aAmp) > 0.15 && (Math.abs(gx-centerP) === ringDist || Math.abs(gy-centerP) === ringDist)) {
                            offCtx.globalAlpha = Math.min(1, val * Math.abs(aAmp) * dynamicGlow); const padSize = Math.max(1, cellW * (aThick > 1.5 ? 0.85 : 0.5));
                            offCtx.fillRect(gx * cellW + (cellW - padSize)/2, gy * cellW + (cellW - padSize)/2, padSize, padSize);
                        }
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'launchpad_split' && dataArray) {
                const gridCells = Math.floor(Math.max(3, aComp * 2)) | 1; const cellW = resolution / gridCells; const centerP = Math.floor(gridCells / 2);
                for(let gy=0; gy<gridCells; gy++) {
                    const val = getAudioVal(Math.floor((gy / gridCells) * (bufferLength / 2))); const pushAmount = Math.floor(val * Math.abs(aAmp) * centerP);
                    for(let gx=0; gx<gridCells; gx++) {
                        const dist = Math.abs(gx - centerP);
                        if (dist <= pushAmount && dist > pushAmount - (aThick * 2)) {
                            offCtx.globalAlpha = Math.min(1, val * dynamicGlow * 1.5); const padSize = Math.max(1, cellW * (aThick > 1.5 ? 0.85 : 0.5));
                            offCtx.fillRect(gx * cellW + (cellW - padSize)/2, gy * cellW + (cellW - padSize)/2, padSize, padSize);
                        }
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'supernova' && dataArray) {
                const beams = Math.floor(Math.max(8, aComp * 4));
                for(let i=0; i<beams; i++) {
                    const val = getAudioVal(Math.floor((i/beams)*(bufferLength/2))); const angle = (i / beams) * Math.PI * 2 + (animTime * 0.002 * (i%2===0?1:-1));
                    const length = (resolution * 0.1) + (val * Math.abs(aAmp) * resolution * 0.4);
                    offCtx.globalAlpha = Math.min(1, val * dynamicGlow); offCtx.lineWidth = Math.max(1, baseThick * val * 4);
                    offCtx.beginPath(); offCtx.moveTo(cx, cy); offCtx.lineTo(cx + Math.cos(angle)*length, cy + Math.sin(angle)*length); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'hyperspace' && dataArray) {
                const stars = Math.floor(Math.max(10, aComp * 5));
                for(let i=0; i<stars; i++) {
                    const val = getAudioVal(Math.floor(Math.random()*(bufferLength/2))); const angle = (i / stars) * Math.PI * 2 + (animTime * 0.001);
                    const zOffset = (animTime * 0.01 + i*(resolution/stars)) % resolution; const rStart = zOffset; const rEnd = Math.max(0.1, zOffset + (val * Math.abs(aAmp) * resolution * 0.3) + aThick);
                    offCtx.globalAlpha = Math.min(1, (zOffset/resolution) * dynamicGlow); offCtx.lineWidth = baseThick;
                    offCtx.beginPath(); offCtx.moveTo(cx + Math.cos(angle)*rStart, cy + Math.sin(angle)*rStart); offCtx.lineTo(cx + Math.cos(angle)*rEnd, cy + Math.sin(angle)*rEnd); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'dna_helix' && dataArray) {
                const strands = Math.floor(Math.max(10, aComp * 3)); const yStep = resolution / strands;
                for(let i=0; i<=strands; i++) {
                    const val = getAudioVal(Math.floor((i/strands)*(bufferLength/3))); const y = i * yStep; const offset = animTime * 0.003;
                    const x1 = cx + Math.sin(i*0.5 + offset) * (resolution*0.3 * aAmp) * (1+val); const x2 = cx + Math.sin(i*0.5 + offset + Math.PI) * (resolution*0.3 * aAmp) * (1+val);
                    offCtx.globalAlpha = Math.min(1, 0.3 + val * dynamicGlow);
                    offCtx.beginPath(); offCtx.arc(x1, y, Math.max(1, baseThick), 0, Math.PI*2); offCtx.fill();
                    offCtx.beginPath(); offCtx.arc(x2, y, Math.max(1, baseThick), 0, Math.PI*2); offCtx.fill();
                    if (i % 2 === 0) { offCtx.globalAlpha = Math.min(1, 0.1 + val * dynamicGlow * 0.5); offCtx.beginPath(); offCtx.moveTo(x1, y); offCtx.lineTo(x2, y); offCtx.stroke(); }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'hologram' && dataArray) {
                const r = Math.max(0.1, (resolution * 0.3) * Math.abs(aAmp) * (1 + getAudioVal(0)*0.5)); const rings = Math.floor(Math.max(3, aComp)); offCtx.globalAlpha = Math.min(1, dynamicGlow * 0.8);
                for(let i=0; i<rings; i++) {
                    const val = getAudioVal(Math.floor((i/rings)*(bufferLength/4)));
                    offCtx.beginPath(); offCtx.ellipse(cx, cy, Math.max(0.1, r * (1+val*0.2)), Math.max(0.1, r * Math.abs(Math.sin(animTime*0.001 + i*(Math.PI/rings)))), 0, 0, Math.PI*2); offCtx.stroke();
                    offCtx.beginPath(); offCtx.ellipse(cx, cy, Math.max(0.1, r * Math.abs(Math.cos(animTime*0.001 + i*(Math.PI/rings)))), Math.max(0.1, r * (1+val*0.2)), 0, 0, Math.PI*2); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'cyber_web' && dataArray) {
                const nodes = Math.floor(Math.max(5, aComp * 3)); let pts = [];
                for(let i=0; i<nodes; i++) {
                    const val = getAudioVal(Math.floor((i/nodes)*(bufferLength/2))); const angle = animTime * 0.001 * (i%2===0?1:-1) + (i*Math.PI*2/nodes);
                    const dist = (val * Math.abs(aAmp) * resolution * 0.4) + (resolution * 0.1); pts.push({x: cx + Math.cos(angle)*dist, y: cy + Math.sin(angle)*dist, v: val});
                }
                for(let i=0; i<pts.length; i++) {
                    offCtx.globalAlpha = Math.min(1, pts[i].v * dynamicGlow + 0.2); offCtx.beginPath(); offCtx.arc(pts[i].x, pts[i].y, Math.max(1, baseThick * 0.75), 0, Math.PI*2); offCtx.fill();
                    for(let j=i+1; j<pts.length; j++) {
                        const dx = pts[i].x - pts[j].x; const dy = pts[i].y - pts[j].y;
                        if (dx*dx + dy*dy < Math.pow(resolution*0.6, 2)) {
                            offCtx.globalAlpha = Math.min(1, (pts[i].v + pts[j].v) * dynamicGlow * 0.5);
                            offCtx.beginPath(); offCtx.moveTo(pts[i].x, pts[i].y); offCtx.lineTo(pts[j].x, pts[j].y); offCtx.stroke();
                        }
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'cymatics' && dataArray) {
                const waves = Math.floor(Math.max(3, aComp * 2));
                for(let i=0; i<waves; i++) {
                   const val = getAudioVal(Math.floor((i/waves)*(bufferLength/4))); const r = Math.max(0.1, (i * resolution/(waves*2)) + Math.abs(Math.sin(animTime*0.002 + i))*resolution*0.1 * Math.abs(aAmp));
                   offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.1); offCtx.beginPath(); offCtx.arc(cx,cy,r,0,Math.PI*2); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'lissajous_knot' && dataArray) {
                const points = 100; const a = 3, b = 2; const delta = animTime * 0.002 * aComp; offCtx.beginPath();
                for(let i=0; i<=points; i++) {
                    const t = (i / points) * Math.PI * 2; const val = getAudioVal(Math.floor((i/points)*(bufferLength/3)));
                    const x = cx + Math.sin(a * t + delta) * (resolution*0.35 * aAmp) * (1+val*0.5); const y = cy + Math.sin(b * t) * (resolution*0.35 * aAmp) * (1+val*0.5);
                    if (i===0) offCtx.moveTo(x,y); else offCtx.lineTo(x,y);
                }
                offCtx.globalAlpha = Math.min(1, dynamicGlow * (0.5 + globalBass)); offCtx.stroke(); offCtx.globalAlpha = 1.0;
            } else if (mode === 'radar_sweep' && dataArray) {
                const angle = (animTime * 0.002) % (Math.PI * 2);
                offCtx.globalAlpha = 0.3; offCtx.beginPath(); offCtx.moveTo(cx, cy); offCtx.arc(cx, cy, Math.max(0.1, resolution), angle - 0.5, angle, false); offCtx.lineTo(cx, cy); offCtx.fill();
                offCtx.globalAlpha = Math.min(1, dynamicGlow); offCtx.beginPath(); offCtx.moveTo(cx, cy); offCtx.lineTo(cx + Math.cos(angle)*resolution, cy + Math.sin(angle)*resolution); offCtx.stroke();
                const blips = Math.floor(Math.max(5, aComp * 3));
                for(let i=0; i<blips; i++) {
                    const val = getAudioVal(Math.floor((i/blips)*(bufferLength/2)));
                    if (val > 0.3) {
                        const dist = (i/blips) * (resolution*0.4) * Math.abs(aAmp); const bx = cx + Math.cos(angle - 0.1)*dist; const by = cy + Math.sin(angle - 0.1)*dist;
                        offCtx.beginPath(); offCtx.arc(bx, by, Math.max(0.1, baseThick * val * 3), 0, Math.PI*2); offCtx.fill();
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'barcode' && dataArray) {
                const bars = Math.floor(Math.max(5, aComp * 3)); const bW = resolution / bars;
                for(let i=0; i<bars; i++) {
                    const val = getAudioVal(Math.floor((i/bars)*(bufferLength/2)));
                    if (val > 0.1) {
                        offCtx.globalAlpha = Math.min(1, val * dynamicGlow * 1.5); const h = val * resolution * 0.8 * Math.abs(aAmp);
                        offCtx.fillRect(i*bW + bW*0.1, cy - h/2, bW*0.8, h);
                    }
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'audio_eclipse' && dataArray) {
                const r = Math.max(0.1, (resolution * 0.25) * Math.abs(aAmp));
                offCtx.globalAlpha = Math.min(1, globalBass * dynamicGlow * 1.5); offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, r * 1.1), 0, Math.PI*2); offCtx.fill();
                offCtx.globalCompositeOperation = 'destination-out'; offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI*2); offCtx.fill(); offCtx.globalCompositeOperation = 'source-over';
                const rays = Math.floor(Math.max(12, aComp * 5));
                for(let i=0; i<rays; i++) {
                    const val = getAudioVal(Math.floor((i/rays)*(bufferLength/3))); const angle = (i/rays) * Math.PI*2 + animTime*0.001; const rayL = r + (val * resolution * 0.2);
                    offCtx.globalAlpha = Math.min(1, val * dynamicGlow); offCtx.beginPath(); offCtx.moveTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r); offCtx.lineTo(cx + Math.cos(angle)*rayL, cy + Math.sin(angle)*rayL); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'quantum_foam' && dataArray) {
                const bubbles = Math.floor(Math.max(5, aComp * 4));
                for(let i=0; i<bubbles; i++) {
                    const val = getAudioVal(Math.floor((i/bubbles)*(bufferLength/2))); const bx = cx + Math.sin(animTime*0.001 + i*1.2) * (resolution*0.4); const by = cy + Math.cos(animTime*0.0013 + i*0.8) * (resolution*0.4);
                    const br = Math.max(1, (val * resolution * 0.2 * Math.abs(aAmp)) + baseThick);
                    offCtx.globalAlpha = Math.min(1, val * dynamicGlow); offCtx.beginPath(); offCtx.arc(bx, by, br, 0, Math.PI*2); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'vortex_tunnel' && dataArray) {
                const polys = Math.floor(Math.max(3, aComp * 2));
                for(let i=0; i<polys; i++) {
                    const val = getAudioVal(Math.floor((i/polys)*(bufferLength/3))); const scale = ((animTime * 0.002 + i*(1/polys)) % 1.0);
                    const r = Math.max(0.1, scale * (resolution * 0.8) * Math.abs(aAmp)); const rot = scale * Math.PI + (val * 0.5);
                    offCtx.globalAlpha = Math.min(1, (1-scale) * dynamicGlow * (0.5+val)); offCtx.beginPath();
                    for(let s=0; s<4; s++) { 
                        const angle = (s/4) * Math.PI*2 + rot;
                        if(s===0) offCtx.moveTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r); else offCtx.lineTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r);
                    }
                    offCtx.closePath(); offCtx.stroke();
                }
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'solar_flare' && dataArray) {
                const edges = ['top', 'bottom', 'left', 'right'];
                edges.forEach((edge, idx) => {
                    const val = getAudioVal(Math.floor((idx/4)*(bufferLength/4))); offCtx.globalAlpha = Math.min(1, val * dynamicGlow * 1.5); const thick = val * resolution * 0.3 * Math.abs(aAmp);
                    if(edge==='top') offCtx.fillRect(0, 0, resolution, thick); if(edge==='bottom') offCtx.fillRect(0, resolution-thick, resolution, thick);
                    if(edge==='left') offCtx.fillRect(0, 0, thick, resolution); if(edge==='right') offCtx.fillRect(resolution-thick, 0, thick, resolution);
                });
                offCtx.globalAlpha = 1.0;
            } else if (mode === 'neon_heartbeat' && dataArray) {
                offCtx.beginPath();
                for(let x=0; x<=resolution; x++) {
                    const isCenter = x > resolution*0.4 && x < resolution*0.6; const val = isCenter ? getAudioVal(0) : getAudioVal(Math.floor((x/resolution)*(bufferLength/2)));
                    const spike = isCenter ? Math.sin((x-resolution*0.4)*Math.PI*5) * (val * resolution*0.4 * Math.abs(aAmp)) : 0; const y = cy + spike;
                    if(x===0) offCtx.moveTo(x,y); else offCtx.lineTo(x,y);
                }
                offCtx.globalAlpha = Math.min(1, dynamicGlow * (0.5 + globalBass)); offCtx.stroke(); offCtx.globalAlpha = 1.0;
            } else if (mode === 'fractal_tree' && dataArray) {
                const drawBranch = (x, y, len, angle, depth) => {
                    if (depth === 0) return; const nx = x + Math.cos(angle) * len; const ny = y + Math.sin(angle) * len;
                    const val = getAudioVal(Math.floor((depth/4)*(bufferLength/3))); offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.2);
                    offCtx.beginPath(); offCtx.moveTo(x,y); offCtx.lineTo(nx,ny); offCtx.stroke();
                    drawBranch(nx, ny, len * 0.7, angle - 0.5 - (val*0.5), depth - 1); drawBranch(nx, ny, len * 0.7, angle + 0.5 + (val*0.5), depth - 1);
                };
                drawBranch(cx, resolution, resolution*0.25 * Math.abs(aAmp), -Math.PI/2, Math.floor(Math.max(2, aComp))); offCtx.globalAlpha = 1.0;
            } else if (mode === 'glitch_blocks' && dataArray) {
                const blocks = Math.floor(Math.max(4, aComp * 3));
                for(let i=0; i<blocks; i++) {
                    const val = getAudioVal(Math.floor((i/blocks)*(bufferLength/2)));
                    if (val > 0.2) {
                        const bw = (Math.random() * resolution * 0.2 + (resolution * 0.05)) * Math.abs(aAmp); const bh = (Math.random() * resolution * 0.2 + (resolution * 0.05)) * Math.abs(aAmp);
                        const bx = Math.random() * resolution; const by = Math.random() * resolution;
                        offCtx.globalAlpha = Math.min(1, val * dynamicGlow * 1.5); offCtx.fillRect(bx, by, bw, bh);
                    }
                }
                offCtx.globalAlpha = 1.0;
            }
        };

        if (isAutoVj && autoVjState.current.transitionPulse > 0.01) {
            const tp = autoVjState.current.transitionPulse; 
            if (tp > 0.5) {
                const easeOut = (1.0 - tp) * 2.0; 
                offCtx.save(); offCtx.translate(resolution/2, resolution/2); offCtx.scale(1, Math.cos(easeOut * Math.PI / 2)); offCtx.translate(-resolution/2, -resolution/2);
                drawAudioFx(autoVjState.current.prevMode); offCtx.restore();
            } else {
                const easeIn = tp * 2.0; 
                offCtx.save(); offCtx.translate(resolution/2, resolution/2); offCtx.scale(1, Math.cos(easeIn * Math.PI / 2)); offCtx.translate(-resolution/2, -resolution/2);
                drawAudioFx(autoVjState.current.mode); offCtx.restore();
            }
            autoVjState.current.transitionPulse = Math.max(0, tp - 0.015 * speedMult);
        } else {
            drawAudioFx(activeFxMode);
        }

        const timeNow = performance.now();
        offCtx.save();
        offCtx.globalCompositeOperation = 'lighter'; 
        
        for (let i = padTriggersRef.current.length - 1; i >= 0; i--) {
            const trig = padTriggersRef.current[i];
            const age = timeNow - trig.birth;
            const duration = trig.type === 'smooth_ripple' ? 1800 : 600; 
            
            if (age > duration) {
                padTriggersRef.current.splice(i, 1);
                continue;
            }

            const progress = age / duration;
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const alpha = 1 - progress; 

            const px = (trig.col + 0.5) * (resolution / 3) + padPanX;
            const py = (trig.row + 0.5) * (resolution / 3) + padPanY;

            offCtx.fillStyle = `rgba(255,255,255,${alpha})`;
            offCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
            const currentLineWidth = Math.max(1, resolution * 0.05);
            offCtx.lineWidth = currentLineWidth;

            if (trig.type === 'pulse_ring') {
                const size = Math.max(1, easeOut * resolution * 0.6);
                offCtx.strokeRect(px - size/2, py - size/2, size, size);
            } else if (trig.type === 'cross_strike') {
                const length = easeOut * resolution;
                offCtx.fillRect(px - length/2, py - currentLineWidth/2, length, currentLineWidth);
                offCtx.fillRect(px - currentLineWidth/2, py - length/2, currentLineWidth, length);
            } else if (trig.type === 'x_strike') {
                const length = easeOut * resolution * 0.6;
                offCtx.beginPath();
                offCtx.moveTo(px - length, py - length); offCtx.lineTo(px + length, py + length);
                offCtx.moveTo(px + length, py - length); offCtx.lineTo(px - length, py + length);
                offCtx.stroke();
            } else if (trig.type === 'ripple_fill') {
                const size = easeOut * resolution * 0.5;
                offCtx.fillRect(px - size/2, py - size/2, size, size);
            } else if (trig.type === 'smooth_ripple') {
                const numRings = 3;
                for(let r=0; r<numRings; r++) {
                    const ringProg = progress - (r * 0.15);
                    if (ringProg > 0 && ringProg < 1) {
                        const rEase = 1 - Math.pow(1 - ringProg, 2.5);
                        const rSize = rEase * resolution * 0.8;
                        const rAlpha = Math.pow(1 - ringProg, 1.5) * 0.8;
                        offCtx.strokeStyle = `rgba(255,255,255,${rAlpha})`;
                        offCtx.lineWidth = Math.max(1, resolution * 0.04 * (1 - ringProg));
                        offCtx.beginPath();
                        offCtx.arc(px, py, Math.max(0.1, rSize), 0, Math.PI * 2);
                        offCtx.stroke();
                    }
                }
                const centerAlpha = Math.max(0, 1 - progress * 6);
                if (centerAlpha > 0) {
                    offCtx.fillStyle = `rgba(255,255,255,${centerAlpha})`;
                    offCtx.beginPath();
                    offCtx.arc(px, py, Math.max(0.1, resolution * 0.12), 0, Math.PI * 2);
                    offCtx.fill();
                }
            }
        }
        offCtx.restore();
      }
    } else if (currentRenderTab === 'generative') {
      const cx = resolution / 2; const cy = resolution / 2;
      if (generativeMode === 'ringtone') {
        const maxRadius = resolution * 0.85; 
        const speed = time * 0.0006 * rippleSpeed; 
        const numRings = rippleCount;
        
        offCtx.lineWidth = Math.max(1, resolution * rippleThickness);
        
        for (let i = 0; i < numRings; i++) {
          let progress = ((speed + (i / numRings)) % 1.0); 
          const currentRadius = progress * maxRadius;
          const alpha = Math.sin(progress * Math.PI); 
          
          offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, currentRadius), 0, Math.PI * 2);
          offCtx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; offCtx.stroke();
        }
        
        if (rippleCenterPulse) {
          const centerPulse = Math.pow(Math.sin(time * 0.001 * rippleSpeed), 2) * 0.8;
          offCtx.fillStyle = `rgba(255, 255, 255, ${centerPulse})`;
          offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, resolution * 0.15), 0, Math.PI * 2); offCtx.fill();
        }

      } else if (generativeMode === 'hourglass') {
        const sim = sandSimRef.current;
        if (sim && sim.grid && sim.res === resolution) {
          const gridCx = Math.floor(resolution / 2); const gridCy = Math.floor(resolution / 2);
          if (sim.lastTime === null) sim.lastTime = time;
          const dt = Math.min((time - sim.lastTime) / 1000, 0.1); 
          sim.lastTime = time;

          if (sim.droppedCount < sim.sandCount) {
            const dropRate = sim.sandCount / Math.max(1, sim.duration);
            sim.dropsPending += dt * dropRate;
          }

          const grid = sim.grid; const res = sim.res;
          for (let y = res - 2; y >= 1; y--) {
            const xs = Array.from({length: res}, (_, i) => i).sort(() => Math.random() - 0.5);
            for (let x of xs) {
              const idx = y * res + x;
              if (grid[idx] === 1) {
                const down = (y + 1) * res + x;
                const downLeft = (y + 1) * res + (x - 1); const downRight = (y + 1) * res + (x + 1);

                const tryMove = (targetY, targetX, targetIdx) => {
                  if (grid[targetIdx] !== 0) return false; 
                  if (targetY === gridCy && targetX === gridCx && y < gridCy) {
                     if (sim.dropsPending >= 1) {
                        grid[targetIdx] = 1; grid[idx] = 0;
                        sim.dropsPending -= 1; sim.droppedCount++;
                        return true;
                     }
                     return false; 
                  }
                  grid[targetIdx] = 1; grid[idx] = 0;
                  return true;
                };

                if (tryMove(y + 1, x, down)) continue;
                const canLeft = x > 0 && grid[downLeft] === 0;
                const canRight = x < res - 1 && grid[downRight] === 0;

                if (canLeft && canRight) {
                  if (Math.random() > 0.5) { if (tryMove(y + 1, x - 1, downLeft)) continue; tryMove(y + 1, x + 1, downRight); } 
                  else { if (tryMove(y + 1, x + 1, downRight)) continue; tryMove(y + 1, x - 1, downLeft); }
                } 
                else if (canLeft) tryMove(y + 1, x - 1, downLeft);
                else if (canRight) tryMove(y + 1, x + 1, downRight);
              }
            }
          }

          for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
              const val = grid[y * res + x];
              if (val === 1) { offCtx.fillStyle = 'white'; offCtx.fillRect(x, y, 1, 1); } 
              else if (val === 3) { offCtx.fillStyle = 'rgba(255, 255, 255, 0.2)'; offCtx.fillRect(x, y, 1, 1); }
            }
          }
        }
      } else if (generativeMode === 'moonphase') {
        const phase = (time * 0.001) % (Math.PI * 2); const r = resolution * 0.4;
        offCtx.fillStyle = 'white'; offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2); offCtx.fill();
        offCtx.fillStyle = 'black';
        const offset = Math.sin(phase) * r * 2;
        offCtx.beginPath(); offCtx.arc(cx + offset, cy, Math.max(0.1, r), 0, Math.PI * 2); offCtx.fill();
      } else if (generativeMode === 'glyph_progress') {
        const slowTime = time * 0.001; 
        const baseRotation = slowTime * 1.8; 
        const rawPulse = (Math.sin(slowTime * 2.2) + 1) / 2; 
        const smoothPulse = rawPulse * rawPulse * (3 - 2 * rawPulse); 
        const arcLength = (Math.PI * 0.2) + (smoothPulse * Math.PI * 1.6); 

        offCtx.lineCap = 'round';
        offCtx.beginPath(); 
        offCtx.arc(cx, cy, Math.max(0.1, resolution * 0.35), baseRotation, baseRotation + arcLength, false); 
        offCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; 
        offCtx.lineWidth = resolution * 0.2; 
        offCtx.stroke();

        offCtx.beginPath(); 
        offCtx.arc(cx, cy, Math.max(0.1, resolution * 0.35), baseRotation, baseRotation + arcLength, false); 
        offCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; 
        offCtx.lineWidth = Math.max(0.5, resolution * 0.05); 
        offCtx.stroke();
      } else if (generativeMode === 'lava') {
        const metaballs = [
          { x: cx + Math.sin(time * 0.001) * resolution * 0.3, y: cy + Math.cos(time * 0.0013) * resolution * 0.3, r: resolution * 0.4 },
          { x: cx + Math.sin(time * 0.0015) * resolution * 0.2, y: cy + Math.cos(time * 0.0009) * resolution * 0.4, r: resolution * 0.3 },
          { x: cx + Math.cos(time * 0.0011) * resolution * 0.3, y: cy + Math.sin(time * 0.0017) * resolution * 0.2, r: resolution * 0.5 }
        ];
        const imgData = offCtx.createImageData(resolution, resolution);
        for(let y=0; y<resolution; y++){
          for(let x=0; x<resolution; x++){
            let sum = 0;
            metaballs.forEach(mb => {
              const dx = x - mb.x; const dy = y - mb.y;
              sum += (mb.r * mb.r) / (dx*dx + dy*dy + 0.01);
            });
            if (sum > 1.2) {
              const idx = (y * resolution + x) * 4;
              imgData.data[idx] = 255; imgData.data[idx+1] = 255; imgData.data[idx+2] = 255; imgData.data[idx+3] = 255;
            }
          }
        }
        offCtx.putImageData(imgData, 0, 0);
      } else if (generativeMode === 'reaction') {
        const imgDataRD = offCtx.createImageData(resolution, resolution);
        for(let y=0; y<resolution; y++){
          for(let x=0; x<resolution; x++){
            const u = x / resolution; const v = y / resolution;
            const t = time * 0.0005;
            const v1 = Math.sin(u * 10 + t) + Math.cos(v * 10 + t);
            const v2 = Math.sin(u * 20 - t * 1.5) + Math.cos(v * 20 - t * 0.8);
            const v3 = Math.sin((u+v) * 15 + t * 2);
            const sum = v1 + v2 * 0.5 + v3 * 0.5;
            const smoothVal = Math.min(1, Math.abs(Math.sin(sum * 2)) * 2) * 255;
            const idx = (y * resolution + x) * 4;
            imgDataRD.data[idx] = smoothVal; imgDataRD.data[idx+1] = smoothVal; imgDataRD.data[idx+2] = smoothVal; imgDataRD.data[idx+3] = 255;
          }
        }
        offCtx.putImageData(imgDataRD, 0, 0);
      } else if (generativeMode === 'starfield') {
        if (!starsRef.current || starsRef.current.length === 0) {
            starsRef.current = Array.from({length: 60}, () => ({
                x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200, z: Math.random() * 200
            }));
        }
        offCtx.fillStyle = 'white';
        starsRef.current.forEach(star => {
            star.z -= 2; 
            if (star.z <= 0) { star.z = 200; star.x = (Math.random() - 0.5) * 200; star.y = (Math.random() - 0.5) * 200; }
            const px = cx + (star.x / star.z) * resolution;
            const py = cy + (star.y / star.z) * resolution;
            const size = Math.max(0.5, (1 - star.z / 200) * (resolution * 0.15));
            offCtx.fillRect(px, py, size, size);
        });
      } else if (generativeMode === 'matrix') {
        if (!matrixRainRef.current || matrixRainRef.current.length !== resolution) {
            matrixRainRef.current = Array.from({length: resolution}, () => ({
                y: Math.random() * -resolution, 
                speed: (0.1 + Math.random() * 0.4) * (resolution / 15), 
                length: (3 + Math.random() * 6) * (resolution / 15)
            }));
        }
        matrixRainRef.current.forEach((drop, x) => {
            if (x >= resolution) return;
            drop.y += drop.speed;
            if (drop.y - drop.length > resolution) {
                drop.y = Math.random() * -resolution;
                drop.speed = (0.1 + Math.random() * 0.4) * (resolution / 15);
                drop.length = (3 + Math.random() * 6) * (resolution / 15);
            }
            for (let i = 0; i < drop.length; i++) {
                const py = Math.floor(drop.y - i);
                if (py >= 0 && py < resolution) {
                    const alpha = 1 - (i / drop.length);
                    offCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    const drawSize = Math.max(1, Math.floor(resolution / 30));
                    offCtx.fillRect(x, py, drawSize, drawSize);
                }
            }
        });
      } else if (generativeMode === 'radar') {
        if (!radarPingsRef.current) radarPingsRef.current = [];
        const angle = (time * 0.0015) % (Math.PI * 2);
        if (Math.random() < 0.1) radarPingsRef.current.push({ x: Math.random() * resolution, y: Math.random() * resolution, life: 1.0 });
        
        offCtx.beginPath(); offCtx.moveTo(cx, cy); offCtx.arc(cx, cy, resolution, angle - 0.5, angle, false); offCtx.lineTo(cx, cy);
        offCtx.fillStyle = 'rgba(255, 255, 255, 0.2)'; offCtx.fill();
        
        offCtx.beginPath(); offCtx.moveTo(cx, cy); offCtx.lineTo(cx + Math.cos(angle)*resolution, cy + Math.sin(angle)*resolution);
        offCtx.strokeStyle = 'white'; offCtx.lineWidth = Math.max(1, resolution * 0.05); offCtx.stroke();
        
        for (let i = radarPingsRef.current.length - 1; i >= 0; i--) {
            let ping = radarPingsRef.current[i];
            ping.life -= 0.005;
            if (ping.life <= 0) radarPingsRef.current.splice(i, 1);
            else {
                let pingAngle = Math.atan2(ping.y - cy, ping.x - cx);
                if (pingAngle < 0) pingAngle += Math.PI * 2;
                let angleDiff = Math.abs(angle - pingAngle);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                
                let highlight = angleDiff < 0.15 ? 1 : 0;
                offCtx.fillStyle = `rgba(255, 255, 255, ${Math.max(ping.life * 0.3, highlight)})`;
                offCtx.beginPath(); offCtx.arc(ping.x, ping.y, Math.max(1, resolution * 0.05), 0, Math.PI*2); offCtx.fill();
            }
        }
      } else if (generativeMode === 'lissajous') {
        const A = resolution * 0.4; const B = resolution * 0.4;
        const a = 3; const b = 2; const delta = Math.PI / 2;
        offCtx.beginPath();
        for(let i=0; i<100; i++) {
            const t = (time * 0.001) - (i * 0.02);
            const x = cx + A * Math.sin(a * t + delta);
            const y = cy + B * Math.sin(b * t);
            if (i === 0) offCtx.moveTo(x, y);
            else offCtx.lineTo(x, y);
        }
        offCtx.strokeStyle = 'white'; offCtx.lineWidth = Math.max(1, resolution * 0.05); offCtx.lineCap = 'round'; offCtx.stroke();
      } else if (generativeMode === 'gol') {
        if (!golGridRef.current || golGridRef.current.length !== resolution * resolution || time - (golGridRef.current.lastUpdate || 0) > 150) {
            if (!golGridRef.current || golGridRef.current.length !== resolution * resolution) {
                golGridRef.current = new Uint8Array(resolution * resolution).map(() => Math.random() > 0.7 ? 1 : 0);
            } else {
                let newGrid = new Uint8Array(resolution * resolution);
                let aliveCount = 0;
                for (let y = 0; y < resolution; y++) {
                    for (let x = 0; x < resolution; x++) {
                        let neighbors = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nx = (x + dx + resolution) % resolution;
                                const ny = (y + dy + resolution) % resolution;
                                neighbors += golGridRef.current[ny * resolution + nx];
                            }
                        }
                        const idx = y * resolution + x;
                        const alive = golGridRef.current[idx];
                        if (alive && (neighbors === 2 || neighbors === 3)) { newGrid[idx] = 1; aliveCount++; }
                        else if (!alive && neighbors === 3) { newGrid[idx] = 1; aliveCount++; }
                        else newGrid[idx] = 0;
                    }
                }
                if (aliveCount < (resolution * resolution * 0.05)) {
                    newGrid = new Uint8Array(resolution * resolution).map(() => Math.random() > 0.7 ? 1 : 0);
                }
                golGridRef.current = newGrid;
            }
            golGridRef.current.lastUpdate = time;
        }
        offCtx.fillStyle = 'white';
        for(let i=0; i<golGridRef.current.length; i++) {
            if (golGridRef.current[i]) {
                const x = i % resolution; const y = Math.floor(i / resolution);
                offCtx.fillRect(x, y, 1, 1);
            }
        }
      }
    } else if (currentRenderTab === 'media' && videoRef.current) {
      const media = videoRef.current;
      const isVideo = media.tagName === 'VIDEO';
      const isReady = isVideo ? media.readyState >= 2 : (media.complete && media.naturalWidth !== 0);
      
      if (isReady) {
          const mWidth = isVideo ? media.videoWidth : media.naturalWidth;
          const mHeight = isVideo ? media.videoHeight : media.naturalHeight;
          const mAspect = (mWidth / mHeight) || 1;
          
          let currentScale = mediaScale;
          if (audioSyncMode === 'zoom' && !isAudioIdle) currentScale += (globalBass * 0.5); 

          let drawW = resolution; let drawH = resolution;
          if (mAspect > 1) drawH = resolution / mAspect; else drawW = resolution * mAspect;

          offCtx.save();
          offCtx.translate(resolution / 2 + mediaPanX, resolution / 2 + mediaPanY);
          offCtx.rotate((mediaRotation * Math.PI) / 180);
          offCtx.scale(currentScale, currentScale);
          if (isWebcamActive) offCtx.scale(-1, 1);

          offCtx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);
          offCtx.restore();

          if (audioSyncMode === 'flash' && !isAudioIdle) {
              offCtx.save(); offCtx.fillStyle = `rgba(255,255,255, ${Math.min(0.8, globalBass * 0.6)})`;
              offCtx.globalCompositeOperation = 'lighter'; offCtx.fillRect(0, 0, resolution, resolution); offCtx.restore();
          }
      }
    } else if (currentRenderTab === 'audio') {
      const cx = resolution / 2; const cy = resolution / 2;
      const aAmp = 1.0 + (globalBass * 1.5);
      const aThick = 1.0 + (globalMid * 1.0);
      const dynamicGlow = Math.min(1.5, 0.5 + (globalHigh * 2.0) + (beatGlow * 0.4));
      
      offCtx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, dynamicGlow)})`;
      offCtx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, dynamicGlow)})`;
      offCtx.lineWidth = Math.max(1, aThick * (resolution * 0.05));
      offCtx.lineCap = 'round';

      const animTime = time * speedMult;

      if (audioAnimMode === 'bars') {
        const bars = Math.floor(resolution / 2) || 1;
        const bW = resolution / bars;
        for (let i = 0; i < bars; i++) {
          const val = getAudioVal(Math.floor((i / bars) * (bufferLength / 2)));
          const h = val * resolution * 0.8 * Math.abs(aAmp);
          offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.2);
          offCtx.fillRect(i * bW + bW * 0.1, resolution - h, bW * 0.8, h);
        }
      } else if (audioAnimMode === 'wave') {
        offCtx.beginPath();
        for (let x = 0; x <= resolution; x++) {
          const val = getAudioVal(Math.floor((x / resolution) * (bufferLength / 2)));
          const y = cy + Math.sin(x * 0.5 + animTime * 0.005) * (val * resolution * 0.5 * Math.abs(aAmp));
          if (x === 0) offCtx.moveTo(x, y); else offCtx.lineTo(x, y);
        }
        offCtx.stroke();
      } else if (audioAnimMode === 'radial') {
        const points = Math.max(10, Math.floor(resolution * 1.5));
        offCtx.beginPath();
        for (let i = 0; i <= points; i++) {
          const val = getAudioVal(Math.floor((i / points) * (bufferLength / 3)));
          const r = Math.max(0.1, (resolution * 0.2) + (val * resolution * 0.3 * Math.abs(aAmp)));
          const angle = (i / points) * Math.PI * 2 + animTime * 0.001;
          if (i === 0) offCtx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
          else offCtx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        }
        offCtx.closePath(); offCtx.stroke();
        offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, globalBass * resolution * 0.15 * Math.abs(aAmp)), 0, Math.PI * 2); offCtx.fill();
      } else if (audioAnimMode === 'particles') {
        const count = Math.max(5, Math.floor(resolution));
        for (let i = 0; i < count; i++) {
          const val = getAudioVal(Math.floor((i / count) * (bufferLength / 2)));
          const angle = (i / count) * Math.PI * 2 + animTime * 0.002;
          const dist = (resolution * 0.1) + (val * resolution * 0.4 * Math.abs(aAmp));
          offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.1);
          offCtx.beginPath(); offCtx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, Math.max(0.5, val * resolution * 0.08), 0, Math.PI * 2); offCtx.fill();
        }
      } else if (audioAnimMode === 'liquid') {
         offCtx.beginPath();
         for(let x = 0; x <= resolution; x++) {
            const val = getAudioVal(Math.floor((x / resolution) * (bufferLength / 2)));
            const y = resolution - (val * resolution * 0.6 * Math.abs(aAmp)) - (Math.sin(x * 0.3 + animTime * 0.003) * resolution * 0.1 * globalMid);
            if (x === 0) offCtx.moveTo(x, resolution);
            if (x === 0) offCtx.lineTo(x, y); else offCtx.lineTo(x, y);
         }
         offCtx.lineTo(resolution, resolution); offCtx.closePath();
         offCtx.globalAlpha = Math.min(1, dynamicGlow * 0.8); offCtx.fill();
      } else if (audioAnimMode === 'split') {
         const bars = Math.floor(resolution / 2) || 1;
         const bW = resolution / bars;
         for (let i = 0; i < bars; i++) {
           const val = getAudioVal(Math.floor((i / bars) * (bufferLength / 2)));
           const h = val * resolution * 0.4 * Math.abs(aAmp);
           offCtx.globalAlpha = Math.min(1, val * dynamicGlow + 0.2);
           offCtx.fillRect(i * bW + bW * 0.1, cy - h, bW * 0.8, h * 2);
         }
      } else if (audioAnimMode === 'vortex') {
         const arms = 4;
         for(let a = 0; a < arms; a++) {
            offCtx.beginPath();
            const segments = Math.floor(resolution);
            for(let i = 0; i < segments; i++) {
               const val = getAudioVal(Math.floor((i / segments) * (bufferLength / 3)));
               const r = (i / segments) * resolution * 0.5;
               const angle = (a / arms) * Math.PI * 2 + (i * 0.2) + animTime * 0.002;
               const px = cx + Math.cos(angle) * r; const py = cy + Math.sin(angle) * r;
               offCtx.lineWidth = Math.max(1, val * resolution * 0.05 * Math.abs(aAmp));
               if(i === 0) offCtx.moveTo(px, py); else offCtx.lineTo(px, py);
            }
            offCtx.globalAlpha = Math.min(1, dynamicGlow); offCtx.stroke();
         }
      } else if (audioAnimMode === 'pulse') {
         const r = Math.max(0.1, globalBass * resolution * 0.35 * Math.abs(aAmp));
         offCtx.globalAlpha = Math.min(1, dynamicGlow * 1.2);
         offCtx.beginPath(); offCtx.arc(cx, cy, r, 0, Math.PI * 2); offCtx.fill();
         offCtx.globalAlpha = Math.min(1, dynamicGlow * 0.5);
         offCtx.beginPath(); offCtx.arc(cx, cy, Math.max(0.1, r * 1.5), 0, Math.PI * 2); offCtx.stroke();
      }
      offCtx.globalAlpha = 1.0;
    }

    if (glitchState.current.trails) {
        if (!trailCanvasRef.current || trailCanvasRef.current.width !== resolution) {
            trailCanvasRef.current = document.createElement('canvas');
            trailCanvasRef.current.width = resolution; trailCanvasRef.current.height = resolution;
        }
        const tCtx = trailCanvasRef.current.getContext('2d', { willReadFrequently: true });
        tCtx.fillStyle = 'rgba(0, 0, 0, 0.15)'; tCtx.fillRect(0, 0, resolution, resolution);
        tCtx.globalCompositeOperation = 'lighter'; tCtx.drawImage(offscreen, 0, 0); tCtx.globalCompositeOperation = 'source-over';
        offCtx.clearRect(0, 0, resolution, resolution); offCtx.drawImage(trailCanvasRef.current, 0, 0);
    } else {
        if (trailCanvasRef.current && trailCanvasRef.current.width === resolution) {
            const tCtx = trailCanvasRef.current.getContext('2d', { willReadFrequently: true });
            tCtx.clearRect(0, 0, resolution, resolution); tCtx.drawImage(offscreen, 0, 0);
        }
    }

    if (glitchState.current.smoothWarp) {
        const temp = document.createElement('canvas'); temp.width = resolution; temp.height = resolution;
        const tCtx = temp.getContext('2d', { willReadFrequently: true }); tCtx.drawImage(offscreen, 0, 0);
        offCtx.clearRect(0,0,resolution,resolution);
        for(let i=4; i>=0; i--) {
            offCtx.save(); offCtx.translate(resolution/2, resolution/2);
            const pulse = (rawTime * 0.0015 + i * 0.25) % 1.0; const scale = 1.0 + (pulse * 1.5);
            offCtx.scale(scale, scale); offCtx.rotate(pulse * 0.5 * (i % 2 === 0 ? 1 : -1)); offCtx.translate(-resolution/2, -resolution/2);
            offCtx.globalAlpha = i === 0 ? 1.0 : Math.max(0, 1.0 - pulse);
            if (i > 0) offCtx.globalCompositeOperation = 'lighter';
            offCtx.drawImage(temp, 0, 0); offCtx.restore();
        }
    }

    if (glitchState.current.waveWarp) {
        const temp = document.createElement('canvas'); temp.width = resolution; temp.height = resolution;
        const tCtx = temp.getContext('2d', { willReadFrequently: true }); tCtx.drawImage(offscreen, 0, 0);
        offCtx.clearRect(0,0,resolution,resolution);
        for (let y = 0; y < resolution; y++) {
            const shift = Math.floor(Math.sin(y * 0.5 + rawTime * 0.02) * (resolution * 0.2));
            offCtx.drawImage(temp, 0, y, resolution, 1, shift, y, resolution, 1);
        }
    }

    if (glitchState.current.vhs) {
        const temp = document.createElement('canvas'); temp.width = resolution; temp.height = resolution;
        const tCtx = temp.getContext('2d', { willReadFrequently: true }); tCtx.drawImage(offscreen, 0, 0);
        offCtx.fillStyle = 'black'; offCtx.fillRect(0, 0, resolution, resolution);
        for(let i=0; i<10; i++) {
           const y = Math.random() * resolution; const h = Math.random() * (resolution / 4); const shift = (Math.random() - 0.5) * (resolution * 0.8);
           offCtx.drawImage(temp, 0, y, resolution, h, shift, y, resolution, h);
        }
    }

    if (glitchState.current.roll) {
        const rollOffset = Math.floor((rawTime * 0.03) % resolution);
        const temp = document.createElement('canvas'); temp.width = resolution; temp.height = resolution;
        const tCtx = temp.getContext('2d', { willReadFrequently: true }); tCtx.drawImage(offscreen, 0, 0);
        offCtx.clearRect(0,0,resolution,resolution); offCtx.drawImage(temp, 0, rollOffset); offCtx.drawImage(temp, 0, rollOffset - resolution);
    }

    if (glitchState.current.crush) {
        const crushRes = Math.max(2, Math.floor(resolution / 4));
        const temp = document.createElement('canvas'); temp.width = crushRes; temp.height = crushRes;
        const tCtx = temp.getContext('2d', { willReadFrequently: true }); tCtx.imageSmoothingEnabled = false; tCtx.drawImage(offscreen, 0, 0, crushRes, crushRes);
        offCtx.imageSmoothingEnabled = false; offCtx.clearRect(0,0,resolution,resolution);
        offCtx.drawImage(temp, 0, 0, crushRes, crushRes, 0, 0, resolution, resolution);
    }

    if (glitchState.current.strobe) {
        if (Math.floor(rawTime / 50) % 2 === 0) { offCtx.fillStyle = 'black'; offCtx.fillRect(0, 0, resolution, resolution); }
    }

    if (glitchState.current.kill) {
        offCtx.fillStyle = 'black'; offCtx.fillRect(0, 0, resolution, resolution);
    }

    const imageData = offCtx.getImageData(0, 0, resolution, resolution).data;
    ctx.clearRect(0, 0, width, height);

    if (!exportTransparentRef.current) {
      ctx.beginPath(); ctx.arc(width/2, height/2, Math.max(0.1, width/2 - 2), 0, Math.PI * 2);
      ctx.fillStyle = colors.bg; ctx.fill();
    }

    const margin = width * 0.08; 
    const drawWidth = width - margin * 2;
    const cellSize = drawWidth / resolution;
    const padding = cellSize * 0.12; 
    const drawSize = cellSize - padding * 2;
    const halfDrawSize = Math.max(0.1, drawSize / 2);
    const twoPi = Math.PI * 2;
    const drawRadius = drawWidth / 2;
    const maxDistSq = (drawRadius - cellSize / 2) * (drawRadius - cellSize / 2);

    const GLYPH_MASK_15 = [
      [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0], [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0], [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0], [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0], [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0], [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0], [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0], [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0]
    ];

    let validPixels = 0; 
    let activePixels = 0; 

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        if (resolution === 15) { 
            if (GLYPH_MASK_15[y][x] === 0) continue; 
        } else {
          const dx = (x + 0.5) * cellSize - drawRadius; const dy = (y + 0.5) * cellSize - drawRadius;
          if (dx * dx + dy * dy > maxDistSq) continue;
        }
        
        validPixels++;

        const cellX = margin + x * cellSize; const cellY = margin + y * cellSize;
        const i = (y * resolution + x) * 4;
        let brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / (3 * 255);

        if (currentRenderTab === 'media') {
            brightness = brightness * mediaBrightness;
            brightness = (brightness - 0.5) * mediaContrast + 0.5;
        }

        brightness = brightness * globalBrightness;
        brightness = (brightness - 0.5) * globalContrast + 0.5;
        brightness = Math.max(0, Math.min(1, brightness)); 

        if (glitchState.current.invert) {
            brightness = 1.0 - brightness;
        }

        if (currentRenderTab === 'media' && brightness > 0) {
            if (mediaFx === 'dither') {
                const threshold = (BAYER_MATRIX[y % 4][x % 4] + 0.5) / 16; brightness = brightness > threshold ? 1.0 : 0.0;
            } else if (mediaFx === 'edge') {
                const rightX = Math.min(x + 1, resolution - 1); const downY = Math.min(y + 1, resolution - 1);
                const iR = (y * resolution + rightX) * 4; const iD = (downY * resolution + x) * 4;
                const bRight = (imageData[iR] + imageData[iR+1] + imageData[iR+2]) / (3*255);
                const bDown = (imageData[iD] + imageData[iD+1] + imageData[iD+2]) / (3*255);
                const gradX = brightness - bRight; const gradY = brightness - bDown;
                brightness = Math.sqrt(gradX*gradX + gradY*gradY) > 0.15 ? 1.0 : 0.0;
            }
        }

        if (brightness > 0.1) {
          activePixels++; ctx.fillStyle = colors.lit; ctx.globalAlpha = brightness; 
          if (bloom) { ctx.shadowColor = colors.lit; ctx.shadowBlur = cellSize * 0.5; } else { ctx.shadowBlur = 0; }
        } else {
          ctx.fillStyle = colors.unlit; ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
        }

        if (dotShape === 'square') {
          ctx.fillRect(cellX + padding, cellY + padding, drawSize, drawSize);
        } else {
          ctx.beginPath(); ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, halfDrawSize, 0, twoPi); ctx.fill();
        }
        ctx.globalAlpha = 1.0; ctx.shadowBlur = 0; 
      }
    }
    
    if (isAutoVj && currentRenderTab === 'synth' && synthEngineMode === 'audio' && !isAudioIdle && (globalBass + globalMid + globalHigh) > 0.15) {
        const litRatio = validPixels > 0 ? (activePixels / validPixels) : 0;
        if (litRatio <= 0.02 || litRatio > 0.90) { 
            if (!autoVjState.current.badFramesStart) { autoVjState.current.badFramesStart = time; } 
            else if (time - autoVjState.current.badFramesStart > 700) { autoVjState.current.forceNextSwitch = true; autoVjState.current.badFramesStart = null; }
        } else { autoVjState.current.badFramesStart = null; }
    } else { autoVjState.current.badFramesStart = null; }
  }, [currentRenderTab, resolution, dotShape, textInput, textSpeed, fontFamily, textAnimation, generativeMode, colors, bloom, audioAnimMode, mediaBrightness, mediaContrast, mediaScale, mediaPanX, mediaPanY, mediaRotation, audioSyncMode, mediaFx, globalBrightness, globalContrast, rippleSpeed, rippleCount, rippleThickness, rippleCenterPulse, isWebcamActive, synthMode, synthEngineMode, audioFxMode, textScale, textPanX, textPanY, textWaveAmp, textWaveFreq, textWaveSpeed, textBlinkRate, typewriterCursor, decryptComplexity, cubeDistance, cubeSpeed, vhsFrequency, vhsIntensity, isAutoVj, audioSensitivity, isPlaying, audioFile, padPanX, padPanY, isVideoMedia]);

  const renderFrameRef = useRef(renderFrame);
  useEffect(() => { renderFrameRef.current = renderFrame; }, [renderFrame]);

  useEffect(() => {
    let frameId;
    const tick = (time) => { renderFrameRef.current(time); frameId = requestAnimationFrame(tick); };
    frameId = requestAnimationFrame(tick);
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, []);

  const handleMediaUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (isWebcamActive) { toggleWebcam(); } 
    setMediaFile(file); const url = URL.createObjectURL(file); const isVideo = file.type.startsWith('video');
    setIsVideoMedia(isVideo);

    let isNewElement = false;
    if (!videoRef.current || videoRef.current.tagName !== (isVideo ? 'VIDEO' : 'IMG')) {
      videoRef.current = document.createElement(isVideo ? 'video' : 'img');
      isNewElement = true;
    }

    videoRef.current.src = url;
    
    if (isVideo) {
      videoRef.current.loop = true; videoRef.current.muted = false; 
      videoRef.current.volume = volume; 

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser(); 
        analyserRef.current.fftSize = 256;
        audioDestRef.current = audioContextRef.current.createMediaStreamDestination();
      }

      if (isNewElement || !videoRef.current._hasAudioSource) {
        try {
          const vSource = audioContextRef.current.createMediaElementSource(videoRef.current);
          vSource.connect(analyserRef.current);
          vSource.connect(audioContextRef.current.destination); 
          vSource.connect(audioDestRef.current);                
          videoRef.current._hasAudioSource = true;
        } catch (err) {
          console.warn("Video audio routing failed", err);
        }
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      videoRef.current.ontimeupdate = () => setVideoProgress(videoRef.current.currentTime);
      videoRef.current.onloadedmetadata = () => setVideoDuration(videoRef.current.duration);
      videoRef.current.play().catch(err => console.error("Autoplay prevented:", err));
    }
    if (activeTab !== 'synth') setActiveTab('media'); 
    setIsPlaying(true); e.target.value = '';
  };

  const handleClearMedia = () => {
    if (isWebcamActive) {
      toggleWebcam();
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      setMediaFile(null);
      setIsVideoMedia(false);
    }
  };

  const handleVideoTimelineScrub = useCallback((val) => {
    if (videoRef.current && videoRef.current.tagName === 'VIDEO') { videoRef.current.currentTime = val; setVideoProgress(val); }
  }, []);

  const handleRestartVideo = () => {
    if (videoRef.current && videoRef.current.tagName === 'VIDEO') { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); if (!isPlaying) setIsPlaying(true); }
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setAudioFile(file); const url = URL.createObjectURL(file);
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url; audioRef.current.volume = volume;
    audioRef.current.ontimeupdate = () => setAudioProgress(audioRef.current.currentTime);
    audioRef.current.onloadedmetadata = () => setAudioDuration(audioRef.current.duration);

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser(); 
      analyserRef.current.fftSize = 256;
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      audioDestRef.current = audioContextRef.current.createMediaStreamDestination();
      sourceRef.current.connect(analyserRef.current); 
      analyserRef.current.connect(audioContextRef.current.destination); 
      sourceRef.current.connect(audioDestRef.current); 
    }

    prevDataArrayRef.current.peaks.fill(0); prevDataArrayRef.current.history.fill(0); beatState.current.history = []; beatState.current.pulse = 0;
    audioContextRef.current.resume(); audioRef.current.play().catch(err => console.error("Audio block:", err));
    
    if (activeTab !== 'synth') setActiveTab('audio'); 
    setIsPlaying(true); e.target.value = ''; 
  };

  const handleClearAudio = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; } setAudioFile(null); };

  const handleTimelineScrub = useCallback((val) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val; setAudioProgress(val);
      prevDataArrayRef.current.peaks.fill(0); prevDataArrayRef.current.history.fill(0); beatState.current.history = []; beatState.current.pulse = 0;
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    }
  }, []);

  const handleVolumeChange = useCallback((val) => { 
    setVolume(val); 
    if (audioRef.current) audioRef.current.volume = val; 
    if (videoRef.current && videoRef.current.tagName === 'VIDEO') videoRef.current.volume = val;
  }, []);

  const handleRestartAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      prevDataArrayRef.current.peaks.fill(0); prevDataArrayRef.current.history.fill(0); beatState.current.history = []; beatState.current.pulse = 0;
      audioContextRef.current?.resume(); audioRef.current.play().catch(() => {});
      if (!isPlaying) setIsPlaying(true);
    }
  };

  const executeImageExport = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const isJpeg = exportImgFormat === 'image/jpeg'; const prevTransparent = exportTransparentRef.current;
    if (isJpeg) exportTransparentRef.current = false;
    renderFrameRef.current(performance.now());
    let exportCanvas = canvas;
    if (exportScale !== 1) {
      exportCanvas = document.createElement('canvas'); exportCanvas.width = canvas.width * exportScale; exportCanvas.height = canvas.height * exportScale;
      const eCtx = exportCanvas.getContext('2d'); eCtx.scale(exportScale, exportScale); eCtx.drawImage(canvas, 0, 0);
    }
    const url = exportCanvas.toDataURL(exportImgFormat, 1.0); const ext = exportImgFormat.split('/')[1];
    const a = document.createElement('a'); a.href = url; a.download = `glyph-frame.${ext}`; a.click();
    exportTransparentRef.current = prevTransparent;
    setNotification(`Image exported as ${ext.toUpperCase()}`); setTimeout(() => setNotification(''), 3000); setIsExportModalOpen(false);
  };

const executeVideoExport = async (shouldRestart = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (shouldRestart) {
      if (audioRef.current && audioFile && (currentRenderTab === 'audio' || currentRenderTab === 'synth' || currentRenderTab === 'media')) {
          audioRef.current.currentTime = 0;
          if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
          audioRef.current.play().catch(e=>console.warn("Audio play failed on export", e));
      }
      if (videoRef.current && videoRef.current.tagName === 'VIDEO' && isVideoMedia && currentRenderTab === 'media') {
          videoRef.current.currentTime = 0;
          if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
          videoRef.current.play().catch(e=>console.warn("Video play failed on export", e));
      }
    }

    const canvasStream = canvas.captureStream(exportFps);
    const tracks = [...canvasStream.getVideoTracks()];

    if (exportAudio && audioDestRef.current) {
      const audioTracks = audioDestRef.current.stream.getAudioTracks();
      if (audioTracks.length > 0) tracks.push(audioTracks[0]);
    }

    const stream = new MediaStream(tracks);
    recordedChunksRef.current = [];

    try {
      // 1. ALWAYS record in WebM first (It's the only format Chrome gets 100% right)
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: exportBitrate });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        const webmBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const isMp4Requested = exportVidFormat.toLowerCase().includes('mp4');

        if (!isMp4Requested) {
           // Normal WebM export
           const url = URL.createObjectURL(webmBlob);
           const a = document.createElement('a');
           a.href = url; a.download = `matrix-studio-export-${Date.now()}.webm`; a.click();
           setIsRecording(false);
           setNotification(`Export Saved (WEBM)`);
           setTimeout(() => setNotification(''), 3000);
           return;
        }

        // 2. FFmpeg True MP4 Conversion
        try {
           setNotification('Converting to True MP4... Please wait.');
           
           // Import Node.js tools
           const fs = window.require('fs');
           const os = window.require('os');
           const path = window.require('path');
           const ffmpeg = window.require('fluent-ffmpeg');
           ffmpeg.setFfmpegPath(window.require('@ffmpeg-installer/ffmpeg').path);

           // Turn video into raw data
           const arrayBuffer = await webmBlob.arrayBuffer();
           const buffer = window.Buffer.from(arrayBuffer);

           // Create hidden temporary files
           const tempDir = os.tmpdir();
           const tempWebm = path.join(tempDir, `temp_${Date.now()}.webm`);
           const tempMp4 = path.join(tempDir, `final_${Date.now()}.mp4`);

           fs.writeFileSync(tempWebm, buffer);

           // Convert! This forces H.264 Video and AAC Audio, fixing the dragging/timeline issue
           ffmpeg(tempWebm)
             .outputOptions([
               '-c:v libx264',
               '-c:a aac',
               '-b:v 8M',
               '-pix_fmt yuv420p'
             ])
             .save(tempMp4)
             .on('end', () => {
                // When done, download the perfect MP4
                const mp4Buffer = fs.readFileSync(tempMp4);
                const mp4Blob = new Blob([mp4Buffer], { type: 'video/mp4' });
                const url = URL.createObjectURL(mp4Blob);
                
                const a = document.createElement('a');
                a.href = url; a.download = `matrix-studio-export-${Date.now()}.mp4`; a.click();
                
                // Delete hidden temp files
                fs.unlinkSync(tempWebm);
                fs.unlinkSync(tempMp4);
                
                setIsRecording(false);
                setNotification('Export Saved (True MP4)');
                setTimeout(() => setNotification(''), 3000);
             })
             .on('error', (err) => {
                console.error('FFmpeg error:', err);
                setIsRecording(false);
                setNotification('MP4 Conversion failed. Check Console.');
             });

        } catch (e) {
           console.error("FFmpeg Setup Error:", e);
           setIsRecording(false);
           setNotification('Failed. Node Integration might be blocked.');
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsExportModalOpen(false);
      if (!isPlaying) setIsPlaying(true);
    } catch (err) {
      console.error("Recording Error:", err);
      setNotification('Export Failed.');
    }
  };
  
  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };
  const togglePlay = () => { if (!isPlaying) audioContextRef.current?.resume(); setIsPlaying(!isPlaying); };

  useEffect(() => {
    executeActionsRef.current = { image: executeImageExport, video: executeVideoExport, stop: stopRecording };
  });

  const DockButton = ({ id, icon: Icon, label }) => (
    <button onClick={() => setActiveTab(id)} className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 active:scale-90 ${activeTab === id ? 'bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-white/5 hover:bg-white/10'}`}>
      <Icon size={22} color={activeTab === id ? activeColor : '#9ca3af'} className="transition-colors duration-300" />
      <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform duration-200 bg-zinc-900 border border-white/10 text-xs py-1 px-3 rounded-lg shadow-xl pointer-events-none whitespace-nowrap text-white z-50 origin-bottom">{label}</span>
      {activeTab === id && <div className="absolute -bottom-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeColor }} />}
    </button>
  );

  return (
    <div className={`w-screen h-screen bg-black overflow-hidden relative font-sans text-gray-300 select-none flex transition-[filter] duration-700 ${isLightMode ? 'invert hue-rotate-180' : ''}`}>
      {/* Background Glow */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
         <div className="absolute top-[10%] left-[20%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[120px] animate-pulse opacity-40 transition-colors duration-1000" style={{ backgroundColor: activeColor }}></div>
         <div className="absolute bottom-[10%] right-[20%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[100px] animate-pulse opacity-30 delay-1000" style={{ backgroundColor: '#4b5563' }}></div>
      </div>

      {/* Main Canvas Area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 transition-all duration-500 ease-out" style={{ paddingTop: isFullscreen ? '0px' : '80px', paddingRight: isFullscreen ? '0px' : '40px', paddingBottom: isFullscreen ? '0px' : '120px', paddingLeft: isFullscreen ? '0px' : (isPanelMinimized ? '120px' : '400px') }}>
         <div className={`relative flex items-center justify-center rounded-full transition-all duration-500 pointer-events-auto ${!exportTransparentRef.current ? 'border border-white/10 bg-[#050505] shadow-[0_0_50px_rgba(0,0,0,0.8)] ring-1 ring-white/5' : ''}`} style={{ height: '100%', maxHeight: isFullscreen ? '100vmin' : '85vmin', aspectRatio: '1 / 1', maxWidth: '100%', backgroundImage: exportTransparentRef.current ? 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMmQyZDJkIi8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzFmMWYxZiIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxZjFmMWYiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzJkMmQyZCIvPjwvc3ZnPg==")' : 'none', backgroundSize: '20px 20px', backgroundRepeat: 'repeat' }}>
           <canvas ref={canvasRef} width={800} height={800} className="w-full h-full object-contain pointer-events-none filter drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] rounded-full z-10" />
         </div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 z-40 flex space-x-3 pointer-events-auto">
         <button onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Exit Fullscreen" : "Maximize Canvas"} className={`flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-xl border transition-all hover:scale-105 active:scale-95 shadow-lg ${isFullscreen ? 'bg-white/20 border-white/40 text-white' : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'}`}>
           {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
         </button>
         <button onClick={togglePlay} className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 text-white transition-all hover:scale-105 active:scale-95 shadow-lg">
           {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
         </button>
         <button onClick={() => setIsExportModalOpen(true)} className="flex items-center px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 text-xs font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg uppercase tracking-wider">
            <Download size={16} className="mr-2" /> Export
         </button>
         {isRecording && (
           <button onClick={stopRecording} className="flex items-center px-5 py-2 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse uppercase tracking-wider backdrop-blur-xl transition-all active:scale-95">
             <Video size={16} className="mr-2" /> Stop Rec
           </button>
         )}
      </div>

      {/* Top Left Theme Toggle */}
      <div className="absolute top-6 left-6 z-50 flex pointer-events-auto">
         <button 
           onClick={() => setIsLightMode(!isLightMode)} 
           title="Toggle Light/Dark Theme" 
           className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
         >
           {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
         </button>
      </div>

      {/* Controls Panel */}
      <div className={`absolute bg-black/50 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col z-40 pointer-events-auto transition-all duration-500 ease-out overflow-hidden rounded-3xl ${isFullscreen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'} ${isPanelMinimized ? 'top-24 left-6 bottom-[100px] w-[60px]' : 'top-24 left-6 bottom-[100px] w-[340px]'}`}>
        <div className="h-14 flex items-center px-4 bg-white/5 border-b border-white/10 shrink-0">
           {!isPanelMinimized && (
             <>
               <Layers size={16} className="text-gray-500 mr-3" />
               <span className="text-xs font-bold text-white tracking-widest uppercase flex-1 drop-shadow-md">{activeTab === 'settings' ? 'Global Config' : activeTab === 'synth' ? 'FX Properties' : `${activeTab} Properties`}</span>
             </>
           )}
           <div className={`flex items-center ${isPanelMinimized ? 'mx-auto flex-col space-y-4' : 'space-x-4'}`}>
             <button onClick={() => setIsPanelMinimized(!isPanelMinimized)} className="text-gray-400 hover:text-white transition-all bg-black/40 hover:bg-white/10 p-2 rounded-full active:scale-90">
               {isPanelMinimized ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
             </button>
             {!isPanelMinimized && <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-500" style={{ backgroundColor: activeColor, color: activeColor }} />}
           </div>
        </div>
        
        {!isPanelMinimized && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <style>
               {`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }`}
            </style>

            {activeTab === 'synth' && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-5">
                 <MatrixRainSwitch isAudioMode={synthEngineMode === 'audio'} activeColor={activeColor} onToggle={() => setSynthEngineMode(prev => prev === 'texture' ? 'audio' : 'texture')} />

                 {synthEngineMode === 'audio' && (
                   <label className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl cursor-pointer hover:bg-indigo-500/20 transition-all group">
                     <div>
                       <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center">
                         <Zap size={14} className="mr-2 animate-pulse" /> Auto-VJ Chaos Mode
                       </span>
                       <span className="text-[9px] text-indigo-400/60 mt-1 flex items-center">
                         AI dynamically swaps FX to the beat
                         {isAutoVj && <span id="bpm-ai-badge" className="ml-2 px-1.5 py-0.5 bg-indigo-500/30 rounded text-[8px] font-mono text-white tracking-widest">--- BPM</span>}
                       </span>
                     </div>
                     <input type="checkbox" checked={isAutoVj} onChange={(e) => setIsAutoVj(e.target.checked)} style={{ accentColor: '#818cf8' }} className="w-5 h-5 cursor-pointer" />
                   </label>
                 )}

                 <div className={`space-y-5 transition-opacity duration-500 ${isAutoVj && synthEngineMode === 'audio' ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                   <div className="space-y-2">
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold">Effect Algorithm</label>
                        <button onClick={handleResetEffect} className="flex items-center text-[8px] uppercase tracking-widest text-gray-400 hover:text-white transition-colors active:scale-95">
                          <RotateCcw size={10} className="mr-1" /> Reset
                        </button>
                      </div>
                      <select className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none transition-all focus:border-white/30" value={synthEngineMode === 'texture' ? synthMode : audioFxMode} onChange={(e) => synthEngineMode === 'texture' ? setSynthMode(e.target.value) : setAudioFxMode(e.target.value)}>
                        {synthEngineMode === 'texture' ? [
                           {value: 'noise', label: 'Simplex Noise'}, {value: 'voronoi', label: 'Voronoi Cells'}, {value: 'wave', label: 'Wave Forms'}
                        ].map(m => <option key={m.value} value={m.value}>{m.label}</option>) : [
                           {value: 'oscilloscope', label: 'Oscilloscope'}, {value: 'particles', label: 'Quantum Particles'}, {value: 'spectrum', label: 'Circular Spectrum'},
                           {value: 'grid', label: 'Bass Matrix'}, {value: 'tetris', label: 'Audio Tetris 🧱'}, {value: 'launchpad', label: 'Launchpad Radial 🎛️'},
                           {value: 'hyperspace', label: 'Hyperspace Jump 🚀'}, {value: 'cyber_web', label: 'Cyber Web 🕸️'}
                        ].map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                   </div>

                   {synthEngineMode === 'texture' && (
                   <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4">
                      {TEXTURE_INPUTS.map(inp => {
                         const currentConfig = allSynthConfig[synthMode]; const currentParams = currentConfig.params; const currentLinks = currentConfig.links;
                         const linkVal = currentLinks[inp.id]; const isLinked = linkVal !== 'none'; const linkColor = MODULATOR_COLORS[linkVal] || 'transparent';
                         return (
                            <div key={inp.id} className="space-y-2 pb-2 border-b border-white/5 last:border-0 last:pb-0">
                               <div className="flex justify-between items-center">
                                  <label className="text-xs text-gray-400 font-medium flex items-center">
                                     {isLinked && <div className="w-1.5 h-1.5 rounded-full mr-2" style={{backgroundColor: linkColor}} />}
                                     {inp.label}
                                  </label>
                                  <select value={linkVal} onChange={(e) => handleSynthLinkChange(inp.id, e.target.value)} className="bg-black/40 border border-white/10 text-[9px] uppercase tracking-wider text-gray-400 rounded-lg px-2 py-1 outline-none focus:border-white/30">
                                     <option value="none">Static</option><option value="time">Time Flow</option><option value="lfo">Sine LFO</option>
                                  </select>
                               </div>
                               <OptimizedSlider min={inp.min} max={inp.max} step={inp.step} value={currentParams[inp.id] || 0} onChange={(v) => handleSynthParamChange(inp.id, v)} activeColor={isLinked ? linkColor : activeColor} disabled={isLinked} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" />
                            </div>
                         );
                      })}
                   </div>
                   )}
                 </div>

                 {synthEngineMode === 'audio' && (
                 <>
                   <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                      <div><span className="text-[10px] font-bold text-white uppercase block mb-1">AI Smart Auto-Pilot Active</span><span className="text-[9px] text-gray-400 block">All visual parameters are dynamically driven by live audio frequencies.</span></div>
                      <Zap size={20} style={{ color: activeColor }} className="animate-pulse opacity-50" />
                   </div>
                   
                   <div className="space-y-3 pt-2 border-t border-white/10 mt-4">
                     <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest pb-2">Launchpad MIDI Input</h4>
                     <div className="p-4 bg-black/40 border border-white/10 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                           <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center"><Gamepad2 size={14} className="mr-2" style={{ color: activeColor }} />Keyboard Triggers</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                           {[7,8,9,4,5,6,1,2,3].map(num => (<div key={num} className="bg-white/5 border border-white/10 rounded flex items-center justify-center py-2"><span className="text-[10px] font-mono text-gray-500">{num}</span></div>))}
                        </div>
                        <div className="flex space-x-3 mt-4 pt-3 border-t border-white/5">
                           <div className="flex-1 space-y-1">
                             <label className="text-xs text-gray-400 font-medium flex justify-between"><span>Align X (Cols)</span><span className="text-white font-mono">{padPanX}</span></label>
                             <OptimizedSlider min={-10} max={10} step={1} value={padPanX} onChange={setPadPanX} activeColor={activeColor} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none" />
                           </div>
                           <div className="flex-1 space-y-1">
                             <label className="text-xs text-gray-400 font-medium flex justify-between"><span>Align Y (Rows)</span><span className="text-white font-mono">{padPanY}</span></label>
                             <OptimizedSlider min={-10} max={10} step={1} value={padPanY} onChange={setPadPanY} activeColor={activeColor} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none" />
                           </div>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-3 text-center">Use Numpad (1-9) to trigger live visual pulses.</p>
                     </div>
                   </div>

                   <div className="space-y-3 pt-2 border-t border-white/10 mt-4">
                     <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest pb-2">VJ Glitch Rack (Keyboard)</h4>
                     <div className="p-3 bg-black/40 border border-white/10 rounded-xl grid grid-cols-3 gap-2 text-[8px] text-gray-400 font-mono">
                        <div><span className="text-white">Q</span> VHS Tear</div>
                        <div><span className="text-white">W</span> Ghost Trails</div>
                        <div><span className="text-white">E</span> Strobe Flash</div>
                        <div><span className="text-white">A</span> Slow Motion</div>
                        <div><span className="text-white">S</span> Pixel Crush</div>
                        <div><span className="text-white">D</span> Smooth Warp</div>
                        <div><span className="text-white">Z</span> CRT Roll</div>
                        <div><span className="text-white">X</span> Wave Warp</div>
                        <div><span className="text-white">C</span> Kill Switch</div>
                        <div className="col-span-3 pt-2 border-t border-white/5 mt-1 text-center"><span className="text-white">{'`'} (Backtick)</span> Next Algorithm Swap</div>
                     </div>
                   </div>

                   <div className="space-y-3 pt-2 mt-4 border-t border-white/10">
                     <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">Audio Modulator Source</h4>
                     {!audioFile ? (
                        <label className="flex items-center justify-center w-full bg-black/40 border border-white/10 hover:bg-white/5 text-white rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95">
                           <Upload size={14} className="mr-2 text-gray-400" /><span className="text-[10px] font-bold uppercase tracking-wider">Upload MP3 to drive FX</span>
                           <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                        </label>
                     ) : (
                        <div className="flex flex-col space-y-2 bg-black/40 border border-white/10 rounded-xl p-3">
                           <div className="text-[9px] text-gray-400 truncate w-full font-mono">{audioFile.name}</div>
                           <div className="flex items-center space-x-2 text-[8px] font-mono text-gray-500 w-full">
                              <span>{formatTime(audioProgress)}</span>
                              <OptimizedSlider min={0} max={audioDuration || 100} step={0.1} value={audioProgress || 0} onChange={handleTimelineScrub} activeColor={activeColor} className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                              <span>{formatTime(audioDuration)}</span>
                           </div>
                           <div className="flex items-center space-x-2 text-[8px] font-mono text-gray-500 w-full pt-1">
                              <Volume2 size={10} className="text-gray-400" />
                              <OptimizedSlider min={0} max={1} step={0.01} value={volume} onChange={handleVolumeChange} activeColor={activeColor} className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                           </div>
                           <div className="flex items-center space-x-2 text-[8px] font-mono text-indigo-400 w-full pt-1" title="Boost Visual Reactivity without increasing Speaker Volume">
                              <Zap size={10} className="text-indigo-400" />
                              <OptimizedSlider min={0.1} max={5.0} step={0.1} value={audioSensitivity} onChange={setAudioSensitivity} activeColor="#818cf8" className="flex-1 h-1 bg-indigo-500/20 rounded-lg appearance-none cursor-pointer" />
                           </div>
                           <div className="flex justify-between items-center pt-1">
                              <button onClick={togglePlay} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                                {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                              </button>
                              <button onClick={handleRestartAudio} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                                <RotateCcw size={12} />
                              </button>
                              <button onClick={handleClearAudio} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors">
                                <X size={12} />
                              </button>
                           </div>
                        </div>
                     )}
                   </div>
                 </>
                 )}
              </div>
            )}

            {activeTab === 'generative' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold">Algorithm</label>
                  <select className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none transition-all focus:border-white/30" value={generativeMode} onChange={(e) => setGenerativeMode(e.target.value)}>
                    <option value="ringtone">Classic Ringtone (Ripples)</option><option value="hourglass">Hourglass Timer (Physics)</option><option value="moonphase">Moon Phase Indicator</option>
                    <option value="glyph_progress">Glyph Progress Arc</option><option value="lava">Quantum Lava Lamp</option><option value="reaction">Reaction-Diffusion (Organic)</option>
                    <option value="starfield">Warp Speed (3D Starfield)</option><option value="matrix">Matrix Digital Rain</option><option value="radar">Sonar / Radar Sweep</option>
                    <option value="lissajous">Lissajous Spirograph</option><option value="gol">Cellular Automata (Game of Life)</option>
                  </select>
                </div>
                {generativeMode === 'ringtone' && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4">
                    <div className="space-y-1"><label className="flex justify-between text-xs text-gray-400 font-medium"><span>Speed</span><span className="font-mono text-white">{rippleSpeed.toFixed(1)}x</span></label><OptimizedSlider min={0.1} max={5} step={0.1} value={rippleSpeed} onChange={setRippleSpeed} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="space-y-1"><label className="flex justify-between text-xs text-gray-400 font-medium"><span>Ripples</span><span className="font-mono text-white">{rippleCount}</span></label><OptimizedSlider min={1} max={10} step={1} value={rippleCount} onChange={setRippleCount} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="space-y-1"><label className="flex justify-between text-xs text-gray-400 font-medium"><span>Thickness</span><span className="font-mono text-white">{Math.round(rippleThickness * 100)}</span></label><OptimizedSlider min={0.01} max={0.3} step={0.01} value={rippleThickness} onChange={setRippleThickness} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" /></div>
                    <label className="flex items-center justify-between pt-2 cursor-pointer group"><span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">Center Pulse Core</span><input type="checkbox" checked={rippleCenterPulse} onChange={(e) => setRippleCenterPulse(e.target.checked)} style={{ accentColor: activeColor }} className="w-4 h-4 cursor-pointer" /></label>
                  </div>
                )}
                {generativeMode === 'hourglass' && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4">
                    <div className="space-y-1"><label className="flex justify-between text-xs text-gray-400 font-medium"><span>Duration</span><span className="font-mono text-white">{hourglassDuration}s</span></label><OptimizedSlider min={5} max={300} step={5} value={hourglassDuration} onChange={setHourglassDuration} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" /></div>
                    <button onClick={handleRestartHourglass} className="w-full py-3 bg-black/40 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95">Restart Drop</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'clock' && (
               <div className="flex flex-col items-center justify-center p-8 opacity-50"><Clock size={48} className="mb-4 text-gray-500 animate-pulse" /><p className="text-xs text-center">Live system clock rendering.<br/>No parameters to adjust.</p></div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold">Input String</label>
                  <OptimizedTextInput value={textInput} onChange={setTextInput} className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none focus:border-white/30 transition-all font-mono" placeholder="Enter text..." />
                </div>
                
                {/* --- SYSTEM FONT SEARCH & SELECT --- */}
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold flex justify-between">
                    <span>System Typeface</span>
                    <span className="text-white opacity-40 font-mono">{systemFonts.length} Fonts</span>
                  </label>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-3.5 text-gray-500" />
                    <input 
                       type="text" 
                       placeholder="Search your fonts..." 
                       value={fontSearch} 
                       onChange={e=>setFontSearch(e.target.value)} 
                       className="w-full bg-white/5 border border-white/10 rounded-t-xl p-3 pl-9 text-[10px] text-white outline-none border-b-0" 
                    />
                  </div>
                  <div className="h-32 bg-white/5 border border-white/10 rounded-b-xl overflow-y-auto custom-scrollbar">
                    {systemFonts.filter(f=>f.toLowerCase().includes(fontSearch.toLowerCase())).map(font => (
                      <button 
                        key={font} 
                        onClick={()=>setFontFamily(font)} 
                        className={`w-full text-left p-2.5 text-[11px] border-b border-white/5 hover:bg-white/10 transition-colors ${fontFamily===font ? 'bg-white/20 text-white' : 'text-gray-400'}`} 
                        style={{ fontFamily: font }}
                      >
                        {font}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold">Motion Effect</label>
                  <select value={textAnimation} onChange={(e) => setTextAnimation(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-xl p-3 outline-none">
                    <optgroup label="Standard"><option value="scroll-left">Scroll Left</option><option value="scroll-right">Scroll Right</option><option value="scroll-left-blink">Scroll Left + Blink</option><option value="scroll-right-blink">Scroll Right + Blink</option><option value="blink">Static Blink</option><option value="static">Static</option></optgroup>
                    <optgroup label="Retro Terminal"><option value="typewriter">Typewriter</option><option value="decrypt">Matrix Decrypt</option></optgroup>
                    <optgroup label="Distortions & Glitch"><option value="cube">3D Cube Rotation</option><option value="sine-wave">Sine Wave Snake</option><option value="vhs">VHS Tracking Glitch</option></optgroup>
                  </select>
                </div>
                <div className="space-y-1 bg-white/5 border border-white/5 rounded-xl p-4">
                  <label className="flex justify-between text-xs text-gray-400 font-medium"><span>Speed Vector</span><span className="font-mono text-white">{textSpeed.toFixed(2)}x</span></label>
                  <OptimizedSlider min={0.01} max={0.2} step={0.01} value={textSpeed} onChange={setTextSpeed} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer mt-2" />
                </div>
                <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4 mt-4">
                  <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">Spatial Transforms</h4>
                  <div className="space-y-1 mt-3"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Scale Multiplier</span><span className="text-white font-mono">{textScale.toFixed(2)}x</span></label><OptimizedSlider min={0.5} max={3} step={0.1} value={textScale} onChange={setTextScale} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                  <div className="flex space-x-3">
                     <div className="flex-1 space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Pan X</span><span className="text-white font-mono">{textPanX}</span></label><OptimizedSlider min={-15} max={15} step={1} value={textPanX} onChange={setTextPanX} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                     <div className="flex-1 space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Pan Y</span><span className="text-white font-mono">{textPanY}</span></label><OptimizedSlider min={-15} max={15} step={1} value={textPanY} onChange={setTextPanY} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                  </div>
                </div>

                {textAnimation.includes('blink') && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4 mt-4 animate-in fade-in zoom-in duration-300">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">Strobe Settings</h4>
                    <div className="space-y-1 mt-3"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Blink Rate</span><span className="text-white font-mono">{textBlinkRate.toFixed(2)}x</span></label><OptimizedSlider min={0.1} max={5} step={0.1} value={textBlinkRate} onChange={setTextBlinkRate} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                  </div>
                )}
                {textAnimation === 'typewriter' && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4 mt-4 animate-in fade-in zoom-in duration-300">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">Terminal Settings</h4>
                    <div className="space-y-2 mt-3">
                      <label className="text-xs text-gray-400 font-medium">Cursor Style</label>
                      <select value={typewriterCursor} onChange={(e) => setTypewriterCursor(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-xl p-3 outline-none"><option value="_">Underscore ( _ )</option><option value="█">Solid Block ( █ )</option><option value="|">Pipe ( | )</option><option value="none">Hidden</option></select>
                    </div>
                  </div>
                )}
                {textAnimation === 'decrypt' && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4 mt-4 animate-in fade-in zoom-in duration-300">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">Hacker Config</h4>
                    <div className="space-y-1 mt-3"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Chaos Multiplier</span><span className="text-white font-mono">{decryptComplexity.toFixed(1)}x</span></label><OptimizedSlider min={0.5} max={3} step={0.1} value={decryptComplexity} onChange={setDecryptComplexity} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                  </div>
                )}
                {textAnimation === 'cube' && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4 mt-4 animate-in fade-in zoom-in duration-300">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">3D Projection</h4>
                    <div className="space-y-1 mt-3"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Camera Distance</span><span className="text-white font-mono">{cubeDistance.toFixed(2)}</span></label><OptimizedSlider min={1.0} max={4.0} step={0.1} value={cubeDistance} onChange={setCubeDistance} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                    <div className="space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Spin Speed</span><span className="text-white font-mono">{cubeSpeed.toFixed(2)}x</span></label><OptimizedSlider min={0.1} max={4.0} step={0.1} value={cubeSpeed} onChange={setCubeSpeed} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                  </div>
                )}
                {textAnimation === 'vhs' && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4 mt-4 animate-in fade-in zoom-in duration-300">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">Glitch Physics</h4>
                    <div className="space-y-1 mt-3"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Tracking Probability</span><span className="text-white font-mono">{Math.round(vhsFrequency * 100)}%</span></label><OptimizedSlider min={0.01} max={0.5} step={0.01} value={vhsFrequency} onChange={setVhsFrequency} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                    <div className="space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Tear Intensity</span><span className="text-white font-mono">{vhsIntensity.toFixed(2)}</span></label><OptimizedSlider min={0.1} max={1.5} step={0.1} value={vhsIntensity} onChange={setVhsIntensity} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                  </div>
                )}
                {textAnimation === 'sine-wave' && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4 mt-4 animate-in fade-in zoom-in duration-300">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest border-b border-white/10 pb-2">Wave Physics</h4>
                    <div className="space-y-1 mt-3"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Amplitude</span><span className="text-white font-mono">{textWaveAmp.toFixed(2)}</span></label><OptimizedSlider min={0} max={0.8} step={0.05} value={textWaveAmp} onChange={setTextWaveAmp} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                    <div className="space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Frequency</span><span className="text-white font-mono">{textWaveFreq.toFixed(2)}</span></label><OptimizedSlider min={0.05} max={1} step={0.05} value={textWaveFreq} onChange={setTextWaveFreq} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                    <div className="space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Undulation Speed</span><span className="text-white font-mono">{textWaveSpeed.toFixed(2)}x</span></label><OptimizedSlider min={0.1} max={3} step={0.1} value={textWaveSpeed} onChange={setTextWaveSpeed} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="grid grid-cols-2 gap-3">
                  <label className="group flex flex-col items-center justify-center bg-black/40 border border-white/10 hover:bg-white/5 hover:border-white/30 text-white rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95">
                    <Upload size={22} className="mb-2 text-gray-400 group-hover:text-white transition-colors" /><span className="text-xs font-bold uppercase tracking-wider">{mediaFile ? 'Change File' : 'Upload Media'}</span>
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
                  </label>
                  <button onClick={toggleWebcam} style={{ borderColor: isWebcamActive ? activeColor : '' }} className={`flex flex-col items-center justify-center border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${isWebcamActive ? 'bg-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]' : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5 text-white'}`}>
                    <Camera size={22} style={{ color: isWebcamActive ? activeColor : '' }} className={`mb-2 transition-colors ${isWebcamActive ? 'animate-pulse drop-shadow-[0_0_8px_currentColor]' : 'text-gray-400'}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${isWebcamActive ? 'text-white' : ''}`}>{isWebcamActive ? 'Stop Stream' : 'Live Webcam'}</span>
                  </button>
                </div>
                {(mediaFile || isWebcamActive) && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                       {mediaFile && !isWebcamActive && <p className="text-[10px] uppercase tracking-widest text-gray-500 truncate font-mono flex-1 pr-2">{mediaFile.name}</p>}
                       {isWebcamActive && <p className="text-[10px] uppercase tracking-widest text-gray-500 truncate font-mono flex items-center flex-1 pr-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span> Live Video Device 0</p>}
                       <button onClick={handleClearMedia} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors shrink-0">
                         <X size={12} />
                       </button>
                    </div>
                    
                    {isVideoMedia && !isWebcamActive && (
                      <div className="flex flex-col space-y-2 pb-1">
                        <div className="flex items-center space-x-2">
                          <button onClick={togglePlay} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-90">{isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
                          <button onClick={handleRestartVideo} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-90"><RotateCcw size={14} /></button>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400 flex-1 ml-1 bg-black/20 p-2 rounded-xl">
                            <span>{formatTime(videoProgress)}</span>
                            <OptimizedSlider min={0} max={videoDuration || 100} step={0.1} value={videoProgress || 0} onChange={handleVideoTimelineScrub} activeColor={activeColor} className="flex-1 h-1 bg-black/50 rounded-lg appearance-none cursor-pointer" />
                            <span>{formatTime(videoDuration)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 text-xs font-mono text-gray-500 bg-black/20 p-2 rounded-xl mt-1">
                           <Volume2 size={12} className="text-gray-400" />
                           <OptimizedSlider min={0} max={1} step={0.01} value={volume} onChange={handleVolumeChange} activeColor={activeColor} className="flex-1 h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer" />
                        </div>
                      </div>
                    )}
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Image Processing</h4>
                      <div className="flex space-x-3">
                         <div className="flex-1 space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Bright</span><span className="text-white font-mono">{Math.round(mediaBrightness * 100)}%</span></label><OptimizedSlider min={0} max={3} step={0.05} value={mediaBrightness} onChange={setMediaBrightness} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                         <div className="flex-1 space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Contrast</span><span className="text-white font-mono">{Math.round(mediaContrast * 100)}%</span></label><OptimizedSlider min={0} max={3} step={0.05} value={mediaContrast} onChange={setMediaContrast} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                      </div>
                    </div>
                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">UV Transforms</h4>
                      <div className="space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Scale Engine</span><span className="text-white font-mono">{mediaScale.toFixed(2)}x</span></label><OptimizedSlider min={0.1} max={5} step={0.1} value={mediaScale} onChange={setMediaScale} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                      <div className="flex space-x-3">
                         <div className="flex-1 space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Pan X</span><span className="text-white font-mono">{mediaPanX}</span></label><OptimizedSlider min={-15} max={15} step={1} value={mediaPanX} onChange={setMediaPanX} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                         <div className="flex-1 space-y-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Pan Y</span><span className="text-white font-mono">{mediaPanY}</span></label><OptimizedSlider min={-15} max={15} step={1} value={mediaPanY} onChange={setMediaPanY} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                      </div>
                      <div className="space-y-1 pt-1"><label className="text-xs text-gray-400 font-medium flex justify-between"><span>Z-Rotation</span><span className="text-white font-mono">{mediaRotation}°</span></label><OptimizedSlider min={0} max={360} step={1} value={mediaRotation} onChange={setMediaRotation} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" /></div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex justify-between items-center">Audio Reactors</h4>
                      <select value={audioSyncMode} onChange={(e) => setAudioSyncMode(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-xl p-3 outline-none"><option value="none">Disabled (Static)</option><option value="zoom">Bass Bounce (Modulate UV Scale)</option><option value="flash">Bass Flash (Modulate Brightness)</option></select>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Retro Logic</h4>
                      <select value={mediaFx} onChange={(e) => setMediaFx(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-xl p-3 outline-none"><option value="none">Standard Threshold</option><option value="dither">Bayer 4x4 Dithering (8-Bit Look)</option><option value="edge">Sobel Edge Detect (Neon Outlines)</option></select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                <label className="group flex flex-col items-center justify-center w-full bg-black/40 border border-white/10 hover:border-white/30 hover:bg-white/5 text-white rounded-xl p-6 cursor-pointer transition-all hover:scale-[1.02] active:scale-95">
                  <Music size={24} className="mb-3 text-gray-400 group-hover:text-white transition-colors" /><span className="text-sm font-bold uppercase tracking-wider">{audioFile ? 'Load New Track' : 'Upload MP3 / Audio'}</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </label>
                {audioFile && (
                  <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 truncate border-b border-white/10 pb-2 font-mono">Now Playing: {audioFile.name}</p>
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-center space-x-2">
                        <button onClick={togglePlay} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-90">{isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
                        <button onClick={handleRestartAudio} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-90"><RotateCcw size={16} /></button>
                        <button onClick={handleClearAudio} className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-transform active:scale-90"><X size={16} /></button>
                        <select value={audioAnimMode} onChange={(e) => setAudioAnimMode(e.target.value)} className="flex-1 bg-black/40 border border-white/10 text-white text-xs rounded-xl p-3 outline-none focus:border-white/30 truncate min-w-0">
                          <option value="particles">Ember Particle Flow</option><option value="liquid">Fluid Liquid Slosh</option><option value="radial">Radial Sub-Bass Circle</option>
                          <option value="split">Split Symmetry Waves</option><option value="vortex">Galactic Vortex Swirl</option><option value="bars">Classic EQ Bars</option>
                          <option value="wave">Oscillator Waveform</option><option value="pulse">Pulse Beat Sphere</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-3 text-xs font-mono text-gray-500 bg-black/20 p-2 rounded-xl">
                        <span>{formatTime(audioProgress)}</span><OptimizedSlider min={0} max={audioDuration || 100} step={0.1} value={audioProgress || 0} onChange={handleTimelineScrub} activeColor={activeColor} className="flex-1 h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer" /><span>{formatTime(audioDuration)}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs font-mono text-gray-500 bg-black/20 p-2 rounded-xl mt-2">
                        <Volume2 size={14} className="text-gray-400" /><OptimizedSlider min={0} max={1} step={0.01} value={volume} onChange={handleVolumeChange} activeColor={activeColor} className="flex-1 h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                 <div className="space-y-3">
                   <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold flex items-center"><Palette size={12} className="mr-2" /> Interface Theme Engine</label>
                   <div className="grid grid-cols-2 gap-2">
                     {Object.values(UI_THEMES).map(theme => (
                       <button key={theme.id} onClick={() => setUiTheme(theme.id)} style={{ borderColor: uiTheme === theme.id ? theme.color : '', backgroundColor: uiTheme === theme.id ? `${theme.color}15` : '' }} className="flex items-center p-3 bg-black/40 border border-white/5 hover:border-white/20 rounded-xl transition-all hover:scale-105 active:scale-95">
                         <div className="w-3 h-3 rounded-full mr-2 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: theme.color, color: theme.color }} />
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${uiTheme === theme.id ? 'text-white' : 'text-gray-400'}`}>{theme.label}</span>
                       </button>
                     ))}
                   </div>
                 </div>
                 <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-4">
                   <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-white/10 pb-2">Rendering Pipeline</h3>
                   <label className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5 cursor-pointer hover:border-white/20 transition-all group">
                     <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-white transition-colors">Volumetric Bloom</span>
                     <input type="checkbox" checked={bloom} onChange={(e) => setBloom(e.target.checked)} style={{ accentColor: activeColor }} className="w-4 h-4 cursor-pointer" />
                   </label>
                   <div className="space-y-1">
                     <label className="flex justify-between text-xs text-gray-400 font-medium"><span>Grid Resolution</span><span className="font-mono text-white">{resolution}px</span></label>
                     <OptimizedSlider min={8} max={64} step={1} value={resolution} onChange={setResolution} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" />
                   </div>
                   <div className="flex space-x-3 pt-2 border-t border-white/5">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] uppercase text-gray-400 font-bold flex justify-between"><span>Exposure</span><span className="text-white font-mono">{Math.round(globalBrightness * 100)}%</span></label>
                        <OptimizedSlider min={0} max={3} step={0.05} value={globalBrightness} onChange={setGlobalBrightness} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] uppercase text-gray-400 font-bold flex justify-between"><span>Contrast</span><span className="text-white font-mono">{Math.round(globalContrast * 100)}%</span></label>
                        <OptimizedSlider min={0} max={3} step={0.05} value={globalContrast} onChange={setGlobalContrast} activeColor={activeColor} className="w-full h-1.5 bg-black/40 rounded-lg appearance-none" />
                      </div>
                   </div>
                   <div className="space-y-2 pt-3 border-t border-white/5">
                     <label className="block text-[10px] uppercase text-gray-400 font-bold">Physical Pixel Shape</label>
                     <div className="flex space-x-2">
                       <button onClick={() => setDotShape('square')} style={{ backgroundColor: dotShape === 'square' ? `${activeColor}20` : '', borderColor: dotShape === 'square' ? activeColor : '', color: dotShape === 'square' ? activeColor : '' }} className={`flex-1 py-3 text-[10px] uppercase tracking-wider font-bold rounded-xl border transition-all active:scale-95 ${dotShape === 'square' ? 'shadow-[0_0_15px_rgba(0,0,0,0.3)]' : 'bg-black/40 border-white/10 text-gray-500 hover:text-white hover:border-white/30'}`}>Block (Square)</button>
                       <button onClick={() => setDotShape('circle')} style={{ backgroundColor: dotShape === 'circle' ? `${activeColor}20` : '', borderColor: dotShape === 'circle' ? activeColor : '', color: dotShape === 'circle' ? activeColor : '' }} className={`flex-1 py-3 text-[10px] uppercase tracking-wider font-bold rounded-xl border transition-all active:scale-95 ${dotShape === 'circle' ? 'shadow-[0_0_15px_rgba(0,0,0,0.3)]' : 'bg-black/40 border-white/10 text-gray-500 hover:text-white hover:border-white/30'}`}>LED (Circle)</button>
                     </div>
                   </div>
                 </div>
               </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 p-3 bg-black/50 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 pointer-events-auto transition-all duration-500 ease-out ${isFullscreen ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
         <DockButton id="synth" icon={Radio} label="Procedural Math & Audio FX" />
         <DockButton id="generative" icon={Zap} label="Generative Engine" />
         <DockButton id="clock" icon={Clock} label="Live System Clock" />
         <DockButton id="text" icon={Type} label="Typeface Scroller" />
         <div className="w-px h-8 bg-white/10 self-center mx-1" />
         <DockButton id="media" icon={ImageIcon} label="Media & Webcam" />
         <DockButton id="audio" icon={Music} label="Audio Visualizers" />
         <div className="w-px h-8 bg-white/10 self-center mx-1" />
         <DockButton id="settings" icon={Settings} label="Global Config" />
      </div>

      {/* Modals & Notifications */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-zinc-950">
              <h2 className="text-sm font-bold text-white flex items-center uppercase tracking-widest"><Download size={16} className="mr-3" style={{ color: activeColor }} /> Render Engine</h2>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-5 flex space-x-2 border-b border-white/5 bg-black/20">
              <button onClick={() => setExportTab('image')} style={{ backgroundColor: exportTab === 'image' ? `${activeColor}20` : '', color: exportTab === 'image' ? activeColor : '' }} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${exportTab === 'image' ? 'border border-current' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>Image Frame</button>
              <button onClick={() => setExportTab('video')} style={{ backgroundColor: exportTab === 'video' ? `${activeColor}20` : '', color: exportTab === 'video' ? activeColor : '' }} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${exportTab === 'video' ? 'border border-current' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>Animation</button>
            </div>

            <div className="p-6 space-y-6">
              {exportTab === 'image' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Format Output</label>
                    <select value={exportImgFormat} onChange={(e) => setExportImgFormat(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none focus:border-white/30">
                      <option value="image/png">PNG (Supports Transparency)</option><option value="image/jpeg">JPEG (Solid Background)</option><option value="image/webp">WebP (High Compression)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Resolution Scale</label>
                    <select value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none focus:border-white/30">
                      <option value={1}>1x (800 x 800) - Standard</option><option value={2}>2x (1600 x 1600) - High Res</option><option value={4}>4x (3200 x 3200) - Ultra Res</option>
                    </select>
                  </div>
                  <label className={`flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/10 transition-colors ${exportImgFormat === 'image/jpeg' ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-white/30 cursor-pointer'}`}>
                    <div>
                      <span className="text-xs font-bold text-white block tracking-wide uppercase">Transparent Substrate</span>
                      <span className="text-[10px] text-gray-400 mt-1 block">Remove black background disc</span>
                    </div>
                    <input type="checkbox" disabled={exportImgFormat === 'image/jpeg'} checked={exportTransparent} onChange={(e) => handleTransparentChange(e.target.checked)} style={{ accentColor: activeColor }} className="w-5 h-5 cursor-pointer" />
                  </label>
                </>
              )}

              {exportTab === 'video' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Codec / Format</label>
                    <select value={exportVidFormat} onChange={(e) => setExportVidFormat(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none focus:border-white/30">
                      <option value="video/webm;codecs=vp9,opus">WebM (VP9 + Opus Audio) - Best</option><option value="video/webm;codecs=vp8,opus">WebM (VP8 + Opus Audio)</option><option value='video/mp4;codecs="avc1.4d002a"'>MP4 (H.264 / AVC)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Timeline Frame Rate</label>
                    <select value={exportFps} onChange={(e) => setExportFps(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none focus:border-white/30">
                      <option value={24}>24 FPS (Cinematic Look)</option><option value={30}>30 FPS (Standard Digital)</option><option value={60}>60 FPS (Ultra Smooth)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Data Bitrate</label>
                    <select value={exportBitrate} onChange={(e) => setExportBitrate(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 outline-none focus:border-white/30">
                      <option value={2500000}>2.5 Mbps (Low Quality)</option><option value={5000000}>5.0 Mbps (Medium Quality)</option><option value={10000000}>10 Mbps (High Quality)</option><option value={20000000}>20 Mbps (Ultra Quality)</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/10 transition-colors hover:border-white/30 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-white block tracking-wide uppercase">Include Audio Track</span>
                      <span className="text-[10px] text-gray-400 mt-1 block">Record the currently playing MP3</span>
                    </div>
                    <input type="checkbox" checked={exportAudio} onChange={(e) => setExportAudio(e.target.checked)} style={{ accentColor: activeColor }} className="w-5 h-5 cursor-pointer" />
                  </label>
                </>
              )}
            </div>

            <div className="p-5 border-t border-white/5 bg-zinc-950 flex justify-between items-center">
              <button onClick={handleSaveDefaults} className="px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-white/10 hover:text-white hover:bg-white/10 transition-colors">Apply as Default</button>
              <div className="flex space-x-3">
                <button onClick={() => setIsExportModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Cancel</button>
                <button onClick={() => exportTab === 'image' ? executeImageExport() : executeVideoExport(true)} style={{ backgroundColor: activeColor }} className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  {exportTab === 'image' ? 'Save Image' : 'Start Recording'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-2xl flex items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-bold text-xs uppercase tracking-widest z-[70] animate-in slide-in-from-top-10 duration-300">
          <Check size={16} className="mr-3 text-green-600" />{notification}
        </div>
      )}
    </div>
  );
};

export default MatrixStudio;