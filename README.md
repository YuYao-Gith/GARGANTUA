# GARGANTUA — Schwarzschild Black Hole Raytracer

一个基于 WebGL / Three.js 的实时黑洞渲染器，在片元着色器中用 **Schwarzschild 度规下的零测地线（null geodesic）光线追踪**，模拟一颗 **1.0 × 10⁸ M☉** 超大质量黑洞的引力透镜、吸积盘与光子环。

纯前端项目，无构建步骤，零依赖（three.js 已内置于 `vendor/`），双击或任意静态服务器即可运行。

![type](https://img.shields.io/badge/type-WebGL%20Raytracer-blue)
![three](https://img.shields.io/badge/three.js-0.160.0-8A2BE2)
![license](https://img.shields.io/badge/license-Mulan%20PSL%20v2-green)

## 特性

- **物理渲染** — 每像素沿光线方向积分 Schwarzschild 度规下的零测地线，产生引力透镜、弯曲的吸积盘镜像与光子环；`uSteps` 控制积分步数（默认 460）。
- **电影镜头序列** — 88 秒、8 段关键帧飞越路径，含远景环绕、极轴俯视与近距穿越；用户交互自动打断并平滑接回。
- **预设视角** — POSTER 38° / EDGE-ON / POLAR / CLOSE PASS 四种机位一键切换。
- **三档画质** — STANDARD / HIGH / CINEMATIC（积分步数 200/320/460，像素比上限 1/1.5/2）。
- **后处理栈** — UnrealBloom 泛光、胶片颗粒、暗角、色差。
- **沉浸式 HUD** — 任务时钟、观测者距离（RS）、吸积盘倾角、积分步数、渲染档位与实时 FPS。
- **程序化音频** — WebAudio 实时合成（振荡器 + 噪声），无音频文件，随电影序列同步推进。
- **参数面板** — 吸积盘内外半径、亮度、旋转速度、泛光、噪点、色差等 20+ 参数实时调节，自动持久化到 `localStorage`。
- **URL 参数** — 支持 `?q=`、`?steps=`、`?shot`、`?cam=`、`?nocine`、`?ctime=`、`?debug=` 快速调参。
- **离线优先** — `boot.js` 注入 importmap：优先加载本地 `vendor/`，缺失或 `file://` 直开时自动回退 jsDelivr CDN。

## 快速开始

```bash
# 方式一：项目自带极简静态服务器（自动打开浏览器）
python3 serve.py            # 默认 8000 端口
python3 serve.py 8080       # 指定端口
python3 serve.py 0          # 随机空闲端口

# 方式二：任意静态服务器
npx serve .
```

浏览器访问 `http://127.0.0.1:8000` 即可。

> 需要 WebGL2 支持（Chrome / Edge / Firefox / Safari 15+ 均可）。也可以直接双击 `index.html` 以 `file://` 方式打开，会自动回退 CDN。

## 操作

| 操作 | 说明 |
| --- | --- |
| 拖拽 | 环绕观察（打断电影序列） |
| 滚轮 / 双指缩放 | 推拉镜头 |
| `1` – `4` | 预设视角：POSTER 38° / EDGE-ON / POLAR / CLOSE PASS |
| `C` | 切换电影镜头序列 |
| `R` | 自动环绕 |
| `P` | 参数面板 |
| `M` | 程序化音效开关 |
| `H` | 显示 / 隐藏 HUD |

## URL 参数

| 参数 | 说明 |
| --- | --- |
| `?q=standard\|high\|cinematic` | 画质档位 |
| `?steps=N` | 覆盖测地线积分步数 |
| `?shot` | 无界面截图模式（跳过加载动画、隐藏 HUD） |
| `?cam=r,inc,az` | 指定初始机位（球坐标，RS / 度 / 度） |
| `?nocine` | 启动时不自动播放电影序列 |
| `?ctime=s` | 跳转到电影序列第 s 秒 |
| `?debug=0-9` | 着色器调试可视化级别 |

## 目录结构

```
GARGANTUA/
├── index.html          # 入口页面 + HUD 结构
├── css/style.css       # 全部样式
├── js/
│   ├── boot.js         # importmap 注入器（本地 vendor / CDN 回退）
│   ├── config.js       # 全局状态、默认参数、URL 参数、localStorage
│   ├── main.js         # Three.js 场景、渲染循环、启动
│   ├── shaders.js      # 测地线光线追踪着色器（GLSL 内联字符串）
│   ├── camera.js       # 电影镜头路径 / 预设视角 / 飞行动画
│   ├── ui.js           # HUD、参数面板、键盘快捷键
│   ├── audio.js        # WebAudio 程序化音效
│   └── toast.js        # 轻提示
├── vendor/             # three.js 0.160.0 + addons（离线可用）
├── serve.py            # 极简静态 HTTP 服务器
└── README.md
```

## 网页端体验
无需安装，浏览器打开即可：  
[https://yuyao-gith.github.io/GARGANTUA/](https://yuyao-gith.github.io/GARGANTUA/)

## 实现要点

- **测地线积分**：每条光线从相机出发，在片元着色器内按自适应步长沿 Schwarzschild 时空积分，命中吸积盘（`uDin`–`uDout` 半径范围）或事件视界（RS = 1）时分别着色；天空与星空作为远场背景采样。
- **吸积盘**：开普勒角速度 + 相对论性多普勒增亮（`uDiskBright`），盘面双面渲染。
- **后处理**：`UnrealBloomPass` 泛光 → 色差 / 颗粒 / 暗角复合着色器，最终输出到线性色彩空间。

## 许可

[Mulan Permissive Software License, Version 2 (Mulan PSL v2)](LICENSE)
