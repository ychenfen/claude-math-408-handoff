"""Allowlist the published artifact. Never copy git, local drafts or caches."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'_site';OUT.mkdir(exist_ok=True)
for name in ['assets','截图','原文','问答记录','每日复盘','考试记录','串联','图解']:
    shutil.copytree(ROOT/name,OUT/name,dirs_exist_ok=True)
for p in [ROOT/'index.html',ROOT/'sw.js',ROOT/'manifest.webmanifest',ROOT/'README.md',ROOT/'ALL_TEXT.md',ROOT/'AGENTS.md',*ROOT.glob('0*.md')]:shutil.copy2(p,OUT/p.name)
(OUT/'.nojekyll').write_text('')
print('Staged public allowlist in _site')
