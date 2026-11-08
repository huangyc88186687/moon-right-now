# -*- coding: utf-8 -*-
"""此刻的月亮 —— 用真实天文数据渲染月面光照"""
import os
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)


@app.after_request
def no_cache(response):
    # 静态资源禁用缓存，保证改版立即生效
    if request.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify(ok=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
