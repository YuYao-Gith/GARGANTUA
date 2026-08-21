// ============================================================
//  shaders.js — 全部着色器代码（内联字符串）
// ============================================================

export const RAY_VERT = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

export const RAY_FRAG = `
    precision highp float;

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec3  uCamPos;
    uniform vec3  uCamTarget;
    uniform float uFov;
    uniform float uSteps;
    uniform float uRotSign;
    uniform float uDebug;
    uniform float uDin;
    uniform float uDout;
    uniform float uDopMax;
    uniform float uOpNear;
    uniform float uOpFar;
    uniform float uDiskBright;
    uniform float uStarBright;
    uniform float uSkyFloor;
    uniform float uRotSpeed;

    varying vec2 vUv;

    #define RS 1.0
    #define PI 3.14159265359

    // ---- 工具函数 ----
    float hash(vec3 p) {
        p = fract(p * 0.3183099 + .1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float hash2(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    // 3D value noise
    float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f*f*(3.0-2.0*f);
        float a = hash(i);
        float b = hash(i+vec3(1,0,0));
        float c = hash(i+vec3(0,1,0));
        float d = hash(i+vec3(1,1,0));
        float e = hash(i+vec3(0,0,1));
        float f_ = hash(i+vec3(1,0,1));
        float g = hash(i+vec3(0,1,1));
        float h = hash(i+vec3(1,1,1));
        return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
                   mix(mix(e,f_,f.x), mix(g,h,f.x), f.y), f.z);
    }

    // FBM 5层
    float fbm(vec3 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        for(int i=0; i<5; i++) {
            val += amp * noise3(p * freq);
            freq *= 2.03;
            amp *= 0.5;
            p += vec3(11.3, 7.7, 3.1);
        }
        return val;
    }

    // 2D hash 星点
    float starCell(vec2 p, float thresh) {
        vec2 i = floor(p);
        vec2 f = fract(p) - 0.5;
        float h = hash2(i);
        if(h < thresh) return 0.0;
        float d = length(f - vec2(hash2(i+0.5), hash2(i+1.7)));
        return exp(-d*d*120.0) * (1.0 + 0.5*sin(uTime*0.3 + h*100.0));
    }

    // ---- 黑体伪色 ----
    vec3 blackbody(float t) {
        t = clamp(t, 0.0, 2.0);
        vec3 c;
        if(t < 0.55) {
            float s = smoothstep(0.0, 0.55, t);
            c = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.42, 0.10), s);
        } else if(t < 1.05) {
            float s = smoothstep(0.50, 1.05, t);
            c = mix(vec3(1.0, 0.42, 0.10), vec3(1.0, 0.86, 0.55), s);
        } else {
            float s = smoothstep(1.05, 1.90, t);
            c = mix(vec3(1.0, 0.86, 0.55), vec3(0.85, 0.92, 1.25), s);
        }
        return c;
    }

    // ---- 背景星空 + 银河 ----
    vec3 background(vec3 dir) {
        vec3 col = uSkyFloor * vec3(0.10, 0.13, 0.28);

        // 银河
        vec3 gNorm = normalize(vec3(0.25, 1.0, 0.15));
        float w = dot(dir, gNorm);
        vec3 local = dir - w * gNorm;
        float band = exp(-w*w*7.0);
        // ★ 修复：vec3(vec3, float) 非法构造 → 显式展开，时间漂移加在 z 上
        float cloud1 = fbm(local * 4.0 + vec3(0.0, 0.0, uTime * 0.002));
        float cloud2 = fbm(local * 8.0 + 1.7 + vec3(0.0, 0.0, uTime * 0.003 + 5.3));
        float dust = 1.0 - 0.6 * cloud1 * cloud2;
        vec3 galCol = mix(vec3(0.04, 0.07, 0.20), vec3(0.42, 0.24, 0.52), cloud1 * 0.8);
        col += band * dust * galCol * 1.15 * 0.6;

        // 星点 (4层)
        float stars = 0.0;
        vec2 uv = dir.xz / (abs(dir.y) + 0.01);
        float scale = 120.0;
        stars += starCell(uv * scale, 0.952);
        stars += starCell(uv * scale * 1.7 + 10.3, 0.952);
        stars += starCell(uv * scale * 2.9 + 33.7, 0.952);
        stars += starCell(uv * scale * 5.1 + 77.1, 0.968);

        // Hero stars
        stars += starCell(uv * scale * 0.8 + 3.7, 0.9975) * 2.0;
        stars += starCell(uv * scale * 1.3 + 19.3, 0.9975) * 1.8;

        col += vec3(0.95, 0.92, 1.0) * stars * 0.7 * uStarBright;
        // 暖色点缀
        col += vec3(1.0, 0.75, 0.5) * stars * 0.3 * uStarBright;

        return col * uStarBright;
    }

    // ---- 主光线追踪 ----
    void main() {
        vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
        vec3 ro = uCamPos;
        vec3 target = uCamTarget;

        vec3 ww = normalize(target - ro);
        vec3 up = vec3(0.0, 1.0, 0.0);
        if(abs(dot(ww, up)) > 0.999) up = vec3(1.0, 0.0, 0.0);
        vec3 uu = normalize(cross(ww, up));
        vec3 vv = cross(uu, ww);
        vec3 rd = normalize(p.x * uu + p.y * vv + uFov * ww);

        vec3 pos = ro;
        vec3 vel = rd;
        vec3 col = vec3(0.0);
        float trans = 1.0;
        float minR = 1e5;
        float lastR = length(ro);
        int stepsUsed = 0;
        int crossingCount = 0;
        int validCrossingCount = 0;
        float firstAngle = 0.0;
        float crossingRadius = 0.0;
        float patternVal = 0.0;
        bool crossed = false;

        float stepLimit = uSteps;
        if(stepLimit < 10.0) stepLimit = 60.0;

        for(int i=0; i<600; i++) {
            if(float(i) >= stepLimit) break;
            float r = length(pos);
            if(r < 1.03 * RS) {
                trans = 0.0;
                break;
            }
            if(r > 45.0 && dot(pos, vel) > 0.0) {
                break;
            }
            minR = min(minR, r);

            // 测地线加速度
            vec3 h = cross(pos, vel);
            float h2 = dot(h, h);
            float r2 = r*r;
            float r3 = r2*r;
            vec3 acc = -1.5 * RS * h2 / (r3 * r) * pos;

            // 自适应步长
            float dt = max(0.012, r * mix(0.02, 0.06, smoothstep(6.0, 20.0, r)));

            vec3 nvel = normalize(vel + acc * dt);
            vec3 npos = pos + nvel * dt;

            // 盘面交叉检测
            if(pos.y * npos.y <= 0.0 && r > uDin && r < uDout) {
                float t = abs(pos.y) / (abs(pos.y) + abs(npos.y) + 1e-5);
                vec3 q = pos + (npos - pos) * t;
                float qr = length(q);
                if(qr > uDin && qr < uDout) {
                    float flux = 0.0;
                    float x = max(qr, 3.001);
                    flux = pow(x / 3.0, -3.0) * (1.0 - sqrt(3.0 / x));

                    // 温度
                    float temp = pow(flux * 10.0, 0.25);

                    // 噪声纹理
                    vec2 qxz = q.xz;
                    float ang = atan(qxz.y, qxz.x);
                    float omega = uRotSign * 1.1 * uRotSpeed * pow(3.0 / qr, 1.5);
                    float rotAng = ang + uTime * omega;

                    vec2 rotCoord = vec2(cos(rotAng), sin(rotAng)) * (qr - uDin) / (uDout - uDin);
                    float warp = fbm(vec3(rotCoord * 1.5, uTime * 0.02 + 3.0));
                    float det = smoothstep(18.0, 4.0, qr);
                    float turb = fbm(vec3(rotCoord * 3.0 + vec2(1.7, 3.3), uTime * 0.03));
                    float streak = fbm(vec3(rotCoord * 5.0 + vec2(7.1, 11.3), uTime * 0.04 + 2.0));
                    float laneMask = fbm(vec3(rotCoord * 0.8 + vec2(5.5, 9.9), uTime * 0.01 + 1.0));

                    float I = flux * 11.0 * (warp * 0.5 + 0.5) * (turb * 0.7 + 0.3) * (streak * 0.6 + 0.4) * (laneMask * 0.5 + 0.5);
                    I += exp(-pow((qr - 3.1) * 3.0, 2.0)) * 2.8;
                    I *= smoothstep(uDout, uDout - 14.0, qr);

                    // 相对论效应
                    float beta = sqrt(0.5 / qr);
                    float gamma = 1.0 / sqrt(1.0 - beta*beta);
                    vec2 tdir2 = vec2(-sin(ang), cos(ang)) * uRotSign;
                    vec3 tdir = vec3(tdir2.x, 0.0, tdir2.y);
                    float D = 1.0 / (gamma * (1.0 - dot(tdir * beta, rd)));
                    D = clamp(D, 0.50, uDopMax);
                    float g = sqrt(1.0 - RS / qr);

                    vec3 emit = blackbody(temp * D * g) * I;
                    emit *= D * D * D * g;

                    // 不透明度
                    float op = mix(uOpFar, uOpNear, smoothstep(13.0, 4.0, qr));
                    op *= smoothstep(uDout, uDout - 14.0, qr);

                    col += trans * op * emit * uDiskBright;
                    trans *= (1.0 - op);

                    // 记录调试数据
                    if(!crossed) {
                        crossed = true;
                        firstAngle = ang;
                        crossingRadius = qr;
                        patternVal = warp;
                    }
                    crossingCount++;
                    validCrossingCount++;

                    if(trans < 0.02) break;
                }
            }

            // 体积盘晕 (薄雾)
            if(abs(pos.y) < 0.45 && r > uDin && r < uDout) {
                float density = exp(-abs(pos.y) * 30.0) * 0.03 * smoothstep(uDout - 1.0, 10.0, r);
                float x = max(r, 3.001);
                float flux2 = pow(x / 3.0, -3.0) * (1.0 - sqrt(3.0 / x));
                float temp2 = pow(flux2 * 10.0, 0.25);
                vec3 glow = blackbody(temp2) * 0.3;
                col += trans * glow * density * dt * uDiskBright;
            }

            pos = npos;
            vel = nvel;
            stepsUsed = i + 1;
            lastR = r;
        }

        // 背景 (逃逸光线)
        if(trans > 0.0) {
            float dim = clamp((lastR - 1.03) * 0.45, 0.45, 1.0);
            vec3 bg = background(vel) * uStarBright;
            col += trans * bg * dim;
        }

        // 光子环
        float ring = exp(-pow((minR - 1.55) * 4.0, 2.0));
        col += vec3(1.0, 0.92, 0.80) * ring * 0.05;

        // ---- Debug 视图 ----
        float dMode = uDebug;
        if(dMode >= 1.0 && dMode <= 9.0) {
            if(dMode == 1.0) {
                // 仅盘/晕 (移除背景)
                col = col - trans * background(vel) * uStarBright * clamp((lastR-1.03)*0.45,0.45,1.0);
                col = max(col, 0.0);
            } else if(dMode == 2.0) {
                // 仅透镜背景
                col = trans * background(vel) * uStarBright * clamp((lastR-1.03)*0.45,0.45,1.0);
            } else if(dMode == 3.0) {
                // 步数热图
                float norm = float(stepsUsed) / stepLimit;
                col = vec3(norm * 0.8, norm * 0.3, (1.0 - norm) * 0.5);
            } else if(dMode == 4.0) {
                // 穿越半径图
                if(crossed) {
                    float rn = (crossingRadius - 2.0) / 40.0;
                    col = vec3(rn, 0.2, 1.0 - rn);
                } else {
                    col = vec3(0.0);
                }
            } else if(dMode == 5.0) {
                // 原始 turbulence pattern
                if(crossed) {
                    col = vec3(patternVal, patternVal * 0.5, patternVal * 0.8);
                } else {
                    col = vec3(0.0);
                }
            } else if(dMode == 6.0) {
                // 红=minR/12, 绿=crossingCount/4
                float rv = minR / 12.0;
                float gv = float(crossingCount) / 4.0;
                col = vec3(clamp(rv,0.0,1.0), clamp(gv,0.0,1.0), 0.0);
            } else if(dMode == 7.0) {
                // 有效穿盘次数分级
                int vc = validCrossingCount;
                if(vc == 0) col = vec3(0.0);
                else if(vc == 1) col = vec3(0.0, 0.3, 1.0);
                else if(vc == 2) col = vec3(0.2, 0.8, 0.2);
                else col = vec3(1.0, 0.1, 0.1);
            } else if(dMode == 8.0) {
                // 首个角度三相正弦
                if(crossed) {
                    float a = firstAngle / PI;
                    col = vec3(0.5 + 0.5*sin(a*3.0), 0.5 + 0.5*sin(a*3.0+2.09), 0.5 + 0.5*sin(a*3.0+4.19));
                } else {
                    col = vec3(0.0);
                }
            } else if(dMode == 9.0) {
                // 穿越半径条带
                if(crossed) {
                    float rn = fract(crossingRadius / 2.0);
                    col = vec3(rn, rn, rn);
                } else {
                    col = vec3(0.0);
                }
            }
        }

        // 调试视图0正常输出
        gl_FragColor = vec4(col, 1.0);
    }
`;

export const COMPOSITE_VERT = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const COMPOSITE_FRAG = `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uCA;

    varying vec2 vUv;

    // ACES
    vec3 aces(vec3 x) {
        x *= 0.95;
        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
        vec2 uv = vUv;
        vec2 res = uRes;

        // 色散
        vec2 dir = uv - 0.5;
        float ca = uCA * dot(dir, dir);
        vec2 uvR = uv + dir * ca;
        vec2 uvB = uv - dir * ca;
        float r = texture2D(tDiffuse, uvR).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uvB).b;
        vec3 col = vec3(r, g, b);

        // ACES
        col = aces(col);

        // 暗角 (考虑宽高比)
        float aspect = uRes.x / uRes.y;
        float v = smoothstep(1.30, 0.30, length(dir * vec2(aspect, 1.0)) * 1.15);
        v = mix(1.0, v, uVignette);
        col *= v;

        // 胶片颗粒
        float grain = hash(vec2(gl_FragCoord.x + uTime*13.7, gl_FragCoord.y + uTime*97.3)) - 0.5;
        col += grain * uGrain * (1.0 - 0.5 * col);

        // 输出
        gl_FragColor = vec4(col, 1.0);
    }
`;
