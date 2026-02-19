"""
Enhanced Sentiment Analyzer Service - Two-Phase Analysis Pipeline

Phase 1: Quick classification — is this post investment-related?
Phase 2: Deep extraction — extract all assets with individual signals.
"""

import requests
import json
from typing import Dict, Any, List


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
        prompt = f"""You are a financial content classifier. Determine whether the following social media post contains any investment-related content (stock picks, portfolio updates, market analysis, buy/sell signals, etc.).

Post:
\"\"\"{post_content}\"\"\"

Respond ONLY in valid JSON:
{{
  "is_investment": true or false,
  "post_type": "single_pick" | "portfolio_update" | "market_commentary" | "lifestyle" | "other",
  "reason": "Brief explanation in English"
}}

Guidelines:
- "single_pick": Post focuses on one stock/asset
- "portfolio_update": Post mentions multiple stocks (e.g., "持股更新", listing symbols)
- "market_commentary": General market views without specific tickers
- "lifestyle" / "other": Not investment-related
- If ANY stock ticker or investment term is mentioned, set is_investment to true"""

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
        Deep analysis: extract ALL mentioned assets with individual buy/sell signals.
        Each asset gets its own independent signal determination.
        """
        prompt = f"""Role: You are an expert Financial Analyst. Your job is to extract EVERY stock/asset mentioned in this post with its individual investment signal.

CRITICAL RULES:
1. Respond ONLY in valid JSON
2. Extract EVERY ticker mentioned (NVDA, TSLA, MU, QQQ, BTC, etc.)
3. Each asset gets its OWN signal — a single post can have BOTH buys AND sells
4. Signal mapping:
   - BUY = 看多, 持有, 加碼, 買入, long, bullish, holding
   - SELL = 看空, 減持, 賣出, 對沖, put, short, hedge, bearish
   - HOLD = 觀望, 中性, watching
5. For portfolio updates listing stocks by category, default signal is BUY (they are holdings)
6. If a hedge/put/short is mentioned (e.g., "QQQ spread put"), signal is SELL
7. Summary should be in Traditional Chinese (繁體中文)
8. Convert non-US stocks appropriately (e.g., "群聯" → symbol: "8299.TW", market: "TW")

Post:
\"\"\"{post_content}\"\"\"

JSON Output:
{{
  "assets": [
    {{
      "symbol": "TICKER",
      "category": "Sector or theme (optional)",
      "signal": "BUY" | "SELL" | "HOLD",
      "market": "US" | "TW" | "JP" | "CRYPTO" | "OTHER",
      "note": "Specific context for this asset"
    }}
  ],
  "overall_sentiment": "Bullish" | "Bearish" | "Mixed" | "Neutral",
  "confidence": 0.0-1.0,
  "summary": "Brief analysis summary in Traditional Chinese",
  "key_points": ["point 1", "point 2"]
}}

EXAMPLES:

Example 1 — Portfolio update:
"持股更新 Physical AI & Cloud: NVDA、TSLA、Meta  Storage: MU、STX  對沖: QQQ spread put"
→ assets: [
    {{"symbol":"NVDA","category":"Physical AI & Cloud","signal":"BUY","market":"US"}},
    {{"symbol":"TSLA","category":"Physical AI & Cloud","signal":"BUY","market":"US"}},
    {{"symbol":"META","category":"Physical AI & Cloud","signal":"BUY","market":"US"}},
    {{"symbol":"MU","category":"Storage","signal":"BUY","market":"US"}},
    {{"symbol":"STX","category":"Storage","signal":"BUY","market":"US"}},
    {{"symbol":"QQQ","category":"Hedge","signal":"SELL","market":"US","note":"spread put hedge"}}
  ]

Example 2 — Single pick:
"看好 PLTR 雲端業務成長，目標價 $85"
→ assets: [{{"symbol":"PLTR","signal":"BUY","market":"US","note":"target $85"}}]

Example 3 — Mixed signals:
"加碼 NVDA，但覺得 AAPL 短期風險大建議先減持"
→ assets: [
    {{"symbol":"NVDA","signal":"BUY","market":"US"}},
    {{"symbol":"AAPL","signal":"SELL","market":"US","note":"short-term risk"}}
  ]"""

        result = self._call_model(prompt)
        if "error" in result:
            return {"assets": [], "error": result["error"]}
        
        # Ensure assets is always a list
        assets = result.get("assets", [])
        if not isinstance(assets, list):
            assets = [assets] if assets else []
        
        # Filter out invalid assets
        valid_assets = []
        for a in assets:
            sym = a.get("symbol", "")
            if sym and sym not in ["None", "N/A", "", "null"]:
                # Normalize signal
                signal = a.get("signal", "HOLD").upper()
                if signal not in ["BUY", "SELL", "HOLD"]:
                    signal = "HOLD"
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
