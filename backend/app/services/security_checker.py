import datetime as dt
import ipaddress
import re
import socket
import ssl
from http.cookies import SimpleCookie
from typing import Any, Dict, List, Optional, Tuple, Set
from urllib.parse import urljoin, urlparse

import dns.resolver
import requests
from bs4 import BeautifulSoup
from cryptography import x509
from cryptography.x509.oid import NameOID

try:
    import nmap
except ImportError:
    nmap = None

try:
    from wappalyzer import Wappalyzer
except ImportError:
    Wappalyzer = None

# ── BLOCKED IP / NETWORKS FOR SSRF PROTECTION ──
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),        # IPv4 Loopback
    ipaddress.ip_network("10.0.0.0/8"),         # RFC1918 Private
    ipaddress.ip_network("172.16.0.0/12"),      # RFC1918 Private
    ipaddress.ip_network("192.168.0.0/16"),     # RFC1918 Private
    ipaddress.ip_network("169.254.0.0/16"),     # Link-Local / Cloud Metadata
    ipaddress.ip_network("0.0.0.0/32"),         # Current network
    ipaddress.ip_network("::1/128"),            # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),           # IPv6 Unique Local
    ipaddress.ip_network("fe80::/10"),          # IPv6 Link-Local
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "169.254.169.254",
}

HEADER_RULES = {
    "Strict-Transport-Security": {
        "title": "Enforce HTTPS Connection (HSTS)",
        "category": "HTTP Security Headers",
        "severity": "High",
        "status_label": "Warning",
        "priority": "HIGH PRIORITY",
        "cvss": {"score": 5.3, "vector": "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:N"},
        "what_was_found": "The website does not instruct browsers to connect exclusively using encrypted HTTPS.",
        "why_is_this_a_risk": "Without this protection, visitors connecting over public Wi-Fi could have their connection downgraded to unencrypted HTTP.",
        "remediation": "Add the Strict-Transport-Security header to all server responses.",
        "description": "The target domain does not send an HSTS header.",
        "impact": "Visitors connecting over public Wi-Fi could have their connection downgraded to unencrypted HTTP.",
        "references": ["https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html"],
    },
    "Content-Security-Policy": {
        "title": "Content Security Policy (CSP)",
        "category": "HTTP Security Headers",
        "severity": "High",
        "status_label": "Warning",
        "priority": "HIGH PRIORITY",
        "cvss": {"score": 6.9, "vector": "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N"},
        "what_was_found": "The website does not have a Content Security Policy.",
        "why_is_this_a_risk": "This can make it easier for attackers to inject unwanted content or scripts into the website.",
        "remediation": "Add a Content Security Policy to control which content and scripts the browser is allowed to load.",
        "description": "No Content-Security-Policy header is present on the HTTP response.",
        "impact": "This can make it easier for attackers to inject unwanted content or scripts into the website.",
        "references": ["https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"],
    },
    "X-Content-Type-Options": {
        "title": "MIME Type Sniffing Protection (X-Content-Type-Options)",
        "category": "HTTP Security Headers",
        "severity": "Medium",
        "status_label": "Warning",
        "priority": "MEDIUM PRIORITY",
        "cvss": {"score": 4.3, "vector": "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:N"},
        "what_was_found": "The website is missing the instruction that stops browsers from guessing file types.",
        "why_is_this_a_risk": "A browser might incorrectly run a non-script file as a script if it guesses the file type.",
        "remediation": "Add the X-Content-Type-Options header set to 'nosniff'.",
        "description": "The X-Content-Type-Options header is missing or not set to 'nosniff'.",
        "impact": "A browser might incorrectly run a non-script file as a script if it guesses the file type.",
        "references": ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options"],
    },
    "X-Frame-Options": {
        "title": "Clickjacking Protection (X-Frame-Options)",
        "category": "HTTP Security Headers",
        "severity": "Medium",
        "status_label": "Warning",
        "priority": "MEDIUM PRIORITY",
        "cvss": {"score": 5.3, "vector": "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:N"},
        "what_was_found": "The website does not have protection against being displayed inside another website.",
        "why_is_this_a_risk": "An attacker could try to trick users into clicking something they did not intend to click.",
        "remediation": "Enable the appropriate browser protection header to prevent the website from being embedded by untrusted websites.",
        "description": "The X-Frame-Options header is missing, allowing the site to be rendered inside a frame.",
        "impact": "An attacker could try to trick users into clicking something they did not intend to click.",
        "references": ["https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html"],
    },
    "Referrer-Policy": {
        "title": "Referrer Information Control (Referrer-Policy)",
        "category": "HTTP Security Headers",
        "severity": "Low",
        "status_label": "Warning",
        "priority": "LOW PRIORITY",
        "cvss": {"score": 2.6, "vector": "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N"},
        "what_was_found": "The website does not specify how much address information is shared when visitors click links.",
        "why_is_this_a_risk": "Web page addresses containing sensitive information could be shared with external websites.",
        "remediation": "Add a Referrer-Policy header to limit address information shared with third-party sites.",
        "description": "No Referrer-Policy header was detected.",
        "impact": "Web page addresses containing sensitive information could be shared with external websites.",
        "references": ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy"],
    },
    "Permissions-Policy": {
        "title": "Browser Feature Control (Permissions-Policy)",
        "category": "HTTP Security Headers",
        "severity": "Low",
        "status_label": "Warning",
        "priority": "LOW PRIORITY",
        "cvss": {"score": 2.3, "vector": "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:N"},
        "what_was_found": "The website does not explicitly restrict access to browser features like camera, microphone, or location.",
        "why_is_this_a_risk": "Embedded third-party content could access browser capabilities if permissions are not explicitly managed.",
        "remediation": "Configure the Permissions-Policy header to restrict unnecessary browser capabilities.",
        "description": "The Permissions-Policy header is absent.",
        "impact": "Embedded third-party content could access browser capabilities if permissions are not explicitly managed.",
        "references": ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy"],
    },
}

