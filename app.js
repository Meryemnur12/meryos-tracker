const AREAS = ['DGS', 'Üniversite', 'İngilizce', 'Siber Güvenlik'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const KEY = 'meryos-tracker-v1';
const LOCAL_BACKUP_KEY = 'meryos-tracker-local-backup-v1';
const $ = selector => document.querySelector(selector);
const localDateKey = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayKey = () => localDateKey();
const newId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

function defaultSchedule() {
  return {
    0: [{ area: 'DGS', title: 'Paragraf: 20 soru', minutes: 40 }, { area: 'İngilizce', title: 'Kelime tekrarı ve kısa okuma', minutes: 30 }, { area: 'Siber Güvenlik', title: 'Haftalık konu tekrarı', minutes: 35 }],
    1: [{ area: 'Üniversite', title: 'Pazartesi ders notlarını gözden geçir', minutes: 45 }, { area: 'DGS', title: 'Matematik: problemler', minutes: 50 }, { area: 'İngilizce', title: 'Kelime kartları', minutes: 25 }, { area: 'Siber Güvenlik', title: 'Linux komut pratiği', minutes: 35 }],
    2: [{ area: 'Üniversite', title: 'Salı dersine hazırlık / ödev', minutes: 45 }, { area: 'DGS', title: 'Türkçe: paragraf soruları', minutes: 45 }, { area: 'İngilizce', title: 'Dinleme pratiği', minutes: 25 }, { area: 'Siber Güvenlik', title: 'Ağ temelleri çalışması', minutes: 35 }],
    3: [{ area: 'Üniversite', title: 'Çarşamba ders notlarını düzenle', minutes: 45 }, { area: 'DGS', title: 'Matematik: sayısal mantık', minutes: 50 }, { area: 'İngilizce', title: 'Kısa yazma pratiği', minutes: 25 }, { area: 'Siber Güvenlik', title: 'TryHackMe / laboratuvar görevi', minutes: 45 }],
    4: [{ area: 'Üniversite', title: 'Perşembe dersine hazırlık / tekrar', minutes: 45 }, { area: 'DGS', title: 'Türkçe: dil bilgisi', minutes: 40 }, { area: 'İngilizce', title: 'Gramer tekrarları', minutes: 30 }, { area: 'Siber Güvenlik', title: 'Web güvenliği konusu', minutes: 35 }],
    5: [{ area: 'Üniversite', title: 'Haftalık ders ve ödev kontrolü', minutes: 50 }, { area: 'DGS', title: 'Deneme analizi / yanlışlar', minutes: 50 }, { area: 'İngilizce', title: 'Haftalık kelime tekrarı', minutes: 30 }, { area: 'Siber Güvenlik', title: 'CTF veya mini lab', minutes: 45 }],
    6: [{ area: 'DGS', title: 'Konu tarama denemesi', minutes: 70 }, { area: 'İngilizce', title: 'Film, video veya okuma', minutes: 40 }, { area: 'Siber Güvenlik', title: 'Haftalık proje / not çıkarma', minutes: 45 }]
  };
}
function normaliseState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return { tasks: Array.isArray(source.tasks) ? source.tasks : [], reports: source.reports && typeof source.reports === 'object' ? source.reports : {}, settings: { planTime: '09:00', reportTime: '21:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(source.settings || {}) }, schedule: source.schedule && typeof source.schedule === 'object' ? source.schedule : defaultSchedule(), generatedDates: source.generatedDates && typeof source.generatedDates === 'object' ? source.generatedDates : {}, updatedAt: source.updatedAt || new Date(0).toISOString() };
}
let state = normaliseState(JSON.parse(localStorage.getItem(KEY) || 'null'));
function persistLocal() { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify({ createdAt: new Date().toISOString(), data: state })); }
function save() { state.updatedAt = new Date().toISOString(); persistLocal(); window.MeryosCloud?.schedule(() => state, applyRemoteState); }
function applyRemoteState(remote) { state = normaliseState(remote); persistLocal(); renderTasks(); renderInsights(); loadReport(); renderScheduleEditor(); }
function fmtDate(date) { return new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`)); }
function tasksToday() { return state.tasks.filter(task => task.date === todayKey()); }
function currentDay() { return new Date().getDay(); }
function ensureTodayPlan() {
  const date = todayKey();
  if (state.generatedDates[date]) return false;
  const plan = Array.isArray(state.schedule[currentDay()]) ? state.schedule[currentDay()] : [];
  plan.forEach(task => state.tasks.push({ id: newId(), date, area: task.area, title: task.title, minutes: Number(task.minutes), done: false, source: 'schedule' }));
  state.generatedDates[date] = true; save(); return plan.length > 0;
}
function renderTasks() {
  const list = $('#taskList'), tasks = tasksToday(); list.innerHTML = '';
  tasks.forEach(task => {
    const item = $('#taskTemplate').content.firstElementChild.cloneNode(true); item.classList.toggle('done', task.done);
    const check = item.querySelector('input'); check.checked = task.done; item.querySelector('strong').textContent = task.title;
    item.querySelector('.task-copy span').textContent = `${task.area} · ${task.minutes} dk${task.source === 'schedule' ? ' · otomatik plan' : ''}`;
    check.onchange = () => { task.done = check.checked; save(); renderTasks(); renderInsights(); };
    item.querySelector('.delete').onclick = () => { state.tasks = state.tasks.filter(candidate => candidate.id !== task.id); save(); renderTasks(); renderInsights(); }; list.append(item);
  });
  if (!tasks.length) list.innerHTML = '<div class="card" style="padding:22px;text-align:center;color:#716d85">Bugün için henüz görev yok. Yukarıdan ilk görevini ekle. 🌱</div>';
  const percent = tasks.length ? Math.round(tasks.filter(task => task.done).length / tasks.length * 100) : 0; $('#todayProgress').textContent = `${percent}%`; $('.progress-ring').style.background = `conic-gradient(var(--purple) ${percent * 3.6}deg,#ddd8ed 0deg)`;
}
function currentReport() { return state.reports[todayKey()] || {}; }
function loadReport() { const report = currentReport(); $('#win').value = report.win || ''; $('#blocker').value = report.blocker || ''; $('#energy').value = report.energy || 3; $('#energyValue').textContent = report.energy || 3; $('#tomorrow').value = report.tomorrow || ''; }
function startOf(period) { const date = new Date(); if (period === 'week') date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); else date.setDate(1); return localDateKey(date); }
function completedInRange(start) { return state.tasks.filter(task => task.done && task.date >= start && task.date <= todayKey()); }
function totalMinutes(tasks) { return tasks.reduce((sum, task) => sum + Number(task.minutes), 0); }
function renderInsights() {
  const week = completedInRange(startOf('week')), month = completedInRange(startOf('month')); $('#weekMinutes').textContent = `${totalMinutes(week)} dk`; $('#weekTasks').textContent = `${week.length} tamamlanan görev`; $('#monthMinutes').textContent = `${totalMinutes(month)} dk`; $('#monthTasks').textContent = `${month.length} tamamlanan görev`;
  let streak = 0; const date = new Date(); while (state.reports[localDateKey(date)]) { streak += 1; date.setDate(date.getDate() - 1); } $('#streak').textContent = `${streak} gün`;
  const max = Math.max(...AREAS.map(area => totalMinutes(week.filter(task => task.area === area))), 1); $('#areaStats').innerHTML = AREAS.map(area => { const minutes = totalMinutes(week.filter(task => task.area === area)); return `<div class="area-row"><span>${area}</span><div class="bar"><i style="width:${minutes / max * 100}%"></i></div><strong>${minutes} dk</strong></div>`; }).join('');
  const reports = Object.entries(state.reports).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7); $('#reportHistory').innerHTML = reports.length ? reports.map(([dateKey, report]) => `<div class="history-item"><strong>${fmtDate(dateKey)}</strong><p>${report.win ? `✓ ${report.win}` : ''}${report.blocker ? `\n⚑ ${report.blocker}` : ''}</p></div>`).join('') : '<p class="muted">Henüz kaydedilmiş rapor yok.</p>';
  renderWeeklyReport();
}
function weeklyAreas() {
  const start = startOf('week');
  return AREAS.map(area => {
    const tasks = state.tasks.filter(task => task.date >= start && task.date <= todayKey() && task.area === area);
    const completed = tasks.filter(task => task.done);
    const plannedMinutes = totalMinutes(tasks), completedMinutes = totalMinutes(completed);
    return { area, tasks, completed, plannedMinutes, completedMinutes, rate: tasks.length ? Math.round(completed.length / tasks.length * 100) : 0 };
  });
}
function weeklyReportText() {
  const rows = weeklyAreas();
  return `MERYOŞ TRACKER — HAFTALIK DEĞERLENDİRME\n${fmtDate(startOf('week'))} – ${fmtDate(todayKey())}\n\n${rows.map(row => `${row.area}\n- Tamamlanan: ${row.completed.length}/${row.tasks.length} görev (%${row.rate})\n- Çalışılan süre: ${row.completedMinutes}/${row.plannedMinutes} dk`).join('\n\n')}\n\nGenel tamamlanan süre: ${rows.reduce((sum, row) => sum + row.completedMinutes, 0)} dk`;
}
function renderWeeklyReport() {
  const target = $('#weeklyDetails'); if (!target) return;
  target.innerHTML = weeklyAreas().map(row => `<article class="weekly-detail"><span>${row.area}</span><strong>${row.completed.length}/${row.tasks.length} görev · %${row.rate}</strong><small>${row.completedMinutes} dk çalışıldı · ${Math.max(0, row.tasks.length - row.completed.length)} görev bekliyor</small></article>`).join('');
}
function renderScheduleEditor() { $('#scheduleEditor').innerHTML = DAYS.map((day, index) => { const lines = (state.schedule[index] || []).map(task => `${task.area} | ${task.title} | ${task.minutes}`).join('\n'); return `<article class="schedule-day${index === currentDay() ? ' today' : ''}"><label for="schedule-${index}">${day}${index === currentDay() ? ' · bugün' : ''}</label><textarea id="schedule-${index}" data-day="${index}" aria-label="${day} programı">${lines}</textarea><small>Örn. DGS | Problemler: 20 soru | 45</small></article>`; }).join(''); }
function parseSchedule() {
  const plan = {};
  for (let day = 0; day < DAYS.length; day += 1) { const text = $(`#schedule-${day}`).value.trim(); plan[day] = text ? text.split('\n').filter(Boolean).map((line, lineIndex) => { const [area, title, minutes] = line.split('|').map(part => part.trim()); if (!AREAS.includes(area) || !title || !Number(minutes) || Number(minutes) < 1) throw new Error(`${DAYS[day]} günündeki ${lineIndex + 1}. satırı kontrol et.`); return { area, title, minutes: Math.min(Number(minutes), 600) }; }) : []; }
  return plan;
}
function reportText() { const report = currentReport(), tasks = tasksToday(), completed = tasks.filter(task => task.done), missed = tasks.filter(task => !task.done); return `MERYOŞ TRACKER — ${fmtDate(todayKey())}\n\nTamamlanan görevler (${completed.length}):\n${completed.map(task => `- ${task.area}: ${task.title} (${task.minutes} dk)`).join('\n') || '- Yok'}\n\nEksik kalan görevler (${missed.length}):\n${missed.map(task => `- ${task.area}: ${task.title}`).join('\n') || '- Yok'}\n\nBugünün başarısı: ${report.win || '-'}\nEngeller / notlar: ${report.blocker || '-'}\nEnerji: ${report.energy || 3}/5\nYarın önceliği: ${report.tomorrow || '-'}`; }
const reminderTimers = [];
function scheduleReminder(time, title, body) { if (Notification.permission !== 'granted' || !time) return; const [hour, minute] = time.split(':').map(Number), next = new Date(); next.setHours(hour, minute, 0, 0); if (next <= new Date()) next.setDate(next.getDate() + 1); reminderTimers.push(setTimeout(() => { new Notification(title, { body }); scheduleReminder(time, title, body); }, next - Date.now())); }
function scheduleReminders() { reminderTimers.splice(0).forEach(timer => clearTimeout(timer)); scheduleReminder(state.settings.planTime, 'Meryoş Tracker: günaydın ✦', 'Bugünün çalışma programını gözden geçirme zamanı.'); scheduleReminder(state.settings.reportTime, 'Meryoş Tracker: günü kapat', 'Günlük çalışma raporunu kaydetmeyi unutma.'); }
$('.tabs').onclick = event => { if (!event.target.matches('.tab')) return; $('.tab.active').classList.remove('active'); event.target.classList.add('active'); $('.page.active').classList.remove('active'); $(`#${event.target.dataset.page}`).classList.add('active'); if (event.target.dataset.page === 'reportPage') loadReport(); if (event.target.dataset.page === 'insightsPage') renderInsights(); if (event.target.dataset.page === 'settingsPage') renderScheduleEditor(); };
$('#addTaskBtn').onclick = () => { $('#taskForm').hidden = false; }; $('#cancelTaskBtn').onclick = () => { $('#taskForm').hidden = true; };
$('#taskForm').onsubmit = event => { event.preventDefault(); state.tasks.push({ id: newId(), date: todayKey(), title: $('#taskTitle').value.trim(), area: $('#taskArea').value, minutes: Number($('#taskMinutes').value), done: false, source: 'manual' }); save(); event.target.reset(); $('#taskMinutes').value = 45; event.target.hidden = true; renderTasks(); };
$('#energy').oninput = event => { $('#energyValue').textContent = event.target.value; };
$('#reportForm').onsubmit = event => { event.preventDefault(); state.reports[todayKey()] = { win: $('#win').value.trim(), blocker: $('#blocker').value.trim(), energy: Number($('#energy').value), tomorrow: $('#tomorrow').value.trim() }; save(); $('#reportStatus').textContent = 'Raporun kaydedildi. Harika iş!'; renderInsights(); };
$('#copyReport').onclick = async () => { await navigator.clipboard.writeText(reportText()); $('#reportStatus').textContent = 'Rapor panoya kopyalandı. ChatGPT’ye yapıştırabilirsin.'; };
$('#openChatGPT').onclick = () => { window.open('https://chatgpt.com/', '_blank', 'noopener'); navigator.clipboard.writeText(reportText()).then(() => { $('#reportStatus').textContent = 'Rapor kopyalandı ve ChatGPT açıldı. Sohbete yapıştırman yeterli.'; }); };
$('#copyWeeklyReport').onclick = async () => { await navigator.clipboard.writeText(weeklyReportText()); alert('Haftalık değerlendirme panoya kopyalandı.'); };
$('#saveSettings').onclick = () => { state.settings = { planTime: $('#planTime').value, reportTime: $('#reportTime').value, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }; save(); scheduleReminders(); $('#reportStatus').textContent = 'Ayarlar kaydedildi; uygulama açıkken hatırlatıcılar zamanlanacak.'; };
$('#saveSchedule').onclick = () => { try { state.schedule = parseSchedule(); save(); $('#scheduleStatus').textContent = 'Haftalık program kaydedildi. Yeni plan, sonraki günlerde otomatik oluşacak.'; } catch (error) { $('#scheduleStatus').textContent = error.message; } };
$('#exportData').onclick = () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); link.download = 'meryos-tracker-yedek.json'; link.click(); URL.revokeObjectURL(link.href); };
$('#importData').onchange = event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { state = normaliseState(JSON.parse(reader.result)); save(); location.reload(); } catch { alert('Geçerli bir Meryoş Tracker yedek dosyası seç.'); } }; reader.readAsText(file); };
function bindCloudControls() {
  window.MeryosCloud?.render();
  $('#saveCloudConfig').onclick = () => { MeryosCloud.saveConfig({ url: $('#supabaseUrl').value, key: $('#supabaseKey').value, vapidPublicKey: $('#vapidPublicKey').value }); };
  $('#authForm').onsubmit = async event => { event.preventDefault(); try { $('#cloudStatus').textContent = await MeryosCloud.signIn($('#authEmail').value.trim(), $('#authPassword').value); await syncNow(); } catch (error) { $('#cloudStatus').textContent = error.message; } };
  $('#signUp').onclick = async () => { try { $('#cloudStatus').textContent = await MeryosCloud.signUp($('#authEmail').value.trim(), $('#authPassword').value); MeryosCloud.render(); } catch (error) { $('#cloudStatus').textContent = error.message; } };
  $('#signOut').onclick = () => { MeryosCloud.signOut(); };
  $('#syncNow').onclick = syncNow;
  $('#cloudBackup').onclick = async () => { try { await MeryosCloud.createBackup(state); } catch (error) { $('#cloudStatus').textContent = error.message; } };
  $('#enablePush').onclick = async () => { try { await MeryosCloud.enablePush(state.settings); } catch (error) { $('#cloudStatus').textContent = error.message; } };
}
async function syncNow() { try { const result = await MeryosCloud.sync(state); if (result.source === 'remote') applyRemoteState(result.data); } catch (error) { $('#cloudStatus').textContent = error.message; } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && MeryosCloud?.session()) syncNow(); });
setInterval(() => { if (!document.hidden && MeryosCloud?.session()) syncNow(); }, 30_000);
let installPrompt; window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('#installBtn').hidden = false; }); $('#installBtn').onclick = async () => { installPrompt?.prompt(); await installPrompt?.userChoice; $('#installBtn').hidden = true; };
$('#notifyBtn').onclick = async () => { if (!('Notification' in window)) { alert('Bu tarayıcı bildirimleri desteklemiyor.'); return; } const permission = await Notification.requestPermission(); if (permission === 'granted') { $('#notifyBtn').textContent = '🔔 Bildirimler açık'; new Notification('Meryoş Tracker', { body: 'Hatırlatıcı saatlerini Ayarlar bölümünden düzenleyebilirsin.' }); scheduleReminders(); } };
$('#planTime').value = state.settings.planTime; $('#reportTime').value = state.settings.reportTime; $('#today').textContent = fmtDate(todayKey()).toLocaleUpperCase('tr-TR'); ensureTodayPlan(); renderTasks(); renderInsights(); bindCloudControls(); if (MeryosCloud?.session()) syncNow(); if (Notification.permission === 'granted') { $('#notifyBtn').textContent = '🔔 Bildirimler açık'; scheduleReminders(); } if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
