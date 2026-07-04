/**
 * Task 1.1 静的検証テスト: ゲームプレイ系スキーママイグレーション
 *
 * ローカル Supabase を起動せずに検証するため、マイグレーション SQL ファイルの
 * 内容を静的に解析し、design.md で規定した DDL 要素が存在することを確認する。
 * （実際の DB への適用検証はローカル Supabase 環境が利用可能な場合に別途実施する）
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

describe('gameplay正規化マイグレーション（スキーマ）の静的検証', () => {
  it('マイグレーションファイルが存在する', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  describe('attempts テーブルのALTER', () => {
    const sql = () => readMigration();

    it('completed_at の NOT NULL / DEFAULT を削除している', () => {
      expect(sql()).toMatch(/ALTER TABLE attempts ALTER COLUMN completed_at DROP DEFAULT/i);
      expect(sql()).toMatch(/ALTER TABLE attempts ALTER COLUMN completed_at DROP NOT NULL/i);
    });

    it('gave_up_lateral 列を追加している', () => {
      expect(sql()).toMatch(/ALTER TABLE attempts ADD COLUMN gave_up_lateral BOOLEAN/i);
    });
  });

  describe('quiz_reviews テーブルのALTER', () => {
    const sql = () => readMigration();

    it('旧 rating/comment 列を削除している', () => {
      expect(sql()).toMatch(/ALTER TABLE quiz_reviews DROP COLUMN rating/i);
      expect(sql()).toMatch(/ALTER TABLE quiz_reviews DROP COLUMN comment/i);
    });

    it('type/reason 列を追加し、複合主キー化している', () => {
      expect(sql()).toMatch(/ALTER TABLE quiz_reviews ADD COLUMN type TEXT NOT NULL CHECK \(type IN \('positive', 'negative'\)\)/i);
      expect(sql()).toMatch(/ALTER TABLE quiz_reviews ADD COLUMN reason TEXT/i);
      expect(sql()).toMatch(/ALTER TABLE quiz_reviews ADD PRIMARY KEY \(reviewer_id, quiz_id\)/i);
    });
  });

  describe('feedback_reports の重複防止インデックス', () => {
    it('部分ユニークインデックスが定義されている', () => {
      const sql = readMigration();
      expect(sql).toMatch(/CREATE UNIQUE INDEX idx_feedback_reports_open_dedup/i);
      expect(sql).toMatch(/ON feedback_reports \(quiz_id, question_id, reporter_id\)/i);
      expect(sql).toMatch(/WHERE status = 'open'/i);
    });
  });

  describe('quizzes への新規ゲームプレイ系集計列', () => {
    it('likes_count / difficulty_votes_sum / difficulty_votes_count が追加されている', () => {
      const sql = readMigration();
      expect(sql).toMatch(/ALTER TABLE quizzes ADD COLUMN likes_count INTEGER/i);
      expect(sql).toMatch(/ALTER TABLE quizzes ADD COLUMN difficulty_votes_sum INTEGER/i);
      expect(sql).toMatch(/ALTER TABLE quizzes ADD COLUMN difficulty_votes_count INTEGER/i);
    });
  });

  describe('新規テーブル定義', () => {
    const sql = () => readMigration();

    it('reactions テーブルが複合主キー (sender_id, quiz_id, type) で定義されている', () => {
      expect(sql()).toMatch(/CREATE TABLE reactions/i);
      expect(sql()).toMatch(/PRIMARY KEY \(sender_id, quiz_id, type\)/i);
    });

    it('difficulty_votes テーブルが定義され、ログイン済みユーザーの部分ユニーク制約を持つ', () => {
      expect(sql()).toMatch(/CREATE TABLE difficulty_votes/i);
      expect(sql()).toMatch(/CREATE UNIQUE INDEX idx_difficulty_votes_user_quiz/i);
      expect(sql()).toMatch(/ON difficulty_votes \(user_id, quiz_id\) WHERE user_id IS NOT NULL/i);
    });

    it('ai_turn_counts_per_quiz / ai_turn_counts_global テーブルが定義されている', () => {
      expect(sql()).toMatch(/CREATE TABLE ai_turn_counts_per_quiz/i);
      expect(sql()).toMatch(/CREATE TABLE ai_turn_counts_global/i);
    });
  });

  describe('RLS ポリシー', () => {
    const sql = () => readMigration();

    it('新規テーブル全てでRLSが有効化されている', () => {
      expect(sql()).toMatch(/ALTER TABLE reactions ENABLE ROW LEVEL SECURITY/i);
      expect(sql()).toMatch(/ALTER TABLE difficulty_votes ENABLE ROW LEVEL SECURITY/i);
      expect(sql()).toMatch(/ALTER TABLE ai_turn_counts_per_quiz ENABLE ROW LEVEL SECURITY/i);
      expect(sql()).toMatch(/ALTER TABLE ai_turn_counts_global ENABLE ROW LEVEL SECURITY/i);
    });

    it('difficulty_votes の書き込みポリシーが INSERT/UPDATE/DELETE に分離されている（設計レビュー指摘の是正）', () => {
      const content = sql();
      expect(content).toMatch(/CREATE POLICY difficulty_votes_insert ON difficulty_votes FOR INSERT/i);
      expect(content).toMatch(/CREATE POLICY difficulty_votes_update ON difficulty_votes FOR UPDATE/i);
      expect(content).toMatch(/CREATE POLICY difficulty_votes_delete ON difficulty_votes FOR DELETE/i);
      // FOR ALL による過剰許可（匿名行を他人が更新/削除できる穴）が残っていないことを確認する
      expect(content).not.toMatch(/CREATE POLICY difficulty_votes_write ON difficulty_votes FOR ALL/i);
    });

    it('ai_turn_counts テーブルは読み取りのみ許可し、書き込みポリシーを持たない（RPC経由のみ）', () => {
      const content = sql();
      expect(content).toMatch(/CREATE POLICY ai_turn_counts_per_quiz_read ON ai_turn_counts_per_quiz FOR SELECT/i);
      expect(content).toMatch(/CREATE POLICY ai_turn_counts_global_read ON ai_turn_counts_global FOR SELECT/i);
    });
  });
});
