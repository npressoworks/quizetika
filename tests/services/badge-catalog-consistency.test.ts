/**
 * Task 3.2 単体テスト: badges テーブルのシードデータと BADGE_DEFINITIONS の整合性検証
 *
 * ローカル Supabase を起動せずに検証するため、マイグレーション SQL 内の
 * `INSERT INTO badges` シード文を静的に解析し、ID 集合が一致することを確認する。
 */
import fs from 'fs';
import path from 'path';
import { BADGE_DEFINITIONS } from '../../src/services/user';

describe('badges カタログとBADGE_DEFINITIONSの整合性', () => {
  const migrationPath = path.join(
    __dirname,
    '../../supabase/migrations/20260703000000_core_data_normalization.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  function extractSeededBadgeIds(sqlText: string): string[] {
    const insertMatch = sqlText.match(/INSERT INTO badges[\s\S]*?VALUES([\s\S]*?);/);
    if (!insertMatch) return [];
    const valuesBlock = insertMatch[1];
    const rowMatches = [...valuesBlock.matchAll(/\('([a-z0-9_]+)',/g)];
    return rowMatches.map((m) => m[1]);
  }

  it('マイグレーションのシードSQLに BADGE_DEFINITIONS と同数のバッジが定義されている', () => {
    const seededIds = extractSeededBadgeIds(sql);
    expect(seededIds.length).toBe(BADGE_DEFINITIONS.length);
  });

  it('マイグレーションのシードIDと BADGE_DEFINITIONS のID集合が完全に一致する', () => {
    const seededIds = new Set(extractSeededBadgeIds(sql));
    const definedIds = new Set(BADGE_DEFINITIONS.map((d) => d.id));

    expect(seededIds).toEqual(definedIds);
  });
});
