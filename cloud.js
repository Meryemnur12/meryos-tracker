/* Meryoş Tracker cloud adapter. Keys here are Supabase publishable keys, never service-role keys. */
window.MeryosCloud = (() => {
  const CONFIG_KEY = 'meryos-cloud-config-v1';
  const SESSION_KEY = 'meryos-cloud-session-v1';
  const BACKUP_KEY = 'meryos-last-cloud-backup-v1';
  let timer;
  let config = readJson(CONFIG_KEY, { url: '', key: '', vapidPublicKey: '' });
  let session = readJson(SESSION_KEY, null);
  const $ = selector => document.querySelector(selector);
  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; } }
  function setStatus(message, error = false) { const target = $('#cloudStatus'); if (target) { target.textContent = message; target.style.color = error ? '#a83d3d' : ''; } }
  function isConfigured() { return /^https:\/\/.+\.supabase\.co\/?$/i.test(config.url || '') && Boolean(config.key); }
  function baseUrl() { return (config.url || '').replace(/\/$/, ''); }
  function authHeaders(token) { return { apikey: config.key, Authorization: `Bearer ${token || config.key}`, 'Content-Type': 'application/json' }; }
  async function request(path, options = {}, token) {
    const response = await fetch(`${baseUrl()}${path}`, { ...options, headers: { ...authHeaders(token), ...(options.headers || {}) } });
    const body = await response.text();
    if (!response.ok) throw new Error(body || `İstek başarısız (${response.status})`);
    return body ? JSON.parse(body) : null;
  }
  async function validSession() {
    if (!session) return null;
    if (session.expires_at && session.expires_at * 1000 > Date.now() + 60_000) return session;
    const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
    session = refreshed; localStorage.setItem(SESSION_KEY, JSON.stringify(session)); return session;
  }
  function render() {
    if ($('#supabaseUrl')) $('#supabaseUrl').value = config.url || '';
    if ($('#supabaseKey')) $('#supabaseKey').value = config.key || '';
    if ($('#vapidPublicKey')) $('#vapidPublicKey').value = config.vapidPublicKey || '';
    const signedIn = Boolean(session?.user?.email);
    if ($('#signOut')) $('#signOut').hidden = !signedIn;
    if ($('#authEmail') && signedIn) $('#authEmail').value = session.user.email;
    if (!isConfigured()) setStatus('Bulut bağlantısı yapılandırılmadı.');
    else if (signedIn) setStatus(`${session.user.email} ile oturum açık.`);
    else setStatus('Bağlantı hazır; hesabınla giriş yap.');
  }
  function saveConfig(next) {
    config = { url: (next.url || '').trim().replace(/\/$/, ''), key: (next.key || '').trim(), vapidPublicKey: (next.vapidPublicKey || '').trim() };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); render();
  }
  async function signUp(email, password) {
    if (!isConfigured()) throw new Error('Önce Supabase bağlantı bilgilerini kaydet.');
    const result = await request('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (result.session) { session = result.session; localStorage.setItem(SESSION_KEY, JSON.stringify(session)); render(); return 'Hesap oluşturuldu ve giriş yapıldı.'; }
    return 'Hesap oluşturuldu. E-posta doğrulama bağlantısını açtıktan sonra giriş yap.';
  }
  async function signIn(email, password) {
    if (!isConfigured()) throw new Error('Önce Supabase bağlantı bilgilerini kaydet.');
    session = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem(SESSION_KEY, JSON.stringify(session)); render(); return 'Giriş yapıldı.';
  }
  function signOut() { session = null; localStorage.removeItem(SESSION_KEY); render(); }
  async function sync(localState) {
    if (!isConfigured()) throw new Error('Bulut bağlantısı yapılandırılmadı.');
    const active = await validSession(); if (!active?.user?.id) throw new Error('Bulut eşitlemesi için giriş yapmalısın.');
    const userId = encodeURIComponent(active.user.id);
    const rows = await request(`/rest/v1/tracker_state?user_id=eq.${userId}&select=data,updated_at`, { method: 'GET' }, active.access_token);
    const remote = rows?.[0];
    const localUpdated = Date.parse(localState.updatedAt || 0) || 0;
    const remoteUpdated = Date.parse(remote?.updated_at || remote?.data?.updatedAt || 0) || 0;
    if (remote && remoteUpdated > localUpdated) { setStatus('Daha yeni bulut verisi bu cihaza alındı.'); return { source: 'remote', data: remote.data }; }
    await request('/rest/v1/tracker_state?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: active.user.id, data: localState, updated_at: localState.updatedAt }) }, active.access_token);
    setStatus('Bulut eşitlemesi tamamlandı.');
    await dailyBackup(localState, active);
    return { source: 'local', data: localState };
  }
  async function dailyBackup(state, active) {
    const day = new Date().toISOString().slice(0, 10); if (localStorage.getItem(BACKUP_KEY) === day) return;
    await request('/rest/v1/tracker_backups', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: active.user.id, data: state, kind: 'daily' }) }, active.access_token);
    localStorage.setItem(BACKUP_KEY, day);
  }
  async function createBackup(state) {
    const active = await validSession(); if (!active?.user?.id) throw new Error('Bulut yedeği için giriş yapmalısın.');
    await request('/rest/v1/tracker_backups', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: active.user.id, data: state, kind: 'manual' }) }, active.access_token);
    setStatus('Bulut yedeği oluşturuldu.');
  }
  function schedule(getState, applyRemote) {
    clearTimeout(timer);
    timer = setTimeout(async () => { try { const result = await sync(getState()); if (result.source === 'remote') applyRemote(result.data); } catch (error) { if (isConfigured() && session) setStatus(`Eşitleme bekliyor: ${error.message}`, true); } }, 1200);
  }
  function toUint8Array(base64) { const padded = `${base64}${'='.repeat((4 - base64.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(padded); return Uint8Array.from(raw, char => char.charCodeAt(0)); }
  async function enablePush(settings) {
    if (!isConfigured() || !config.vapidPublicKey) throw new Error('Bildirim için Supabase bağlantısı ve VAPID genel anahtarı gerekli.');
    const active = await validSession(); if (!active?.user?.id) throw new Error('Bildirim için giriş yapmalısın.');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Bu tarayıcı web push bildirimlerini desteklemiyor.');
    const permission = await Notification.requestPermission(); if (permission !== 'granted') throw new Error('Bildirim izni verilmedi.');
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(config.vapidPublicKey) });
    const json = subscription.toJSON();
    await request('/rest/v1/push_subscriptions?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ endpoint: json.endpoint, user_id: active.user.id, p256dh: json.keys?.p256dh, auth: json.keys?.auth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, plan_time: settings.planTime, report_time: settings.reportTime }) }, active.access_token);
    setStatus('Kapalıyken bildirim aboneliği kaydedildi. Sunucu işlevi dağıtıldıktan sonra etkinleşir.');
  }
  return { render, isConfigured, saveConfig, signUp, signIn, signOut, sync, schedule, createBackup, enablePush, session: () => session };
})();
