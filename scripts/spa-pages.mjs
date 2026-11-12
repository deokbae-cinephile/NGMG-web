// GitHub Pages는 없는 주소를 404 상태로 404.html을 보냅니다. 앱은 뜨지만 브라우저 콘솔에 404가 남으므로,
// 화면 주소마다 앱 파일(index.html)을 '<주소>.html'로 복사해 /schedule 같은 주소도 200으로 받게 합니다.
// (GitHub Pages는 /schedule 요청에 schedule.html을 돌려줍니다.) 장소 상세는 /place?id=<id>라 place.html이 받고,
// 예전 주소(/places/<id>)처럼 정해지지 않은 주소만 404.html이 맡습니다.
import { copyFileSync } from 'node:fs';

const ROUTES = ['schedule', 'stats', 'dex', 'items', 'settings', 'calendar', 'records', 'gear', 'place'];
copyFileSync('dist/index.html', 'dist/404.html');
for (const route of ROUTES) copyFileSync('dist/index.html', `dist/${route}.html`);
