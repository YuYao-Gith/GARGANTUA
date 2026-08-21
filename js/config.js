// ============================================================
//  config.js — 全局状态 / 默认参数 / URL 参数 / 本地存储
//  注意：本模块不依赖 three，STATE.clock 由 main.js 注入。
// ============================================================

export const STATE = {
    quality: 'cinematic',
    steps: 460,
    dprCap: 2,
    cineMode: true,
    autoOrbit: false,
    soundOn: false,
    hudVisible: true,
    paramsVisible: false,
    cineTime: 0,
    cineDuration: 11,
    totalCineDuration: 88,
    presetFlight: null,
    isFlying: false,
    debug: 0,
    clock: null, // main.js: STATE.clock = new THREE.Clock()
    elapsed: 0,
    fps: 60,
    fpsSamples: [],
    lastHUDUpdate: 0,
    ready: false,
    shotMode: false,
    shotFrames: 0,
    soundIntroPlayed: false,
    soundMainStarted: false,
    soundBlocked: false,
    audioCtx: null,
};

// 默认参数 (与面板一致)
export const DEFAULTS = {
    steps: 460,
    din: 2.75,
    dout: 40,
    dopMax: 1.85,
    opNear: 0.90,
    opFar: 0.80,
    diskBright: 1.0,
    starBright: 1.0,
    skyFloor: 0.04,
    rotSpeed: 1.0,
    bloomStr: 0.55,
    bloomRad: 0.35,
    bloomThr: 0.55,
    vignette: 1.0,
    grain: 0.045,
    ca: 0.0028,
    fov: 44,
    maxDist: 150,
    autoSpeed: 0.12,
    cineSeg: 11,
    debug: 0,
    rotSign: 1,
};

export const PARAMS = { ...DEFAULTS };

// ============================================================
//  URL 参数
// ============================================================
export function getURLParams() {
    const url = new URL(window.location.href);
    const p = {};
    p.q = url.searchParams.get('q') || 'cinematic';
    p.steps = parseInt(url.searchParams.get('steps')) || 0;
    p.shot = url.searchParams.has('shot');
    p.cam = url.searchParams.get('cam') || null;
    p.nocine = url.searchParams.has('nocine');
    p.ctime = parseFloat(url.searchParams.get('ctime')) || 0;
    p.debug = parseInt(url.searchParams.get('debug')) || 0;
    return p;
}
export const URLP = getURLParams();

// ============================================================
//  质量档位
// ============================================================
export const QUALITIES = {
    standard: { steps: 200, dpr: 1, label: 'STANDARD' },
    high: { steps: 320, dpr: 1.5, label: 'HIGH' },
    cinematic: { steps: 460, dpr: 2, label: 'CINEMATIC' },
};

export function applyQuality(q) {
    const qual = QUALITIES[q] || QUALITIES.cinematic;
    STATE.quality = q;
    STATE.steps = URLP.steps > 0 ? URLP.steps : qual.steps;
    STATE.dprCap = qual.dpr;
    document.getElementById('btn-quality').textContent = qual.label;
    return qual;
}

// 初始质量
let qKey = URLP.q;
if (!QUALITIES[qKey]) qKey = 'cinematic';
applyQuality(qKey);
if (URLP.debug >= 0 && URLP.debug <= 9) PARAMS.debug = URLP.debug;
if (URLP.nocine) STATE.cineMode = false;

// ============================================================
//  本地存储
// ============================================================
const STORAGE_KEY = 'gargantua.params.v1';

export function loadStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        for (const k of Object.keys(DEFAULTS)) {
            if (k in data && Number.isFinite(data[k])) {
                PARAMS[k] = data[k];
            }
        }
    } catch (_) { /* ignore */ }
}

export function saveStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(PARAMS));
    } catch (_) { /* ignore */ }
}

loadStorage();

// URL 覆盖
if (URLP.debug >= 0 && URLP.debug <= 9) PARAMS.debug = URLP.debug;
if (URLP.steps > 0) {
    STATE.steps = URLP.steps;
} else {
    // ★ 修复：渲染实际使用 STATE.steps，此处把持久化的 steps 同步回来，
    //   否则刷新后滑杆与着色器实际步数不一致。
    STATE.steps = PARAMS.steps;
}
