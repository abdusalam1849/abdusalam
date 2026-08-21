"""演示网页后端：基于 Flask.

提供两个端点：
- GET  /             渲染主页（含初始示例数据）
- GET  /api/sample   返回内置示例数据（sample_input + sample_output）
- POST /api/run       现场运行脚本：接收 {keyword, limit, platforms, demo}，返回完整报告

启动：
    python -m web.app --port 5000
    python web/app.py
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, render_template, request

# 让 price_tracker 包可被导入（从 web/ 目录运行时）
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from price_tracker import Pipeline  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("web")

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
STATIC_DIR = Path(__file__).resolve().parent / "static"
DATA_DIR = ROOT / "data"

app = Flask(__name__, template_folder=str(TEMPLATE_DIR), static_folder=str(STATIC_DIR))
_pipeline = Pipeline()


def _load_sample() -> Dict[str, Any]:
    """加载内置示例数据（采集输入 + 分析结果）。"""
    sample = {"input": None, "output": None}
    for key, fname in (("input", "sample_input.json"), ("output", "sample_output.json")):
        path = DATA_DIR / fname
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                sample[key] = json.load(f)
    return sample


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/sample")
def api_sample():
    return jsonify(_load_sample())


@app.route("/api/run", methods=["POST"])
def api_run():
    payload = request.get_json(silent=True) or {}
    keyword = (payload.get("keyword") or "").strip()
    if not keyword:
        return jsonify({"error": "keyword 不能为空"}), 400
    try:
        limit = max(1, min(int(payload.get("limit", 10)), 50))
    except (TypeError, ValueError):
        limit = 10
    platforms = payload.get("platforms") or None
    if platforms:
        platforms = [p for p in platforms if p in ("jd", "taobao", "pdd")] or None
    demo = bool(payload.get("demo", True))  # 默认 demo 模式（沙箱内真实采集大概率被风控）

    try:
        report = _pipeline.run(
            keyword,
            limit=limit,
            platforms=platforms,
            demo=demo,
            allow_fallback=True,
        )
        chart_json = _pipeline.visualizer._build_chart_payload(report.to_dict())
        return jsonify({"report": report.to_dict(), "charts": chart_json})
    except Exception as exc:  # noqa: BLE001  演示页面需返回可读错误
        logger.exception("run failed")
        return jsonify({"error": f"运行失败：{exc}"}), 500


@app.route("/api/health")
def api_health():
    return jsonify({"status": "ok", "platforms": [s.platform for s in _pipeline.registry.all()]})


def main():
    import argparse
    parser = argparse.ArgumentParser(description="价格对比工具演示网页")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()
    logger.info("启动演示网页 http://%s:%s", args.host, args.port)
    app.run(host=args.host, port=args.port, debug=args.debug, use_reloader=False)


if __name__ == "__main__":
    main()
