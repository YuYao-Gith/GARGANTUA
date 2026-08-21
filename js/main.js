// ============================================================
//  main.js — 入口：Three.js 场景 / 渲染循环 / 启动
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { RAY_VERT, RAY_FRAG, COMPOSITE_VERT, COMPOSITE_FRAG } from './shaders.js';
import { STATE, PARAMS, URLP } from './config.js';
import { showToast } from './toast.js';
import { bindCamera, breakCine, getCinePosition, updateFlight, updateDeckTitle, updateCineButton, PRESETS, sphToCart } from './camera.js';
import { buildParamsPanel, bindHUDCamera, initUI, updateHUD, updateQualityLabelFromSteps } from './ui.js';

// ============================================================
//  全局状态注入（clock 依赖 three）
// ============================================================
STATE.clock = new THREE.Clock();

// ============================================================
//  Three.js 场景
// ============================================================
const canvas = document.getElementById('view');

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, STATE.dprCap));

const fsScene = new THREE.Scene();
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
        vertexShader: RAY_VERT,
        fragmentShader: RAY_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
            uRes: { value: new THREE.Vector2(1, 1) },
            uTime: { value: 0 },
            uCamPos: { value: new THREE.Vector3(4.49, 2.72, 25.46) },
            uCamTarget: { value: new THREE.Vector3(0, 0, 0) },
            uFov: { value: 1 / Math.tan(THREE.MathUtils.degToRad(44) / 2) },
            uSteps: { value: STATE.steps },
            uRotSign: { value: 1 },
            uDebug: { value: PARAMS.debug },
            uDin: { value: PARAMS.din },
            uDout: { value: PARAMS.dout },
            uDopMax: { value: PARAMS.dopMax },
            uOpNear: { value: PARAMS.opNear },
            uOpFar: { value: PARAMS.opFar },
            uDiskBright: { value: PARAMS.diskBright },
            uStarBright: { value: PARAMS.starBright },
            uSkyFloor: { value: PARAMS.skyFloor },
            uRotSpeed: { value: PARAMS.rotSpeed },
        },
    })
);
fsScene.add(plane);

// 观察相机
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(4.49, 2.72, 25.46);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.62;
controls.maxDistance = PARAMS.maxDist;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.7;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.12;
controls.update();

// 注入 camera/controls 给 camera.js / ui.js
bindCamera(camera, controls);
bindHUDCamera(camera);

// ============================================================
//  后处理
// ============================================================
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(fsScene, fsCam);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    PARAMS.bloomStr,
    PARAMS.bloomRad,
    PARAMS.bloomThr
);
composer.addPass(bloomPass);

// 自定义合成 Pass
const compositePass = new ShaderPass({
    vertexShader: COMPOSITE_VERT,
    fragmentShader: COMPOSITE_FRAG,
    uniforms: {
        tDiffuse: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uVignette: { value: PARAMS.vignette },
        uGrain: { value: PARAMS.grain },
        uCA: { value: PARAMS.ca },
    },
});
compositePass.renderToScreen = true;
composer.addPass(compositePass);

// ============================================================
//  resize
// ============================================================
function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, STATE.dprCap);

    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const fb = renderer.getDrawingBufferSize(new THREE.Vector2());
    const res = plane.material.uniforms.uRes.value;
    res.set(fb.x, fb.y);
    compositePass.uniforms.uRes.value.set(fb.x, fb.y);

    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    plane.material.uniforms.uFov.value = 1 / Math.tan(fovRad / 2);
}

window.addEventListener('resize', resize);

// ============================================================
//  Uniform 同步
// ============================================================
function syncUniforms() {
    const mat = plane.material;
    mat.uniforms.uCamPos.value.copy(camera.position);
    mat.uniforms.uCamTarget.value.copy(controls.target);
    mat.uniforms.uSteps.value = STATE.steps;
    mat.uniforms.uDebug.value = PARAMS.debug;
    mat.uniforms.uDin.value = PARAMS.din;
    mat.uniforms.uDout.value = PARAMS.dout;
    mat.uniforms.uDopMax.value = PARAMS.dopMax;
    mat.uniforms.uOpNear.value = PARAMS.opNear;
    mat.uniforms.uOpFar.value = PARAMS.opFar;
    mat.uniforms.uDiskBright.value = PARAMS.diskBright;
    mat.uniforms.uStarBright.value = PARAMS.starBright;
    mat.uniforms.uSkyFloor.value = PARAMS.skyFloor;
    mat.uniforms.uRotSpeed.value = PARAMS.rotSpeed;
    mat.uniforms.uRotSign.value = PARAMS.rotSign;

    bloomPass.strength = PARAMS.bloomStr;
    bloomPass.radius = PARAMS.bloomRad;
    bloomPass.threshold = PARAMS.bloomThr;

    compositePass.uniforms.uVignette.value = PARAMS.vignette;
    compositePass.uniforms.uGrain.value = PARAMS.grain;
    compositePass.uniforms.uCA.value = PARAMS.ca;

    controls.maxDistance = PARAMS.maxDist;
    // 更新相机 FOV
    if (camera.fov !== PARAMS.fov) {
        camera.fov = PARAMS.fov;
        camera.updateProjectionMatrix();
        const fovRad = THREE.MathUtils.degToRad(camera.fov);
        mat.uniforms.uFov.value = 1 / Math.tan(fovRad / 2);
    }
}

