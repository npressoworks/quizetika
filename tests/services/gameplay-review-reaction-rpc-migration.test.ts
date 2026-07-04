/**
 * Task 1.3 静的検証テスト: レビュー・評価・リアクション関連RPCのマイグレーション
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

describe('gameplay正規化マイグレーション（レビュー・評価・リアクションRPC）の静的検証', () => {
  it('マイグレーションファイルが存在する', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  describe('handle_submit_review', () => {
    const sql = () => readMigration();

    it('関数が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION handle_submit_review/i);
    });

    it('同一票の再送信を無視している', () => {
      const content = sql();
      expect(content).toMatch(/IF v_old_type IS NOT NULL AND v_old_type = p_type THEN\s*RETURN;/i);
    });

    it('差分に基づき positive_count / negative_count を再計算している', () => {
      const content = sql();
      expect(content).toMatch(/positive_count = positive_count/i);
      expect(content).toMatch(/negative_count = negative_count/i);
    });

    it('review_score を再集計している', () => {
      expect(sql()).toMatch(/review_score = CASE WHEN v_positive \+ v_negative = 0 THEN NULL/i);
    });
  });

  describe('handle_retract_review', () => {
    const sql = () => readMigration();

    it('関数が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION handle_retract_review/i);
    });

    it('レビュー削除後に集計列を再計算している', () => {
      const content = sql();
      expect(content).toMatch(/DELETE FROM quiz_reviews WHERE reviewer_id = p_reviewer_id AND quiz_id = p_quiz_id/i);
      expect(content).toMatch(/positive_count = GREATEST\(0, positive_count/i);
      expect(content).toMatch(/negative_count = GREATEST\(0, negative_count/i);
    });
  });

  describe('handle_submit_difficulty_vote', () => {
    const sql = () => readMigration();

    it('関数が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION handle_submit_difficulty_vote/i);
    });

    it('1〜5範囲チェックを行っている', () => {
      expect(sql()).toMatch(/IF p_vote < 1 OR p_vote > 5 THEN/i);
    });

    it('ログイン済みユーザーは上書き+差分反映している', () => {
      const content = sql();
      expect(content).toMatch(/ON CONFLICT \(user_id, quiz_id\) WHERE user_id IS NOT NULL DO UPDATE/i);
      expect(content).toMatch(/difficulty_votes_sum = difficulty_votes_sum \+ \(p_vote - v_old_vote\)/i);
    });

    it('匿名投票は常に新規加算している', () => {
      const content = sql();
      expect(content).toMatch(/INSERT INTO difficulty_votes \(user_id, quiz_id, vote\) VALUES \(NULL, p_quiz_id, p_vote\)/i);
    });
  });

  describe('handle_toggle_reaction', () => {
    const sql = () => readMigration();

    it('関数が定義されている', () => {
      expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION handle_toggle_reaction/i);
    });

    it('受信者をクイズ作成者からサーバー側導出している', () => {
      expect(sql()).toMatch(/SELECT author_id INTO v_receiver_id FROM quizzes WHERE id = p_quiz_id/i);
    });

    it('自己反応を防止している', () => {
      expect(sql()).toMatch(/IF p_sender_id = v_receiver_id THEN\s*RETURN FALSE;/i);
    });

    it('追加/解除の双方で likes_count と total_reactions_count を更新している', () => {
      const content = sql();
      expect(content).toMatch(/UPDATE quizzes SET likes_count = GREATEST\(0, likes_count - 1\)/i);
      expect(content).toMatch(/UPDATE users SET total_reactions_count = GREATEST\(0, total_reactions_count - 1\)/i);
      expect(content).toMatch(/UPDATE quizzes SET likes_count = likes_count \+ 1/i);
      expect(content).toMatch(/UPDATE users SET total_reactions_count = total_reactions_count \+ 1/i);
    });
  });
});
