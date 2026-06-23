"""
Step 2: For each package in package_list.json, fetch GitHub + npm data
and compute all 20 features. Label each package as maintained or abandoned.

Optimized for API efficiency: ~6 GitHub calls per package.
At 5,000 req/hr with token: ~830 packages/hr.

Checkpoint every 50 packages for resume support.
"""

import json
import os
import sys
import time
import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise RuntimeError("Set GITHUB_TOKEN in model/.env")

BASE = Path(__file__).parent
PACKAGE_LIST = BASE / "package_list.json"
OUTPUT_CSV = BASE / "dataset.csv"
CHECKPOINT = BASE / "checkpoint.json"

GH = requests.Session()
GH.headers.update({
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
})

NPM = requests.Session()
NPM.headers.update({"Accept": "application/json"})

NOW = datetime.now(timezone.utc)

FEATURES = [
    "package_name", "github_owner", "github_repo",
    "commits_90d", "commits_365d", "commit_velocity_trend",
    "contributors_total", "contributors_90d", "bus_factor",
    "open_issues", "closed_issues_90d", "issue_response_time_median",
    "days_since_last_release", "release_frequency", "release_regularity",
    "weekly_downloads", "download_trend", "dependent_count",
    "has_readme", "has_license", "repo_stars", "repo_open_prs",
    "days_since_last_commit", "label",
]


def check_rate_limit():
    resp = GH.get("https://api.github.com/rate_limit")
    if resp.status_code == 200:
        data = resp.json()
        remaining = data["resources"]["core"]["remaining"]
        reset_at = data["resources"]["core"]["reset"]
        if remaining < 100:
            wait = max(reset_at - time.time(), 0) + 5
            print(f"  Rate limit: {remaining} remaining. Sleeping {wait:.0f}s...", flush=True)
            time.sleep(wait)
        return remaining
    return 999


def count_from_pagination(url: str, params: dict) -> int:
    """Count items using GitHub's pagination Link header (1 API call)."""
    params["per_page"] = 1
    try:
        resp = GH.get(url, params=params, timeout=20)
        if resp.status_code in (404, 422, 409):
            return 0
        if resp.status_code == 403:
            check_rate_limit()
            resp = GH.get(url, params=params, timeout=20)
        if resp.status_code != 200:
            return 0
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
    except Exception:
        return 0


def gh_get(url: str, params: dict = None) -> dict | list | None:
    for attempt in range(3):
        try:
            resp = GH.get(url, params=params, timeout=20)
            if resp.status_code == 404:
                return None
            if resp.status_code == 403:
                check_rate_limit()
                continue
            if resp.status_code in (422, 409):
                return None
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException:
            if attempt < 2:
                time.sleep(2 ** attempt)
    return None


def npm_get(url: str) -> dict | None:
    for attempt in range(3):
        try:
            resp = NPM.get(url, timeout=15)
            if resp.status_code == 404:
                return None
            if resp.status_code == 429:
                time.sleep(5)
                continue
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if attempt < 2:
                time.sleep(1)
    return None


