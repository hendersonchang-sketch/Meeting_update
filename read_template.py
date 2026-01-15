# -*- coding: utf-8 -*-
"""
讀取 Word 範本的完整內容
"""
from docx import Document
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

def read_full_content(file_path):
    """讀取 Word 文件完整內容"""
    doc = Document(file_path)
    
    print(f"\n{'='*80}")
    print(f"檔案: {os.path.basename(file_path)}")
    print(f"{'='*80}\n")
    
    for para in doc.paragraphs:
        if para.text.strip():
            print(para.text)
    
    print("\n")

# 只讀取第一個範本來比對內容風格
template_path = "NSL-技術小組進度會議-20251210會議摘要.docx"
if not os.path.exists(template_path):
    print(f"檔案不存在: {template_path}")
else:
    read_full_content(template_path)
