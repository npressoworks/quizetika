-- ==========================================
-- BigQuery Export Pipeline: 残り4テーブル(quiz_questions/quiz_tags/difficulty_votes/quiz_reviews)への
-- キャプチャトリガー適用
-- Requirements: 1.2, 1.3, 2.4, 4.1, 4.4
-- Design: CaptureTriggers component（design.md「DB / Capture」節）
--
-- 方針: 許可カラム列挙方式（allow-list）でpayloadを構築する。to_jsonb(NEW) - '除外カラム'
-- のような除外方式は用いない（20260714000000と同一方針。将来ソーステーブルに新しいPII
-- カラムが追加されても、ホワイトリストに明示追加するまでBigQueryへ自動流出しないフェイル
-- セーフとするため）。
--
-- 対象4テーブルはいずれもPIIカラムを含まないため、全カラムを許可する。
-- ライブスキーマは`\d <table>`で確認済み（design.mdの静的スナップショットからドリフト
-- あり。quiz_tagsにoriginal_label追加、quiz_reviewsはid/rating/commentを持たず
-- reviewer_id+quiz_id複合PK・type・reason構成に変更されている）。
--
-- トリガー関数はSECURITY DEFINERとし、outboxへのINSERT失敗はソーストランザクション
-- を失敗させる（欠損よりロールバックを優先。design.md Error Strategy参照）。
--
-- users（および本specの対象7テーブル以外の全テーブル）にはトリガーを設置しない。
-- これはRequirement 4.1/4.4の構造的保証であり、実装すべきコードは存在しない
-- （トリガー未設置そのものが実装）。
-- ==========================================

-- ==========================================
-- quiz_questions: 全カラムを許可（PIIカラムなし）
-- ==========================================
CREATE OR REPLACE FUNCTION capture_quiz_questions_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quiz_questions',
            'DELETE',
            jsonb_build_object(
                'quiz_id', OLD.quiz_id,
                'question_id', OLD.question_id,
                'display_order', OLD.display_order
            )
        );
        RETURN OLD;
    ELSE
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quiz_questions',
            TG_OP,
            jsonb_build_object(
                'quiz_id', NEW.quiz_id,
                'question_id', NEW.question_id,
                'display_order', NEW.display_order
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_capture_quiz_questions_event
AFTER INSERT OR UPDATE OR DELETE ON quiz_questions
FOR EACH ROW
EXECUTE FUNCTION capture_quiz_questions_event();

-- ==========================================
-- quiz_tags: 全カラムを許可（PIIカラムなし）
-- ==========================================
CREATE OR REPLACE FUNCTION capture_quiz_tags_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quiz_tags',
            'DELETE',
            jsonb_build_object(
                'quiz_id', OLD.quiz_id,
                'tag_id', OLD.tag_id,
                'original_label', OLD.original_label
            )
        );
        RETURN OLD;
    ELSE
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quiz_tags',
            TG_OP,
            jsonb_build_object(
                'quiz_id', NEW.quiz_id,
                'tag_id', NEW.tag_id,
                'original_label', NEW.original_label
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_capture_quiz_tags_event
AFTER INSERT OR UPDATE OR DELETE ON quiz_tags
FOR EACH ROW
EXECUTE FUNCTION capture_quiz_tags_event();

-- ==========================================
-- difficulty_votes: 全カラムを許可（PIIカラムなし）
-- ==========================================
CREATE OR REPLACE FUNCTION capture_difficulty_votes_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'difficulty_votes',
            'DELETE',
            jsonb_build_object(
                'id', OLD.id,
                'user_id', OLD.user_id,
                'quiz_id', OLD.quiz_id,
                'vote', OLD.vote,
                'created_at', OLD.created_at,
                'updated_at', OLD.updated_at
            )
        );
        RETURN OLD;
    ELSE
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'difficulty_votes',
            TG_OP,
            jsonb_build_object(
                'id', NEW.id,
                'user_id', NEW.user_id,
                'quiz_id', NEW.quiz_id,
                'vote', NEW.vote,
                'created_at', NEW.created_at,
                'updated_at', NEW.updated_at
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_capture_difficulty_votes_event
AFTER INSERT OR UPDATE OR DELETE ON difficulty_votes
FOR EACH ROW
EXECUTE FUNCTION capture_difficulty_votes_event();

-- ==========================================
-- quiz_reviews: 全カラムを許可（PIIカラムなし）
-- ライブスキーマはdesign.mdの静的スナップショット(id/rating/comment)からドリフトしており、
-- reviewer_id+quiz_id複合PK・type('positive'/'negative')・reason(自由記述)構成である。
-- ==========================================
CREATE OR REPLACE FUNCTION capture_quiz_reviews_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quiz_reviews',
            'DELETE',
            jsonb_build_object(
                'reviewer_id', OLD.reviewer_id,
                'quiz_id', OLD.quiz_id,
                'created_at', OLD.created_at,
                'type', OLD.type,
                'reason', OLD.reason,
                'updated_at', OLD.updated_at
            )
        );
        RETURN OLD;
    ELSE
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quiz_reviews',
            TG_OP,
            jsonb_build_object(
                'reviewer_id', NEW.reviewer_id,
                'quiz_id', NEW.quiz_id,
                'created_at', NEW.created_at,
                'type', NEW.type,
                'reason', NEW.reason,
                'updated_at', NEW.updated_at
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_capture_quiz_reviews_event
AFTER INSERT OR UPDATE OR DELETE ON quiz_reviews
FOR EACH ROW
EXECUTE FUNCTION capture_quiz_reviews_event();
