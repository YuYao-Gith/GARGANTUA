// ============================================================
//  ui.js — 参数面板 / HUD / 事件绑定 / 快捷键
//  参数与质量变化通过自定义事件通知 main.js（避免循环依赖）：
//    'gargantua:param-change'   → main 执行 syncUniforms()
//    'gargantua:quality-change' → main 执行 syncUniforms() + resize()
// ============================================================

import * as THREE from 'three';
import { STATE, PARAMS, QUALITIES, applyQuality, saveStorage } from './config.js';
import { showToast } from './toast.js';
import { toggleCine, applyPreset, breakCine, updateDeckTitle, updateCineButton } from './camera.js';
import { toggleSound } from './audio.js';

// ---- DOM 引用 ----
const hud = document.getElementById('hud');
const paramsPanel = document.getElementById('params');
const paramsScroll = document.getElementById('params-scroll');
const btnCine = document.getElementById('btn-cine');
const btnAutoOrbit = document.getElementById('btn-autoorbit');
const btnQuality = document.getElementById('btn-quality');
const btnParams = document.getElementById('btn-params');
const btnHud = document.getElementById('btn-hud');
const btnSound = document.getElementById('btn-sound');
const btnReset = document.getElementById('params-reset');
const tDist = document.getElementById('t-dist');
const tInc = document.getElementById('t-inc');
const tSteps = document.getElementById('t-steps');
const tProfile = document.getElementById('t-profile');
const tFps = document.getElementById('t-fps');

// ---- 事件派发 ----
const fireParamChange = () => window.dispatchEvent(new CustomEvent('gargantua:param-change'));
const fireQualityChange = () => window.dispatchEvent(new CustomEvent('gargantua:quality-change'));

// ============================================================
//  参数面板
// ============================================================
const PARAM_DEFS = [
    { key: 'steps', label: 'GEODESIC STEPS', min: 60, max: 600, step: 10, default: 460 },
    { key: 'din', label: 'DISK INNER EDGE', min: 2.0, max: 4.0, step: 0.05, default: 2.75 },
    { key: 'dout', label: 'DISK OUTER EDGE', min: 10, max: 80, step: 1, default: 40 },
    { key: 'dopMax', label: 'DOPPLER BOOST', min: 1, max: 3, step: 0.05, default: 1.85 },
    { key: 'opNear', label: 'DISK OPACITY·INNER', min: 0.5, max: 1, step: 0.01, default: 0.90 },
    { key: 'opFar', label: 'DISK OPACITY·OUTER', min: 0.3, max: 1, step: 0.01, default: 0.80 },
    { key: 'diskBright', label: 'DISK BRIGHTNESS', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: 'starBright', label: 'STARFIELD BRIGHTNESS', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: 'skyFloor', label: 'SKY FLOOR GLOW', min: 0, max: 0.15, step: 0.005, default: 0.04 },
    { key: 'rotSpeed', label: 'DISK ROTATION', min: 0, max: 3, step: 0.05, default: 1 },
    { key: 'bloomStr', label: 'BLOOM STRENGTH', min: 0, max: 1.5, step: 0.05, default: 0.55 },
    { key: 'bloomRad', label: 'BLOOM RADIUS', min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: 'bloomThr', label: 'BLOOM THRESHOLD', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'vignette', label: 'VIGNETTE', min: 0, max: 1.5, step: 0.05, default: 1 },
    { key: 'grain', label: 'FILM GRAIN', min: 0, max: 0.15, step: 0.005, default: 0.045 },
    { key: 'ca', label: 'CHROMATIC ABERRATION', min: 0, max: 0.01, step: 0.0005, default: 0.0028 },
    { key: 'fov', label: 'LENS FOV', min: 25, max: 80, step: 1, default: 44 },
    { key: 'maxDist', label: 'MAX DISTANCE', min: 40, max: 300, step: 5, default: 150 },
    { key: 'autoSpeed', label: 'AUTO-ORBIT SPEED', min: 0, max: 1, step: 0.02, default: 0.12 },
    { key: 'cineSeg', label: 'CINE SEGMENT', min: 4, max: 30, step: 1, default: 11 },
    { key: 'debug', label: 'DEBUG VIEW', min: 0, max: 9, step: 1, default: 0, isDebug: true },
];

function formatVal(def, v) {
    return def.step < 1 ? v.toFixed(2) : (Number.isInteger(def.step) ? Math.round(v) : v.toFixed(1));
}

export function buildParamsPanel() {
    paramsScroll.innerHTML = '';
    PARAM_DEFS.forEach(def => {
        const row = document.createElement('div');
        row.className = 'param-row' + (def.isDebug ? ' debug-row' : '');
        const label = document.createElement('div');
        label.className = 'param-label';
        const span = document.createElement('span');
        span.textContent = def.label;
        const val = document.createElement('span');
        val.className = 'param-val';
        val.id = `pval-${def.key}`;
        const v = PARAMS[def.key] ?? def.default;
        val.textContent = formatVal(def, v);
        label.appendChild(span);
        label.appendChild(val);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = def.min;
        input.max = def.max;
        input.step = def.step;
        input.value = v;
        input.dataset.key = def.key;
        input.id = `prange-${def.key}`;
        input.setAttribute('aria-label', def.label);

        row.appendChild(label);
        row.appendChild(input);
        paramsScroll.appendChild(row);

        input.addEventListener('input', () => {
            const raw = parseFloat(input.value);
            if (!Number.isFinite(raw)) return;
            PARAMS[def.key] = raw;
            val.textContent = formatVal(def, raw);
            if (def.key === 'steps') {
                STATE.steps = Math.round(raw);
                tSteps.textContent = STATE.steps;
            }
            if (def.key === 'debug') {
                STATE.debug = Math.round(raw);
            }
            if (def.key === 'cineSeg') {
                STATE.cineDuration = raw;
            }
            fireParamChange();
            saveStorage();
            if (def.key === 'steps') {
                updateQualityLabelFromSteps();
            }
        });
    });
}

