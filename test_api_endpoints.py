#!/usr/bin/env python3
"""
TwitterHot API 測試腳本
"""

import requests
import json
from datetime import datetime, timedelta

# 測試可能的 API 端點
base_url = "https://twitterhot.vercel.app"
test_urls = [
    f"{base_url}/api/tweets",
    f"{base_url}/api/data",
    f"{base_url}/api/prompts",
    f"{base_url}/data/tweets.json",
    f"https://ttmouse.com/api/tweets",  # 從 HTML 的 CSP 看到這個域名
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

print("=" * 60)
print("測試 API 端點")
print("=" * 60)

for url in test_urls:
    print(f"\n🔍 測試：{url}")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"   狀態碼：{response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   ✅ 成功！數據類型：{type(data)}")
                if isinstance(data, list):
                    print(f"   項目數量：{len(data)}")
                    if len(data) > 0:
                        print(f"   第一個項目的 keys：{list(data[0].keys())}")
                elif isinstance(data, dict):
                    print(f"   Keys：{list(data.keys())}")
                
                # 儲存成功的回應
                filename = url.replace("https://", "").replace("/", "_") + ".json"
                with open(filename, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"   已儲存至：{filename}")
                
            except json.JSONDecodeError:
                print(f"   非 JSON 回應，內容長度：{len(response.text)}")
        else:
            print(f"   ❌ 失敗")
            
    except Exception as e:
        print(f"   ❌ 錯誤：{e}")

print("\n" + "=" * 60)
print("測試完成")
print("=" * 60)
