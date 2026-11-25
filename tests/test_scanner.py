import datetime
import unittest
from unittest.mock import patch, MagicMock
from types import SimpleNamespace

from app.services.security_checker import (
    validate_url_and_ip,
    is_same_origin,
    check_security_headers,
    check_cookies,
    check_dns,
    detect_technologies_with_confidence,
    calculate_transparent_risk_score,
    generate_ai_explanations,
    scan_ports_nmap,
)
from app.services.scanner import scan_website


class FakeResponse:
    def __init__(self, status_code=200, headers=None, text=""):
        self.status_code = status_code
        self.elapsed = datetime.timedelta(milliseconds=120)
        self.history = []
        self.headers = headers or {
            "server": "nginx/1.18.0",
            "content-type": "text/html; charset=utf-8",
            "set-cookie": "sessionid=abc; Secure; HttpOnly; SameSite=Lax; Path=/",
            "strict-transport-security": "max-age=31536000; includeSubDomains",
        }
        self.content = text.encode("utf-8") if isinstance(text, str) else text
        self.text = text if isinstance(text, str) else text.decode("utf-8", errors="ignore")
        self.url = "https://example.com/"


class SecurityScannerTestSuite(unittest.TestCase):

    # 1. URL Validation
    def test_01_url_validation_and_normalization(self):
        valid, url, info = validate_url_and_ip("example.com")
        self.assertTrue(valid)
        self.assertTrue(url.startswith("https://"))

        # Strict URL validation rejects invalid inputs/sentences
        invalid_inputs = ["hello", "hello this is my website", "amazon", "google", "12345", "not a url", "javascript:alert(1)"]
        for bad_input in invalid_inputs:
            v, _, _ = validate_url_and_ip(bad_input)
            self.assertFalse(v, f"Failed to reject invalid URL input: {bad_input}")

    # 2. SSRF Protection
    def test_02_ssrf_protection_blocks_private_and_loopback_ips(self):
        for blocked_target in ["http://127.0.0.1", "http://localhost", "http://10.0.0.1", "http://169.254.169.254"]:
            valid, _, reason = validate_url_and_ip(blocked_target)
            self.assertFalse(valid, f"Failed to block SSRF target: {blocked_target}")
            self.assertIn("blocked", reason.lower())

    # 3. Scope Validation
    def test_03_scope_validation_same_origin(self):
        self.assertTrue(is_same_origin("https://example.com/page1", "https://example.com/api/test"))
        self.assertFalse(is_same_origin("https://example.com", "https://malicious.com"))

    # 4. HTTPS Detection
    def test_04_https_detection(self):
        headers = {"server": "nginx"}
        summary, findings = check_security_headers(headers, "http://insecure-site.com")
        self.assertTrue(any(f["severity"] in ["High", "Medium"] for f in findings))

    # 5. TLS Certificate Validation
    @patch("app.services.security_checker.socket.create_connection")
    def test_05_tls_certificate_validation_failure_handled(self, mock_conn):
        mock_conn.side_effect = Exception("SSL handshake failed")
        from app.services.security_checker import check_tls_ssl
        ssl_info, findings = check_tls_ssl("invalid-ssl-host.com")
        self.assertFalse(ssl_info["valid"])

    # 6. Security Header Detection
    def test_06_security_header_detection(self):
        headers = {"server": "apache"}
        summary, findings = check_security_headers(headers, "https://example.com")
        missing_headers = [f["id"] for f in findings]
        self.assertIn("HDR_STRICT_TRANSPORT_SECURITY", missing_headers)
        self.assertIn("HDR_CONTENT_SECURITY_POLICY", missing_headers)

    # 7. Cookie Analysis
    def test_07_cookie_analysis_flags_missing_attributes(self):
        headers = {"set-cookie": "insecure_sess=123; Path=/"}
        entries, findings = check_cookies(headers, "https://example.com")
        self.assertEqual(len(entries), 1)
        finding_titles = [f["title"] for f in findings]
        self.assertTrue(any("Missing Secure Flag" in t for t in finding_titles))
        self.assertTrue(any("Missing HttpOnly Flag" in t for t in finding_titles))

    # 8. DNS Analysis
    @patch("app.services.security_checker.dns.resolver.Resolver")
    def test_08_dns_analysis_flags_missing_spf_dmarc(self, mock_resolver_cls):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = Exception("No record")
        mock_resolver_cls.return_value = mock_resolver

        records, findings = check_dns("example.com")
        fid_list = [f["id"] for f in findings]
        self.assertIn("DNS-SPF-MISSING", fid_list)
        self.assertIn("DNS-DMARC-MISSING", fid_list)

    # 9. Technology Detection
    def test_09_technology_detection_fallback(self):
        body = "<html><body><div id='reactRoot'></div><script src='jquery.min.js'></script></body></html>"
        techs = detect_technologies_with_confidence("https://example.com", {}, body)
        tech_names = [t["name"] for t in techs]
        self.assertIn("React", tech_names)
        self.assertIn("jQuery", tech_names)

    # 10. Finding Deduplication
    def test_10_finding_deduplication(self):
        duplicate_findings = [
            {"id": "HDR-CSP", "title": "Missing CSP", "severity": "High"},
            {"id": "HDR-CSP", "title": "Missing CSP", "severity": "High"},
            {"id": "HDR-HSTS", "title": "Missing HSTS", "severity": "High"},
        ]
        risk_data = calculate_transparent_risk_score(duplicate_findings)
        self.assertEqual(risk_data["verified_findings_count"], 2)
        self.assertEqual(risk_data["total_deduction"], 30)  # 2 * 15

    # 11. Transparent Risk Score Calculation
    def test_11_risk_score_calculation(self):
        findings = [
            {"id": "F1", "title": "Critical Issue", "severity": "Critical"},  # -25
            {"id": "F2", "title": "High Issue", "severity": "High"},        # -15
            {"id": "F3", "title": "Medium Issue", "severity": "Medium"},    # -8
        ]
        risk_data = calculate_transparent_risk_score(findings)
        self.assertEqual(risk_data["base_score"], 100)
        self.assertEqual(risk_data["total_deduction"], 48)
        self.assertEqual(risk_data["final_score"], 52)
        self.assertEqual(risk_data["risk_level"], "High Risk")

    # 12. AI Input Validation
    def test_12_ai_input_validation(self):
        verified_findings = [
            {"id": "HDR-HSTS", "title": "Missing HSTS", "evidence": "Header not observed", "severity": "High", "remediation": "Add HSTS"}
        ]
        explanations = generate_ai_explanations(verified_findings)
        self.assertEqual(len(explanations), 1)
        self.assertEqual(explanations[0]["finding_id"], "HDR-HSTS")
        self.assertIn("Missing HSTS", explanations[0]["title"])

    # 13. Nmap Unavailable Handling
    def test_13_nmap_unavailable_handling(self):
        with patch("app.services.security_checker.nmap", None):
            ports, status = scan_ports_nmap("example.com", is_active_mode=True)
            self.assertEqual(ports, [])
            self.assertIsNotNone(status)
            self.assertEqual(status["status"], "unavailable")

    # 14. Wappalyzer Unavailable Handling
    def test_14_wappalyzer_unavailable_fallback(self):
        with patch("app.services.security_checker.Wappalyzer", None):
            techs = detect_technologies_with_confidence("https://example.com", {"server": "nginx"}, "")
            self.assertTrue(isinstance(techs, list))

    # 15. Timeout Handling
    @patch("app.services.scanner.requests.get")
    @patch("app.services.scanner.validate_url_and_ip", return_value=(True, "https://example.com", "93.184.216.34"))
    def test_15_timeout_handling(self, _mock_val, mock_get):
        import requests
        mock_get.side_effect = requests.exceptions.Timeout("Read timeout")
        res = scan_website("https://example.com")
        self.assertEqual(res["score"], 0)
        self.assertIn("Timeout", res["error"])


if __name__ == "__main__":
    unittest.main()
