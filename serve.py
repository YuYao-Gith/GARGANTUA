#!/usr/bin/env python3
"""
GARGANTUA — 极简静态 HTTP 服务器

用法:
    python3 serve.py           # 默认端口 8000，自动打开浏览器
    python3 serve.py 8080      # 指定端口
    python3 serve.py 0         # 随机空闲端口

启动后浏览器访问 http://127.0.0.1:<端口>/
按 Ctrl+C 停止。
"""
import http.server
import os
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8000

# ES module 必须用 JavaScript MIME，显式指定最稳
MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".html": "text/html",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME.get(ext) or super().guess_type(path)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    requested = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    # 端口被占用时自动顺延，最多尝试 100 个
    httpd = None
    port = requested
    for p in range(port, port + 100):
        try:
            httpd = http.server.ThreadingHTTPServer(("", p), Handler)
            port = p
            break
        except OSError:
            continue
    if httpd is None:
        print("\n  错误：端口 %d~%d 均被占用，请换个端口再试。\n" % (requested, requested + 99))
        sys.exit(1)
    url = "http://127.0.0.1:%d/" % port
    print("\n  GARGANTUA 已启动: %s" % url)
    if port != requested:
        print("  提示：端口 %d 被占用，已自动改用 %d" % (requested, port))
    print("  按 Ctrl+C 停止\n")
    try:
        webbrowser.open(url)  # 无浏览器环境会静默跳过
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  已停止。")
        httpd.server_close()


if __name__ == "__main__":
    main()