WEAK_TLS_CIPHERS = {
    "TLS_RSA_WITH_3DES_EDE_CBC_SHA",
    "TLS_RSA_WITH_RC4_128_SHA",
    "TLS_RSA_WITH_RC4_128_MD5",
    "TLS_RSA_EXPORT_WITH_RC4_40_MD5",
    "TLS_RSA_WITH_DES_CBC_SHA",
}

USER_AGENT = "CyberShield-Security-Scanner/2.0 (+https://cybershield.ai/bot)"


# ── 1. URL & SSRF VALIDATION ──
def validate_url_and_ip(url: str) -> Tuple[bool, str, str]:
    """
    Strictly validates URL scheme, format, hostname, TLD/IP, and SSRF blacklist.
    Returns: (is_valid, normalized_url, reason_or_ip)
    """
    if not url or not isinstance(url, str):
        return False, "", "Please enter a valid website URL."

    val = url.strip()
    if not val:
        return False, "", "Please enter a valid website URL."

    # Reject spaces or newlines (e.g. "hello this is my website")
    if re.search(r'\s', val):
        return False, val, "Please enter a valid website URL."

    parsed = urlparse(val if "://" in val else "https://" + val)
    scheme = parsed.scheme.lower()
    if scheme and scheme not in ("http", "https"):
        return False, val, "Only http:// and https:// URLs are supported."

    normalized = val if "://" in val else "https://" + val

    try:
        parsed_norm = urlparse(normalized)
    except Exception:
        return False, val, "Please enter a valid website URL."

    hostname = parsed_norm.hostname
    if not hostname:
        return False, val, "Please enter a valid website URL."

    hostname_lower = hostname.lower()

    # Check if hostname is localhost or valid IP address
    is_ip = False
    try:
        ipaddress.ip_address(hostname_lower)
        is_ip = True
    except ValueError:
        pass

    if hostname_lower != "localhost" and not is_ip:
        # Must contain a dot (domain name)
        if "." not in hostname_lower:
            return False, val, "Please enter a valid website URL."
        parts = hostname_lower.split('.')
        tld = parts[-1]
        if not tld.isalpha() or len(tld) < 2:
            return False, val, "Please enter a valid website URL."

    if not re.match(r'^[a-z0-9\-\.:]+$', hostname_lower):
        if not is_ip:
            return False, val, "Please enter a valid website URL."

    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, val, f"Access to restricted target '{hostname}' is blocked."

    # Check if target is IP string directly
    try:
        ip_obj = ipaddress.ip_address(hostname_lower)
        for blocked_net in BLOCKED_NETWORKS:
            if ip_obj in blocked_net:
                return False, val, f"Target IP {ip_obj} is within blocked private/reserved range {blocked_net}."
        return True, normalized, str(ip_obj)
    except ValueError:
        pass  # Hostname is domain name

    # Resolve domain to IP addresses via DNS
    try:
        ip_list = socket.getaddrinfo(hostname, None)
        resolved_ips = set(item[4][0] for item in ip_list)
    except socket.gaierror as e:
        return False, val, f"DNS resolution failed for hostname '{hostname}': {e}"

    for ip_str in resolved_ips:
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            for blocked_net in BLOCKED_NETWORKS:
                if ip_obj in blocked_net:
                    return False, val, f"Domain '{hostname}' resolved to blocked private/reserved IP {ip_obj} ({blocked_net})."
        except ValueError:
            continue

    return True, normalized, ", ".join(resolved_ips)


def is_same_origin(base_url: str, target_url: str) -> bool:
    """Verifies whether target_url shares host and port with base_url."""
    try:
        base_p = urlparse(base_url)
        target_p = urlparse(target_url)
        return base_p.hostname.lower() == target_p.hostname.lower()
    except Exception:
        return False