export function updateQualityLabelFromSteps() {
    const s = STATE.steps;
    let q = 'cinematic';
    if (s <= 220) q = 'standard';
    else if (s <= 380) q = 'high';
    else q = 'cinematic';
    STATE.quality = q;
    btnQuality.textContent = QUALITIES[q].label;
}

export function resetParams() {
    PARAM_DEFS.forEach(def => {
        PARAMS[def.key] = def.default;
        const input = document.getElementById(`prange-${def.key}`);
        if (input) input.value = def.default;
        const val = document.getElementById(`pval-${def.key}`);
        if (val) {
            val.textContent = formatVal(def, def.default);
        }
    });
    STATE.steps = PARAMS.steps;
    STATE.debug = PARAMS.debug;
    STATE.cineDuration = PARAMS.cineSeg;
    fireParamChange();
    saveStorage();
    updateQualityLabelFromSteps();
    showToast('PARAMETERS RESET', 1.5);
}

// ============================================================
//  Auto-Orbit
// ============================================================
export function toggleAutoOrbit() {
    STATE.autoOrbit = !STATE.autoOrbit;
    btnAutoOrbit.classList.toggle('active', STATE.autoOrbit);
    if (STATE.autoOrbit && STATE.cineMode) {
        STATE.cineMode = false;
        updateDeckTitle();
        updateCineButton();
    }
    showToast(STATE.autoOrbit ? 'AUTO-ORBIT ON' : 'AUTO-ORBIT OFF', 1.2);
}

// ============================================================
//  HUD 更新
// ============================================================
export function updateHUD() {
    const dist = _camera.position.length();
    const inc = Math.asin(_camera.position.y / Math.max(dist, 0.001));
    const incDeg = THREE.MathUtils.radToDeg(inc);
    tDist.textContent = dist.toFixed(2) + ' RS';
    tInc.textContent = incDeg.toFixed(1) + '°';
    tSteps.textContent = STATE.steps;
    const qLabel = QUALITIES[STATE.quality]?.label || 'CINEMATIC';
    tProfile.textContent = qLabel;
    tFps.textContent = Math.round(STATE.fps) + ' fps';

    const sec = Math.floor(STATE.elapsed % 86400);
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}:${ss}`;
}

// camera 引用由 main.js 注入（避免循环依赖）
let _camera = null;
export function bindHUDCamera(camera) {
    _camera = camera;
}

let clockEl = document.getElementById('clock');

// ============================================================
//  事件绑定
// ============================================================
export function initUI() {
    btnCine.addEventListener('click', toggleCine);

    document.querySelectorAll('.preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.preset;
            applyPreset(name);
            showToast(`VIEW: ${btn.textContent}`, 1.5);
        });
    });

    btnAutoOrbit.addEventListener('click', toggleAutoOrbit);

    btnQuality.addEventListener('click', () => {
        const keys = ['standard', 'high', 'cinematic'];
        let idx = keys.indexOf(STATE.quality);
        idx = (idx + 1) % keys.length;
        const q = keys[idx];
        applyQuality(q);
        PARAMS.steps = STATE.steps;
        const slider = document.getElementById('prange-steps');
        if (slider) {
            slider.value = STATE.steps;
            slider.dispatchEvent(new Event('input'));
        }
        fireQualityChange();
        showToast(`QUALITY: ${QUALITIES[q].label}`, 1.2);
    });

    btnParams.addEventListener('click', () => {
        STATE.paramsVisible = !STATE.paramsVisible;
        paramsPanel.classList.toggle('hidden', !STATE.paramsVisible);
        btnParams.classList.toggle('active', STATE.paramsVisible);
    });

    btnHud.addEventListener('click', () => {
        STATE.hudVisible = !STATE.hudVisible;
        hud.classList.toggle('hidden-hud', !STATE.hudVisible);
        btnHud.classList.toggle('active', STATE.hudVisible);
    });

    btnSound.addEventListener('click', toggleSound);
    btnReset.addEventListener('click', resetParams);

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const key = e.key.toLowerCase();
        if (key === '1') applyPreset('poster');
        else if (key === '2') applyPreset('edge');
        else if (key === '3') applyPreset('polar');
        else if (key === '4') applyPreset('close');
        else if (key === 'c') { e.preventDefault(); toggleCine(); }
        else if (key === 'r') { e.preventDefault(); toggleAutoOrbit(); }
        else if (key === 'p') { e.preventDefault(); btnParams.click(); }
        else if (key === 'm') { e.preventDefault(); btnSound.click(); }
        else if (key === 'h') { e.preventDefault(); btnHud.click(); }
    });

    // 用户交互打断电影 (捕获阶段)
    const canvas = document.getElementById('view');
    canvas.addEventListener('pointerdown', breakCine, true);
    canvas.addEventListener('wheel', breakCine, true);
}
