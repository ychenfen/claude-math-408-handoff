import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import ledger
from ledger import LedgerError
S='操作系统'
def src(date,time='10:00'):return f'[{time}](../../问答记录/{S}/{date}.md)'
def review(date,questions,attempts=()):
    """questions: (id_cell, status); attempts: (id_cell, mode, content, result, basis[, source_date])."""
    q=''.join(f'| {i} 题意 | {st} | {src(date)} | — | — |\n' for i,st in questions)
    a=''.join(f'| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | {src(r[5] if len(r)>5 else date)} |\n' for r in attempts)
    text=f'# {date}\n\n## 题目状态\n\n| 题目 | 状态 | 来源 | 卡点／错误步骤 → 更正 | 下次验证 |\n|---|---|---|---|---|\n{q}'
    if attempts:text+=f'\n## 作答记录\n\n| 编号 | 作答方式 | 作答内容／附件 | 核对结果 | 核对依据 | 来源 |\n|---|---|---|---|---|---|\n{a}'
    return (date,text+'\n## 下次先做\n')
ANY=lambda rel:True
ANSWER='[原图](../../附件/操作系统/A-1.jpg)'
VERIFIED=('独立',ANSWER,'正确','原件已核')
def run(*docs,exists=ANY):return ledger.latest(S,list(docs),exists)
class CommittedFiles(unittest.TestCase):
    def test_all_committed_reviews_pass(self):
        for s in ledger.SUBJECTS:ledger.collect(s)
    def test_os_sample(self):
        state=ledger.latest(S)
        self.assertEqual(state['PV-22']['status'],'作答待核实')
        self.assertEqual(state['二模-27']['status'],'已讨论')
        for qid in ['PV-04','PV-05','PV-06','PV-07(2)','PV-25','PV-27','PV-08']:self.assertEqual(state[qid]['status'],'仅安排',qid)
        self.assertFalse(any(q['status'] in ('独立做对','隔日重做通过') for q in state.values()))
        self.assertIn('PV-22',ledger.next_action((ROOT/'每日复盘/操作系统/2026-10-05.md').read_text()))
    def test_review_without_table_is_reported_not_invented(self):
        days=ledger.collect('数据结构');self.assertTrue(days and all(q is None for _,q in days))
class Structure(unittest.TestCase):
    def bad(self,*docs,exists=ANY):
        with self.assertRaises(LedgerError):run(*docs,exists=exists)
    def test_unknown_status(self):self.bad(review('2026-10-07',[('`A-1`','掌握')]))
    def test_missing_source(self):
        d,t=review('2026-10-07',[('`A-1`','已讨论')]);self.bad((d,t.replace(src(d),'聊过')))
    def test_cross_subject_source(self):
        d,t=review('2026-10-07',[('`A-1`','已讨论')]);self.bad((d,t.replace(f'问答记录/{S}/','问答记录/数据结构/')))
    def test_source_after_review_date(self):self.bad(review('2026-10-07',[('`A-1`','作答待核实')],[('`A-1`','有提示','手写','错误','仅旧助手判断','2026-10-08')]))
    def test_missing_source_file(self):self.bad(review('2026-10-07',[('`A-1`','已讨论')]),exists=lambda rel:False)
    def test_duplicate_id_same_day(self):self.bad(review('2026-10-07',[('`A-1`','仅安排'),('`A-1`','仅安排')]))
    def test_grouped_ids_must_be_split(self):self.bad(review('2026-10-07',[('`PV-25` `PV-27`','仅安排')]))
    def test_ranges_rejected_not_read_as_endpoints(self):
        for cell in ['`PV-04～PV-07`','`PV-04~07`','`PV-04、05`','`PV-04,PV-05`','`PV-04/05`']:
            with self.subTest(cell):self.bad(review('2026-10-07',[(cell,'仅安排')]))
    def test_sub_question_id_allowed(self):self.assertIn('PV-07(2)',run(review('2026-10-07',[('`PV-07(2)`','仅安排')])))
    def test_attempt_for_question_not_in_table(self):self.bad(review('2026-10-07',[('`A-1`','仅安排')],[('`B-2`','有提示','手写','错误','仅旧助手判断')]))
    def test_attempt_field_enums(self):
        for row in [('`A-1`','自己做','手写','正确','原件已核'),('`A-1`','独立','手写','全对','原件已核'),('`A-1`','独立','手写','正确','看过了')]:
            with self.subTest(row):self.bad(review('2026-10-07',[('`A-1`','作答待核实')],[row]))
    def test_result_and_basis_must_agree(self):self.bad(review('2026-10-07',[('`A-1`','作答待核实')],[('`A-1`','独立','手写','正确','未核对')]))
    def test_attempt_needs_content(self):self.bad(review('2026-10-07',[('`A-1`','作答待核实')],[('`A-1`','独立','—','错误','仅旧助手判断')]))
    def test_verified_needs_linked_original(self):
        self.bad(review('2026-10-07',[('`A-1`','独立做对')],[('`A-1`','独立','手写图未入库','正确','原件已核')]))
        self.bad(review('2026-10-07',[('`A-1`','独立做对')],[('`A-1`',*VERIFIED)]),exists=lambda rel:'附件' not in rel)
