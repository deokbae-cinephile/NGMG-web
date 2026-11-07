// Supabase와 Kakao SDK 응답을 흉내 내는 가짜 서버입니다. Playwright(fake-backend.ts)와 배포용 데모(demo-entry.ts)가 함께 씁니다.
export type Row = Record<string, unknown> & { id: string };
export type Seed = Partial<Record<'places' | 'records' | 'record_photos' | 'events' | 'checklist_items', Row[]>>;

export type FakeRequest = { method: string; url: string; accept: string; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
export type FakeResponse = { status: number; contentType: string; body: string };

export const KAKAO_SDK = `
  document.head.insertAdjacentHTML('beforeend', '<style>[data-demo]{position:relative;overflow:hidden;background:#b9c4bc}[data-demo]::after{content:attr(data-demo);position:absolute;right:8px;bottom:8px;padding:2px 6px;background:#030302;color:#fdf4df;font-size:12px}</style>');
  (() => {
    class LatLng { constructor(a, b) { this.a = a; this.b = b; } getLat() { return this.a; } getLng() { return this.b; } }
    const listeners = {};
    class Map {
      constructor(el) {
        this.el = el;
        el.dataset.demo = '가짜 지도 · Kakao 키 연결 전';
        el.addEventListener('click', (e) => {
          if (e.target !== el) return;
          const box = el.getBoundingClientRect();
          const latitude = 38.6 - ((e.clientY - box.top) / box.height) * 5.6;
          const longitude = 125.5 + ((e.clientX - box.left) / box.width) * 4.5;
          listeners.click?.({ latLng: new LatLng(latitude, longitude) });
        });
      }
      getCenter() { return new LatLng(36, 127); } getLevel() { return 13; }
      relayout() {} panTo() {}
    }
    class CustomOverlay { constructor(o) { this.o = o; } }
    class MarkerClusterer {
      constructor({ map, markers }) {
        this.items = markers.map((m) => {
          const pin = m.o.content;
          pin.style.position = 'absolute';
          pin.style.left = ((m.o.position.getLng() - 125.5) / 4.5) * 100 + '%';
          pin.style.top = ((38.6 - m.o.position.getLat()) / 5.6) * 100 + '%';
          return map.el.appendChild(pin);
        });
      }
      clear() { this.items.forEach((i) => i.remove()); }
    }
    const Status = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' };
    class Places {
      keywordSearch(q, cb) {
        q === '없는곳' ? cb([], Status.ZERO_RESULT) : cb([
          { place_name: q + ' 방파제', road_address_name: '', address_name: '전남 여수시 삼산면', x: '127.3', y: '34.0', category_group_code: '' },
          { place_name: q + ' 횟집', road_address_name: '전남 여수시 횟집로 1', address_name: '', x: '127.4', y: '34.1', category_group_code: 'FD6' },
        ], Status.OK);
      }
    }
    class Geocoder { coord2Address(_x, _y, cb) { cb([{ address: { address_name: '전남 고흥군' } }], Status.OK); } }
    window.kakao = { maps: { load: (cb) => cb(), LatLng, Map, CustomOverlay, MarkerClusterer,
      event: { addListener: (_t, name, cb) => { listeners[name] = cb; } },
      services: { Places, Geocoder, Status } } };
  })();
`;

export const PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#3a362b"/><path d="M0 3l1.5-1.5L3 3l.5-.5L4 3v1H0z" fill="#daceb0"/></svg>';

const json = (body: unknown, status = 200): FakeResponse => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const session = () => ({
  access_token: `h.${btoa(JSON.stringify({ sub: 'u1', exp: 4102444800 }))}.s`,
  refresh_token: 'r',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  user: { id: 'u1', aud: 'authenticated', email: 'a@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' },
});

export const createFakeServer = (seed: Seed = {}) => {
  const db: Record<string, Row[]> = { places: [], records: [], record_photos: [], events: [], checklist_items: [], ...seed };
  const removedFiles: string[] = [];
  let nextId = 1;

  // place.kind, records.place_id처럼 연결된 테이블의 값을 읽습니다.
  const read = (row: Row, key: string) => {
    const [relation, column = ''] = key.split('.');
    if (!column) return row[key];
    if (relation === 'place') return db.places!.find((item) => item.id === row.place_id)?.[column];
    return db.records!.find((item) => item.id === row.record_id)?.[column];
  };

  const embed = (table: string, row: Row): Row => {
    const place = db.places!.find((item) => item.id === row.place_id) ?? null;
    if (table === 'events') return { ...row, place };
    if (table === 'records') return { ...row, place, photos: db.record_photos!.filter((item) => item.record_id === row.id) };
    return row;
  };

  const apply = (rows: Row[], params: URLSearchParams) => {
    let result = [...rows];
    params.forEach((value, key) => {
      if (['select', 'order', 'offset', 'limit', 'columns', 'on_conflict'].includes(key)) return;
      if (key === 'or') {
        const terms = [...value.matchAll(/(\w+)\.ilike\."%(.*?)%"/g)];
        result = result.filter((row) => terms.some(([, column = '', text = '']) => String(row[column]).toLowerCase().includes(text.toLowerCase())));
        return;
      }
      const [op, operand = ''] = [value.slice(0, value.indexOf('.')), value.slice(value.indexOf('.') + 1)];
      if (op === 'eq') result = result.filter((row) => String(read(row, key)) === operand);
      if (op === 'neq') result = result.filter((row) => String(read(row, key)) !== operand);
      if (op === 'gte') result = result.filter((row) => String(read(row, key)) >= operand);
      if (op === 'lte') result = result.filter((row) => String(read(row, key)) <= operand);
      if (op === 'in') {
        const list = operand.slice(1, -1).split(',').map((item) => item.replaceAll('"', ''));
        result = result.filter((row) => list.includes(String(row[key])));
      }
    });
    return result;
  };

  // path는 Supabase 주소 뒤의 경로입니다. (/auth/v1/token, /rest/v1/places 등)
  const handle = (path: string, request: FakeRequest): FakeResponse => {
    const url = new URL(request.url);
    const { method } = request;
    if (method === 'OPTIONS') return json({});

    if (path.startsWith('/auth/v1/token')) {
      const body = request.body;
      return body.password === 'wrong' ? json({ error: 'invalid_grant', msg: 'bad' }, 400) : json(session());
    }
    if (path.startsWith('/auth/v1/logout')) return json({});
    if (path.startsWith('/auth/v1/user')) {
      if (method === 'PUT' && request.body.password === 'same-password') return json({ code: 'same_password', msg: 'same' }, 422);
      return json(session().user);
    }

    if (path.startsWith('/storage/v1/object/sign/')) {
      const { paths } = request.body;
      // 실제 서버처럼 상대 경로를 줍니다. SDK가 앞에 Storage 주소를 붙입니다.
      return json(paths.map((item: string) => ({ path: item, signedURL: `/object/fake-photo/${item}?token=t`, error: null })));
    }
    if (path.startsWith('/storage/v1/object/fake-photo/')) {
      return { status: 200, contentType: 'image/svg+xml', body: PHOTO };
    }
    if (method === 'DELETE' && path.startsWith('/storage/v1/object')) {
      removedFiles.push(...request.body.prefixes);
      return json([]);
    }
    if (path.startsWith('/storage/v1/object')) return json({ Key: path, Id: 'x', path });

    const table = path.split('/rest/v1/')[1] ?? '';
    const rows = db[table];
    if (!rows) return json({ message: `unknown ${table}` }, 404);
    const params = url.searchParams;

    if (method === 'GET') {
      let result = apply(rows, params);
      const order = params.get('order');
      if (order) {
        for (const part of order.split(',').reverse()) {
          const [column = '', direction] = part.split('.');
          result = [...result].sort((a, b) => {
            const compare = String(a[column]).localeCompare(String(b[column]));
            return direction === 'desc' ? -compare : compare;
          });
        }
      }
      const offset = Number(params.get('offset') ?? 0);
      const limit = params.get('limit');
      if (limit) result = result.slice(offset, offset + Number(limit));
      result = result.map((row) => embed(table, row));
      const columns = params.get('select') ?? '*';
      if (!/[*(]/.test(columns)) {
        result = result.map((row) => Object.fromEntries(columns.split(',').map((column) => [column, row[column]])) as Row);
      }
      const single = request.accept.includes('vnd.pgrst.object');
      return json(single ? result[0] : result);
    }
    if (method === 'POST') {
      const body = request.body;
      const created = [body].flat().map((value: Row) => {
        const row = { memo: '', address: '', checked: false, ...value, id: value.id ?? `gen-${nextId++}` };
        const index = rows.findIndex((item) => item.id === row.id || (item.storage_path && item.storage_path === value.storage_path));
        if (index >= 0) rows[index] = row;
        else rows.push(row);
        return row;
      });
      const single = request.accept.includes('vnd.pgrst.object');
      return json(single ? created[0] : created, 201);
    }
    if (method === 'PATCH') {
      const updated = apply(rows, params).map((row) => Object.assign(row, request.body));
      const single = request.accept.includes('vnd.pgrst.object');
      return json(single ? updated[0] : updated);
    }
    if (method === 'DELETE') {
      const removed = apply(rows, params);
      db[table] = rows.filter((row) => !removed.includes(row));
      if (table === 'places') {
        const ids = removed.map((row) => row.id);
        db.records = db.records!.filter((row) => !ids.includes(row.place_id as string));
        db.events!.forEach((row) => {
          if (ids.includes(row.place_id as string)) row.place_id = null;
        });
      }
      return json([]);
    }
    return json({}, 405);
  };

  return Object.assign(db, { removedFiles, handle });
};
