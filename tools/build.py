#!/usr/bin/env python3
"""Сборка озвучки и PDF для всех лекций.

Нужно: запущенный сервер на http://localhost:8765, Google Chrome и пакет edge-tts.
    python3 -m venv /tmp/nagl && /tmp/nagl/bin/pip install edge-tts pypdf
    /tmp/nagl/bin/python tools/build.py

Каждая реплика лежит в audio/<лекция>/<голос>/<хеш текста>.mp3.
Если текст реплики не менялся, файл не пересоздаётся.
"""
import asyncio, hashlib, html, json, pathlib, re, subprocess, sys

import edge_tts
from pypdf import PdfReader, PdfWriter, Transformation

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "http://localhost:8765/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
VOICES = {"svetlana": "ru-RU-SvetlanaNeural", "dmitry": "ru-RU-DmitryNeural"}


def chrome(*args):
    return subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", *args],
                          capture_output=True, text=True, timeout=120)


def export():
    dom = chrome("--virtual-time-budget=6000", "--dump-dom", URL + "#/export").stdout
    m = re.search(r'<pre id="export">(.*?)</pre>', dom, re.S)
    if not m:
        sys.exit("Страница экспорта не ответила. Сервер запущен?")
    return json.loads(html.unescape(m.group(1)))


async def speak(text, voice, path):
    """True, если файл получен. Сервис иногда отказывает одному голосу: тогда этот голос пропускаем."""
    for attempt in range(5):
        try:
            await edge_tts.Communicate(text, voice).save(str(path))
            if path.stat().st_size > 1000:
                return True
        except Exception as e:
            print("  повтор:", e)
        await asyncio.sleep(3 * (attempt + 1))
    path.unlink(missing_ok=True)
    print(f"  голос {voice} не отвечает на: {text[:50]}")
    return False


async def audio(lectures):
    manifest = {}
    for lec in lectures:
        entry = {"voices": [], "lines": {}, "pdf": {}}
        for name, voice in VOICES.items():
            ok = True
            folder = ROOT / "audio" / lec["id"] / name
            folder.mkdir(parents=True, exist_ok=True)
            keep = set()
            for line in lec["lines"]:
                h = hashlib.sha1(line["say"].encode()).hexdigest()[:10]
                entry["lines"][line["key"]] = h
                path = folder / f"{h}.mp3"
                keep.add(path.name)
                if not path.exists():
                    print(f"  {name} {line['key']}")
                    if not await speak(line["say"], voice, path):
                        ok = False
                        break
            if not ok:
                print(f"  голос {name} пропущен, остальные файлы сохранены до следующей сборки")
                continue
            entry["voices"].append(name)
            for old in folder.glob("*.mp3"):
                if old.name not in keep:
                    old.unlink()
        manifest[lec["id"]] = entry
    return manifest


def pdfs(lectures, manifest):
    out = ROOT / "pdf"
    out.mkdir(exist_ok=True)
    foot_file = out / "_foot.pdf"
    chrome("--no-pdf-header-footer", "--virtual-time-budget=6000", f"--print-to-pdf={foot_file}", URL + "#/pdf-foot")
    for lec in lectures:
        for kind, route, name in (("notes", "notes", "konspekt"), ("sheet", "sheet", "shpora")):
            target = out / f"{lec['id']}-{name}.pdf"
            chrome("--no-pdf-header-footer", "--virtual-time-budget=9000",
                   f"--print-to-pdf={target}", URL + f"#/lecture/{lec['id']}/{route}")
            stamp(target, foot_file)
            print(" ", target.name, len(PdfReader(target).pages), "стр.", target.stat().st_size // 1024, "КБ")
            manifest[lec["id"]]["pdf"][kind] = f"pdf/{target.name}"
    foot_file.unlink()


def stamp(target, foot_file):
    """Подпись создателя внизу каждого листа."""
    foot = PdfReader(foot_file).pages[0]
    writer = PdfWriter(clone_from=target)
    for page in writer.pages:
        page.merge_transformed_page(foot, Transformation().translate(0, -24))
    writer.write(target)


def write(manifest):
    (ROOT / "audio").mkdir(exist_ok=True)
    (ROOT / "audio" / "manifest.js").write_text(
        "window.AudioManifest = " + json.dumps(manifest, ensure_ascii=False, indent=1) + ";\n", encoding="utf8")


lectures = export()
print("Лекций:", len(lectures))
if "--no-audio" in sys.argv:
    # озвучку не трогаем: оставляем то, что уже есть в манифесте (или пусто)
    m = {lec["id"]: {"voices": [], "lines": {}, "pdf": {}} for lec in lectures}
else:
    m = asyncio.run(audio(lectures))
pdfs(lectures, m)
write(m)
print("Готово")
