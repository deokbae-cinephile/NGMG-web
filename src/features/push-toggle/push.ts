import { supabase } from '@/shared/api';

/** 웹 푸시를 쓸 수 있는 환경인지. 아이폰은 홈 화면에 추가한 앱(iOS 16.4 이상)에서만 됩니다. */
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (base64: string) => {
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

/** 서비스 워커(public/sw.js)가 없으면 등록합니다. ready는 등록이 없으면 끝나지 않아 먼저 확인합니다. */
const registration = async () => {
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
};

/** 이 기기의 지금 구독. 서비스 워커가 아직 없으면 구독도 없습니다. */
export const currentSubscription = async () => {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
};

/** 알림을 켜고 테스트 알림을 보냅니다. */
export const enablePush = async () => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림 권한을 허용해야 받을 수 있습니다. 브라우저나 기기 설정에서 허용해 주세요.');
  const keyResponse = await supabase.functions.fetch('notify');
  const { publicKey } = (await keyResponse.json().catch(() => ({}))) as { publicKey?: string };
  if (!keyResponse.ok || !publicKey) throw new Error('알림 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  const subscription = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const { endpoint, keys } = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
  if (error) {
    // 서버에 없는 구독이 브라우저에만 남으면 '받는 중'으로 보이지만 알림이 오지 않으므로, 이번에 만든 구독은 되돌립니다.
    if (!existing) await subscription.unsubscribe().catch(() => undefined);
    throw new Error('알림 구독을 저장하지 못했습니다.');
  }
  await supabase.functions.fetch('notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: endpoint }) });
};

/** 이 기기의 알림을 끕니다. */
export const disablePush = async () => {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
};
