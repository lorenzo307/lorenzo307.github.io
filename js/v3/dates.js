/* Calendar dates are civil dates, never converted through local time zones. */
(function (global) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const validators = new WeakMap();
  function days(y, m) { return [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31][m - 1]; }
  function parse(raw) {
    let s = String(raw || '').trim().replace(/\s+/g, '');
    if (!s) return null;
    if (/^(不详|未知)$/.test(s)) return { value: '不详', precision: 'unknown', start: null, end: null, original: raw };
    const approximate = /^(约|約|~)/.test(s); s = s.replace(/^(约|約|~)/, '');
    const range = s.split(/至|—|–|~/);
    if (range.length === 2) {
      const a = parse(range[0]), b = parse(range[1]);
      if (!a?.start || !b?.end || a.start > b.end) return null;
      return { value: (approximate ? '约' : '') + `${a.value}至${b.value}`, precision: 'range', start: a.start, end: b.end, original: raw, approximate };
    }
    if (/^\d{8}$/.test(s)) s = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`;
    s = s.replace(/年|月|\//g, '-').replace(/日$/, '').replace(/-$/, '');
    const m = s.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
    if (!m) return null;
    const y = +m[1], mo = m[2] ? +m[2] : null, d = m[3] ? +m[3] : null;
    if (y < 1 || (mo !== null && (mo < 1 || mo > 12)) || (d !== null && (d < 1 || d > days(y, mo)))) return null;
    const value = m[1] + (mo === null ? '' : '-' + pad(mo)) + (d === null ? '' : '-' + pad(d));
    return { value: (approximate ? '约' : '') + value, precision: d !== null ? 'day' : mo !== null ? 'month' : 'year', approximate, original: raw,
      start: `${m[1]}-${pad(mo || 1)}-${pad(d || 1)}`, end: `${m[1]}-${pad(mo || 12)}-${pad(d || days(y, mo || 12))}` };
  }
  function overlaps(value, start, end) {
    const d = parse(value), a = parse(start), b = parse(end);
    if (!start && !end) return true;
    return !!(d?.start && (!a || d.end >= a.start) && (!b || d.start <= b.end));
  }
  function enhance(input) {
    if (input.dataset.civilDate) return;
    input.dataset.civilDate = '1'; input.type = 'text';
    const historical = input.name === 'date' || input.id === 'v2-event-date';
    input.autocomplete = 'off'; input.placeholder = historical ? '1937-07-07，也可填写年份或不详' : '年-月-日，如 1937-07-07';
    input.setAttribute('aria-label', input.getAttribute('aria-label') || (historical ? '史料日期，支持年月日、年份、区间或不详' : '日期，年-月-日'));
    const wrap = document.createElement('div'); wrap.className = 'ed-date'; input.before(wrap); wrap.append(input);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'ed-calendar-button'; button.textContent = '日历'; button.setAttribute('aria-label', '打开日历，支持直接输入年份'); wrap.append(button);
    const help = document.createElement('small'); help.className = 'ed-date-help'; help.id = 'date-help-' + (input.id || input.name || Math.random().toString(36).slice(2));
    help.textContent = historical ? '支持 1937、1937-07、约1937、1937至1939、不详' : '可直接输入或粘贴年月日';
    input.setAttribute('aria-describedby', help.id); wrap.after(help);
    function validate(normalize) {
      const raw = input.value.trim(), result = parse(raw);
      const valid = !raw || !!result && (historical || (input.id==='startDate'||input.id==='endDate' ? ['day','month','year'] : ['day']).includes(result.precision) && !result.approximate);
      input.setCustomValidity(valid ? '' : '请输入有效日期，例如 1937-07-07；请检查月份和天数');
      input.setAttribute('aria-invalid', String(!valid));
      help.classList.toggle('is-error', !valid);
      if (!valid) help.textContent = '日期无效，请检查年份、月份和实际天数';
      else help.textContent = historical ? '支持 1937、1937-07、约1937、1937至1939、不详' : '可直接输入或粘贴年月日';
      if (normalize && result && valid) input.value = result.value;
      return valid;
    }
    input.addEventListener('input', () => validate(false));
    validators.set(input,validate);
    input.addEventListener('change', () => validate(true), true);
    input.form?.addEventListener('reset',()=>setTimeout(()=>validate(false),0));
    button.addEventListener('click', () => {
      const dialog = document.createElement('dialog'); dialog.className = 'ed-dialog ed-calendar';
      dialog.innerHTML = '<form method="dialog"><header><h2>选择日期</h2><button value="cancel" aria-label="关闭日历">×</button></header></form><div class="ed-calendar-heading"><label>年份<input class="calendar-year" type="number" min="1" max="9999" aria-label="年份"></label><label>月份<select class="calendar-month" aria-label="月份"></select></label></div><div class="ed-calendar-days"></div><p>也可以关闭日历，直接在日期框中输入。</p>';
      document.body.append(dialog);
      const year = dialog.querySelector('.calendar-year'), month = dialog.querySelector('.calendar-month'), grid = dialog.querySelector('.ed-calendar-days');
      for (let i = 1; i <= 12; i++) month.add(new Option(i + '月', i));
      const initial = parse(input.value)?.start || new Date().toLocaleDateString('sv-SE'); year.value = +initial.slice(0,4); month.value = +initial.slice(5,7);
      function draw() {
        const y = +year.value, m = +month.value; grid.replaceChildren();
        if (!Number.isInteger(y) || y < 1 || y > 9999) return;
        '一二三四五六日'.split('').forEach(t => { const e = document.createElement('span'); e.textContent = t; grid.append(e); });
        const date = new Date(0); date.setUTCFullYear(y,m-1,1); date.setUTCHours(0,0,0,0);
        for (let i=0; i<(date.getUTCDay()+6)%7; i++) grid.append(document.createElement('span'));
        for (let d=1; d<=days(y,m); d++) { const b = document.createElement('button'); b.type = 'button'; b.textContent = d; b.setAttribute('aria-label', `${y}年${m}月${d}日`); b.onclick = () => { input.value = `${String(y).padStart(4,'0')}-${pad(m)}-${pad(d)}`; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); dialog.close(); }; grid.append(b); }
      }
      year.addEventListener('input',draw); month.addEventListener('change',draw); draw();
      dialog.addEventListener('close', () => { dialog.remove(); button.focus(); }); dialog.showModal(); year.focus();
    });
  }
  function init(root = document) { root.querySelectorAll('input[type="date"]').forEach(enhance); }
  function validateAll(root = document) { root.querySelectorAll('[data-civil-date]').forEach(input=>validators.get(input)?.(false)); }
  global.ResearchDates = { parse, days, overlaps, init, validateAll };
  if (typeof module !== 'undefined') module.exports = global.ResearchDates;
  if (typeof document !== 'undefined') { document.addEventListener('DOMContentLoaded', () => { init(); new MutationObserver(records => { if(records.some(r=>r.addedNodes.length)) init(); }).observe(document.body,{childList:true,subtree:true}); }); }
})(typeof window !== 'undefined' ? window : globalThis);
