#!/usr/bin/env python3
"""
測試腳本：檢查 twitterhot.vercel.app 的實際 HTML 結構
"""

import requests
from bs4 import BeautifulSoup

url = "https://twitterhot.vercel.app/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

response = requests.get(url, headers=headers, timeout=30)
soup = BeautifulSoup(response.text, "html.parser")

print("=" * 60)
print("HTML 結構分析")
print("=" * 60)

# 檢查所有 script tags
print("\n📌 所有 script tags:")
scripts = soup.find_all("script")
for i, script in enumerate(scripts[:5], 1):  # 只顯示前 5 個
    script_id = script.get("id", "無ID")
    script_type = script.get("type", "無TYPE")
    script_src = script.get("src", "無SRC")
    content_preview = str(script.string)[:100] if script.string else "無內容"
    print(f"{i}. ID={script_id}, TYPE={script_type}, SRC={script_src}")
    print(f"   內容預覽：{content_preview}")

# 檢查主要內容區域
print("\n📌 主要結構元素:")
main_tags = ["main", "div#__next", "div[class*='container']", "article", "section"]
for tag_selector in main_tags:
    elements = soup.select(tag_selector)
    if elements:
        print(f"找到 {len(elements)} 個 <{tag_selector}>")

# 儲存完整 HTML 以便檢視
with open("twitterhot_debug.html", "w", encoding="utf-8") as f:
    f.write(response.text)

print("\n✅ 完整 HTML 已儲存至 twitterhot_debug.html")