class NoUpgradeWithoutEvidence(unittest.TestCase):
    """Counterexamples: each must stay below 独立做对, and claiming more must fail."""
    CASES={
        '未独立完成（有提示）':('有提示',ANSWER,'正确','原件已核'),
        '看答案后作答':('看答案后',ANSWER,'正确','原件已核'),
        '未注明是否独立，内容里写了独立二字':('未注明','自述“独立完成”的手写图未入库','正确','仅旧助手判断'),
        '独立作答但错误':('独立',ANSWER,'错误','原件已核'),
        '独立作答部分正确':('独立',ANSWER,'部分正确','原件已核'),
        '独立正确但只有旧助手判断':('独立','手写图未入库','正确','仅旧助手判断'),
        '独立作答未核对':('独立','手写图未入库','未核对','未核对'),
    }
    def test_attempt_without_full_evidence_stays_pending(self):
        for name,row in self.CASES.items():
            with self.subTest(name):
                self.assertEqual(run(review('2026-10-07',[('`A-1`','作答待核实')],[('`A-1`',*row)]))['A-1']['status'],'作答待核实')
                with self.assertRaises(LedgerError):run(review('2026-10-07',[('`A-1`','独立做对')],[('`A-1`',*row)]))
    def test_plan_only_redo_does_not_count(self):
        plan=('`A-1`','未作答','—','未核对','未核对')
        self.assertEqual(run(review('2026-10-07',[('`A-1`','已讨论')],[plan]))['A-1']['status'],'已讨论')
        self.assertEqual(run(review('2026-10-07',[('`A-1`','仅安排')],[plan]))['A-1']['status'],'仅安排')
        for claim in ['作答待核实','独立做对','隔日重做通过']:
            with self.subTest(claim),self.assertRaises(LedgerError):run(review('2026-10-07',[('`A-1`',claim)],[plan]))
        with self.assertRaises(LedgerError):run(review('2026-10-07',[('`A-1`','仅安排')],[('`A-1`','未作答','准备明天做','未核对','未核对')]))
    def test_full_evidence_upgrades_once(self):
        self.assertEqual(run(review('2026-10-07',[('`A-1`','独立做对')],[('`A-1`',*VERIFIED)]))['A-1']['status'],'独立做对')
class AcrossDates(unittest.TestCase):
    def test_history_kept_and_single_latest_status(self):
        d1=review('2026-10-05',[('`A-1`','作答待核实')],[('`A-1`','有提示','手写图未入库','部分正确','仅旧助手判断')])
        d2=review('2026-10-07',[('`A-1`','隔日重做通过')],[('`A-1`',*VERIFIED)])
        d3=review('2026-10-09',[('`A-1`','作答待核实')],[('`A-1`','独立',ANSWER,'错误','原件已核')])
        state=run(d1,d2,d3)
        self.assertEqual(len(state),1)
        self.assertEqual(state['A-1']['status'],'作答待核实')
        self.assertEqual(state['A-1']['trail'],[('2026-10-05','作答待核实'),('2026-10-07','隔日重做通过'),('2026-10-09','作答待核实')])
        self.assertEqual([a['date'] for a in state['A-1']['attempts']],['2026-10-05','2026-10-07','2026-10-09'])
        self.assertEqual(run(d1,d2)['A-1']['status'],'隔日重做通过')
    def test_failed_redo_cannot_keep_old_status(self):
        d1=review('2026-10-05',[('`A-1`','独立做对')],[('`A-1`',*VERIFIED,'2026-10-05')])
        d2=review('2026-10-07',[('`A-1`','独立做对')],[('`A-1`','独立',ANSWER,'错误','原件已核')])
        with self.assertRaises(LedgerError):run(d1,d2)
    def test_same_day_retry_is_not_next_day_redo(self):
        d=review('2026-10-07',[('`A-1`','独立做对')],[('`A-1`','有提示','手写图未入库','错误','仅旧助手判断'),('`A-1`',*VERIFIED)])
        self.assertEqual(run(d)['A-1']['status'],'独立做对')
        with self.assertRaises(LedgerError):run(review('2026-10-07',[('`A-1`','隔日重做通过')],[('`A-1`',*VERIFIED)]))
    def test_review_date_is_not_attempt_date(self):
        # A later review re-recording a same-day attempt is still that day's attempt, not a redo.
        d1=review('2026-10-05',[('`A-1`','作答待核实')],[('`A-1`','有提示','手写图未入库','错误','仅旧助手判断')])
        d2=review('2026-10-07',[('`A-1`','隔日重做通过')],[('`A-1`',*VERIFIED,'2026-10-05')])
        with self.assertRaises(LedgerError):run(d1,d2)
    def test_question_absent_later_keeps_last_known(self):
        d1=review('2026-10-05',[('`A-1`','已讨论'),('`B-2`','仅安排')])
        d2=review('2026-10-07',[('`B-2`','仅安排')])
        state=run(d1,d2);self.assertEqual(state['A-1']['status'],'已讨论');self.assertEqual(state['A-1']['trail'],[('2026-10-05','已讨论')])
    def test_no_silent_downgrade_of_discussion(self):
        with self.assertRaises(LedgerError):run(review('2026-10-05',[('`A-1`','已讨论')]),review('2026-10-07',[('`A-1`','仅安排')]))
if __name__=='__main__':unittest.main()
