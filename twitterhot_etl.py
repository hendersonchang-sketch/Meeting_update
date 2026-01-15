#!/usr/bin/env python3
"""
TwitterHot AI Prompt 每日 ETL Pipeline (修正版)
功能：從 ttmouse.com API 抓取 AI prompts，使用 Gemini API 進行翻譯、標籤提取與向量嵌入
"""

import os
import json
import sys
import time
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import requests
import google.generativeai as genai


# ============ 設定區 ============

# Google Gemini API 金鑰
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
if not GOOGLE_API_KEY:
    print("⚠️  警告：未設定 GOOGLE_API_KEY 環境變數")
    print("請執行：$env:GOOGLE_API_KEY='your_api_key_here'")

# API 端點
TWEET_LIST_API = "https://ttmouse.com/api/tweets"
TWEET_DETAIL_API = "https://twitterhot.vercel.app/api/tweet_info"

# API 模型配置
GEMINI_MODEL = "gemini-1.5-flash"
EMBEDDING_MODEL = "models/text-embedding-004"

# 預設處理數量限制（節省 API 配額）
DEFAULT_LIMIT = 10

# Retry 設定
MAX_RETRIES = 3
RETRY_DELAY = 2  # 秒


# ============ 工具函數 ============

def init_gemini_api():
    """初始化 Gemini API"""
    if not GOOGLE_API_KEY:
        raise ValueError("❌ GOOGLE_API_KEY 未設定，無法初始化 Gemini API")
    genai.configure(api_key=GOOGLE_API_KEY)
    print("✅ Gemini API 初始化成功")


def retry_on_failure(func, *args, max_retries=MAX_RETRIES, **kwargs):
    """通用 retry 裝飾器"""
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            print(f"⚠️  嘗試 {attempt + 1}/{max_retries} 失敗：{e}")
            time.sleep(RETRY_DELAY * (attempt + 1))
    return None


# ============ API 爬取模組 ============

def fetch_tweet_list(date_str: str = None) -> List[Dict[str, Any]]:
    """
    抓取 tweet 列表
    
    Args:
        date_str: 日期字串 (YYYY-MM-DD)，預設為今天
        
    Returns:
        Tweet 列表
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    url = f"{TWEET_LIST_API}?date={date_str}"
    print(f"🌐 正在抓取 tweet 列表：{url}")
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        tweets = data if isinstance(data, list) else data.get("items", [])
        
        print(f"✅ 成功取得 {len(tweets)} 個 tweets")
        return tweets
        
    except requests.RequestException as e:
        print(f"❌ API 請求失敗：{e}")
        return []
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失敗：{e}")
        return []


def fetch_tweet_detail(tweet_id: str) -> Optional[Dict[str, Any]]:
    """
    抓取單個 tweet 的詳細資訊
    
    Args:
        tweet_id: Tweet ID
        
    Returns:
        Tweet 詳細資訊字典
    """
    url = f"{TWEET_DETAIL_API}?id={tweet_id}"
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        return response.json()
        
    except Exception as e:
        print(f"❌ 取得 tweet 詳情失敗 (ID: {tweet_id})：{e}")
        return None


def extract_prompt_from_tweet(tweet_detail: Dict[str, Any]) -> Optional[str]:
    """
    從 tweet 詳情中提取 AI prompt
    
    優先順序：
    1. media_extended[].altText（最常見的 prompt 位置）
    2. text（主要文字）
    3. qrt.text（引用推文）
    
    Args:
        tweet_detail: Tweet 詳細資訊
        
    Returns:
        提取到的 prompt 文字
    """
    # 安全檢查
    if not tweet_detail or not isinstance(tweet_detail, dict):
        return None
    
    # 策略 1: 檢查 media altText
    media_extended = tweet_detail.get("media_extended", [])
    if media_extended:
        for media in media_extended:
            if not isinstance(media, dict):
                continue
            alt_text = media.get("altText", "").strip()
            if alt_text and len(alt_text) > 20:  # 至少 20 字元
                return alt_text
    
    # 策略 2: 檢查主要文字
    text = tweet_detail.get("text", "").strip()
    if text and len(text) > 20:
        return text
    
    # 策略 3: 檢查引用推文
    qrt = tweet_detail.get("qrt")
    if qrt and isinstance(qrt, dict):
        qrt_text = qrt.get("text", "").strip()
        if qrt_text and len(qrt_text) > 20:
            return qrt_text
    
    return None


# ============ Gemini API 轉換模組 ============

def transform_prompt_with_gemini(prompt_text: str) -> Optional[Dict[str, Any]]:
    """
    使用 Gemini API 進行 prompt 轉換：翻譯、標籤提取、清理
    
    Args:
        prompt_text: 原始 prompt 文字
        
    Returns:
        包含 translated_text_zh, tags, cleaned_text 的字典
    """
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        # 建立結構化 prompt
        system_prompt = f"""你是一位專業的 AI 藝術 prompt 分析專家。
請分析以下 AI 藝術生成 prompt，並以 JSON 格式回傳：

{{
  "translated_text_zh": "繁體中文翻譯（台灣用語風格）",
  "tags": ["標籤1", "標籤2", "標籤3", "標籤4", "標籤5"],
  "cleaned_text": "優化後的英文 prompt（移除冗餘詞、修正文法）"
}}

**要求：**
1. 翻譯必須符合台灣繁體中文習慣用語
2. 提取 5 個最能代表此 prompt 風格的標籤（如 cyberpunk, watercolor, portrait 等）
3. 清理後的英文應保持原意但更精簡專業
4. **僅回傳 JSON，不要包含任何其他說明文字**

