-- ==========================================
-- BigQuery Export Pipeline: キャプチャトリガー基盤とattempts/quizzes/questionsへの適用
-- Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.2, 4.3, 5.4
-- Design: CaptureTriggers component（design.md「DB / Capture」節）
--
-- 方針: 許可カラム列挙方式（allow-list）でpayloadを構築する。
-- to_jsonb(NEW) - '除外カラム' のような除外方式は用いない。将来ソーステーブルに
-- 新しいPIIカラムが追加されても、ホワイトリストに明示追加するまでBigQueryへ
-- 自動流出しないフェイルセーフとするため。
--
-- トリガー関数はSECURITY DEFINERとし、outboxへのINSERT失敗はソーストランザクション
-- を失敗させる（欠損よりロールバックを優先。design.md Error Strategy参照）。
-- ==========================================

-- ==========================================
-- attempts: 全カラムを許可（PIIカラムなし。ai_questions_history/ai_truth_attempts/
-- question_answer_details等の人間行動層データを含む）
-- ==========================================
CREATE OR REPLACE FUNCTION capture_attempts_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'attempts',
            'DELETE',
            jsonb_build_object(
                'id', OLD.id,
                'user_id', OLD.user_id,
                'quiz_id', OLD.quiz_id,
                'list_id', OLD.list_id,
                'mode', OLD.mode,
                'session_id', OLD.session_id,
                'score', OLD.score,
                'total_questions', OLD.total_questions,
                'elapsed_seconds', OLD.elapsed_seconds,
                'failed_question_ids', OLD.failed_question_ids,
                'question_answers', OLD.question_answers,
                'question_answer_details', OLD.question_answer_details,
                'difficulty_vote', OLD.difficulty_vote,
                'ai_questions_history', OLD.ai_questions_history,
                'ai_truth_attempts', OLD.ai_truth_attempts,
                'ai_turn_count', OLD.ai_turn_count,
                'ai_turn_limit', OLD.ai_turn_limit,
                'completed_at', OLD.completed_at,
                'gave_up_lateral', OLD.gave_up_lateral
            )
        );
        RETURN OLD;
    ELSE
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'attempts',
            TG_OP,
            jsonb_build_object(
                'id', NEW.id,
                'user_id', NEW.user_id,
                'quiz_id', NEW.quiz_id,
                'list_id', NEW.list_id,
                'mode', NEW.mode,
                'session_id', NEW.session_id,
                'score', NEW.score,
                'total_questions', NEW.total_questions,
                'elapsed_seconds', NEW.elapsed_seconds,
                'failed_question_ids', NEW.failed_question_ids,
                'question_answers', NEW.question_answers,
                'question_answer_details', NEW.question_answer_details,
                'difficulty_vote', NEW.difficulty_vote,
                'ai_questions_history', NEW.ai_questions_history,
                'ai_truth_attempts', NEW.ai_truth_attempts,
                'ai_turn_count', NEW.ai_turn_count,
                'ai_turn_limit', NEW.ai_turn_limit,
                'completed_at', NEW.completed_at,
                'gave_up_lateral', NEW.gave_up_lateral
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_capture_attempts_event
AFTER INSERT OR UPDATE OR DELETE ON attempts
FOR EACH ROW
EXECUTE FUNCTION capture_attempts_event();

-- ==========================================
-- quizzes: author_name/author_avatarを除く全カラムを許可（4.2 PIIカラム除外）
-- ==========================================
CREATE OR REPLACE FUNCTION capture_quizzes_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quizzes',
            'DELETE',
            jsonb_build_object(
                'id', OLD.id,
                'author_id', OLD.author_id,
                'title', OLD.title,
                'description', OLD.description,
                'thumbnail_url', OLD.thumbnail_url,
                'difficulty', OLD.difficulty,
                'genre', OLD.genre,
                'question_count', OLD.question_count,
                'status', OLD.status,
                'visibility', OLD.visibility,
                'flags_count', OLD.flags_count,
                'play_count', OLD.play_count,
                'bookmarks_count', OLD.bookmarks_count,
                'positive_count', OLD.positive_count,
                'negative_count', OLD.negative_count,
                'temp_positive_count', OLD.temp_positive_count,
                'temp_negative_count', OLD.temp_negative_count,
                'review_score', OLD.review_score,
                'review_badge', OLD.review_badge,
                'is_review_masked', OLD.is_review_masked,
                'active_reset_request_id', OLD.active_reset_request_id,
                'canonical_genre_id', OLD.canonical_genre_id,
                'format', OLD.format,
                'created_at', OLD.created_at,
                'updated_at', OLD.updated_at,
                'likes_count', OLD.likes_count,
                'difficulty_votes_sum', OLD.difficulty_votes_sum,
                'difficulty_votes_count', OLD.difficulty_votes_count
            )
        );
        RETURN OLD;
    ELSE
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'quizzes',
            TG_OP,
            jsonb_build_object(
                'id', NEW.id,
                'author_id', NEW.author_id,
                'title', NEW.title,
                'description', NEW.description,
                'thumbnail_url', NEW.thumbnail_url,
                'difficulty', NEW.difficulty,
                'genre', NEW.genre,
                'question_count', NEW.question_count,
                'status', NEW.status,
                'visibility', NEW.visibility,
                'flags_count', NEW.flags_count,
                'play_count', NEW.play_count,
                'bookmarks_count', NEW.bookmarks_count,
                'positive_count', NEW.positive_count,
                'negative_count', NEW.negative_count,
                'temp_positive_count', NEW.temp_positive_count,
                'temp_negative_count', NEW.temp_negative_count,
                'review_score', NEW.review_score,
                'review_badge', NEW.review_badge,
                'is_review_masked', NEW.is_review_masked,
                'active_reset_request_id', NEW.active_reset_request_id,
                'canonical_genre_id', NEW.canonical_genre_id,
                'format', NEW.format,
                'created_at', NEW.created_at,
                'updated_at', NEW.updated_at,
                'likes_count', NEW.likes_count,
                'difficulty_votes_sum', NEW.difficulty_votes_sum,
                'difficulty_votes_count', NEW.difficulty_votes_count
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_capture_quizzes_event
AFTER INSERT OR UPDATE OR DELETE ON quizzes
FOR EACH ROW
EXECUTE FUNCTION capture_quizzes_event();

-- ==========================================
-- questions: author_name/author_avatarを除く全カラムを許可（4.2 PIIカラム除外）
-- ==========================================
CREATE OR REPLACE FUNCTION capture_questions_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'questions',
            'DELETE',
            jsonb_build_object(
                'id', OLD.id,
                'owner_quiz_id', OLD.owner_quiz_id,
                'link_kind', OLD.link_kind,
                'author_id', OLD.author_id,
                'type', OLD.type,
                'question_text', OLD.question_text,
                'explanation', OLD.explanation,
                'image_url', OLD.image_url,
                'hint', OLD.hint,
                'limit_time', OLD.limit_time,
                'correct_text_answer_list', OLD.correct_text_answer_list,
                'text_input_mode', OLD.text_input_mode,
                'text_input_char_count', OLD.text_input_char_count,
                'choices', OLD.choices,
                'sorting_items', OLD.sorting_items,
                'association_hints', OLD.association_hints,
                'ai_context_details', OLD.ai_context_details,
                'truth_keywords', OLD.truth_keywords,
                'source_url', OLD.source_url,
                'correct_count', OLD.correct_count,
                'incorrect_count', OLD.incorrect_count,
                'bookmarks_count', OLD.bookmarks_count,
                'created_at', OLD.created_at,
                'updated_at', OLD.updated_at
            )
        );
        RETURN OLD;
    ELSE
        INSERT INTO analytics_outbox (table_name, event_type, payload)
        VALUES (
            'questions',
            TG_OP,
            jsonb_build_object(
                'id', NEW.id,
                'owner_quiz_id', NEW.owner_quiz_id,
                'link_kind', NEW.link_kind,
                'author_id', NEW.author_id,
                'type', NEW.type,
                'question_text', NEW.question_text,
                'explanation', NEW.explanation,
                'image_url', NEW.image_url,
                'hint', NEW.hint,
                'limit_time', NEW.limit_time,
                'correct_text_answer_list', NEW.correct_text_answer_list,
                'text_input_mode', NEW.text_input_mode,
                'text_input_char_count', NEW.text_input_char_count,
                'choices', NEW.choices,
                'sorting_items', NEW.sorting_items,
                'association_hints', NEW.association_hints,
                'ai_context_details', NEW.ai_context_details,
                'truth_keywords', NEW.truth_keywords,
                'source_url', NEW.source_url,
                'correct_count', NEW.correct_count,
                'incorrect_count', NEW.incorrect_count,
                'bookmarks_count', NEW.bookmarks_count,
                'created_at', NEW.created_at,
                'updated_at', NEW.updated_at
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_capture_questions_event
AFTER INSERT OR UPDATE OR DELETE ON questions
FOR EACH ROW
EXECUTE FUNCTION capture_questions_event();