// ui.js 参数/质量变化 → 同步 uniform
window.addEventListener('gargantua:param-change', syncUniforms);
window.addEventListener('gargantua:quality-change', () => {
    syncUniforms();
    resize();
});

// ============================================================
//  动画循环
// ============================================================
function animate() {
    const dt = Math.min(STATE.clock.getDelta(), 0.1);
    STATE.elapsed += dt;

    STATE.fpsSamples.push(1 / (dt + 0.001));
    if (STATE.fpsSamples.length > 60) STATE.fpsSamples.shift();
    STATE.fps = STATE.fpsSamples.reduce((a, b) => a + b, 0) / STATE.fpsSamples.length;

    const mat = plane.material;
    mat.uniforms.uTime.value = STATE.elapsed;
    compositePass.uniforms.uTime.value = STATE.elapsed;

    if (STATE.cineMode && !STATE.isFlying) {
        STATE.cineTime += dt;
        const pos = getCinePosition(STATE.cineTime);
        camera.position.copy(pos);
        controls.target.set(0, 0, 0);
        controls.update();
        if (STATE.soundOn && STATE.cineMode) {
            // 简单对齐
        }
    }

    if (STATE.isFlying) {
        updateFlight();
    }

    if (STATE.autoOrbit && !STATE.cineMode) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = PARAMS.autoSpeed;
    } else if (!STATE.autoOrbit) {
        controls.autoRotate = false;
    }

    controls.update();
    syncUniforms();
    composer.render();

    if (STATE.elapsed - STATE.lastHUDUpdate > 0.25) {
        STATE.lastHUDUpdate = STATE.elapsed;
        updateHUD();
    }

    if (STATE.shotMode) {
        STATE.shotFrames++;
        if (STATE.shotFrames >= 4) {
            document.title = 'SHOT_OK';
            return;
        }
    }

    if (!STATE.ready) {
        STATE.ready = true;
        document.body.classList.add('ready');
        setTimeout(() => {
            showToast('DRAG ORBIT · SCROLL/PINCH ZOOM · C CINEMATIC · M SOUND · 1-4 VIEWS · P PARAMS · H HUD', 10);
        }, 2500);
        if (URLP.cam && PRESETS[URLP.cam]) {
            setTimeout(() => {
                const pos = sphToCart(
                    PRESETS[URLP.cam].r,
                    PRESETS[URLP.cam].inc,
                    PRESETS[URLP.cam].az
                );
                camera.position.copy(pos);
                controls.update();
                STATE.cineMode = false;
                updateDeckTitle();
                updateCineButton();
            }, 100);
        }
        if (URLP.ctime > 0 && STATE.cineMode) {
            STATE.cineTime = URLP.ctime;
            const pos = getCinePosition(STATE.cineTime);
            camera.position.copy(pos);
            controls.update();
        }
        if (URLP.shot) {
            STATE.shotMode = true;
            document.body.classList.add('shot-mode');
            document.getElementById('intro').style.display = 'none';
        }
    }

    requestAnimationFrame(animate);
}

// ============================================================
//  Context 丢失恢复
// ============================================================
renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showToast('⚠ WEBGL CONTEXT LOST — reloading', 3);
    setTimeout(() => location.reload(), 3000);
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
    showToast('WEBGL CONTEXT RESTORED', 2);
});

// ============================================================
//  页面隐藏时降低渲染频率 (简单处理)
// ============================================================
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        STATE.clock.stop();
    } else {
        STATE.clock.start();
    }
});

// ============================================================
//  启动
// ============================================================
buildParamsPanel();
updateQualityLabelFromSteps(); // 启动时同步质量标签与持久化的 steps
initUI();
controls.addEventListener('start', breakCine);
resize();
animate();

if (URLP.shot) {
    setTimeout(() => {
        document.title = 'SHOT_OK';
    }, 2000);
}

window.addEventListener('error', (e) => {
    console.error(e);
    showToast('⚠ SHADER ERROR — see console', 4);
});

console.log('GARGANTUA — Schwarzschild Black Hole Raytracer');
console.log('© 2026 · Real-time Relativistic Raytracing');

// 导出调试
window.__GARGANTUA = { STATE, PARAMS, camera, controls, renderer, composer };
