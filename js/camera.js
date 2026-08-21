// ============================================================
//  camera.js — 电影镜头路径 / 预设视角 / 飞行动画
// ============================================================

import * as THREE from 'three';
import { STATE, PARAMS } from './config.js';
import { showToast } from './toast.js';
import { alignSoundToCine } from './audio.js';

// ---- 预设镜头 ----
export const PRESETS = {
    poster: { r: 24, inc: 38, az: 30 },
    edge: { r: 26, inc: 6, az: 10 },
    polar: { r: 28, inc: 82, az: 0 },
    close: { r: 9, inc: 14, az: 55 },
};

// ---- 电影镜头路径 ----
const CINE_KEYFRAMES = [
    { r: 58, inc: 12, az: -30 },
    { r: 36, inc: 6, az: 10 },
    { r: 26, inc: 24, az: 55 },
    { r: 14, inc: 14, az: 100 },
    { r: 20, inc: 52, az: 150 },
    { r: 34, inc: 80, az: 200 },
    { r: 46, inc: 35, az: 270 },
    { r: 36, inc: 8, az: 330 },
];
const NUM_CINE_SEG = CINE_KEYFRAMES.length;
export const CINE_TOTAL = NUM_CINE_SEG * STATE.cineDuration;

export function sphToCart(r, incDeg, azDeg) {
    const inc = THREE.MathUtils.degToRad(incDeg);
    const az = THREE.MathUtils.degToRad(azDeg);
    return new THREE.Vector3(
        r * Math.cos(inc) * Math.sin(az),
        r * Math.sin(inc),
        r * Math.cos(inc) * Math.cos(az)
    );
}

function unwrapAz(arr) {
    const out = arr.slice();
    for (let i = 1; i < out.length; i++) {
        let diff = out[i] - out[i - 1];
        if (diff > 180) out[i] -= 360;
        else if (diff < -180) out[i] += 360;
    }
    return out;
}

function catmullRomClamp(t, knots) {
    const n = knots.length;
    const idx = Math.floor(t);
    const frac = t - idx;
    const i0 = Math.max(0, Math.min(n - 1, idx));
    const i1 = Math.max(0, Math.min(n - 1, idx + 1));
    const i2 = Math.max(0, Math.min(n - 1, idx + 2));
    const i3 = Math.max(0, Math.min(n - 1, idx + 3));
    const p0 = knots[i0],
        p1 = knots[i1],
        p2 = knots[i2],
        p3 = knots[i3];
    const f = frac;
    const f2 = f * f,
        f3 = f2 * f;
    const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
    const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
    const c = -0.5 * p0 + 0.5 * p2;
    const d = p1;
    return a * f3 + b * f2 + c * f + d;
}

function sampleCinePath(t) {
    const segLen = STATE.cineDuration;
    const total = NUM_CINE_SEG * segLen;
    let tt = ((t % total) + total) % total;
    const seg = Math.floor(tt / segLen);
    const frac = (tt - seg * segLen) / segLen;
    const idx = seg % NUM_CINE_SEG;
    const nextIdx = (seg + 1) % NUM_CINE_SEG;

    const rKnots = CINE_KEYFRAMES.map(k => k.r);
    const incKnots = CINE_KEYFRAMES.map(k => k.inc);
    const azKnots = unwrapAz(CINE_KEYFRAMES.map(k => k.az));

    const rExt = [...rKnots, ...rKnots.slice(0, 3)];
    const incExt = [...incKnots, ...incKnots.slice(0, 3)];
    const azExt = [...azKnots, ...azKnots.slice(0, 3)];

    const t0 = seg;
    const r = catmullRomClamp(t0 + frac, rExt);
    const inc = catmullRomClamp(t0 + frac, incExt);
    const az = catmullRomClamp(t0 + frac, azExt);
    return { r, inc, az };
}

export function getCinePosition(time) {
    const { r, inc, az } = sampleCinePath(time);
    return sphToCart(r, inc, az);
}

export function getCineTarget() {
    return new THREE.Vector3(0, 0, 0);
}

// ---- 飞行状态 ----
let flightStart = null;
let flightFrom = new THREE.Vector3();
let flightTo = new THREE.Vector3();
let flightDuration = 2.6;

// camera/controls 由 main.js 注入（避免循环依赖）
let _camera = null;
let _controls = null;
export function bindCamera(camera, controls) {
    _camera = camera;
    _controls = controls;
}

// DOM 引用（惰性）
let deckTitleEl = null;
let btnCineEl = null;
function getDeckTitle() {
    if (!deckTitleEl) deckTitleEl = document.getElementById('deck-title');
    return deckTitleEl;
}
function getBtnCine() {
    if (!btnCineEl) btnCineEl = document.getElementById('btn-cine');
    return btnCineEl;
}

export function flyTo(target, duration = 2.6) {
    flightFrom.copy(_camera.position);
    flightTo.copy(target);
    flightDuration = duration;
    flightStart = STATE.elapsed;
    STATE.isFlying = true;
    STATE.cineMode = false;
    STATE.presetFlight = true;
    updateDeckTitle();
    breakCine();
}

export function updateFlight() {
    if (!STATE.isFlying || flightStart === null) return;
    const t = (STATE.elapsed - flightStart) / flightDuration;
    if (t >= 1) {
        _camera.position.copy(flightTo);
        STATE.isFlying = false;
        STATE.presetFlight = false;
        flightStart = null;
        _controls.update();
        return;
    }
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    _camera.position.lerpVectors(flightFrom, flightTo, e);
    _controls.update();
}

export function breakCine() {
    if (STATE.cineMode) {
        STATE.cineMode = false;
        _controls.enableDamping = true;
        _controls.autoRotate = false;
        updateDeckTitle();
        updateCineButton();
        showToast('MANUAL CONTROL', 2);
    }
}

export function toggleCine() {
    if (STATE.cineMode) {
        STATE.cineMode = false;
        _controls.enableDamping = true;
        _controls.autoRotate = false;
        updateDeckTitle();
        updateCineButton();
        showToast('NAVIGATION', 1.5);
    } else {
        const pos = getCinePosition(STATE.cineTime);
        flyTo(pos, 2.0);
        const origFlight = STATE.isFlying;
        const checkFlight = () => {
            if (!STATE.isFlying) {
                STATE.cineMode = true;
                _controls.enableDamping = true;
                _controls.autoRotate = false;
                updateDeckTitle();
                updateCineButton();
                showToast('CINEMATIC SEQUENCE', 1.5);
                if (STATE.soundOn) alignSoundToCine();
            } else {
                requestAnimationFrame(checkFlight);
            }
        };
        setTimeout(checkFlight, 100);
    }
}

export function updateDeckTitle() {
    if (STATE.cineMode) {
        getDeckTitle().textContent = 'CINEMATIC SEQUENCE';
        getBtnCine().textContent = '▶ CINEMATIC SEQUENCE';
        getBtnCine().classList.add('active');
    } else {
        getDeckTitle().textContent = 'NAVIGATION';
        getBtnCine().textContent = '⏹ CINEMATIC SEQUENCE';
        getBtnCine().classList.remove('active');
    }
}

export function updateCineButton() {
    if (STATE.cineMode) {
        getBtnCine().textContent = '▶ CINEMATIC SEQUENCE';
        getBtnCine().classList.add('active');
    } else {
        getBtnCine().textContent = '⏹ CINEMATIC SEQUENCE';
        getBtnCine().classList.remove('active');
    }
}

export function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    const pos = sphToCart(p.r, p.inc, p.az);
    flyTo(pos, 2.6);
}