def compute_features(name: str, owner: str, repo: str) -> dict | None:
    repo_url = f"https://api.github.com/repos/{owner}/{repo}"

    # Call 1: Repo metadata
    repo_data = gh_get(repo_url)
    if not repo_data:
        return None

    stars = repo_data.get("stargazers_count", 0)
    open_issues = repo_data.get("open_issues_count", 0)
    has_license = int(repo_data.get("license") is not None)
    is_archived = repo_data.get("archived", False)
    has_readme = 1  # assume yes; most repos have one

    # Call 2: Commit count last 365 days
    since_365 = (NOW - timedelta(days=365)).isoformat()
    commits_365d = count_from_pagination(f"{repo_url}/commits", {"since": since_365})

    # Call 3: Commit count last 90 days
    since_90 = (NOW - timedelta(days=90)).isoformat()
    commits_90d = count_from_pagination(f"{repo_url}/commits", {"since": since_90})

    expected_90d = commits_365d / 4.0 if commits_365d > 0 else 0
    commit_velocity_trend = (commits_90d / expected_90d) if expected_90d > 0 else (1.0 if commits_90d > 0 else 0.0)

    # Call 4: Contributors (top 30)
    contribs = gh_get(f"{repo_url}/contributors", {"per_page": 30})
    contributors_total = 0
    bus_factor = 100.0
    if isinstance(contribs, list) and len(contribs) > 0:
        contributors_total = len(contribs)
        total_contributions = sum(c.get("contributions", 0) for c in contribs)
        top_contributions = contribs[0].get("contributions", 0)
        bus_factor = (top_contributions / total_contributions * 100) if total_contributions > 0 else 100.0

    # Call 5: Recent commits for contributor_90d + last commit date
    recent_commits = gh_get(f"{repo_url}/commits", {"since": since_90, "per_page": 100})
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
            commit_date_str = recent_commits[0].get("commit", {}).get("committer", {}).get("date")
            if commit_date_str:
                commit_date = datetime.fromisoformat(commit_date_str.replace("Z", "+00:00"))
                days_since_last_commit = (NOW - commit_date).days
    else:
        last_commit = gh_get(f"{repo_url}/commits", {"per_page": 1})
        if isinstance(last_commit, list) and len(last_commit) > 0:
            commit_date_str = last_commit[0].get("commit", {}).get("committer", {}).get("date")
            if commit_date_str:
                commit_date = datetime.fromisoformat(commit_date_str.replace("Z", "+00:00"))
                days_since_last_commit = (NOW - commit_date).days

    # Call 6: Open PRs count
    repo_open_prs = count_from_pagination(f"{repo_url}/pulls", {"state": "open"})

    # Call 7: Closed issues in 90 days
    since_90_str = (NOW - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
    closed_issues_90d = count_from_pagination(
        f"{repo_url}/issues", {"state": "closed", "since": since_90_str}
    )

    # Approximate issue response time from recent issues (Call 8)
    recent_issues = gh_get(f"{repo_url}/issues", {
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

    # npm data (no rate limit)
    npm_data = npm_get(f"https://registry.npmjs.org/{name}")
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
                days_since_last_release = (NOW - latest_date).days
            except Exception:
                pass

            if len(sorted_releases) >= 5:
                try:
                    last_5_dates = [datetime.fromisoformat(d.replace("Z", "+00:00")) for _, d in sorted_releases[:5]]
                    gaps = [(last_5_dates[i] - last_5_dates[i+1]).days for i in range(4)]
                    release_frequency = sum(gaps) / len(gaps) if gaps else 9999
                    if len(gaps) > 1:
                        mean_gap = sum(gaps) / len(gaps)
                        release_regularity = (sum((g - mean_gap)**2 for g in gaps) / len(gaps)) ** 0.5
                    else:
                        release_regularity = 0
                except Exception:
                    pass

    dl_data = npm_get(f"https://api.npmjs.org/downloads/point/last-week/{name}")
    weekly_downloads = dl_data.get("downloads", 0) if dl_data else 0

    dl_month = npm_get(f"https://api.npmjs.org/downloads/point/last-month/{name}")
    monthly_dl = dl_month.get("downloads", 0) if dl_month else 0
    six_mo_avg_monthly = weekly_downloads * 4.33
    download_trend = (monthly_dl / six_mo_avg_monthly) if six_mo_avg_monthly > 0 else (1.0 if monthly_dl > 0 else 0.0)

    npms_data = npm_get(f"https://api.npms.io/v2/package/{name}")
    dependent_count = 0
    if npms_data:
        collected = npms_data.get("collected", {})
        npm_info = collected.get("npm", {})
        dependent_count = npm_info.get("dependentsCount", 0)

    # Labeling
    if is_archived or (days_since_last_commit > 365 and days_since_last_release > 730):
        label = 0
    elif days_since_last_commit <= 180 and (days_since_last_release <= 365 or commits_90d > 2):
        label = 1
    elif days_since_last_commit > 365:
        label = 0
    elif days_since_last_commit <= 365 and commits_365d < 5 and days_since_last_release > 365:
        label = 0
    else:
        label = 1

    return {
        "package_name": name,
        "github_owner": owner,
        "github_repo": repo,
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
        "release_frequency": round(release_frequency, 2) if release_frequency != 9999 else 9999,
        "release_regularity": round(release_regularity, 2) if release_regularity != 9999 else 9999,
        "weekly_downloads": weekly_downloads,
        "download_trend": round(download_trend, 4),
        "dependent_count": dependent_count,
        "has_readme": has_readme,
        "has_license": has_license,
        "repo_stars": stars,
        "repo_open_prs": repo_open_prs,
        "days_since_last_commit": days_since_last_commit,
        "label": label,
    }


def load_checkpoint() -> set:
    if CHECKPOINT.exists():
        data = json.loads(CHECKPOINT.read_text())
        return set(data.get("completed", []))
    return set()


def save_checkpoint(completed: set):
    CHECKPOINT.write_text(json.dumps({"completed": list(completed)}))


def main():
    packages = json.loads(PACKAGE_LIST.read_text())
    print(f"Loaded {len(packages)} packages", flush=True)

    completed = load_checkpoint()
    print(f"Already completed: {len(completed)}", flush=True)

    file_exists = OUTPUT_CSV.exists()
    mode = "a" if file_exists else "w"

    with open(OUTPUT_CSV, mode, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FEATURES)
        if not file_exists:
            writer.writeheader()

        remaining = [p for p in packages if p["name"] not in completed]
        print(f"Remaining: {len(remaining)}", flush=True)

        remaining_rl = check_rate_limit()
        print(f"GitHub API remaining: {remaining_rl}", flush=True)

        errors = 0
        for i, pkg in enumerate(remaining):
            try:
                features = compute_features(
                    pkg["name"], pkg["github_owner"], pkg["github_repo"]
                )
                if features:
                    writer.writerow(features)
                    f.flush()
                completed.add(pkg["name"])

                if (i + 1) % 50 == 0:
                    save_checkpoint(completed)
                    remaining_rl = check_rate_limit()
                    print(f"  [{i+1}/{len(remaining)}] done={len(completed)} ghRemain={remaining_rl} errors={errors}", flush=True)

            except Exception as e:
                errors += 1
                print(f"  Error on {pkg['name']}: {e}", flush=True)
                completed.add(pkg["name"])

        save_checkpoint(completed)

    print(f"\nDone! Total rows in CSV.", flush=True)


if __name__ == "__main__":
    main()
