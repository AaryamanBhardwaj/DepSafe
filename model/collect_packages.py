"""
Step 1: Build a diverse list of npm packages for training data.

Strategy:
- Pull popular packages from npms.io search API (different keywords)
- Pull packages across different popularity tiers
- Include known-abandoned packages by searching for old/unmaintained ones
- Target: ~5,000 unique packages with GitHub repos
"""

import json
import time
import requests
from pathlib import Path
from tqdm import tqdm

OUTPUT = Path(__file__).parent / "package_list.json"
SESSION = requests.Session()
SESSION.headers.update({"Accept": "application/json"})


def search_npms(query: str, size: int = 250) -> list[dict]:
    """Search npms.io and return package metadata."""
    results = []
    for offset in range(0, size, 25):
        url = "https://api.npms.io/v2/search"
        params = {"q": query, "size": 25, "from": offset}
        try:
            resp = SESSION.get(url, params=params, timeout=15)
            if resp.status_code == 429:
                time.sleep(10)
                resp = SESSION.get(url, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("results", []):
                pkg = item.get("package", {})
                links = pkg.get("links", {})
                repo = links.get("repository", "")
                if "github.com" in repo:
                    results.append({
                        "name": pkg["name"],
                        "repo_url": repo,
                        "score": item.get("score", {}).get("final", 0),
                    })
        except Exception as e:
            print(f"  Error searching '{query}' offset={offset}: {e}")
        time.sleep(0.5)
    return results


def get_popular_packages() -> list[dict]:
    """Get packages across different domains and popularity tiers."""
    queries = [
        "keywords:framework",
        "keywords:utility",
        "keywords:cli",
        "keywords:middleware",
        "keywords:database",
        "keywords:testing",
        "keywords:logging",
        "keywords:auth",
        "keywords:validation",
        "keywords:http",
        "keywords:parser",
        "keywords:compiler",
        "keywords:bundler",
        "keywords:lint",
        "keywords:css",
        "keywords:react",
        "keywords:vue",
        "keywords:angular",
        "keywords:express",
        "keywords:graphql",
        "keywords:websocket",
        "keywords:crypto",
        "keywords:image",
        "keywords:video",
        "keywords:audio",
        "keywords:email",
        "keywords:queue",
        "keywords:cache",
        "keywords:markdown",
        "keywords:yaml",
        "keywords:xml",
        "keywords:csv",
        "keywords:pdf",
        "keywords:chart",
        "keywords:map",
        "keywords:date",
        "keywords:color",
        "keywords:animation",
        "keywords:orm",
        "keywords:migration",
        "keywords:deploy",
        "keywords:docker",
        "keywords:aws",
        "keywords:monitoring",
        "keywords:i18n",
        "keywords:accessibility",
        "keywords:scraper",
        "keywords:bot",
        "keywords:payment",
        "keywords:search",
        "keywords:template",
        "keywords:proxy",
    ]

    abandoned_queries = [
        "keywords:deprecated",
        "not:unstable keywords:legacy",
        "not:maintained keywords:old",
    ]

    all_packages = []
    seen = set()

    print("Fetching popular packages across categories...")
    for q in tqdm(queries, desc="Categories"):
        pkgs = search_npms(q, size=100)
        for p in pkgs:
            if p["name"] not in seen:
                seen.add(p["name"])
                all_packages.append(p)

    print(f"\nFetching potentially abandoned packages...")
    for q in tqdm(abandoned_queries, desc="Abandoned"):
        pkgs = search_npms(q, size=250)
        for p in pkgs:
            if p["name"] not in seen:
                seen.add(p["name"])
                all_packages.append(p)

    low_score = [p for p in all_packages if p["score"] < 0.3]
    mid_score = [p for p in all_packages if 0.3 <= p["score"] < 0.7]
    high_score = [p for p in all_packages if p["score"] >= 0.7]
    print(f"\nScore distribution: low={len(low_score)}, mid={len(mid_score)}, high={len(high_score)}")

    return all_packages


def get_bulk_packages_from_registry(count: int = 2000) -> list[dict]:
    """Get additional packages directly from the npm registry to fill our quota."""
    print(f"\nFetching {count} additional packages from npm registry...")
    results = []
    seen_in_batch = set()

    popular_scopes = [
        "@types/", "@babel/", "@testing-library/", "@emotion/",
        "@mui/", "@nestjs/", "@angular/", "@vue/", "@nuxt/",
    ]

    text_searches = [
        "helper", "utils", "tool", "plugin", "adapter", "wrapper",
        "connector", "bridge", "loader", "transform", "stream",
        "buffer", "config", "env", "logger", "debug", "error",
        "retry", "timeout", "throttle", "debounce", "merge",
        "diff", "hash", "encode", "decode", "compress", "extract",
        "render", "format", "convert", "generate", "build",
        "watch", "serve", "proxy", "mock", "stub", "fake",
        "fixture", "seed", "migrate", "sync", "async", "promise",
        "callback", "event", "signal", "hook", "middleware",
    ]

    for term in tqdm(text_searches, desc="Registry search"):
        if len(results) >= count:
            break
        try:
            url = f"https://registry.npmjs.org/-/v1/search"
            params = {"text": term, "size": 50}
            resp = SESSION.get(url, params=params, timeout=15)
            if resp.status_code == 429:
                time.sleep(10)
                continue
            resp.raise_for_status()
            data = resp.json()
            for obj in data.get("objects", []):
                pkg = obj.get("package", {})
                name = pkg.get("name", "")
                links = pkg.get("links", {})
                repo = links.get("repository", "")
                if name and "github.com" in repo and name not in seen_in_batch:
                    seen_in_batch.add(name)
                    results.append({
                        "name": name,
                        "repo_url": repo,
                        "score": 0,
                    })
        except Exception as e:
            print(f"  Error: {e}")
        time.sleep(0.3)

    return results


def normalize_github_url(url: str) -> tuple[str, str] | None:
    """Extract owner/repo from a GitHub URL."""
    url = url.rstrip("/")
    url = url.replace("git+", "").replace("git://", "https://")
    url = url.replace(".git", "")
    if "github.com" not in url:
        return None
    parts = url.split("github.com/")
    if len(parts) < 2:
        return None
    path = parts[1].strip("/")
    segments = path.split("/")
    if len(segments) >= 2:
        return segments[0], segments[1].split("#")[0].split("?")[0]
    return None


def main():
    npms_packages = get_popular_packages()
    print(f"Got {len(npms_packages)} packages from npms.io")

    registry_packages = get_bulk_packages_from_registry(2000)
    print(f"Got {len(registry_packages)} packages from npm registry")

    seen = set()
    combined = []
    for p in npms_packages + registry_packages:
        if p["name"] not in seen:
            parsed = normalize_github_url(p["repo_url"])
            if parsed:
                owner, repo = parsed
                repo_key = f"{owner}/{repo}".lower()
                if repo_key not in seen:
                    seen.add(p["name"])
                    seen.add(repo_key)
                    combined.append({
                        "name": p["name"],
                        "github_owner": owner,
                        "github_repo": repo,
                    })

    print(f"\nTotal unique packages with GitHub repos: {len(combined)}")

    OUTPUT.write_text(json.dumps(combined, indent=2))
    print(f"Saved to {OUTPUT}")


if __name__ == "__main__":
    main()
