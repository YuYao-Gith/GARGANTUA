// ============================================================
//  audio.js — Web Audio 合成氛围音
// ============================================================

import { STATE } from './config.js';
import { showToast } from './toast.js';

let audioCtx = null;
let gainNode = null;
let osc1 = null,
    osc2 = null,
    osc3 = null;
let noiseNode = null;
let noiseGain = null;
let soundActive = false;
let btnSound = null;

function getSoundBtn() {
    if (!btnSound) btnSound = document.getElementById('btn-sound');
    return btnSound;
}

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(audioCtx.destination);
        return true;
    } catch (_) { return false; }
}

function buildNoiseBuffer(ctx, dur = 2) {
    const sr = ctx.sampleRate;
    const len = sr * dur;
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.08;
    }
    return buf;
}

export function startSound() {
    if (STATE.soundOn) return;
    if (!audioCtx) {
        if (!initAudio()) {
            showSoundBlocked();
            return;
        }
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { showSoundBlocked(); return; });
    }

    STATE.soundOn = true;
    const btn = getSoundBtn();
    btn.textContent = '🔊 SOUND: ON';
    btn.classList.add('active');

    try {
        osc1 = audioCtx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.value = 32;
        const g1 = audioCtx.createGain();
        g1.gain.value = 0.25;

        osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 41.2;
        const g2 = audioCtx.createGain();
        g2.gain.value = 0.15;

        osc3 = audioCtx.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.value = 27.5;
        const g3 = audioCtx.createGain();
        g3.gain.value = 0.18;

        const nbuf = buildNoiseBuffer(audioCtx, 4);
        noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = nbuf;
        noiseNode.loop = true;
        noiseGain = audioCtx.createGain();
        noiseGain.gain.value = 0.04;

        osc1.connect(g1);
        g1.connect(gainNode);
        osc2.connect(g2);
        g2.connect(gainNode);
        osc3.connect(g3);
        g3.connect(gainNode);
        noiseNode.connect(noiseGain);
        noiseGain.connect(gainNode);

        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoG = audioCtx.createGain();
        lfoG.gain.value = 4;
        lfo.connect(lfoG);
        lfoG.connect(osc1.frequency);
        lfoG.connect(osc2.frequency);
        lfo.start();

        osc1.start();
        osc2.start();
        osc3.start();
        noiseNode.start();

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.85, audioCtx.currentTime + 0.8);

        soundActive = true;
    } catch (e) {
        console.warn('Audio build error:', e);
        showSoundBlocked();
        STATE.soundOn = false;
        const btn2 = getSoundBtn();
        btn2.textContent = '🔇 SOUND: OFF';
        btn2.classList.remove('active');
    }
}

export function stopSound() {
    STATE.soundOn = false;
    const btn = getSoundBtn();
    btn.textContent = '🔇 SOUND: OFF';
    btn.classList.remove('active');
    if (gainNode) {
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    }
    soundActive = false;
}

export function toggleSound() {
    if (STATE.soundOn) {
        stopSound();
        showToast('SOUND OFF', 1);
    } else {
        startSound();
        showToast('SOUND ON', 1);
    }
}

export function showSoundBlocked() {
    const btn = getSoundBtn();
    btn.textContent = '⚠ SOUND: BLOCKED';
    btn.classList.remove('active');
    setTimeout(() => {
        const b = getSoundBtn();
        b.textContent = STATE.soundOn ? '🔊 SOUND: ON' : '🔇 SOUND: OFF';
        if (STATE.soundOn) b.classList.add('active');
    }, 2500);
}

export function alignSoundToCine() {
    // 占位：保持氛围连续性
}