# ── 2. CONTROLLED BFS CRAWLER & ASSET DISCOVERY ──
def crawl_assets(target_url: str, max_depth: int = 2, max_pages: int = 25, timeout: int = 8) -> List[Dict[str, Any]]:
    """
    Performs controlled BFS crawling within the same origin.
    Does NOT submit forms or send POST/PUT/DELETE requests.
    """
    assets: List[Dict[str, Any]] = []
    visited: Set[str] = set()
    queue: List[Tuple[str, int, str]] = [(target_url, 0, "initial_target")]

    parsed_base = urlparse(target_url)
    base_host = parsed_base.hostname.lower()

    while queue and len(visited) < max_pages:
        current_url, depth, source = queue.pop(0)

        # Remove fragment
        clean_url = current_url.split("#")[0].rstrip("/")
        if not clean_url or clean_url in visited:
            continue

        visited.add(clean_url)

        # SSRF re-validation before request
        valid, normalized_url, reason = validate_url_and_ip(clean_url)
        if not valid:
            continue

        try:
            resp = requests.get(
                normalized_url,
                timeout=timeout,
                headers={"User-Agent": USER_AGENT},
                allow_redirects=True,
                stream=True,
            )

            final_url = resp.url
            if not is_same_origin(target_url, final_url):
                # Redirected outside scope - record asset & do not crawl links
                assets.append({
                    "url": normalized_url,
                    "type": "page",
                    "status_code": resp.status_code,
                    "content_type": resp.headers.get("content-type", "unknown").split(";")[0],
                    "source": source,
                    "depth": depth,
                    "redirected_out": True
                })
                continue

            content_type = resp.headers.get("content-type", "").lower()
            asset_type = "page"
            if "javascript" in content_type or normalized_url.endswith(".js"):
                asset_type = "script"
            elif "json" in content_type or "xml" in content_type:
                asset_type = "api"
            elif "css" in content_type or normalized_url.endswith(".css"):
                asset_type = "resource"

            assets.append({
                "url": normalized_url,
                "type": asset_type,
                "status_code": resp.status_code,
                "content_type": content_type.split(";")[0] if content_type else "unknown",
                "source": source,
                "depth": depth
            })

            # Crawl links & forms if depth limit permits and content is HTML
            if depth < max_depth and "html" in content_type and len(visited) < max_pages:
                try:
                    # Read response text up to 500KB limit
                    content_bytes = b""
                    for chunk in resp.iter_content(chunk_size=8192):
                        content_bytes += chunk
                        if len(content_bytes) > 500000:
                            break
                    html_text = content_bytes.decode("utf-8", errors="ignore")
                    soup = BeautifulSoup(html_text, "html.parser")

                    # Extract links
                    for link_tag in soup.find_all("a", href=True):
                        href = link_tag["href"].strip()
                        full_link = urljoin(normalized_url, href)
                        if is_same_origin(target_url, full_link):
                            queue.append((full_link, depth + 1, "link"))

                    # Extract scripts
                    for script_tag in soup.find_all("script", src=True):
                        src = script_tag["src"].strip()
                        full_script = urljoin(normalized_url, src)
                        if is_same_origin(target_url, full_script):
                            assets.append({
                                "url": full_script,
                                "type": "script",
                                "status_code": 200,
                                "content_type": "application/javascript",
                                "source": "html_script_tag",
                                "depth": depth + 1
                            })

                    # Extract forms (without submitting)
                    for form_tag in soup.find_all("form"):
                        action = form_tag.get("action", "").strip()
                        full_action = urljoin(normalized_url, action) if action else normalized_url
                        method = form_tag.get("method", "GET").upper()
                        assets.append({
                            "url": full_action,
                            "type": "form",
                            "status_code": 0,
                            "content_type": f"form_submission ({method})",
                            "source": "html_form_tag",
                            "depth": depth + 1
                        })

                except Exception:
                    pass

        except Exception:
            pass

    return assets


# ── 3. EVIDENCE-BASED RULE CHECKERS ──

