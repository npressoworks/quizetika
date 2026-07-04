/**
 * Task 1.2 静的検証テスト: リーダーボード・アテンプト・AI対話関連RPCのマイグレーション
 *
 * ローカル Supabase を起動せずに検証するため、マイグレーション SQL ファイルの
 * 内容を静的に解析し、design.md で規定した RPC 定義要素が存在することを確認する。
 * （実際の DB への適用検証はローカル Supabase 環境で別途実施する）
 */
import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  __dirname,
  '../../supabase/migrations/20260703000200_gameplay_normalization.sql'
);

function readMigration(): string {
  return fs.readFileSync(migrationPath, 'utf-8');
}

describe('gameplay正規化マイグレーション（RPC）の静的検証', () => {
  it('マイグレーションファイルが存在する', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  describe('record_leaderboard_entry（内部共有関数）', () => {
    const sql = () => readMigration();

    it('関数が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION record_leaderboard_entry/i);
    });

    it('PUBLIC/anon/authenticated からの直接実行がREVOKEされている', () => {
      expect(sql()).toMatch(
        /REVOKE EXECUTE ON FUNCTION record_leaderboard_entry\([^)]*\) FROM PUBLIC, anon, authenticated/i
      );
    });
  });

  describe('handle_save_attempt', () => {
    const sql = () => readMigration();

    it('関数が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION handle_save_attempt/i);
    });

    it('quiz_questions を用いた対不正検証を行っている', () => {
      expect(sql()).toMatch(/FROM quiz_questions WHERE quiz_id = p_quiz_id/i);
    });

    it('表示名をサーバー側で導出している', () => {
      expect(sql()).toMatch(/FROM users WHERE id = p_user_id/i);
    });

    it('play_count を更新している', () => {
      expect(sql()).toMatch(/UPDATE quizzes SET play_count = play_count \+ 1/i);
    });

    it('適格時にリーダーボードへ反映している', () => {
      expect(sql()).toMatch(/PERFORM record_leaderboard_entry/i);
    });
  });

  describe('handle_start_lateral_attempt / handle_complete_lateral_attempt / handle_give_up_lateral_attempt', () => {
    const sql = () => readMigration();

    it('handle_start_lateral_attempt が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION handle_start_lateral_attempt/i);
    });

    it('handle_complete_lateral_attempt が合格時のみ完了・リーダーボード反映している', () => {
      const content = sql();
      expect(content).toMatch(/CREATE OR REPLACE FUNCTION handle_complete_lateral_attempt/i);
      expect(content).toMatch(/IF NOT p_is_correct THEN\s*RETURN;/i);
    });

    it('handle_give_up_lateral_attempt が既完了時に例外を発生させる', () => {
      const content = sql();
      expect(content).toMatch(/CREATE OR REPLACE FUNCTION handle_give_up_lateral_attempt/i);
      expect(content).toMatch(/RAISE EXCEPTION 'already-completed'/i);
    });
  });

  describe('handle_record_ai_turn', () => {
    const sql = () => readMigration();

    it('関数が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION handle_record_ai_turn/i);
    });

    it('JST日付境界でカウンタをリセット・加算している', () => {
      expect(sql()).toMatch(/AT TIME ZONE 'Asia\/Tokyo'/i);
    });

    it('上限判定がNULL許容（無制限）に対応している', () => {
      const content = sql();
      expect(content).toMatch(/p_per_quiz_limit IS NOT NULL AND v_per_quiz > p_per_quiz_limit/i);
      expect(content).toMatch(/p_global_limit IS NOT NULL AND v_global > p_global_limit/i);
    });

    it('加算直後に上限判定を行いレースを閉じている', () => {
      const content = sql();
      const insertIdx = content.search(/INSERT INTO ai_turn_counts_per_quiz/i);
      const limitCheckIdx = content.search(/per-quiz-limit-exceeded/i);
      expect(insertIdx).toBeGreaterThan(-1);
      expect(limitCheckIdx).toBeGreaterThan(insertIdx);
    });
  });
});
