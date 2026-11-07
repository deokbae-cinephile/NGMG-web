import Cookies from 'js-cookie';
import { beforeEach, expect, test } from 'vitest';
import { getPreference, setPreference } from './preferences';

beforeEach(() => Cookies.remove('pref'));

test('저장한 값을 다시 읽는다', () => {
  setPreference('pref', { level: 8 });
  expect(getPreference('pref', null)).toEqual({ level: 8 });
});

test('값이 없거나 깨졌으면 기본값을 돌려준다', () => {
  expect(getPreference('pref', 'all')).toBe('all');
  Cookies.set('pref', '{broken');
  expect(getPreference('pref', 'all')).toBe('all');
});