def check_tls_ssl(hostname: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Inspects TLS/SSL certificate, version, cipher, SANs, and expiry."""
    ssl_info: Dict[str, Any] = {
        "valid": False,
        "issuer": "Unknown",
        "subject": "Unknown",
        "expiry": "Unknown",
        "days_left": 0,
        "expired": False,
        "tls_version": "Unknown",
        "cipher": "Unknown",
        "signature_algorithm": "Unknown",
        "san_domains": [],
        "weak_cipher": False,
    }
    findings: List[Dict[str, Any]] = []

    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=8) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert_der = ssock.getpeercert(binary_form=True)
                cert = x509.load_der_x509_certificate(cert_der)

                ssl_info["valid"] = True
                ssl_info["tls_version"] = ssock.version() or "Unknown"
                cipher_name = ssock.cipher()[0] if ssock.cipher() else "Unknown"
                ssl_info["cipher"] = cipher_name
                ssl_info["weak_cipher"] = cipher_name in WEAK_TLS_CIPHERS
                ssl_info["signature_algorithm"] = cert.signature_hash_algorithm.name if cert.signature_hash_algorithm else "Unknown"

                issuer_attrs = cert.issuer.get_attributes_for_oid(NameOID.ORGANIZATION_NAME)
                subject_attrs = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
                ssl_info["issuer"] = issuer_attrs[0].value if issuer_attrs else "Unknown"
                ssl_info["subject"] = subject_attrs[0].value if subject_attrs else "Unknown"

                expiry_dt = cert.not_valid_after_utc.replace(tzinfo=None) if hasattr(cert, "not_valid_after_utc") else cert.not_valid_after.replace(tzinfo=None)
                ssl_info["expiry"] = expiry_dt.strftime("%Y-%m-%d")
                ssl_info["days_left"] = (expiry_dt - dt.datetime.utcnow()).days
                ssl_info["expired"] = ssl_info["days_left"] < 0

                try:
                    san_ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
                    ssl_info["san_domains"] = san_ext.value.get_values_for_type(x509.DNSName)
                except Exception:
                    ssl_info["san_domains"] = []

                if ssl_info["expired"]:
                    findings.append({
                        "id": "SSL-001",
                        "title": "SSL/TLS Certificate Status",
                        "status_label": "Critical",
                        "priority": "HIGH PRIORITY",
                        "category": "Cryptographic Failures",
                        "severity": "Critical",
                        "confidence": "High",
                        "url": f"https://{hostname}:443",
                        "evidence": f"Certificate expired on {ssl_info['expiry']} ({abs(ssl_info['days_left'])} days ago)",
                        "detection_method": "TLS Socket & X509 Certificate Inspection",
                        "what_was_found": "The website's SSL/TLS certificate has expired.",
                        "why_is_this_a_risk": "Visitors may see security warnings and may no longer have a trusted encrypted connection to the website.",
                        "remediation": "Renew the SSL/TLS certificate immediately.",
                        "description": "The TLS certificate presented by the server has expired.",
                        "impact": "Visitors may see security warnings and may no longer have a trusted encrypted connection to the website.",
                        "references": ["https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html"],
                        "cvss_score": 7.5,
                        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                    })
                elif ssl_info["days_left"] <= 14:
                    findings.append({
                        "id": "SSL-002",
                        "title": "SSL/TLS Certificate Expiration",
                        "status_label": "Warning",
                        "priority": "MEDIUM PRIORITY",
                        "category": "Cryptographic Failures",
                        "severity": "Medium",
                        "confidence": "High",
                        "url": f"https://{hostname}:443",
                        "evidence": f"Certificate expires in {ssl_info['days_left']} days (on {ssl_info['expiry']})",
                        "detection_method": "TLS Socket & X509 Certificate Inspection",
                        "what_was_found": "The SSL/TLS certificate will expire in less than 14 days.",
                        "why_is_this_a_risk": "An expired certificate will cause browser security warnings and disrupt access for visitors.",
                        "remediation": "Renew the SSL/TLS certificate before it expires.",
                        "description": "The TLS certificate will expire in less than 14 days.",
                        "impact": "An expired certificate will cause browser security warnings and disrupt access for visitors.",
                        "references": [],
                        "cvss_score": 4.0,
                        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                    })

                if ssl_info["tls_version"] in {"TLSv1", "TLSv1.0", "TLSv1.1"}:
                    findings.append({
                        "id": "SSL-003",
                        "title": "Legacy Encryption Protocol (TLS 1.0/1.1)",
                        "status_label": "Risk",
                        "priority": "HIGH PRIORITY",
                        "category": "Cryptographic Failures",
                        "severity": "High",
                        "confidence": "High",
                        "url": f"https://{hostname}:443",
                        "evidence": f"Server accepted deprecated protocol version: {ssl_info['tls_version']}",
                        "detection_method": "TLS Version Handshake Inspection",
                        "what_was_found": "The server supports outdated encryption protocols.",
                        "why_is_this_a_risk": "Older encryption protocols have known weaknesses that can reduce the security of encrypted traffic.",
                        "remediation": "Disable legacy TLS 1.0 and 1.1 protocols and enforce TLS 1.2 or TLS 1.3.",
                        "description": "TLS 1.0 and 1.1 contain cryptographic weaknesses and are deprecated across major browsers.",
                        "impact": "Older encryption protocols have known weaknesses that can reduce the security of encrypted traffic.",
                        "references": ["https://datatracker.ietf.org/doc/html/rfc8996"],
                        "cvss_score": 6.8,
                        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                    })

                if ssl_info["weak_cipher"]:
                    findings.append({
                        "id": "SSL-004",
                        "title": "Encryption Cipher Quality",
                        "status_label": "Risk",
                        "priority": "HIGH PRIORITY",
                        "category": "Cryptographic Failures",
                        "severity": "High",
                        "confidence": "High",
                        "url": f"https://{hostname}:443",
                        "evidence": f"Weak cipher negotiation succeeded: {ssl_info['cipher']}",
                        "detection_method": "TLS Cipher Suite Probing",
                        "what_was_found": "The server supports weak encryption ciphers.",
                        "why_is_this_a_risk": "Weak ciphers provide less security for encrypted data sent between visitors and the website.",
                        "remediation": "Configure the web server to use strong modern encryption ciphers.",
                        "description": "The server supports legacy CBC or RC4 cipher suites.",
                        "impact": "Weak ciphers provide less security for encrypted data sent between visitors and the website.",
                        "references": [],
                        "cvss_score": 5.9,
                        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                    })

    except ssl.SSLCertVerificationError as e:
        ssl_info["valid"] = False
        ssl_info["issuer"] = "Invalid / Self-Signed"
        findings.append({
            "id": "SSL-000",
            "title": "SSL/TLS Certificate Validity",
            "status_label": "Risk",
            "priority": "HIGH PRIORITY",
            "category": "Cryptographic Failures",
            "severity": "High",
            "confidence": "High",
            "url": f"https://{hostname}:443",
            "evidence": f"Certificate verification failed: {e}",
            "detection_method": "SSL Context Certificate Validation",
            "what_was_found": "The website's SSL/TLS certificate is invalid or untrusted.",
            "why_is_this_a_risk": "Visitors will see browser security warnings and cannot verify that they are connected to the genuine website.",
            "remediation": "Install a valid SSL/TLS certificate issued by a trusted certificate authority.",
            "description": "The target certificate is self-signed or not issued by a trusted CA.",
            "impact": "Visitors will see browser security warnings and cannot verify that they are connected to the genuine website.",
            "references": [],
            "cvss_score": 6.5,
            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    except Exception:
        ssl_info["valid"] = False

    return ssl_info, findings


def check_security_headers(headers: Dict[str, str], target_url: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Analyzes response headers against security header rules."""
    normalized = {k.lower(): v for k, v in headers.items()}
    header_summary: List[Dict[str, Any]] = []
    findings: List[Dict[str, Any]] = []

    for header_name, rule in HEADER_RULES.items():
        key = header_name.lower()
        if key in normalized:
            header_summary.append({
                "header": header_name,
                "status": "Present",
                "severity": "Info",
                "evidence": normalized[key],
                "recommendation": f"{header_name} is configured."
            })
        else:
            header_summary.append({
                "header": header_name,
                "status": "Missing",
                "severity": rule["severity"],
                "evidence": "Header not found in HTTP response",
                "recommendation": rule["remediation"]
            })

            findings.append({
                "id": f"HDR_{header_name.upper().replace('-', '_')}",
                "title": rule["title"],
                "status_label": rule.get("status_label", "Warning"),
                "priority": rule.get("priority", "HIGH PRIORITY" if rule["severity"] in ["High", "Critical"] else "MEDIUM PRIORITY"),
                "category": rule["category"],
                "severity": rule["severity"],
                "confidence": "High",
                "url": target_url,
                "evidence": f"HTTP response headers did not include '{header_name}'",
                "detection_method": "HTTP Response Header Audit",
                "what_was_found": rule.get("what_was_found", rule["description"]),
                "why_is_this_a_risk": rule.get("why_is_this_a_risk", rule["impact"]),
                "description": rule["description"],
                "impact": rule["impact"],
                "remediation": rule["remediation"],
                "references": rule["references"],
                "cvss_score": rule["cvss"]["score"],
                "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
            })

    return header_summary, findings


def check_cookies(headers: Dict[str, str], target_url: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Parses Set-Cookie headers and verifies Secure, HttpOnly, and SameSite attributes."""
    raw_set_cookies = headers.get("set-cookie") or headers.get("Set-Cookie") or ""
    cookie_entries: List[Dict[str, Any]] = []
    findings: List[Dict[str, Any]] = []

    if not raw_set_cookies:
        return [], findings

    parts = re.split(r"\s*,(?=\s*[A-Za-z0-9_.-]+=)", raw_set_cookies)
    for raw_cookie in parts:
        cookie = SimpleCookie()
        try:
            cookie.load(raw_cookie)
        except Exception:
            continue

        for name, morsel in cookie.items():
            is_secure = (morsel["secure"] == "Secure") or bool(re.search(r"\bsecure\b", raw_cookie, re.IGNORECASE))
            is_httponly = (morsel["httponly"] == "HttpOnly") or bool(re.search(r"\bhttponly\b", raw_cookie, re.IGNORECASE))
            samesite = morsel["samesite"] or "N/A"
            domain = morsel["domain"] or ""

            entry = {
                "name": name,
                "secure": is_secure,
                "httpOnly": is_httponly,
                "sameSite": samesite,
                "expires": morsel["expires"] or "Session",
                "path": morsel["path"] or "/",
                "domain": domain,
                "status": "Present",
            }
            cookie_entries.append(entry)

            if target_url.startswith("https://") and not is_secure:
                findings.append({
                    "id": f"CK-SECURE-{name}",
                    "title": f"Cookie '{name}' Missing Secure Flag",
                    "category": "Identification and Authentication Failures",
                    "severity": "Medium",
                    "confidence": "High",
                    "url": target_url,
                    "evidence": f"Set-Cookie: {name}=... (Secure attribute absent)",
                    "detection_method": "HTTP Cookie Header Inspection",
                    "description": f"The cookie '{name}' was transmitted over HTTPS without the Secure flag.",
                    "impact": "Browsers may send this cookie over cleartext HTTP if the user clicks a HTTP link.",
                    "remediation": f"Append '; Secure' to the Set-Cookie definition for '{name}'.",
                    "references": ["https://owasp.org/www-community/controls/SecureCookieAttribute"],
                    "cvss_score": 4.3,
                    "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                })

            if not is_httponly:
                findings.append({
                    "id": f"CK-HTTPONLY-{name}",
                    "title": f"Cookie '{name}' Missing HttpOnly Flag",
                    "category": "Identification and Authentication Failures",
                    "severity": "Medium",
                    "confidence": "High",
                    "url": target_url,
                    "evidence": f"Set-Cookie: {name}=... (HttpOnly attribute absent)",
                    "detection_method": "HTTP Cookie Header Inspection",
                    "description": f"The cookie '{name}' lacks the HttpOnly attribute.",
                    "impact": "Client-side scripts (XSS payloads) can read or modify session cookies.",
                    "remediation": f"Append '; HttpOnly' to the Set-Cookie definition for '{name}'.",
                    "references": ["https://owasp.org/www-community/HttpOnly"],
                    "cvss_score": 5.3,
                    "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                })

            if domain.startswith("."):
                findings.append({
                    "id": f"CK-SCOPE-{name}",
                    "title": f"Broad Domain Scope on Cookie '{name}'",
                    "category": "Security Misconfiguration",
                    "severity": "Low",
                    "confidence": "Medium",
                    "url": target_url,
                    "evidence": f"Cookie domain set to broad scope '{domain}'",
                    "detection_method": "HTTP Cookie Scope Audit",
                    "description": f"The cookie '{name}' explicitly specifies a wildcard domain attribute '{domain}'.",
                    "impact": "Subdomains of this domain can access this cookie.",
                    "remediation": "Omit the Domain attribute or restrict scope to specific FQDN.",
                    "references": [],
                    "cvss_score": 2.6,
                    "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                })

    return cookie_entries, findings


def check_dns(domain: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Performs DNS queries for A, AAAA, MX, NS, TXT, CAA, SPF, and DMARC."""
    resolver = dns.resolver.Resolver()
    resolver.timeout = 3.0
    resolver.lifetime = 3.0

    records: Dict[str, Any] = {
        "A": [], "AAAA": [], "MX": [], "NS": [], "TXT": [], "CNAME": [], "CAA": [],
        "spf": None, "dmarc": None
    }
    findings: List[Dict[str, Any]] = []

    for rtype in ("A", "AAAA", "MX", "NS", "TXT", "CNAME", "CAA"):
        try:
            answers = resolver.resolve(domain, rtype)
            records[rtype] = [str(item) for item in answers]
        except Exception:
            records[rtype] = []

    try:
        txt_answers = resolver.resolve(domain, "TXT")
        records["spf"] = next((str(v) for v in txt_answers if "v=spf1" in str(v).lower()), None)
    except Exception:
        records["spf"] = None

    try:
        dmarc_answers = resolver.resolve(f"_dmarc.{domain}", "TXT")
        records["dmarc"] = next((str(v) for v in dmarc_answers if "v=dmarc1" in str(v).lower()), None)
    except Exception:
        records["dmarc"] = None

    if not records["spf"]:
        findings.append({
            "id": "DNS-SPF-MISSING",
            "title": "Missing SPF Record",
            "category": "Security Misconfiguration",
            "severity": "Medium",
            "confidence": "High",
            "url": f"dns://{domain}",
            "evidence": f"No TXT record matching 'v=spf1' was found for domain '{domain}'",
            "detection_method": "DNS TXT Lookup",
            "description": "Sender Policy Framework (SPF) record is missing.",
            "impact": "Attackers can send spoofed emails appearing to originate from your domain.",
            "remediation": f"Publish an SPF TXT record for '{domain}' specifying authorized mail senders.",
            "references": ["https://datatracker.ietf.org/doc/html/rfc7208"],
            "cvss_score": 4.3,
            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        })

    if not records["dmarc"]:
        findings.append({
            "id": "DNS-DMARC-MISSING",
            "title": "Missing DMARC Record",
            "category": "Security Misconfiguration",
            "severity": "Medium",
            "confidence": "High",
            "url": f"dns://{domain}",
            "evidence": f"No TXT record found at '_dmarc.{domain}'",
            "detection_method": "DNS DMARC TXT Lookup",
            "description": "Domain-based Message Authentication, Reporting, and Conformance (DMARC) is not enabled.",
            "impact": "No policy instructions exist for receivers when SPF or DKIM checks fail.",
            "remediation": f"Create a DMARC TXT record at '_dmarc.{domain}' (e.g. 'v=DMARC1; p=reject;').",
            "references": ["https://datatracker.ietf.org/doc/html/rfc7489"],
            "cvss_score": 4.3,
            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        })

    return records, findings


def check_information_disclosure(headers: Dict[str, str], body_text: str, target_url: str) -> List[Dict[str, Any]]:
    """Detects server banner disclosure, framework versions, and mixed content."""
    findings: List[Dict[str, Any]] = []

    server_header = headers.get("server") or headers.get("Server")
    if server_header:
        # Check if version numbers are included in server header
        has_version = bool(re.search(r"\d+\.\d+", server_header))
        findings.append({
            "id": "INF-SERVER-BANNER",
            "title": "Server Banner Information Disclosure",
            "category": "Security Misconfiguration",
            "severity": "Low" if not has_version else "Medium",
            "confidence": "High",
            "url": target_url,
            "evidence": f"Server header disclosed: '{server_header}'",
            "detection_method": "HTTP Response Header Inspection",
            "description": "The web server explicitly discloses software identity in the 'Server' header.",
            "impact": "Aids attacker reconnaissance by revealing web server software and potential specific CVE versions.",
            "remediation": "Disable server tokens in server configuration (e.g., 'ServerTokens Prod' in Apache, 'server_tokens off;' in Nginx).",
            "references": [],
            "cvss_score": 3.1 if has_version else 2.0,
            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        })

    x_powered_by = headers.get("x-powered-by") or headers.get("X-Powered-By")
    if x_powered_by:
        findings.append({
            "id": "INF-X-POWERED-BY",
            "title": "X-Powered-By Header Disclosed",
            "category": "Security Misconfiguration",
            "severity": "Low",
            "confidence": "High",
            "url": target_url,
            "evidence": f"X-Powered-By header disclosed: '{x_powered_by}'",
            "detection_method": "HTTP Response Header Inspection",
            "description": "The application reveals underlying backend framework identity.",
            "impact": "Simplifies framework-targeted exploitation.",
            "remediation": "Remove the X-Powered-By header from application framework configuration.",
            "references": [],
            "cvss_score": 2.6,
            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        })

    # Mixed Content check
    if target_url.startswith("https://"):
        insecure_links = re.findall(r'src=["\']http://[^\s"\'>]+', body_text, re.IGNORECASE)
        if insecure_links:
            findings.append({
                "id": "INF-MIXED-CONTENT",
                "title": "Mixed Active Content Over HTTPS",
                "category": "Cryptographic Failures",
                "severity": "Medium",
                "confidence": "High",
                "url": target_url,
                "evidence": f"Observed HTTP asset references in page source: {insecure_links[0][:60]}...",
                "detection_method": "HTML Source Content Inspection",
                "description": "An HTTPS page loads sub-resources over insecure HTTP links.",
                "impact": "Unencrypted scripts/styles can be intercepted and modified by an active network adversary.",
                "remediation": "Replace all HTTP sub-resource URLs with HTTPS or relative paths.",
                "references": ["https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content"],
                "cvss_score": 5.3,
                "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
            })

    return findings


def detect_technologies_with_confidence(target_url: str, headers: Dict[str, str], body_text: str) -> List[Dict[str, Any]]:
    """Detects tech stack using Wappalyzer or fallback regex rules with confidence ratings."""
    detected: List[Dict[str, Any]] = []

    if Wappalyzer:
        try:
            wapp = Wappalyzer()
            raw_res = wapp.analyze(target_url)
            if raw_res:
                for item in raw_res:
                    if isinstance(item, dict):
                        detected.append({
                            "name": item.get("name") or "Unknown",
                            "confidence": "HIGH" if (item.get("confidence", 0) > 80) else "MEDIUM",
                            "confidence_percent": item.get("confidence", 80),
                            "categories": item.get("categories", []),
                        })
                    else:
                        detected.append({
                            "name": str(item),
                            "confidence": "HIGH",
                            "confidence_percent": 90,
                            "categories": [],
                        })
                return detected
        except Exception:
            pass

    # Fallback Signature Fingerprinting
    signatures = [
        ("WordPress", r"wp-content|wp-includes", "HIGH"),
        ("React", r"reactRoot|_reactListening|data-reactroot", "HIGH"),
        ("Vue.js", r"v-data-|data-v-[a-f0-9]", "HIGH"),
        ("Next.js", r"__NEXT_DATA__", "HIGH"),
        ("Bootstrap", r"bootstrap(?:\.min)?\.(?:js|css)", "MEDIUM"),
        ("jQuery", r"jquery(?:\.min)?\.js", "MEDIUM"),
        ("Tailwind CSS", r"tailwind", "LOW"),
        ("Nginx", r"nginx", "HIGH"),
        ("Apache", r"Apache", "HIGH"),
        ("Cloudflare", r"cloudflare", "HIGH"),
    ]

    combined_text = (str(headers) + " " + body_text[:10000]).lower()

    for name, pattern, conf in signatures:
        if re.search(pattern, combined_text, re.IGNORECASE):
            detected.append({
                "name": name,
                "confidence": conf,
                "confidence_percent": 90 if conf == "HIGH" else 65 if conf == "MEDIUM" else 40,
                "categories": ["Web Framework / Library"]
            })

    return detected


def scan_ports_nmap(hostname: str, is_active_mode: bool = False) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, str]]]:
    """Port probing module - ONLY runs if active scan authorized."""
    if not is_active_mode:
        return [], None

    if not nmap:
        return [], {"status": "unavailable", "reason": "python-nmap dependency is not installed"}

    common_ports = [21, 22, 25, 53, 80, 110, 143, 443, 3306, 5432, 8080, 8443]
    try:
        scanner = nmap.PortScanner()
        res = scanner.scan(hosts=hostname, ports=",".join(map(str, common_ports)), arguments="-sT -Pn -n --timeout 1000")
        tcp_data = res.get("scan", {}).get(hostname, {}).get("tcp", {})

        port_list: List[Dict[str, Any]] = []
        for port, pdata in tcp_data.items():
            if pdata.get("state") == "open":
                port_list.append({
                    "port": port,
                    "protocol": "tcp",
                    "service": pdata.get("name", "unknown"),
                    "state": "open",
                    "evidence": f"TCP connection established on port {port}",
                    "confidence": "HIGH"
                })
        return port_list, None
    except Exception as e:
        return [], {"status": "unavailable", "reason": f"Nmap execution error: {e}"}


