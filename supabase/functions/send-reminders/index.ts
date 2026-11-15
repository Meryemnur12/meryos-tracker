// Supabase Edge Function. VAPID_KEYS_JSON gizli değişkeni JWK biçiminde olmalı.
// Bu işlevi deploy etmeden ve cron job eklemeden kapalı uygulama bildirimi gönderilmez.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidJson = Deno.env.get('VAPID_KEYS_JSON')!;
const contact = Deno.env.get('VAPID_CONTACT') || 'mailto:admin@example.com';
const supabase = createClient(url, serviceKey);
const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson));
const applicationServer = await webpush.ApplicationServer.new({ contactInformation: contact, vapidKeys });

function localClock(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const part = type => parts.find(value => value.type === type)?.value || '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
async function send(subscription: Record<string, string>, payload: Record<string, string>) {
  const target = applicationServer.subscribe({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } });
  await target.pushTextMessage(JSON.stringify(payload), { ttl: 3600, topic: payload.tag, urgency: webpush.Urgency.High });
}

Deno.serve(async request => {
  if (!Deno.env.get('CRON_SECRET') || request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('Unauthorized', { status: 401 });
  const isTest = new URL(request.url).searchParams.get('test') === '1';
  const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results = [];
  for (const subscription of subscriptions || []) {
    const now = localClock(subscription.timezone || 'Europe/Istanbul');
    // Postgres time values are returned as HH:MM:SS, while the reminder clock is HH:MM.
    const planTime = String(subscription.plan_time || '').slice(0, 5);
    const reportTime = String(subscription.report_time || '').slice(0, 5);
    const kind = isTest ? 'test' : now.time === planTime && subscription.last_plan_sent !== now.date ? 'plan' : now.time === reportTime && subscription.last_report_sent !== now.date ? 'report' : null;
    if (!kind) continue;
    try {
      await send(subscription, kind === 'test'
        ? { title: 'Meryoş Tracker test bildirimi', body: 'Kapalıyken bildirim altyapısı yanıt verdi. ✦', tag: 'meryos-test' }
        : kind === 'plan'
        ? { title: 'Meryoş Tracker: günaydın ✦', body: 'Bugünün çalışma programını gözden geçirme zamanı.', tag: 'meryos-plan' }
        : { title: 'Meryoş Tracker: günü kapat', body: 'Günlük çalışma raporunu kaydetmeyi unutma.', tag: 'meryos-report' });
      if (kind !== 'test') {
        const column = kind === 'plan' ? 'last_plan_sent' : 'last_report_sent';
        await supabase.from('push_subscriptions').update({ [column]: now.date }).eq('endpoint', subscription.endpoint);
      }
      results.push({ endpoint: subscription.endpoint, status: 'sent', kind });
    } catch (error) {
      results.push({ endpoint: subscription.endpoint, status: 'failed', error: String(error) });
    }
  }
  return Response.json({ results });
});
