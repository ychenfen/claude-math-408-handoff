/* Bedtime review: one short, dark, thumb-friendly session across all subjects.
   Uses the same browser-local spaced schedule as each subject's 闭卷自测 (StudySpacing + study-drill-v1 keys),
   so a card rated here is not asked again there. Never grades answers or changes evidence status. */
(() => {
  'use strict';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const SIZES = [10, 15, 25];
  const ALGO_MIN = 2;
  // Algorithm cards: tagged 「算法｜」, or data-structure cards about code, loops, traversal or complexity.
  const isAlgo = c => /^算法｜/.test(c.question) || (c.subject.id === 'ds' && /```|复杂度|循环|遍历|递归|指针|O\(|模板/.test(c.question + c.context + c.answer));
  function interleave(groups) {
    const out = [], lists = groups.map(g => [...g]);
    while (lists.some(l => l.length)) for (const l of lists) if (l.length) out.push(l.shift());
    return out;
  }
  function mount({subjects, renderMarkdown, get, put, today, nextOf, onExit}) {
    const keyOf = c => `study-drill-v1:${c.subject.id}:${c.id}`;
    const read = c => { try { const v = JSON.parse(get(keyOf(c)) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
    const save = (c, patch) => put(keyOf(c), JSON.stringify({...read(c), ...patch}));
    const all = subjects.flatMap(s => StudyReview.cardsOf([...s.summaries, ...(s.examCards || [])]).map(c => ({...c, subject: s})));
    let size = 15; try { size = Number(get('bed-v1:size')) || 15; } catch {}
    const root = el('div', 'bed'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '睡前复习');
    root.setAttribute('aria-modal', 'true');
    const behind = [...document.body.children]; behind.forEach(n => n.inert = true);
    document.body.append(root); document.body.classList.add('bed-open');
    const close = () => { behind.forEach(n => n.inert = false); root.remove(); document.body.classList.remove('bed-open'); document.removeEventListener('keydown', keys); onExit(); };
    let queue = [], i = 0, revealed = false, tally = {不会: 0, 模糊: 0, 会了: 0};
    const relearned = new Set();

    // Due cards first (oldest due first), then what you learned most recently; subjects are interleaved.
    function build() {
      const now = Date.now(), has = c => Number.isFinite(read(c).due) && read(c).due > 0;
      const due = all.filter(c => has(c) && read(c).due <= now).sort((a, b) => read(a).due - read(b).due);
      const fresh = all.filter(c => !has(c)).sort((a, b) => b.date.localeCompare(a.date));
      const bySubject = list => subjects.map(s => list.filter(c => c.subject.id === s.id));
      let q = [...interleave(bySubject(due)), ...interleave(bySubject(fresh))].slice(0, size);
      // Every night keeps a little code: at least ALGO_MIN algorithm cards, even if none is due (early practice keeps its schedule).
      const have = q.filter(isAlgo).length;
      if (have < ALGO_MIN) {
        const extra = all.filter(c => isAlgo(c) && !q.includes(c)).sort((a, b) => (read(a).due || 0) - (read(b).due || 0)).slice(0, ALGO_MIN - have);
        const keep = q.filter(c => !isAlgo(c)).slice(0, Math.max(0, size - have - extra.length));
        const algos = [...q.filter(isAlgo), ...extra];
        q = [...keep]; algos.forEach((c, k) => q.splice(Math.min(q.length, 2 + k * 4), 0, c));
      }
      return q;
    }
    function frame(children, footer) {
      root.replaceChildren();
      const top = el('div', 'bed-top');
      const bar = el('div', 'bed-progress'); const fill = el('i'); fill.style.width = queue.length ? `${Math.min(100, i / queue.length * 100)}%` : '0'; bar.append(fill);
      const x = el('button', 'bed-x', '×'); x.type = 'button'; x.setAttribute('aria-label', '退出睡前复习'); x.onclick = close;
      top.append(bar, x);
      const body = el('div', 'bed-body'); body.append(...children);
      const foot = el('div', 'bed-foot'); foot.append(...footer);
      root.append(top, body, foot); body.scrollTop = 0;
    }
    function start() {
      queue = build(); i = 0; tally = {不会: 0, 模糊: 0, 会了: 0}; relearned.clear();
      const counts = subjects.map(s => [s.name, queue.filter(c => c.subject.id === s.id).length]).filter(([, n]) => n);
      const intro = [el('p', 'bed-eyebrow', '睡前复习 · 全科混合'), el('h1', '', queue.length ? `今晚 ${queue.length} 张，约 ${Math.max(3, Math.round(queue.length * 0.6))} 分钟` : '今晚没有要复习的卡')];
      if (queue.length) intro.push(el('p', 'bed-note', counts.map(([n, k]) => `${n} ${k}`).join(' · ') + (queue.some(isAlgo) ? ` · 其中算法 ${queue.filter(isAlgo).length}` : '')));
      intro.push(el('p', 'bed-note', '只在脑子里回想，不用写字。先想，再翻开；想不起来就点「不会」，它会在本轮稍后再出现一次。自评只安排复习时间，不改变题目状态。'));
      const pick = el('div', 'bed-sizes');
      SIZES.forEach(n => { const b = el('button', n === size ? 'on' : '', `${n} 张`); b.type = 'button'; b.onclick = () => { size = n; try { put('bed-v1:size', String(n)); } catch {} start(); }; pick.append(b); });
      intro.push(pick);
      const go = el('button', 'bed-main', queue.length ? '开始' : '关闭'); go.type = 'button';
      go.onclick = () => queue.length ? show() : close();
      frame(intro, [go]); go.focus();
    }
    function show() {
      if (i >= queue.length) return finish();
      revealed = false;
      const c = queue[i];
      const meta = el('p', 'bed-eyebrow', `${i + 1} / ${queue.length} · ${c.subject.name}${isAlgo(c) ? ' · 算法' : ''}${relearned.has(c.id) && c.again ? ' · 再来一次' : ''}`);
      const q = el('div', 'bed-q'); q.append(renderMarkdown('### ' + c.question, c.path));
      const parts = [meta, q];
      if (c.context) { const ctx = el('div', 'bed-ctx'); ctx.append(renderMarkdown(c.context, c.path)); parts.push(ctx); }
      const flip = el('button', 'bed-main', '想好了，翻开'); flip.type = 'button'; flip.onclick = reveal;
      frame(parts, [flip]); flip.focus();
    }
    function reveal() {
      if (revealed || i >= queue.length) return; revealed = true;
      const c = queue[i], body = root.querySelector('.bed-body');
      const ans = el('div', 'bed-ans'); ans.append(renderMarkdown(c.answer, c.path)); body.append(ans);
      ans.scrollIntoView({block: 'start', behavior: 'smooth'});
      const foot = root.querySelector('.bed-foot'); foot.replaceChildren();
      ['不会', '模糊', '会了'].forEach((r, k) => {
        const b = el('button', `bed-rate r${k}`, r); b.type = 'button';
        const p = StudySpacing.schedule(read(c), r);
        b.append(el('small', '', r === '不会' ? '本轮再来' : p.early ? '保留原时间' : r === '模糊' ? '明天' : `${Math.round((p.due - Date.now()) / 864e5)} 天后`));
        b.onclick = () => rate(r); foot.append(b);
      });
    }
    function rate(r) {
      if (!revealed) return;
      const c = queue[i];
      save(c, StudySpacing.schedule(read(c), r)); tally[r]++;
      // A forgotten card comes back once, three cards later, so it is relearned before sleep.
      if (r === '不会' && !relearned.has(c.id)) { relearned.add(c.id); queue.splice(Math.min(queue.length, i + 4), 0, {...c, again: true}); }
      i++; show();
    }
    function finish() {
      const endOfTomorrow = new Date(new Date(today + 'T00:00:00+08:00').getTime() + 2 * 864e5).getTime();
      const dueTomorrow = all.filter(c => { const d = read(c).due; return Number.isFinite(d) && d > Date.now() && d < endOfTomorrow; }).length;
      const parts = [el('p', 'bed-eyebrow', '今晚完成'), el('h1', '', `会了 ${tally['会了']} · 模糊 ${tally['模糊']} · 不会 ${tally['不会']}`),
        el('p', 'bed-note', dueTomorrow ? `明天到期 ${dueTomorrow} 张，打开总览就能看到。` : '明天没有到期卡。')];
      const plans = subjects.map(s => [s.name, nextOf(s)]).filter(([, t]) => t);
      if (plans.length) {
        parts.push(el('h2', '', '明天先做'));
        const ul = el('ul', 'bed-plan'); plans.forEach(([n, t]) => { const li = el('li'); li.append(el('b', '', n + '　'), document.createTextNode(t)); ul.append(li); }); parts.push(ul);
      }
      parts.push(el('p', 'bed-note', '晚安。睡前回想过的东西，睡一觉更容易记住。'));
      const done = el('button', 'bed-main', '完成'); done.type = 'button'; done.onclick = close;
      frame(parts, [done]); done.focus();
    }
    function keys(e) {
      if (e.key === 'Escape') return close();
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (e.key === ' ' && !revealed && i < queue.length && root.querySelector('.bed-q')) { e.preventDefault(); reveal(); }
      if (revealed && ['1', '2', '3'].includes(e.key)) rate(['不会', '模糊', '会了'][Number(e.key) - 1]);
    }
    document.addEventListener('keydown', keys);
    start();
    return close;
  }
  window.StudyBedtime = {mount};
})();
