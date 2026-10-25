import re
from urllib.parse import urlparse

import tldextract


SUSPICIOUS = ["login", "verify", "secure", "account", "update", "bank", "confirm"]

# Offline extractor: uses the bundled public-suffix list and never makes
# a network request (faster, and works without internet).
_extract = tldextract.TLDExtract(suffix_list_urls=())

_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://")
_IPV4_RE = re.compile(r"\d{1,3}(\.\d{1,3}){3}")


def _split_scheme(url: str) -> tuple[str, str]:
    """Return (scheme, url_without_scheme)."""
    url = url.strip()
    match = _SCHEME_RE.match(url)
    if match:
        return match.group(0)[:-3].lower(), url[match.end():]
    return "", url


def _normalize_path(bare: str) -> str:
    """Add the implicit '/' a browser would add: 'a.com' -> 'a.com/'.

    Every URL in the training data has a path separator, so a bare domain
    typed by a user would otherwise look unlike anything the model has seen.
    """
    pos = re.search(r"[/?#]", bare)
    if pos is None:
        return bare + "/"
    if bare[pos.start()] != "/":
        return bare[:pos.start()] + "/" + bare[pos.start():]
    return bare


def extract_features(url: str) -> dict:
    scheme, bare = _split_scheme(url)
    bare = _normalize_path(bare)

    # The training data has no http(s):// prefix, so every length/count
    # feature is computed on the scheme-less URL. This keeps training and
    # prediction consistent no matter what the user types.
    try:
        parsed = urlparse("//" + bare)
        host = parsed.hostname or ""
        path = parsed.path
    except ValueError:
        host = re.split(r"[/?#]", bare, maxsplit=1)[0]
        path = ""

    ext = _extract(host)

    return {
        "url_length": len(bare),
        "host_length": len(host),
        "num_dots": bare.count("."),
        "num_hyphens": bare.count("-"),
        "num_digits": sum(c.isdigit() for c in bare),
        "has_at": int("@" in bare),
        "has_ip": int(bool(_IPV4_RE.fullmatch(host))),
        "is_https": int(scheme == "https"),
        "num_subdomains": len([s for s in ext.subdomain.split(".") if s]),
        "num_suspicious_words": sum(word in bare.lower() for word in SUSPICIOUS),
        "path_length": len(path),
        "num_params": bare.count("="),
    }
