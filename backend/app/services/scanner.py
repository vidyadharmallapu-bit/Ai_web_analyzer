import datetime as dt
import logging
import time
from uuid import uuid4
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests

from app.services.security_checker import (
    validate_url_and_ip,
    crawl_assets,
    check_tls_ssl,
    check_security_headers,
    check_cookies,
    check_dns,
    check_information_disclosure,
    detect_technologies_with_confidence,
    scan_ports_nmap,
    calculate_transparent_risk_score,
    generate_ai_explanations,
    USER_AGENT,
)

# Configure structured logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("CyberShieldScanner")


def scan_website(
    url: str
) -> Dict[str, Any]:
    """
    Executes real, evidence-based website security analysis with SSRF protections,
    controlled asset discovery, rule-based vulnerability checks, transparent scoring,
    and AI explanations.
    """
    start_time = time.time()
    scan_id = str(uuid4())
    scan_timestamp = dt.datetime.now(dt.timezone.utc).isoformat()

    logger.info(f"Starting scan_id={scan_id} mode=passive target={url}")

    # 1. SSRF & URL Validation
    is_valid, normalized_url, resolve_info = validate_url_and_ip(url)
    if not is_valid:
        logger.warning(f"Scan request blocked by SSRF/validation rule: target={url} reason={resolve_info}")
        return {
            "scan_id": scan_id,
            "timestamp": scan_timestamp,
            "url": url,
            "domain": urlparse(url).netloc or url,
            "scan_mode": "passive",
            "security_score": 0,
            "score": 0,
            "risk_level": "Blocked / Critical Risk",
            "error": f"Security Policy Violation: {resolve_info}",
            "findings": [],
            "vulnerabilities": [],
            "summary": {"totalFindings": 0, "critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0},
            "risk": {"score": 0, "grade": "Critical"},
            "ai_summary": f"Scan failed due to security policy: {resolve_info}"
        }

    domain = urlparse(normalized_url).netloc

    # Initialize Scan Output Payload
    result: Dict[str, Any] = {
        "scan_id": scan_id,
        "timestamp": scan_timestamp,
        "url": normalized_url,
        "domain": domain,
        "scan_mode": "passive",
        "security_score": 100,
        "score": 100,
        "risk_level": "Low Risk (Secure)",
        "summary": {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "informational": 0
        },
        "score_breakdown": {},
        "ssl": {},
        "tls": {},
        "headers": [],
        "cookies": [],
        "dns": {},
        "technologies": [],
        "assets": [],
        "ports": [],
        "findings": [],
        "vulnerabilities": [],
        "ai_explanations": [],
        "ai_summary": "",
        "traffic": {},
        "responseTime": 0,
        "error": None,
    }

    try:
        # 2. Main Page Fetch
        resp_start = time.time()
        response = requests.get(
            normalized_url,
            timeout=10,
            headers={"User-Agent": USER_AGENT},
            allow_redirects=True,
        )
        response_time_ms = int((time.time() - resp_start) * 1000)
        result["responseTime"] = response_time_ms
        response_headers = dict(response.headers)
        body_text = response.text or ""

        content_type = response.headers.get("content-type", "unknown").split(";")[0]

        result["traffic"] = {
            "statusCode": response.status_code,
            "responseTime": response_time_ms,
            "contentType": content_type,
            "bodySizeBytes": len(response.content or b""),
            "redirects": len(response.history),
            "finalUrl": response.url,
            "server": response_headers.get("server") or response_headers.get("Server") or "Not Disclosed",
        }

        # 3. TLS / SSL Audit
        ssl_info, ssl_findings = check_tls_ssl(domain)
        result["ssl"] = ssl_info
        result["tls"] = ssl_info

        # 4. Security Headers Audit
        header_summary, header_findings = check_security_headers(response_headers, normalized_url)
        result["headers"] = header_summary

        # 5. Cookie Audit
        cookie_entries, cookie_findings = check_cookies(response_headers, normalized_url)
        result["cookies"] = cookie_entries

        # 6. DNS Audit
        dns_records, dns_findings = check_dns(domain)
        result["dns"] = dns_records

        # 7. Information Disclosure Audit
        info_findings = check_information_disclosure(response_headers, body_text, normalized_url)

        # 8. Technology Fingerprinting
        tech_list = detect_technologies_with_confidence(normalized_url, response_headers, body_text)
        result["technologies"] = tech_list

        # 9. Controlled BFS Crawling (Asset Inventory)
        crawled_assets = crawl_assets(normalized_url, max_depth=2, max_pages=20, timeout=6)
        result["assets"] = crawled_assets

        # 10. Port probing is disabled for passive scans.
        port_list, nmap_status = scan_ports_nmap(domain, is_active_mode=False)
        if nmap_status:
            result["nmap_module"] = nmap_status
        result["ports"] = port_list

        # Aggregate All Verified Findings
        all_findings: List[Dict[str, Any]] = (
            ssl_findings + header_findings + cookie_findings + dns_findings + info_findings
        )
        result["findings"] = all_findings
        result["vulnerabilities"] = all_findings

        # 11. Transparent Risk Scoring
        risk_score_data = calculate_transparent_risk_score(all_findings)
        result["security_score"] = risk_score_data["final_score"]
        result["score"] = risk_score_data["final_score"]
        result["risk_level"] = risk_score_data["risk_level"]
        result["score_breakdown"] = risk_score_data
        result["risk"] = {"score": risk_score_data["final_score"], "grade": risk_score_data["risk_level"]}

        # Count severity totals
        for f in all_findings:
            sev = f.get("severity", "Low").lower()
            if sev in result["summary"]:
                result["summary"][sev] += 1
            else:
                result["summary"]["low"] += 1
        result["summary"]["totalFindings"] = len(all_findings)
        result["summary"]["riskLevel"] = risk_score_data["risk_level"]

        # 12. AI Explanation Layer
        ai_explanations = generate_ai_explanations(all_findings)
        result["ai_explanations"] = ai_explanations

        # Build natural language summary text
        summary_lines = [
            f"Website Security Scan for {domain}",
            f"Mode: {result['scan_mode'].upper()}",
            f"Score: {result['security_score']}/100 ({result['risk_level']})",
            f"Discovered Assets: {len(crawled_assets)}",
            f"Verified Findings: {len(all_findings)}",
        ]
        if all_findings:
            summary_lines.append("Key Findings:")
            for f in all_findings[:5]:
                summary_lines.append(f"- [{f['severity']}] {f['title']}: {f['evidence']}")
        else:
            summary_lines.append("No security vulnerabilities were detected based on observed live evidence.")

        result["ai_summary"] = "\n".join(summary_lines)

    except requests.exceptions.Timeout:
        result["error"] = "Timeout: The website failed to respond within timeout limits."
    except requests.exceptions.ConnectionError:
        result["error"] = "Connection Error: Unable to establish connection to target."
    except requests.exceptions.SSLError:
        result["error"] = "SSL Error: Target SSL certificate validation failed."
    except Exception as exc:
        logger.exception(f"Unexpected error during scan_id={scan_id}: {exc}")
        result["error"] = f"Unexpected scan error: {exc}"

    if result["error"]:
        result["security_score"] = 0
        result["score"] = 0
        result["risk_level"] = "Critical Risk"
        result["risk"] = {"score": 0, "grade": "Critical"}
        result["ai_summary"] = f"Scan incomplete due to error: {result['error']}"

    elapsed_duration = round(time.time() - start_time, 2)
    logger.info(f"Completed scan_id={scan_id} duration={elapsed_duration}s score={result['security_score']}")

    return result
