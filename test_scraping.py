#!/usr/bin/env python3
"""
測試腳本：驗證 TwitterHot API 爬取功能（不需要 Gemini API）
"""

import requests
import json
from datetime import datetime

# API 端點
TWEET_LIST_API = "https://ttmouse.com/api/tweets"
TWEET_DETAIL_API = "https://twitterhot.vercel.app/api/tweet_info"

def test_fetch_tweets():
    """測試抓取 tweet 列表"""
    date_str = "2026-01-13"
    url = f"{TWEET_LIST_API}?date={date_str}"
    
    print("=" * 60)
    print("🧪 測試 1: 抓取 Tweet 列表")
    print("=" * 60)
    print(f"URL: {url}")
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        tweets = response.json()
        print(f"✅ 成功取得 {len(tweets)} 個 tweets")
        
        if tweets:
            print(f"\n範例 Tweet 結構：")
            sample = tweets[0]
            print(json.dumps({
                "id": sample.get("id"),
                "author": sample.get("author"),
                "flat_tags": sample.get("flat_tags"),
                "publish_date": sample.get("publish_date")
            }, ensure_ascii=False, indent=2))
            
            return tweets[:3]  # 返回前 3 個
        
    except Exception as e:
        print(f"❌ 失敗：{e}")
        return []

def test_fetch_detail(tweet_id: str):
    """測試抓取單個 tweet 詳情"""
    url = f"{TWEET_DETAIL_API}?id={tweet_id}"
    
    print(f"\n🧪 測試 2: 抓取 Tweet 詳情 (ID: {tweet_id})")
    print("=" * 60)
    print(f"URL: {url}")
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        detail = response.json()
        print(f"✅ 成功取得詳情")
        
        # 提取 prompt
        prompt_sources = []
        
        # 檢查 media altText
        media_extended = detail.get("media_extended", [])
        for i, media in enumerate(media_extended):
            alt_text = media.get("altText", "")
            if alt_text:
                prompt_sources.append({
                    "source": f"media_extended[{i}].altText",
                    "text": alt_text[:100] + "..." if len(alt_text) > 100 else alt_text
                })
        
        # 檢查 text
        text = detail.get("text", "")
        if text:
            prompt_sources.append({
                "source": "text",
                "text": text[:100] + "..." if len(text) > 100 else text
            })
        
        # 檢查 qrt
        qrt = detail.get("qrt", {})
        qrt_text = qrt.get("text", "")
        if qrt_text:
            prompt_sources.append({
                "source": "qrt.text",
                "text": qrt_text[:100] + "..." if len(qrt_text) > 100 else qrt_text
            })
        
        print(f"\n📝 找到 {len(prompt_sources)} 個可能的 prompt 來源：")
        for source in prompt_sources:
            print(f"\n   來源：{source['source']}")
            print(f"   內容：{source['text']}")
        
        return detail
        
    except Exception as e:
        print(f"❌ 失敗：{e}")
        return None

def main():
    print("\n" + "=" * 60)
    print("TwitterHot API 爬取功能測試")
    print("=" * 60 + "\n")
    
    # 測試 1: 抓取列表
    tweets = test_fetch_tweets()
    
    if not tweets:
        print("\n❌ 無法繼續測試（列表為空）")
        return
    
    # 測試 2: 抓取前 3 個 tweet 的詳情
    for i, tweet in enumerate(tweets[:3], 1):
        tweet_id = tweet.get("id")
        if tweet_id:
            print(f"\n{'=' * 60}")
            print(f"處理第 {i}/3 個 Tweet")
            test_fetch_detail(tweet_id)
    
    print("\n" + "=" * 60)
    print("✅ 測試完成")
    print("=" * 60)

if __name__ == "__main__":
    main()
