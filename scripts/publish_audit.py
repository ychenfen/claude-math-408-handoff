"""Audit the public-only surface. Never traverse private recovery archives."""
import argparse,hashlib,json,re,subprocess,tempfile,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--gitleaks',required=True);a=ap.parse_args()
files=sorted(p for p in ROOT.rglob('*') if p.is_file() and not {'.git','_local','_site','__pycache__','node_modules'}.intersection(p.parts) and p.name!='SHA256SUMS')
assert len(list((ROOT/'原文').glob('*.md')))>=30
assert len(list((ROOT/'截图').iterdir()))>=12
for p in files:
    assert not p.is_symlink()
    assert p.stat().st_size<45*1024*1024
    if p.suffix in {'.md','.json','.tsv'}:
        t=p.read_text()
        assert '/Users/' not in t,p
        assert not re.search(r'https://claude\.ai/(?:chat|code)/',t),p
for p in ROOT.glob('*.md'):
    if p.name=='ALL_TEXT.md':continue
    for v in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        if v.startswith('http'):continue
        assert (p.parent/v).exists(),(p,v)
for p in (ROOT/'原文').glob('*.md'):
    for v in re.findall(r'!\[[^]]*\]\((\.\./截图/[^)]+)\)',p.read_text()):assert (p.parent/v).is_file()
with tempfile.TemporaryDirectory(prefix='study-public-audit-') as temp:
    report=Path(temp)/'scan.json';surface=Path(temp)/'surface'
    for p in files:
        target=surface/p.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
    run=subprocess.run([a.gitleaks,'dir',str(surface),'--redact=100','--no-banner','--log-level','error','--report-format','json','--report-path',str(report)],capture_output=True)
    findings=json.loads(report.read_text()) if report.exists() else []
    assert not findings and run.returncode==0,f'Credential scan blocked: {len(findings)} findings; '+str([(str(Path(f["File"]).relative_to(surface)),f["StartLine"],f["RuleID"]) for f in findings])
(ROOT/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT)}\n' for p in files))
print(json.dumps({'public_files':len(files),'topics':30,'images':12,'credential_findings':0,'local_links':'PASS'},ensure_ascii=False))