# ── 4. TRANSPARENT RISK SCORING ENGINE ──

def calculate_transparent_risk_score(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculates security score based only on verified findings deduplicated by ID.
    Base: 100.
    Weighting: Critical = 25, High = 15, Medium = 8, Low = 3, Informational = 0.
    Returns transparent deduction breakdown.
    """
    base_score = 100
    seen_ids: Set[str] = set()
    deductions: List[Dict[str, Any]] = []
    total_deduction = 0

    weights = {
        "Critical": 25,
        "High": 15,
        "Medium": 8,
        "Low": 3,
        "Informational": 0,
        "Info": 0
    }

    for f in findings:
        fid = f.get("id") or f.get("title")
        if fid in seen_ids:
            continue
        seen_ids.add(fid)

        sev = f.get("severity", "Low")
        points = weights.get(sev, 3)

        if points > 0:
            total_deduction += points
            deductions.append({
                "finding_id": fid,
                "title": f.get("title"),
                "severity": sev,
                "deduction": points
            })

    final_score = max(0, base_score - total_deduction)

    if final_score >= 90:
        risk_level = "Low Risk (Secure)"
    elif final_score >= 75:
        risk_level = "Moderate Risk"
    elif final_score >= 50:
        risk_level = "High Risk"
    else:
        risk_level = "Critical Risk"

    return {
        "base_score": base_score,
        "total_deduction": total_deduction,
        "final_score": final_score,
        "risk_level": risk_level,
        "deductions": deductions,
        "verified_findings_count": len(deductions)
    }


# ── 5. AI EXPLANATION ENGINE (VERIFIED FINDINGS ONLY) ──

def generate_ai_explanations(verified_findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Receives ONLY verified findings and generates technical explanations.
    Does NOT invent findings.
    """
    explanations: List[Dict[str, Any]] = []

    for f in verified_findings:
        title = f.get("title", "Security Finding")
        ev = f.get("evidence", "No evidence specified")
        sev = f.get("severity", "Low")
        rem = f.get("remediation", "Apply vendor security best practices.")

        explanations.append({
            "finding_id": f.get("id"),
            "title": title,
            "what_it_means": f"The security analysis observed that '{title}' is present on the asset.",
            "why_it_matters": f"With severity level {sev}, this issue weakens defensive security controls.",
            "evidence_interpretation": f"Direct scanner evidence: {ev}",
            "recommended_remediation": rem,
            "verification_steps": f"Re-run scanner or execute HTTP GET request to verify '{title}' resolution."
        })

    return explanations
