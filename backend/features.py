"""
Live feature fetching from GitHub + npm APIs.
Computes the same 20 features used during training.
"""

import os
import time
from datetime import datetime, timedelta, timezone

import requests

def _resolve_github_token():
    token = os.getenv("GITHUB_TOKEN", "")
    if token:
        return token
    ssm_name = os.getenv("GITHUB_TOKEN_SSM", "")
    if ssm_name:
        import boto3
        ssm = boto3.client("ssm")
        resp = ssm.get_parameter(Name=ssm_name, WithDecryption=True)
        return resp["Parameter"]["Value"]
    try:
        from pathlib import Path as _P
        from dotenv import load_dotenv
        load_dotenv(_P(__file__).parent / ".env")
    except Exception:
        pass
    return os.getenv("GITHUB_TOKEN", "")

GITHUB_TOKEN = _resolve_github_token()

FEATURE_NAMES = [
    "commits_90d", "commits_365d", "commit_velocity_trend",
    "contributors_total", "contributors_90d", "bus_factor",
    "open_issues", "closed_issues_90d", "issue_response_time_median",
    "days_since_last_release", "release_frequency", "release_regularity",
    "weekly_downloads", "download_trend", "dependent_count",
    "has_readme", "has_license", "repo_stars", "repo_open_prs",
    "days_since_last_commit",
]


def _gh_session() -> requests.Session:
    s = requests.Session()
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    s.headers.update(headers)
    return s


def _npm_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


GH = _gh_session()
NPM = _npm_session()


def reinit_sessions():
    global GH, NPM
    GH = _gh_session()
    NPM = _npm_session()


class PackageNotFoundError(Exception):
    pass


class GitHubRepoNotFoundError(Exception):
    pass


class RateLimitError(Exception):
    pass


def _count_from_pagination(url: str, params: dict) -> int:
    params = {**params, "per_page": 1}
    resp = GH.get(url, params=params, timeout=15)
    if resp.status_code == 403:
        remaining = resp.headers.get("X-RateLimit-Remaining", "?")
        raise RateLimitError(f"GitHub API rate limit hit ({remaining} remaining)")
    if resp.status_code in (404, 422, 409):
        return 0
    resp.raise_for_status()
    if "Link" in resp.headers and 'rel="last"' in resp.headers["Link"]:
        link = resp.headers["Link"]
        last_part = [p for p in link.split(",") if 'rel="last"' in p]
        if last_part:
            page_num = last_part[0].split("page=")[-1].split(">")[0]
            try:
                return int(page_num)
            except ValueError:
                pass
    return len(resp.json())


def _gh_get(url: str, params: dict = None):
    resp = GH.get(url, params=params, timeout=15)
    if resp.status_code == 403:
        remaining = resp.headers.get("X-RateLimit-Remaining", "?")
        raise RateLimitError(f"GitHub API rate limit hit ({remaining} remaining)")
    if resp.status_code == 404:
        return None
    if resp.status_code in (422, 409):
        return None
    resp.raise_for_status()
    return resp.json()


def _npm_get(url: str):
    resp = NPM.get(url, timeout=15)
    if resp.status_code in (404, 429):
        return None
    resp.raise_for_status()
    return resp.json()


def resolve_github_repo(package_name: str) -> tuple[str, str]:
    """Resolve an npm package name to its GitHub owner/repo."""
    npm_data = _npm_get(f"https://registry.npmjs.org/{package_name}")
    if not npm_data:
        raise PackageNotFoundError(f"Package '{package_name}' not found on npm")

    repo_info = npm_data.get("repository", {})
    repo_url = repo_info.get("url", "") if isinstance(repo_info, dict) else str(repo_info)

    if "github.com" not in repo_url:
        homepage = npm_data.get("homepage", "")
        if "github.com" in homepage:
            repo_url = homepage
        else:
            raise GitHubRepoNotFoundError(
                f"Package '{package_name}' has no linked GitHub repository"
            )

    url = repo_url.rstrip("/").replace("git+", "").replace("git://", "https://").replace(".git", "")
    parts = url.split("github.com/")
    if len(parts) < 2:
        raise GitHubRepoNotFoundError(f"Could not parse GitHub URL: {repo_url}")
    path = parts[1].strip("/")
    segments = path.split("/")
    if len(segments) < 2:
        raise GitHubRepoNotFoundError(f"Could not parse GitHub URL: {repo_url}")
    owner = segments[0]
    repo = segments[1].split("#")[0].split("?")[0]
    return owner, repo


