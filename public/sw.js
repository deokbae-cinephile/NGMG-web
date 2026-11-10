/*
 * 오프라인 캐시. 신호가 약한 바닷가에서도 앱이 뜨고, 마지막으로 본 기록과 사진을 볼 수 있게 합니다.
 * - 앱 화면(HTML): 네트워크 먼저, 늦거나 끊기면 저장해 둔 화면
 * - /assets/ (이름에 해시가 붙은 JS·CSS·글꼴): 저장해 둔 것 먼저
 * - DB 조회(GET /rest/v1/): 네트워크 먼저, 늦거나 끊기면 같은 계정의 마지막 응답
 * - 사진(서명 주소): 토큰을 뺀 경로로 저장해 두고 먼저 씀 (서명 주소는 받을 때마다 토큰이 바뀝니다)
 * 로그인, 저장(POST·PATCH·DELETE), 카카오 지도는 건드리지 않습니다.
 */
const VERSION = 'v2'; // v2: DB 응답을 계정별로 저장
const SHELL = `ngmg-shell-${VERSION}`;
const ASSETS = `ngmg-assets-${VERSION}`;
const DATA = `ngmg-data-${VERSION}`;
const PHOTOS = `ngmg-photos-${VERSION}`;
const KEEP = [SHELL, ASSETS, DATA, PHOTOS];
/** 네트워크를 기다리는 최대 시간. 넘으면 저장해 둔 응답을 먼저 보여 줍니다. */
const TIMEOUT = 3500;

/** 요청 토큰(JWT)의 사용자 id. 로그인 전 요청(공개 키)은 'anon'입니다. 키를 나누는 데만 쓰고 검증은 서버가 합니다. */
const account = (request) => {
  try {
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub ?? 'anon';
  } catch {
    return 'anon';
  }
};

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('ngmg-') && !KEEP.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** 오래된 것부터 지워 개수를 제한합니다. */
const trim = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
};

const put = async (name, key, response, max) => {
  const cache = await caches.open(name);
  await cache.put(key, response);
  if (max) await trim(name, max);
};

/** 네트워크 먼저. 실패하거나 TIMEOUT을 넘기면 저장해 둔 응답을 쓰고, 네트워크 응답은 도착하는 대로 저장합니다. */
const networkFirst = async (event, name, key, max) => {
  const network = fetch(event.request).then((response) => {
    if (response.ok || response.status === 404) event.waitUntil(put(name, key, response.clone(), max));
    return response;
  });
  network.catch(() => {}); // 저장해 둔 응답을 먼저 보낸 뒤 네트워크가 실패해도 오류로 남기지 않습니다.
  const cached = caches.open(name).then((cache) => cache.match(key, { ignoreVary: true }));
  const timeout = new Promise((resolve) => setTimeout(resolve, TIMEOUT));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    return (await cached) ?? (await network);
  } catch (error) {
    const fallback = await cached;
    if (fallback) return fallback;
    throw error;
  }
};

const cacheFirst = async (event, name, key, request, max) => {
  const cache = await caches.open(name);
  const cached = await cache.match(key, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) event.waitUntil(put(name, key, response.clone(), max));
  return response;
};

// 알림(supabase/functions/notify): { title, body, url, tag }
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? '낚고먹고', {
      body: data.body ?? '',
      tag: data.tag,
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

// 알림을 누르면 열린 앱 창으로 가고, 없으면 새로 엽니다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return open.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 앱 화면: 주소가 달라도 같은 index.html이므로 한 자리에 저장합니다.
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirst(event, SHELL, '/', undefined));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event, ASSETS, request, request, 400));
    return;
  }
  if (url.pathname.includes('/rest/v1/')) {
    // 다른 계정의 응답을 받지 않도록 요청 토큰의 사용자 id를 키에 넣습니다. 늦게 온 응답도 그 요청의 계정 자리에만 저장됩니다.
    // Cache API는 주소의 # 뒤를 무시하므로 쿼리 값으로 붙입니다.
    const key = new URL(request.url);
    key.searchParams.set('__account', account(request));
    event.respondWith(networkFirst(event, DATA, key.href, 150));
    return;
  }
  if (url.pathname.includes('/storage/v1/object/sign/')) {
    // 사진은 CORS로 받아 실제 크기만큼만 저장 공간을 씁니다.
    const key = `${url.origin}${url.pathname}`;
    event.respondWith(
      cacheFirst(event, PHOTOS, key, new Request(url, { mode: 'cors', credentials: 'omit' }), 300).catch(async (error) => {
        // 오프라인에서 썸네일이 없으면(예전 사진) 저장해 둔 원본을 대신 보여 줍니다.
        const original = key.endsWith('.thumb.jpg') && (await caches.open(PHOTOS).then((cache) => cache.match(key.replace(/\.thumb\.jpg$/, '.jpg'))));
        if (original) return original;
        throw error;
      }),
    );
  }
});
