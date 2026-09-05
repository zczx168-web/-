from __future__ import annotations

import hashlib
import json
import re
import ssl
import sys
import time
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "daily-brief.json"
BEIJING = timezone(timedelta(hours=8))
USER_AGENT = "CokingCoalDesk/1.0 (+https://zczx168-web.github.io/-/)"
KEYWORDS = ("焦煤", "炼焦煤", "焦炭", "煤矿", "通关", "库存", "复产", "洗煤")


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        self._href = dict(attrs).get("href")
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._href is None:
            return
        title = re.sub(r"\s+", " ", "".join(self._text)).strip()
        if title and self._href:
            self.links.append((title, self._href))
        self._href = None
        self._text = []


def fetch(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept": "text/html, text/plain, */*",
            "Referer": "https://www.dce.com.cn/" if "dce.com.cn" in url else url,
        },
    )
    context = ssl._create_unverified_context()
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            with urlopen(request, timeout=25, context=context) as response:
                raw = response.read()
                for encoding in (response.headers.get_content_charset(), "utf-8", "gb18030"):
                    if not encoding:
                        continue
                    try:
                        return raw.decode(encoding)
                    except UnicodeDecodeError:
                        continue
                return raw.decode("utf-8", errors="replace")
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(1)
    raise last_error or RuntimeError("request failed")


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"^[\[【(（].*?[\]】)）]\s*", "", value)
    return value.strip(" -|_")


def classify(title: str) -> str:
    if any(word in title for word in ("复产", "煤矿", "供应", "产量", "洗煤")):
        return "supply"
    if any(word in title for word in ("需求", "焦炭", "钢厂", "铁水", "利润")):
        return "demand"
    if any(word in title for word in ("政策", "通关", "海关", "进口", "口岸")):
        return "policy"
    return "market"


def list_items(source: str, url: str, limit: int = 5) -> tuple[list[dict], str | None]:
    try:
        parser = LinkParser()
        parser.feed(fetch(url))
    except Exception as exc:  # A source failure must not stop other sources.
        return [], f"{source}: {exc}"
    items: list[dict] = []
    seen: set[str] = set()
    now = datetime.now(BEIJING).isoformat(timespec="seconds")
    for title, href in parser.links:
        title = clean_title(title)
        if len(title) < 8 or not any(word in title for word in KEYWORDS):
            continue
        link = urljoin(url, href)
        if link in seen:
            continue
        seen.add(link)
        items.append({
            "title": title,
            "summary": f"{source}公开发布，建议结合焦煤供需和期货盘面继续跟踪。",
            "source": source,
            "url": link,
            "category": classify(title),
            "publishedAt": now,
        })
        if len(items) >= limit:
            break
    return items, None


def fetch_dce_quote() -> tuple[dict | None, str | None]:
    today = datetime.now(BEIJING).date()
    for offset in range(0, 8):
        trade_date = today - timedelta(days=offset)
        url = (
            "https://www.dce.com.cn/publicweb/quotesdata/exportDayQuotesChData.html?"
            f"dayQuotes.variety=all&dayQuotes.trade_type=0&year={trade_date.year}"
            f"&month={trade_date.month - 1}&day={trade_date.day}&exportFlag=txt"
        )
        try:
            content = fetch(url)
        except Exception as exc:
            if offset == 0:
                last_error = f"DCE: {exc}"
            continue
        for line in content.splitlines():
            if "焦煤" not in line:
                continue
            fields = re.split(r"\t+", line.strip("\t "))
            if len(fields) < 8 or not re.search(r"\d", fields[1]):
                continue
            try:
                close = float(fields[5].replace(",", ""))
                settlement = float(fields[7].replace(",", ""))
                volume = int(float(fields[10].replace(",", ""))) if len(fields) > 10 else None
                open_interest = int(float(fields[11].replace(",", ""))) if len(fields) > 11 else None
            except (ValueError, IndexError):
                continue
            contract = fields[1]
            return {
                "tradeDate": trade_date.isoformat(),
                "contract": f"JM{contract}",
                "close": close,
                "settlement": settlement,
                "volume": volume,
                "openInterest": open_interest,
                "source": "大连商品交易所",
                "url": url,
            }, None
    return None, locals().get("last_error", "DCE: 暂无可用交易数据")


def build_payload() -> dict:
    fetched_at = datetime.now(BEIJING).isoformat(timespec="seconds")
    source_specs = [
        ("CCTD", "https://www.cctd.com.cn/list-35-0.html", 6),
        ("国家统计局", "https://www.stats.gov.cn/sj/zxfb/", 4),
        ("海关总署", "https://www.customs.gov.cn/customs/302249/302274/302277/index.html", 4),
        ("国家发展改革委", "https://www.ndrc.gov.cn/xxgk/zcfb/tz/", 4),
    ]
    items: list[dict] = []
    errors: list[str] = []
    for source, url, limit in source_specs:
        found, error = list_items(source, url, limit)
        items.extend(found)
        if error:
            errors.append(error)

    quote, quote_error = fetch_dce_quote()
    if quote:
        items.insert(0, {
            "title": f"{quote['contract']} 收盘 {quote['close']:,.1f} 元/吨",
            "summary": (
                f"DCE 日行情：结算价 {quote['settlement']:,.1f} 元/吨，"
                f"成交量 {quote['volume'] if quote['volume'] is not None else '暂无'}。"
            ),
            "source": quote["source"],
            "url": quote["url"],
            "category": "market",
            "publishedAt": f"{quote['tradeDate']}T15:30:00+08:00",
        })
    elif quote_error:
        errors.append(quote_error)

    unique: dict[str, dict] = {}
    for item in items:
        unique.setdefault(item["url"], item)
    items = list(unique.values())[:12]
    date_label = datetime.now(BEIJING).strftime("%Y年%m月%d日")
    market_summary = "暂无可用的 DCE 日行情"
    if quote:
        market_summary = f"{quote['contract']} 收盘 {quote['close']:,.1f} 元/吨，结算价 {quote['settlement']:,.1f} 元/吨"
    payload = {
        "date": date_label,
        "generatedAt": fetched_at,
        "title": f"焦煤日报｜{date_label}",
        "summary": f"{market_summary}；汇总 {len(items)} 条公开来源信息。",
        "market": quote,
        "items": items,
        "sources": ["大连商品交易所", "CCTD", "国家统计局", "海关总署", "国家发展改革委"],
        "errors": errors,
    }
    fingerprint = hashlib.sha256(json.dumps({"market": quote, "items": items}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    payload["fingerprint"] = fingerprint
    return payload


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = build_payload()
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            if previous.get("fingerprint") == payload.get("fingerprint"):
                payload["generatedAt"] = previous.get("generatedAt", payload["generatedAt"])
        except (json.JSONDecodeError, OSError):
            pass
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT} ({len(payload['items'])} items)")
    if payload["errors"]:
        print("source warnings:", file=sys.stderr)
        for error in payload["errors"]:
            print(f"- {error}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