def fetch_features(package_name: str) -> dict:
    """Fetch all 20 features for a package. Returns dict with feature values + metadata."""
    owner, repo = resolve_github_repo(package_name)
    repo_url = f"https://api.github.com/repos/{owner}/{repo}"
    now = datetime.now(timezone.utc)

    repo_data = _gh_get(repo_url)
    if not repo_data:
        raise GitHubRepoNotFoundError(f"GitHub repo {owner}/{repo} not found")

    stars = repo_data.get("stargazers_count", 0)
    open_issues = repo_data.get("open_issues_count", 0)
    has_license = int(repo_data.get("license") is not None)
    has_readme = 1

    since_365 = (now - timedelta(days=365)).isoformat()
    since_90 = (now - timedelta(days=90)).isoformat()

    commits_365d = _count_from_pagination(f"{repo_url}/commits", {"since": since_365})
    commits_90d = _count_from_pagination(f"{repo_url}/commits", {"since": since_90})

    expected_90d = commits_365d / 4.0 if commits_365d > 0 else 0
    commit_velocity_trend = (commits_90d / expected_90d) if expected_90d > 0 else (1.0 if commits_90d > 0 else 0.0)

    contribs = _gh_get(f"{repo_url}/contributors", {"per_page": 30})
    contributors_total = 0
    bus_factor = 100.0
    if isinstance(contribs, list) and len(contribs) > 0:
        contributors_total = len(contribs)
        total_c = sum(c.get("contributions", 0) for c in contribs)
        top_c = contribs[0].get("contributions", 0)
        bus_factor = (top_c / total_c * 100) if total_c > 0 else 100.0

    recent_commits = _gh_get(f"{repo_url}/commits", {"since": since_90, "per_page": 100})
    contributors_90d = 0
    days_since_last_commit = 9999
    if isinstance(recent_commits, list):
        active_authors = set()
        for c in recent_commits:
            author = c.get("author")
            if author and author.get("login"):
                active_authors.add(author["login"])
        contributors_90d = len(active_authors)
        if len(recent_commits) > 0:
            date_str = recent_commits[0].get("commit", {}).get("committer", {}).get("date")
            if date_str:
                commit_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                days_since_last_commit = (now - commit_date).days
    if days_since_last_commit == 9999:
        last_commit = _gh_get(f"{repo_url}/commits", {"per_page": 1})
        if isinstance(last_commit, list) and len(last_commit) > 0:
            date_str = last_commit[0].get("commit", {}).get("committer", {}).get("date")
            if date_str:
                commit_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                days_since_last_commit = (now - commit_date).days

    repo_open_prs = _count_from_pagination(f"{repo_url}/pulls", {"state": "open"})

    since_90_str = (now - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
    closed_issues_90d = _count_from_pagination(
        f"{repo_url}/issues", {"state": "closed", "since": since_90_str}
    )

    recent_issues = _gh_get(f"{repo_url}/issues", {
        "state": "all", "per_page": 10, "sort": "created", "direction": "desc"
    })
    response_times = []
    if isinstance(recent_issues, list):
        for issue in recent_issues[:5]:
            if issue.get("pull_request"):
                continue
            created = issue.get("created_at")
            closed = issue.get("closed_at")
            if created and closed:
                t_created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                t_closed = datetime.fromisoformat(closed.replace("Z", "+00:00"))
                delta_hours = (t_closed - t_created).total_seconds() / 3600
                if 0 <= delta_hours < 8760:
                    response_times.append(delta_hours)
    issue_response_time_median = 0.0
    if response_times:
        response_times.sort()
        issue_response_time_median = response_times[len(response_times) // 2]

    npm_data = _npm_get(f"https://registry.npmjs.org/{package_name}")
    days_since_last_release = 9999
    release_frequency = 9999
    release_regularity = 9999
    if npm_data and "time" in npm_data:
        times = npm_data["time"]
        versions = {k: v for k, v in times.items() if k not in ("created", "modified")}
        if versions:
            sorted_releases = sorted(versions.items(), key=lambda x: x[1], reverse=True)
            try:
                latest_date = datetime.fromisoformat(sorted_releases[0][1].replace("Z", "+00:00"))
                days_since_last_release = (now - latest_date).days
            except Exception:
                pass
            if len(sorted_releases) >= 5:
                try:
                    last_5 = [datetime.fromisoformat(d.replace("Z", "+00:00")) for _, d in sorted_releases[:5]]
                    gaps = [(last_5[i] - last_5[i + 1]).days for i in range(4)]
                    release_frequency = sum(gaps) / len(gaps)
                    if len(gaps) > 1:
                        mean_gap = sum(gaps) / len(gaps)
                        release_regularity = (sum((g - mean_gap) ** 2 for g in gaps) / len(gaps)) ** 0.5
                    else:
                        release_regularity = 0
                except Exception:
                    pass

    dl_data = _npm_get(f"https://api.npmjs.org/downloads/point/last-week/{package_name}")
    weekly_downloads = dl_data.get("downloads", 0) if dl_data else 0

    dl_month = _npm_get(f"https://api.npmjs.org/downloads/point/last-month/{package_name}")
    monthly_dl = dl_month.get("downloads", 0) if dl_month else 0
    six_mo_avg = weekly_downloads * 4.33
    download_trend = (monthly_dl / six_mo_avg) if six_mo_avg > 0 else (1.0 if monthly_dl > 0 else 0.0)

    npms_data = _npm_get(f"https://api.npms.io/v2/package/{package_name}")
    dependent_count = 0
    if npms_data:
        dependent_count = npms_data.get("collected", {}).get("npm", {}).get("dependentsCount", 0)

    # Cap sentinel values (same as training)
    days_since_last_release = min(days_since_last_release, 3650)
    release_frequency = min(release_frequency, 3650)
    release_regularity = min(release_regularity, 3650)
    days_since_last_commit = min(days_since_last_commit, 3650)
    issue_response_time_median = min(issue_response_time_median, 8760)

    features = {
        "commits_90d": commits_90d,
        "commits_365d": commits_365d,
        "commit_velocity_trend": round(commit_velocity_trend, 4),
        "contributors_total": contributors_total,
        "contributors_90d": contributors_90d,
        "bus_factor": round(bus_factor, 2),
        "open_issues": open_issues,
        "closed_issues_90d": closed_issues_90d,
        "issue_response_time_median": round(issue_response_time_median, 2),
        "days_since_last_release": days_since_last_release,
        "release_frequency": round(release_frequency, 2),
        "release_regularity": round(release_regularity, 2),
        "weekly_downloads": weekly_downloads,
        "download_trend": round(download_trend, 4),
        "dependent_count": dependent_count,
        "has_readme": has_readme,
        "has_license": has_license,
        "repo_stars": stars,
        "repo_open_prs": repo_open_prs,
        "days_since_last_commit": days_since_last_commit,
    }

    metadata = {
        "github_owner": owner,
        "github_repo": repo,
        "github_url": f"https://github.com/{owner}/{repo}",
        "npm_url": f"https://www.npmjs.com/package/{package_name}",
    }

    return {"features": features, "metadata": metadata}
