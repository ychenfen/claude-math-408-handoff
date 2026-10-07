import json,re,shutil,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BAD=re.compile(r'<script|\son\w+\s*=|<foreignObject|javascript:|(?:href|src)\s*=\s*["\']https?:',re.I)
class Diagrams(unittest.TestCase):
    def test_committed_svgs_are_static(self):
        for p in (ROOT/'图解').rglob('*.svg'):
            t=p.read_text();self.assertFalse(BAD.search(t),p);self.assertIn('<title>',t,p)
            self.assertIn(p.parent.name,['高等数学','线性代数','数据结构','计算机组成原理','操作系统','计算机网络'],p)
    def test_site_lists_diagrams_per_subject(self):
        data=json.loads((ROOT/'assets/data.json').read_text())
        listed={d['path'] for s in data['subjects'] for d in s['diagrams']}
        on_disk={p.relative_to(ROOT).as_posix() for p in (ROOT/'图解').rglob('*') if p.suffix.lower() in ('.svg','.png','.jpg','.jpeg','.webp')}
        self.assertEqual(listed,on_disk)
    @unittest.skipUnless((ROOT/'node_modules/react').is_dir() and shutil.which('node'),'run npm install to test the converter')
    def test_converter_turns_jsx_into_static_svg(self):
        src='<style>:root{--cds-text-primary:#111}</style><script type="text/babel">const D=()=> <svg viewBox="0 0 10 10" aria-label="测试图" data-claude-anchor="x"><text fill="var(--cds-text-primary)">PV</text></svg>;ReactDOM.createRoot(document.getElementById("root")).render(<D/>);</script>'
        with tempfile.TemporaryDirectory() as d:
            inp=Path(d)/'in.html';out=Path(d)/'out.svg';inp.write_text(src)
            subprocess.run(['node',str(ROOT/'scripts/render_diagram.mjs'),str(inp),str(out)],check=True,capture_output=True)
            svg=out.read_text()
        self.assertIn('<title>测试图</title>',svg);self.assertIn('--cds-text-primary:#111',svg);self.assertNotIn('data-claude',svg);self.assertFalse(BAD.search(svg))
    @unittest.skipUnless((ROOT/'node_modules/react').is_dir() and shutil.which('node'),'run npm install to test the converter')
    def test_converter_refuses_scripts_in_output(self):
        with tempfile.TemporaryDirectory() as d:
            inp=Path(d)/'in.html';inp.write_text('<svg><script>alert(1)</script></svg>')
            r=subprocess.run(['node',str(ROOT/'scripts/render_diagram.mjs'),str(inp),str(Path(d)/'o.svg')],capture_output=True)
            self.assertNotEqual(r.returncode,0)
if __name__=='__main__':unittest.main()
