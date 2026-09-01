"""Web 演示服务器.

基于标准库 http.server,无需 Flask 依赖,直接可运行。

启动:
  python -m price_tracker.web.server
  python -m price_tracker.web.server --port 8000

接口:
  GET  /                  -> 演示页 index.html
  GET  /api/sample        -> 内置示例数据与结果(初始化展示)
  POST /api/search        -> 现场运行采集脚本, body: {"keyword": "...", "platforms": [...], "limit": 15, "mode": "mock"}
"""
from __future__ import annotations

import argparse
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from ..pipeline import run_pipeline, build_sample_result

WEB_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(WEB_DIR, "templates")
STATIC_DIR = os.path.join(WEB_DIR, "static")

# 示例数据缓存(进程启动时计算一次)
_SAMPLE_CACHE = {"data": None}


def get_sample_data() -> dict:
    if _SAMPLE_CACHE["data"] is None:
        _SAMPLE_CACHE["data"] = build_sample_result()
    return _SAMPLE_CACHE["data"]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # 静默默认日志
        pass

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path: str, content_type: str):
        try:
            with open(path, "rb") as f:
                body = f.read()
        except FileNotFoundError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/" or path == "/index.html":
            self._file(os.path.join(TEMPLATE_DIR, "index.html"), "text/html; charset=utf-8")
        elif path == "/api/sample":
            self._json(get_sample_data())
        elif path == "/static/app.js":
            self._file(os.path.join(STATIC_DIR, "app.js"), "application/javascript; charset=utf-8")
        elif path == "/static/style.css":
            self._file(os.path.join(STATIC_DIR, "style.css"), "text/css; charset=utf-8")
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/search":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except (ValueError, json.JSONDecodeError):
            self._json({"error": "请求体需为合法 JSON"}, status=400)
            return
        keyword = (payload.get("keyword") or "").strip()
        if not keyword:
            self._json({"error": "keyword 不能为空"}, status=400)
            return
        try:
            result = run_pipeline(
                keyword=keyword,
                platforms=payload.get("platforms", ["jd", "taobao", "pdd"]),
                limit_per_platform=int(payload.get("limit", 15)),
                mode=payload.get("mode", "mock"),
                seed=payload.get("seed"),
                history_days=int(payload.get("history_days", 14)),
                detect_anomalies=bool(payload.get("detect_anomalies", True)),
                filter_anomalies=bool(payload.get("filter_anomalies", False)),
                top_n=int(payload.get("top_n", 5)),
            )
            self._json(result)
        except Exception as e:  # noqa: BLE001
            self._json({"error": f"采集失败: {e}"}, status=500)


def serve(port: int = 8000, host: str = "0.0.0.0"):
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"价格采集对比工具 - Web 演示已启动")
    print(f"  地址: http://127.0.0.1:{port}/  (局域网: http://{host}:{port}/)")
    print(f"  示例数据已预加载(关键词: {get_sample_data()['keyword']})")
    print(f"  在页面输入关键词后点击'现场采集'即可运行采集脚本")
    print(f"  按 Ctrl+C 退出")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        server.server_close()


def main(argv=None):
    parser = argparse.ArgumentParser(prog="price_tracker.web", description="Web 演示服务器")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args(argv)
    # 启动前预加载示例数据
    get_sample_data()
    serve(args.port, args.host)


if __name__ == "__main__":
    main()
