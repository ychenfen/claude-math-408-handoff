import json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class Demos(unittest.TestCase):
    def test_catalog_paths_exist(self):
        subjects={'高等数学','线性代数','数据结构','计算机组成原理','操作系统','计算机网络'}
        for x in json.loads((ROOT/'演示'/'目录.json').read_text()):
            self.assertIn(x['科目'],subjects)
            self.assertTrue((ROOT/'演示'/x['路径']).is_file(),x['路径'])
            self.assertTrue(x['路径'].startswith(x['科目']+'/'),x['路径'])
if __name__=='__main__':unittest.main()
