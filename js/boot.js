/*
 * boot.js — importmap 注入器（普通脚本，须在 module 脚本之前执行）
 *
 * 策略：
 *   1. 优先使用本地 vendor/（离线可用、加载快）—— 通过同步 XHR 探测存在性；
 *   2. 探测失败（file:// 直接打开、vendor 缺失、服务器 404）时，
 *      自动回退到 jsDelivr CDN（three@0.160.0），保证页面始终可运行。
 *
 * 备选 CDN：
 *   - https://unpkg.com/three@0.160.0/build/three.module.js
 *   - https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js
 */
(function () {
    'use strict';

    var THREE_VER = '0.160.0';
    var LOCAL_MAP = {
        'three': './vendor/three.module.js',
        'three/addons/': './vendor/jsm/'
    };
    var CDN_MAP = {
        'three': 'https://cdn.jsdelivr.net/npm/three@' + THREE_VER + '/build/three.module.js',
        'three/addons/': 'https://cdn.jsdelivr.net/npm/three@' + THREE_VER + '/examples/jsm/'
    };

    var useLocal = false;
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('HEAD', './vendor/three.module.js', false); // 同步探测
        xhr.send(null);
        useLocal = (xhr.status === 200 || xhr.status === 0);
    } catch (e) {
        useLocal = false;
    }

    var map = useLocal ? LOCAL_MAP : CDN_MAP;
    if (!useLocal) {
        console.info('[GARGANTUA] vendor/ 不可用（' + (location.protocol === 'file:' ? 'file:// 直开' : '文件缺失') + '），回退 CDN: three@' + THREE_VER);
    }

    var el = document.createElement('script');
    el.type = 'importmap';
    el.textContent = JSON.stringify({ imports: map });
    document.head.appendChild(el);
})();