原始 Prompt：
{prompt_text}
"""
        
        response = model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                candidate_count=1,
            )
        )
        
        # 解析 JSON 回應
        response_text = response.text.strip()
        
        # 移除可能的 markdown code block 標記
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        result = json.loads(response_text.strip())
        
        # 驗證必要欄位
        required_fields = ["translated_text_zh", "tags", "cleaned_text"]
        if not all(field in result for field in required_fields):
            raise ValueError(f"API 回應缺少必要欄位：{required_fields}")
        
        return result
        
    except Exception as e:
        print(f"❌ Gemini API 轉換失敗：{e}")
        return None


def generate_embedding(text: str) -> Optional[List[float]]:
    """
    使用 text-embedding-004 生成向量嵌入
    
    Args:
        text: 要嵌入的文字
        
    Returns:
        向量列表（768 維），失敗時返回 None
    """
    try:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_document"
        )
        
        embedding = result["embedding"]
        print(f"✅ 生成向量嵌入（{len(embedding)} 維）")
        return embedding
        
    except Exception as e:
        print(f"❌ 向量嵌入生成失敗：{e}")
        return None


# ============ 主流程 ============

def main(limit: int = DEFAULT_LIMIT, date_str: str = None, test_mode: str = None):
    """
    主 ETL 流程
    
    Args:
        limit: 處理的 prompt 數量上限
        date_str: 目標日期 (YYYY-MM-DD)
        test_mode: 測試模式（"api" 或 None）
    """
    print("=" * 60)
    print("🚀 TwitterHot AI Prompt ETL Pipeline")
    print("=" * 60)
    
    # 初始化 API
    try:
        init_gemini_api()
    except ValueError as e:
        if test_mode != "scrape":
            print(e)
            if test_mode == "api":
                return
    
    # 測試模式：僅測試 API
    if test_mode == "api":
        test_prompt = "A beautiful sunset over the ocean, vibrant colors, photorealistic"
        print(f"\n🧪 測試 Gemini API（測試 prompt）")
        result = transform_prompt_with_gemini(test_prompt)
        if result:
            print("✅ API 測試成功")
            print(json.dumps(result, ensure_ascii=False, indent=2))
        embedding = generate_embedding(test_prompt)
        if embedding:
            print(f"✅ 向量嵌入測試成功（{len(embedding)} 維）")
        return
    
    # 完整 ETL 流程
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    print(f"\n📊 開始處理（日期：{date_str}，限制：{limit} 個 prompts）")
    
    # Step 1: 抓取 tweet 列表
    tweets = retry_on_failure(fetch_tweet_list, date_str)
    if not tweets:
        print("❌ ETL 中止：未找到任何 tweets")
        return
    
    # 限制處理數量
    tweets = tweets[:limit]
    
    # Step 2: 處理每個 tweet
    processed_data = []
    for idx, tweet_meta in enumerate(tweets, 1):
        tweet_id = tweet_meta.get("id")
        if not tweet_id:
            print(f"⚠️  跳過無效項目（缺少 ID）")
            continue
        
        print(f"\n[{idx}/{len(tweets)}] 處理 Tweet ID: {tweet_id}")
        
        # 取得詳細資訊
        tweet_detail = retry_on_failure(fetch_tweet_detail, tweet_id)
        if not tweet_detail:
            print(f"⚠️  跳過此 tweet（無法取得詳情）")
            continue
        
        # 提取 prompt
        prompt_text = extract_prompt_from_tweet(tweet_detail)
        if not prompt_text:
            print(f"⚠️  跳過此 tweet（未找到 prompt 文字）")
            continue
        
        print(f"原文：{prompt_text[:80]}...")
        
        # 使用 Gemini 進行轉換
        transformed = retry_on_failure(
            transform_prompt_with_gemini,
            prompt_text
        )
        
        if not transformed:
            print(f"⚠️  跳過此 prompt（轉換失敗）")
            continue
        
        # 生成向量嵌入
        embedding = retry_on_failure(
            generate_embedding,
            prompt_text
        )
        
        # 組裝最終數據
        processed_item = {
            "id": tweet_id,
            "original_prompt": prompt_text,
            "translated_prompt_zh": transformed["translated_text_zh"],
            "cleaned_prompt": transformed["cleaned_text"],
            "tags": transformed["tags"],
            "api_tags": tweet_meta.get("flat_tags", []),  # 來自 API 的標籤
            "embedding": embedding or [],
            "author": tweet_meta.get("author", {}),
            "publish_date": tweet_meta.get("publish_date", ""),
            "processed_at": datetime.now().isoformat()
        }
        
        processed_data.append(processed_item)
        print(f"✅ 處理完成：{transformed['translated_text_zh'][:50]}...")
        
        # 避免 API 速率限制
        time.sleep(0.5)
    
    # Step 3: 輸出 JSON
    output_filename = f"twitterhot_prompts_{date_str.replace('-', '')}.json"
    output_path = os.path.join(
        os.path.dirname(__file__),
        output_filename
    )
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(processed_data, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print(f"✅ ETL 完成！處理了 {len(processed_data)}/{len(tweets)} 個 prompts")
    print(f"📁 輸出檔案：{output_path}")
    print("=" * 60)


# ============ CLI 入口 ============

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="TwitterHot AI Prompt ETL Pipeline"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"處理的 prompt 數量上限（預設：{DEFAULT_LIMIT}）"
    )
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="目標日期 (YYYY-MM-DD)，預設為今天"
    )
    parser.add_argument(
        "--test-api",
        action="store_true",
        help="僅測試 Gemini API 連線"
    )
    
    args = parser.parse_args()
    
    # 決定測試模式
    test_mode = "api" if args.test_api else None
    
    main(limit=args.limit, date_str=args.date, test_mode=test_mode)
