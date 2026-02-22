from __future__ import annotations
"""
Enhanced Sentiment Analyzer Service — Two-Phase Analysis Pipeline

Phase 1: Quick classification — is this post investment-related?
Phase 2: Deep extraction — extract all assets with individual signals.

Signal Types: BUY, SELL, HEDGE, WATCH, CLOSED
"""

import requests
import json
from typing import Dict, Any, List

# ────────────────────────────────────────────
# Signal & Post-Type Constants
# ────────────────────────────────────────────
VALID_SIGNALS = {"BUY", "SELL", "HEDGE", "WATCH", "CLOSED"}


class SentimentAnalyzerService:
    def __init__(self, model_name: str = "deepseek-r1:8b", api_url: str = "http://localhost:11434/api/generate"):
        self.model_name = model_name
        self.api_url = api_url

    # ────────────────────────────────────────────
    # Phase 1: Quick Classification
    # ────────────────────────────────────────────
    def classify_post(self, post_content: str) -> Dict[str, Any]:
        """
        Quickly classifies whether a post contains investment-related content.
        Returns: {"is_investment": bool, "post_type": str, "reason": str}
        """
        prompt = f"""You are a bilingual financial content classifier fluent in English and Traditional Chinese (繁體中文).
Your job is to determine whether a social media post contains ACTIONABLE investment content — meaning it references a specific trade, holding, recommendation, or exit.

PRECISION-FIRST RULE: If the intent is ambiguous or you are unsure, classify as NOT investment-related. It is far better to miss a borderline post than to incorrectly flag a non-investment post.

Post:
\"\"\"{post_content}\"\"\"

Respond ONLY in valid JSON:
{{
  "is_investment": true or false,
  "post_type": "<type>",
  "reason": "Brief explanation in English"
}}

Post type definitions (pick the BEST match):
- "single_pick": Post recommends or analyzes ONE specific stock/asset with a directional view.
- "portfolio_update": Post lists multiple current holdings or position changes (e.g., "持股更新", "Weekly portfolio").
- "trade_journal": Post recounts a specific completed or ongoing trade (e.g., "今天買了 NVDA", "已停損 AAPL").
- "earnings_review": Post is analyzing an earnings report or a company's financial results.
- "company_analysis": Post provides fundamentals-driven analysis of a specific company.
- "market_commentary": General macro/market views (Fed, CPI, index levels) WITHOUT specific ticker actions.
- "educational": Post teaches a concept (options, charting, DCA) and any tickers are hypothetical examples only.
- "lifestyle" / "other": Not investment-related.

Classification rules:
- is_investment = true ONLY if there is a real trade, holding, recommendation, or exit involving a specific ticker.
- If tickers appear ONLY as illustrative examples in educational content, set is_investment = false.
- If the post is purely macro commentary with no specific ticker action, set is_investment = false.
- A post that says "我覺得 X 不錯" (implicit bullishness) IS investment-related.
- A post that says "什麼是看跌期權？用 TSLA 舉例..." is NOT investment-related."""

        result = self._call_model(prompt)
        if "error" in result:
            return {"is_investment": False, "post_type": "other", "reason": result["error"]}
        
        return {
            "is_investment": result.get("is_investment", False),
            "post_type": result.get("post_type", "other"),
            "reason": result.get("reason", "")
        }

    # ────────────────────────────────────────────
    # Phase 2: Deep Asset Extraction
    # ────────────────────────────────────────────
    def extract_assets(self, post_content: str, post_type: str = "portfolio_update") -> Dict[str, Any]:
        """
        Deep analysis: extract ALL mentioned assets with individual signals.
        Each asset gets its own independent signal determination.
        """
        prompt = f"""Role: You are an expert Bilingual Financial Analyst fluent in English and Traditional Chinese (繁體中文).
Task: Extract EVERY stock/asset from this post that represents a REAL trade, holding, recommendation, or exit. Assign each asset an independent signal.

═══════════════════════════════════
 SIGNAL DEFINITIONS (5 types)
═══════════════════════════════════

BUY — Author is bullish or has taken / plans to take a long position.
  Keywords: 看多, 持有, 加碼, 買入, long, bullish, holding, 看好, 建議買

SELL — Author is bearish or recommends reducing / shorting.
  Keywords: 看空, 減持, 賣出, short, bearish, 不看好, 建議賣
  NOTE: SELL means a directional bearish view. Do NOT use SELL for protective hedges.

HEDGE — Author is hedging an existing portfolio for protection, NOT expressing a bearish view.
  Keywords: 對沖, 避險, hedge, protective put, spread put, collar
  Example: "買 QQQ put 保護部位" → HEDGE (protecting, not shorting QQQ)
  Distinction: "我覺得 QQQ 要跌所以做空" → SELL (directional bearish view)

WATCH — Author is monitoring / interested but has NOT taken a position.
  Keywords: 觀察, 關注, 留意, on my radar, watching, 觀望, 值得注意
  Example: "最近在觀察 PLTR" → WATCH

CLOSED — Author has exited a position (profit or loss).
  Keywords: 已出場, 停損, 獲利了結, took profit, stopped out, 已賣, 平倉, 出清
  Example: "AAPL 已經在 $180 停損了" → CLOSED

═══════════════════════════════════
 CRITICAL RULES
═══════════════════════════════════

1. Respond ONLY in valid JSON.
2. Extract ONLY REAL TICKERS that perfectly map to publicly traded stocks (e.g., AAPL, NVDA, 2330.TW) or legitimate cryptocurrencies (e.g., BTC, ETH).
3. NEVER EXTRACT SECTORS, THEMES, CALENDAR METRICS OR GENERAL CONCEPTS. Do not extract terms like "Cloud", "AI", "Software", "W8", "YTD", "Q3", "Short", "Tech". If no explicit ticker is found, DO NOT hallucinate one.
4. CRITICAL: DO NOT confuse monetary values or points (e.g., "+2630", "-500", "$3000") with Taiwan stock tickers (which are 4 digits). If a number is preceded by +, -, or $, or follows words like "獲利", "短倉", "長倉", IT IS A PROFIT/LOSS AMOUNT, NOT A TICKER.
5. Each asset gets its OWN signal based on context — one post can mix BUY, SELL, HEDGE, etc.
6. For portfolio updates listing stocks by category, default signal is BUY (they are current holdings).
6. If a post mentions both entering AND exiting the same stock, use the MOST RECENT action.
7. Convert non-US stocks appropriately (e.g., "群聯" → "8299.TW", market: "TW").
8. If you are not 100% sure a term is an active stock ticker, OMIT IT. Precision over recall.

═══════════════════════════════════
 CONFIDENCE SCORING RUBRIC
═══════════════════════════════════

0.9 - 1.0: Explicit trade action with ticker ("加碼 NVDA", "bought TSLA at $250")
0.7 - 0.8: Clear directional view ("看好 PLTR 未來成長")
0.5 - 0.6: Implicit or vague mention ("NVDA 還不錯", listing in portfolio without commentary)
0.3 - 0.4: Ambiguous — ticker mentioned but intent unclear
Below 0.3: Do not extract (too uncertain)

═══════════════════════════════════
 OUTPUT FORMAT SCHEMA
═══════════════════════════════════

{{
  "assets": [
    {{
      "symbol": "TICKER",
      "category": "Sector or theme",
      "signal": "BUY" | "SELL" | "HEDGE" | "WATCH" | "CLOSED",
      "market": "US" | "TW" | "JP" | "CRYPTO" | "OTHER",
      "note": "Brief context for this specific asset"
    }}
  ],
  "overall_sentiment": "Bullish" | "Bearish" | "Mixed" | "Neutral",
  "confidence": 0.0-1.0,
  "summary": "One-sentence analysis summary in Traditional Chinese (繁體中文)",
  "key_points": ["point 1", "point 2"]
}}

═══════════════════════════════════
 EXAMPLES
═══════════════════════════════════

Example 1 — Portfolio update with hedge:
"持股更新 Physical AI & Cloud: NVDA、TSLA、Meta  Storage: MU、STX  對沖: QQQ spread put"
→ assets: [
    {{"symbol":"NVDA","category":"Physical AI & Cloud","signal":"BUY","market":"US"}},
    {{"symbol":"TSLA","category":"Physical AI & Cloud","signal":"BUY","market":"US"}},
    {{"symbol":"META","category":"Physical AI & Cloud","signal":"BUY","market":"US"}},
    {{"symbol":"MU","category":"Storage","signal":"BUY","market":"US"}},
    {{"symbol":"STX","category":"Storage","signal":"BUY","market":"US"}},
    {{"symbol":"QQQ","category":"Hedge","signal":"HEDGE","market":"US","note":"spread put, portfolio protection"}}
  ]
  confidence: 0.9

Example 2 — Single pick with target:
"看好 PLTR 雲端業務成長，目標價 $85"
→ assets: [{{"symbol":"PLTR","signal":"BUY","market":"US","note":"target $85"}}]
  confidence: 0.8

Example 3 — Mixed signals:
"加碼 NVDA，但覺得 AAPL 短期風險大建議先減持"
→ assets: [
    {{"symbol":"NVDA","signal":"BUY","market":"US"}},
    {{"symbol":"AAPL","signal":"SELL","market":"US","note":"short-term risk, reduce position"}}
  ]
  confidence: 0.9

Example 4 — Watching / on radar:
"最近在觀察 PLTR 和 CRWD，等拉回再考慮進場"
→ assets: [
    {{"symbol":"PLTR","signal":"WATCH","market":"US","note":"waiting for pullback"}},
    {{"symbol":"CRWD","signal":"WATCH","market":"US","note":"waiting for pullback"}}
  ]
  confidence: 0.6

Example 5 — Position closed:
"上週 AAPL 已經在 $180 停損出場了，小虧 3%"
→ assets: [{{"symbol":"AAPL","signal":"CLOSED","market":"US","note":"stopped out at $180, -3%"}}]
  confidence: 0.95

Example 6 — Earnings review:
"NVDA 財報超預期，營收 YoY +120%，AI 需求依然強勁，繼續持有"
→ assets: [{{"symbol":"NVDA","signal":"BUY","market":"US","category":"AI","note":"earnings beat, +120% YoY revenue, strong AI demand"}}]
  confidence: 0.8

Example 7 — Sector & Profit discussion with no specific tickers:
"2026 第八周復盤 主要短倉 +2630 🚀YTD +69.35% 主要長倉 📈YTD +3.93% 十檔年度選股倉 📈YTD +11.32% Cloud 長倉表現好"
→ assets: []
  confidence: 0

Example 8 — Educational (empty result):
"教學文：什麼是 Call Option？比如你看好 TSLA 和 NVDA，你可以買入 Call..."
→ assets: []
  confidence: 0

Example 9 — Macro commentary without specific action (empty result):
"Fed 可能降息，市場偏多，但短期震盪難免"
→ assets: []
  confidence: 0

═══════════════════════════════════
 NOW ANALYZE THE FOLLOWING POST
═══════════════════════════════════

Post:
\"\"\"{post_content}\"\"\"

JSON Output:
"""

        result = self._call_model(prompt)
        if "error" in result:
            return {"assets": [], "error": result["error"]}
        
        # Ensure assets is always a list
        assets = result.get("assets", [])
        if not isinstance(assets, list):
            assets = [assets] if assets else []
        
        # Filter out invalid assets and normalize signals
        valid_assets = []
        for a in assets:
            sym = a.get("symbol", "")
            if sym and sym not in ["None", "N/A", "", "null"]:
                # Normalize signal to valid set
                signal = a.get("signal", "BUY").upper()
                if signal not in VALID_SIGNALS:
                    # Map legacy HOLD → WATCH for better semantics
                    if signal == "HOLD":
                        signal = "WATCH"
                    else:
                        signal = "BUY"
                a["signal"] = signal
                valid_assets.append(a)
        
        return {
            "assets": valid_assets,
            "overall_sentiment": result.get("overall_sentiment", "Neutral"),
            "confidence": result.get("confidence", 0.5),
            "summary": result.get("summary", ""),
            "key_points": result.get("key_points", [])
        }

    # ────────────────────────────────────────────
    # Combined: Full Pipeline
    # ────────────────────────────────────────────
    def analyze_post(self, post_content: str) -> Dict[str, Any]:
        """
        Full two-phase analysis pipeline.
        Phase 1: Classify → Phase 2: Extract (only if investment-related).
        """
        if not post_content or len(post_content.strip()) < 10:
            return {"post_type": "irrelevant", "assets": [], "summary": "Content too short"}
        
        # Phase 1: Quick classification
        classification = self.classify_post(post_content)
        
        if not classification.get("is_investment", False):
            return {
                "post_type": classification.get("post_type", "irrelevant"),
                "assets": [],
                "overall_sentiment": "Neutral",
                "confidence": 0,
                "summary": f"Non-investment content: {classification.get('reason', '')}"
            }
        
        # Phase 2: Deep extraction
        post_type = classification.get("post_type", "single_pick")
        extraction = self.extract_assets(post_content, post_type)
        extraction["post_type"] = post_type
        
        return extraction

    # ────────────────────────────────────────────
    # Internal: Call Ollama Model
    # ────────────────────────────────────────────
    def _call_model(self, prompt: str) -> Dict[str, Any]:
        """Send prompt to Ollama and parse JSON response."""
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        
        try:
            response = requests.post(self.api_url, json=payload, timeout=120)
            response.raise_for_status()
            result = response.json()
            response_text = result.get('response', '')
            
            # Clean up <think> tags if present (DeepSeek-R1 reasoning)
            if "</think>" in response_text:
                response_text = response_text.split("</think>")[-1].strip()
            
            # Handle markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                parts = response_text.split("```")
                if len(parts) >= 2:
                    response_text = parts[1].strip()
            
            return json.loads(response_text)
            
        except requests.exceptions.Timeout:
            return {"error": "Model analysis timed out"}
        except requests.exceptions.ConnectionError:
            return {"error": "Could not connect to Ollama. Is it running?"}
        except json.JSONDecodeError as e:
            return {"error": f"JSON parse error: {e}", "raw_output": response_text}
        except Exception as e:
            return {"error": str(e)}

    # ────────────────────────────────────────────
    # Legacy compatibility
    # ────────────────────────────────────────────
    def analyze_post_legacy(self, post_content: str) -> Dict[str, Any]:
        """Legacy single-asset analysis for backward compatibility."""
        result = self.analyze_post(post_content)
        
        if result.get("assets"):
            first_asset = result["assets"][0]
            return {
                "asset": first_asset.get("symbol"),
                "sentiment": result.get("overall_sentiment", "Neutral"),
                "confidence": result.get("confidence", 0.5),
                "summary": result.get("summary", ""),
                "key_arguments": result.get("key_points", [])
            }
        
        return {
            "asset": None,
            "sentiment": "Neutral",
            "confidence": 0,
            "summary": result.get("summary", "No actionable assets found"),
            "key_arguments": []
        }


sentiment_analyzer = SentimentAnalyzerService()
