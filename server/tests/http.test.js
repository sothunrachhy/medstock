import { describe, expect, it } from 'vitest';
import { escapeRegex, parsePaging, toPositiveInt } from '../src/utils/http.js';
import { listDays, parseDay, toDayStr } from '../src/utils/date.js';

describe('http utils', () => {
  it('clamps paging values', () => {
    expect(parsePaging({ page: '0', limit: '9999' }, 20, 100)).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(parsePaging({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
  });
  it('escapes regex characters', () => {
    expect(new RegExp(escapeRegex('a.b*(c)')).test('a.b*(c)')).toBe(true);
  });
  it('accepts only positive integers', () => {
    expect(toPositiveInt('5', 'q')).toBe(5);
    expect(() => toPositiveInt('0', 'q')).toThrow();
    expect(() => toPositiveInt('1.5', 'q')).toThrow();
  });
});

describe('Cambodia dates', () => {
  it('uses UTC+7 day boundaries', () => {
    expect(parseDay('2026-11-18').toISOString()).toBe('2026-11-17T17:00:00.000Z');
    expect(toDayStr(new Date('2026-11-17T17:30:00Z'))).toBe('2026-11-18');
  });
  it('lists days inclusively', () => {
    expect(listDays('2026-11-09', '2026-11-15')).toHaveLength(7);
  });
});
