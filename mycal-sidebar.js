(() => {
  'use strict';
  if (window.__mycalSidebarLoaded) return;
  window.__mycalSidebarLoaded = true;
  const API = '/api/v1/courses?enrollment_state=active&per_page=100';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const minutes = (metadata) => {
    if (Number.isFinite(Number(metadata?.estimatedMinutes)) && metadata?.estimatedMinutes !== undefined && metadata?.estimatedMinutes !== null) return Math.max(0, Number(metadata.estimatedMinutes));
    const raw = String(metadata?.estimatedTime ?? '').trim().toLowerCase();
    const match = raw.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)$/);
    return match ? Math.round(Number(match[1]) * (match[2].startsWith('h') ? 60 : 1)) : null;
  };
  const fmt = n => `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}`;
  const sidebar = () => document.querySelector('#right-side') || document.querySelector('.right-side');
  const storage = async () => chrome.storage.local.get(null);
  async function fetchAssignments() {
    const res = await fetch(API, {credentials:'include'});
    if (!res.ok) throw new Error('Canvas courses unavailable');
    const courses = await res.json();
    const results = await Promise.allSettled(courses.map(async course => {
      const r = await fetch(`/api/v1/courses/${encodeURIComponent(course.id)}/assignments?per_page=100`, {credentials:'include'});
      if (!r.ok) return [];
      const data = await r.json();
      return data.map(a => ({...a, mycalCourseName:course.name}));
    }));
    return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  }
  function nativeCalendars(root) {
    // Canvas's original controls stay functional. Only decorate the surrounding list if identifiable.
    const heading = [...root.querySelectorAll('h2,h3,h4')].find(el => /^calendars$/i.test(el.textContent.trim()));
    if (heading && heading.parentElement && !heading.parentElement.classList.contains('mycal-native-calendars')) {
      const section = heading.closest('section') || heading.parentElement;
      if (section !== root && !section.contains(document.querySelector('#mycal-sidebar-panel'))) section.classList.add('mycal-native-calendars');
    }
  }
  function render(items, root) {
    let panel = document.getElementById('mycal-sidebar-panel');
    if (!panel) {
      panel = document.createElement('section');panel.id='mycal-sidebar-panel';
      panel.setAttribute('aria-label','MyCal planning summary');
      root.insertBefore(panel, root.firstChild);
    }
    const now = Date.now(), end = now + 7*86400000;
    const upcoming = items.filter(a => a.due_at && new Date(a.due_at).getTime() >= now && new Date(a.due_at).getTime() < end).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
    const estimated = upcoming.filter(a => a.mycalMinutes !== null);
    const total = estimated.reduce((sum,a)=>sum+a.mycalMinutes,0);
    const high = upcoming.filter(a => String(a.mycalMetadata?.priority ?? '').toLowerCase()==='high');
    const focus = high[0] || upcoming[0];
    panel.innerHTML = `<div class="mycal-brand"><span class="mycal-logo">▦</span><span><span class="mycal-brand-name">MyCal</span><div class="mycal-muted">YOUR PLANNING STUDIO</div></span></div>
      <div class="mycal-card mycal-workload"><div class="mycal-heading">Upcoming workload <span>◷</span></div><div class="mycal-number">${estimated.length ? fmt(total) : '—'}</div><div class="mycal-muted">Estimated effort · next 7 days${!estimated.length ? '<br>No time estimates saved yet' : ''}</div><div class="mycal-row"><span>${upcoming.length} upcoming assignment${upcoming.length===1?'':'s'}</span><span>${high.length} high priority</span></div>${upcoming.length>estimated.length ? `<div class="mycal-muted" style="margin-top:8px">${upcoming.length-estimated.length} without estimates</div>`:''}</div>
      <div class="mycal-card"><div class="mycal-heading">◎ Focus next</div>${focus ? `<div class="mycal-focus-title">${esc(focus.name)}</div><div class="mycal-muted">${esc(focus.mycalCourseName)} · ${esc(new Date(focus.due_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</div><div class="mycal-row"><span class="${String(focus.mycalMetadata?.priority??'').toLowerCase()==='high'?'mycal-priority':'mycal-muted'}">${esc(focus.mycalMetadata?.priority ? focus.mycalMetadata.priority.toUpperCase()+' priority' : 'Priority not set')}</span><span class="mycal-muted">${focus.mycalMinutes===null?'Not estimated':fmt(focus.mycalMinutes)}</span></div>${focus.html_url ? `<button type="button" class="mycal-action" id="mycal-open-focus">Open Canvas assignment ↗</button>`:''}` : '<div class="mycal-empty">No assignments due in the next 7 days. Your calendar is clear!</div>'}</div>
      <div class="mycal-card"><div class="mycal-heading">▤ Plan your week <span class="mycal-pill">${upcoming.length} due</span></div><div class="mycal-muted">Review deadlines and estimates before planning study time.</div><button type="button" class="mycal-action" id="mycal-toggle-workload" aria-expanded="false">View upcoming assignments ↓</button><ul class="mycal-list" id="mycal-upcoming-list">${upcoming.length ? upcoming.map(a=>`<li><strong>${esc(a.name)}</strong><br><span class="mycal-muted">${esc(new Date(a.due_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}))} · ${a.mycalMinutes===null?'Not estimated':fmt(a.mycalMinutes)}</span></li>`).join('') : '<li>No upcoming assignments</li>'}</ul></div>`;
    panel.querySelector('#mycal-open-focus')?.addEventListener('click',()=>{if(focus?.html_url) window.open(focus.html_url,'_blank','noopener,noreferrer');});
    panel.querySelector('#mycal-toggle-workload')?.addEventListener('click',e=>{const list=panel.querySelector('#mycal-upcoming-list');const opened=list.classList.toggle('is-open');e.currentTarget.setAttribute('aria-expanded',String(opened));e.currentTarget.textContent=opened?'Hide upcoming assignments ↑':'View upcoming assignments ↓';});
    nativeCalendars(root);
  }
  async function refresh() {
    const root=sidebar();if(!root)return;
    try {
      const [assignments,saved]=await Promise.all([fetchAssignments(),storage()]);
      render(assignments.map(a=>{const m=saved[`powerTool_${a.course_id}_${a.id}`]||null;return {...a,mycalMetadata:m,mycalMinutes:minutes(m)};}),root);
    } catch(e) {console.warn('MyCal sidebar summary:',e);}
  }
  let attempts=0;
  const boot=setInterval(()=>{if(sidebar()){clearInterval(boot);refresh();}else if(++attempts>=20)clearInterval(boot);},500);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && Object.keys(changes).some(k=>k.startsWith('powerTool_'))) refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();


// Mini-calendar and calendar visibility controls
(() => {
  'use strict';
  if (window.__mycalCalendarControlsLoaded) return;
  window.__mycalCalendarControlsLoaded = true;

  function setup() {
    const root = document.querySelector('#right-side');
    if (!root) return false;
    // Canvas's mini-calendar typically uses #minical. Never delete it: its native navigation stays intact.
    const mini = root.querySelector('#minical, .mini_calendar, .mini-calendar');
    if (mini && !mini.dataset.mycalManaged) {
      mini.dataset.mycalManaged = 'true';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'mycal-mini-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '▸ Show mini calendar';
      mini.before(toggle);
      mini.classList.add('mycal-mini-collapsed');
      toggle.addEventListener('click', () => {
        const opened = mini.classList.toggle('mycal-mini-collapsed') === false;
        toggle.setAttribute('aria-expanded', String(opened));
        toggle.textContent = opened ? '▾ Hide mini calendar' : '▸ Show mini calendar';
      });
    }

    // Work with Canvas's own checkboxes. Moving their existing DOM nodes preserves their event listeners.
    const heading = [...root.querySelectorAll('h2,h3,h4')].find(el => /^calendars$/i.test(el.textContent.trim()));
    const section = heading?.closest('.mycal-native-calendars, section, .calendar-list') || heading?.parentElement;
    if (!section || section === root) return !!mini;
    const candidates = [...section.querySelectorAll('li')].filter(li => {
      return li.querySelector('input[type="checkbox"], [role="checkbox"], .context_list_toggle, .calendar-color, .calendar_color');
    });
    if (!candidates.length) return !!mini;
    // Avoid grabbing nested list items or unrelated widgets.
    const items = candidates.filter(li => !candidates.some(other => other !== li && other.contains(li)));
    if (!items.length) return !!mini;
    const list = items[0].parentElement;
    if (!list || !items.every(li => li.parentElement === list)) return !!mini;
    if (list.dataset.mycalOrganized) return true;
    list.dataset.mycalOrganized = 'true';
    const hiddenWrap = document.createElement('div');
    hiddenWrap.className = 'mycal-hidden-calendars';
    const hiddenButton = document.createElement('button');
    hiddenButton.type = 'button';
    hiddenButton.className = 'mycal-hidden-toggle';
    hiddenButton.setAttribute('aria-expanded', 'false');
    const hiddenList = document.createElement(list.tagName.toLowerCase());
    hiddenList.className = `${list.className} mycal-hidden-list`;
    hiddenWrap.append(hiddenButton, hiddenList);
    list.after(hiddenWrap);
    hiddenButton.addEventListener('click', () => {
      const open = hiddenWrap.classList.toggle('is-open');
      hiddenButton.setAttribute('aria-expanded', String(open));
      update();
    });
    function isSelected(li) {
      const check = li.querySelector('input[type="checkbox"], [role="checkbox"]');
      if (check) return check.matches('input') ? check.checked : check.getAttribute('aria-checked') === 'true';
      // Canvas calendar list commonly uses .active on selected context items.
      if (li.classList.contains('active') || li.classList.contains('selected')) return true;
      if (li.classList.contains('inactive') || li.classList.contains('disabled')) return false;
      const color = li.querySelector('.calendar-color, .calendar_color');
      return color ? !color.classList.contains('inactive') && !color.classList.contains('disabled') : true;
    }
    function update() {
      for (const li of items) (isSelected(li) ? list : hiddenList).appendChild(li);
      const count = hiddenList.children.length;
      hiddenButton.textContent = `${hiddenWrap.classList.contains('is-open') ? '▾' : '▸'} Hidden calendars (${count})`;
      hiddenWrap.style.display = count ? '' : 'none';
    }
    section.addEventListener('click', event => {
      if (event.target.closest('li')) setTimeout(update, 100);
    });
    section.addEventListener('change', () => setTimeout(update, 0));
    update();
    return true;
  }
  let count = 0;
  const timer = setInterval(() => { setup(); if (++count >= 30) clearInterval(timer); }, 600);
})();
