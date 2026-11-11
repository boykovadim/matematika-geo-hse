#!/usr/bin/env python3
"""Публикация сайта на GitHub Pages без git: через GitHub API.

Нужен вход в gh (gh auth login). Запуск:
    python3 tools/deploy.py ВЛАДЕЛЕЦ/РЕПОЗИТОРИЙ "сообщение коммита"

Загружает все файлы сайта (кроме того, что в .gitignore) одним коммитом в ветку main.
"""
import http.client, base64, fnmatch, json, pathlib, re, subprocess, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = sys.argv[1]
MESSAGE = sys.argv[2] if len(sys.argv) > 2 else "Обновление сайта"
TOKEN = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()
API = f"https://api.github.com/repos/{REPO}"


def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json",
                                          "User-Agent": "naglyadno-deploy"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code in (404, 409):
                return None
            if e.code >= 500 or e.code == 429:
                time.sleep(3 * (attempt + 1)); continue
            raise SystemExit(f"{method} {url}: {e.code} {e.read().decode()[:300]}")
        except (OSError, http.client.HTTPException) as e:
            print("  сеть, повтор:", e)
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"{method} {url}: GitHub не отвечает")


def ignored(rel):
    rules = [l.strip() for l in (ROOT / ".gitignore").read_text().splitlines() if l.strip() and not l.startswith("#")]
    parts = rel.split("/")
    for r in rules:
        r = r.rstrip("/")
        if any(fnmatch.fnmatch(p, r) for p in parts) or fnmatch.fnmatch(rel, r):
            return True
    return False


# новая версия файлов: браузеры не возьмут старое из кэша, открытые вкладки тихо обновятся
BUILD = time.strftime("%Y%m%d%H%M%S")
index = ROOT / "index.html"
html = index.read_text(encoding="utf8")
html = re.sub(r'\?v=\w+"', f'?v={BUILD}"', html)
html = re.sub(r'<meta name="build" content="\w+">', f'<meta name="build" content="{BUILD}">', html)
index.write_text(html, encoding="utf8")
print("Версия:", BUILD)

files = sorted(p for p in ROOT.rglob("*") if p.is_file() and not ignored(p.relative_to(ROOT).as_posix()))
files.append(ROOT / ".gitignore")
print("Файлов:", len(files))

head = call("GET", f"{API}/git/ref/heads/main")
parent = head["object"]["sha"] if head else None
tree = []
for n, f in enumerate(files, 1):
    blob = call("POST", f"{API}/git/blobs", {"content": base64.b64encode(f.read_bytes()).decode(), "encoding": "base64"})
    tree.append({"path": f.relative_to(ROOT).as_posix(), "mode": "100644", "type": "blob", "sha": blob["sha"]})
    if n % 25 == 0:
        print(f"  {n}/{len(files)}")
t = call("POST", f"{API}/git/trees", {"tree": tree})
commit = call("POST", f"{API}/git/commits", {"message": MESSAGE, "tree": t["sha"], "parents": [parent] if parent else []})
if parent:
    call("PATCH", f"{API}/git/refs/heads/main", {"sha": commit["sha"], "force": True})
else:
    call("POST", f"{API}/git/refs", {"ref": "refs/heads/main", "sha": commit["sha"]})
print("Коммит:", commit["sha"][:7])
