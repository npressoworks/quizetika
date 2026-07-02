export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: Database["public"]["Enums"]["admin_log_action_enum"]
          created_at: string
          executor_id: string | null
          id: string
          reason: string | null
          target_uid: string
        }
        Insert: {
          action: Database["public"]["Enums"]["admin_log_action_enum"]
          created_at?: string
          executor_id?: string | null
          id?: string
          reason?: string | null
          target_uid: string
        }
        Update: {
          action?: Database["public"]["Enums"]["admin_log_action_enum"]
          created_at?: string
          executor_id?: string | null
          id?: string
          reason?: string | null
          target_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_executor_id_fkey"
            columns: ["executor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_logs_target_uid_fkey"
            columns: ["target_uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          category: Database["public"]["Enums"]["announcement_category_enum"]
          content: string
          created_at: string
          id: string
          published_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category: Database["public"]["Enums"]["announcement_category_enum"]
          content: string
          created_at?: string
          id?: string
          published_at?: string | null
          status: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: Database["public"]["Enums"]["announcement_category_enum"]
          content?: string
          created_at?: string
          id?: string
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          ai_questions_history: Json | null
          ai_truth_attempts: Json | null
          ai_turn_count: number | null
          ai_turn_limit: number | null
          completed_at: string
          difficulty_vote: number | null
          elapsed_seconds: number
          failed_question_ids: string[] | null
          id: string
          list_id: string | null
          mode: string
          question_answer_details: Json | null
          question_answers: Json | null
          quiz_id: string
          score: number
          session_id: string | null
          total_questions: number
          user_id: string
        }
        Insert: {
          ai_questions_history?: Json | null
          ai_truth_attempts?: Json | null
          ai_turn_count?: number | null
          ai_turn_limit?: number | null
          completed_at?: string
          difficulty_vote?: number | null
          elapsed_seconds: number
          failed_question_ids?: string[] | null
          id?: string
          list_id?: string | null
          mode: string
          question_answer_details?: Json | null
          question_answers?: Json | null
          quiz_id: string
          score: number
          session_id?: string | null
          total_questions: number
          user_id: string
        }
        Update: {
          ai_questions_history?: Json | null
          ai_truth_attempts?: Json | null
          ai_turn_count?: number | null
          ai_turn_limit?: number | null
          completed_at?: string
          difficulty_vote?: number | null
          elapsed_seconds?: number
          failed_question_ids?: string[] | null
          id?: string
          list_id?: string | null
          mode?: string
          question_answer_details?: Json | null
          question_answers?: Json | null
          quiz_id?: string
          score?: number
          session_id?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["bookmark_target_type_enum"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["bookmark_target_type_enum"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["bookmark_target_type_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ai_authoring_counts: {
        Row: {
          count: number
          date: string
          id: string
          user_id: string
        }
        Insert: {
          count?: number
          date?: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_ai_authoring_counts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          category: Database["public"]["Enums"]["feedback_report_category_enum"]
          content: string
          created_at: string
          creator_id: string
          id: string
          question_id: string
          question_text: string
          quiz_id: string
          quiz_title: string
          reporter_id: string
          selected_choice_text: string | null
          status: Database["public"]["Enums"]["feedback_report_status_enum"]
        }
        Insert: {
          category: Database["public"]["Enums"]["feedback_report_category_enum"]
          content: string
          created_at?: string
          creator_id: string
          id?: string
          question_id: string
          question_text: string
          quiz_id: string
          quiz_title: string
          reporter_id: string
          selected_choice_text?: string | null
          status?: Database["public"]["Enums"]["feedback_report_status_enum"]
        }
        Update: {
          category?: Database["public"]["Enums"]["feedback_report_category_enum"]
          content?: string
          created_at?: string
          creator_id?: string
          id?: string
          question_id?: string
          question_text?: string
          quiz_id?: string
          quiz_title?: string
          reporter_id?: string
          selected_choice_text?: string | null
          status?: Database["public"]["Enums"]["feedback_report_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_reports_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flags_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      genre_requests: {
        Row: {
          created_at: string
          created_by: string | null
          details: Json | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "genre_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          completed_at: string
          display_name: string
          elapsed_seconds: number
          id: string
          quiz_id: string
          score: number
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          display_name: string
          elapsed_seconds: number
          id?: string
          quiz_id: string
          score: number
          type: string
          user_id: string
        }
        Update: {
          completed_at?: string
          display_name?: string
          elapsed_seconds?: number
          id?: string
          quiz_id?: string
          score?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_requests: {
        Row: {
          created_at: string
          created_by: string | null
          details: Json | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merge_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      metadata_genres: {
        Row: {
          canonical_id: string | null
          created_at: string
          description: string | null
          display_name: string
          icon_image_url: string | null
          id: string
          is_active: boolean
          merged_genre_ids: string[] | null
        }
        Insert: {
          canonical_id?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          icon_image_url?: string | null
          id: string
          is_active?: boolean
          merged_genre_ids?: string[] | null
        }
        Update: {
          canonical_id?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          icon_image_url?: string | null
          id?: string
          is_active?: boolean
          merged_genre_ids?: string[] | null
        }
        Relationships: []
      }
      metadata_tags: {
        Row: {
          canonical_id: string | null
          created_at: string
          created_by: string | null
          id: string
          merged_tag_ids: string[] | null
          tag_name: string | null
          updated_at: string
        }
        Insert: {
          canonical_id?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          merged_tag_ids?: string[] | null
          tag_name?: string | null
          updated_at?: string
        }
        Update: {
          canonical_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          merged_tag_ids?: string[] | null
          tag_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metadata_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          ai_context_details: string | null
          association_hints: string[] | null
          author_avatar: string | null
          author_id: string | null
          author_name: string | null
          bookmarks_count: number | null
          choices: Json | null
          correct_count: number | null
          correct_text_answer_list: string[] | null
          created_at: string
          explanation: string
          hint: string | null
          id: string
          image_url: string | null
          incorrect_count: number | null
          limit_time: number | null
          link_kind: string | null
          question_text: string
          quiz_id: string | null
          sorting_items: Json | null
          source_url: string | null
          text_input_char_count: number | null
          text_input_mode: string | null
          truth_keywords: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          ai_context_details?: string | null
          association_hints?: string[] | null
          author_avatar?: string | null
          author_id?: string | null
          author_name?: string | null
          bookmarks_count?: number | null
          choices?: Json | null
          correct_count?: number | null
          correct_text_answer_list?: string[] | null
          created_at?: string
          explanation: string
          hint?: string | null
          id?: string
          image_url?: string | null
          incorrect_count?: number | null
          limit_time?: number | null
          link_kind?: string | null
          question_text: string
          quiz_id?: string | null
          sorting_items?: Json | null
          source_url?: string | null
          text_input_char_count?: number | null
          text_input_mode?: string | null
          truth_keywords?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          ai_context_details?: string | null
          association_hints?: string[] | null
          author_avatar?: string | null
          author_id?: string | null
          author_name?: string | null
          bookmarks_count?: number | null
          choices?: Json | null
          correct_count?: number | null
          correct_text_answer_list?: string[] | null
          created_at?: string
          explanation?: string
          hint?: string | null
          id?: string
          image_url?: string | null
          incorrect_count?: number | null
          limit_time?: number | null
          link_kind?: string | null
          question_text?: string
          quiz_id?: string | null
          sorting_items?: Json | null
          source_url?: string | null
          text_input_char_count?: number | null
          text_input_mode?: string | null
          truth_keywords?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_lists: {
        Row: {
          author_id: string
          created_at: string
          description: string | null
          id: string
          list_type: string | null
          quiz_ids: string[] | null
          title: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string | null
          id?: string
          list_type?: string | null
          quiz_ids?: string[] | null
          title: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string | null
          id?: string
          list_type?: string | null
          quiz_ids?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_lists_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          quiz_id: string
          rating: number | null
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id: string
          quiz_id: string
          rating?: number | null
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          quiz_id?: string
          rating?: number | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_reviews_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          active_reset_request_id: string | null
          author_avatar: string | null
          author_id: string
          author_name: string
          bookmarks_count: number | null
          canonical_genre_id: string
          canonical_tag_ids: string[] | null
          created_at: string
          description: string
          difficulty: number
          flags_count: number | null
          format: string | null
          genre: string
          id: string
          is_review_masked: boolean | null
          negative_count: number | null
          original_tags: string[] | null
          play_count: number | null
          positive_count: number | null
          question_count: number | null
          question_ids: string[] | null
          questions: Json | null
          review_badge: string | null
          review_score: number | null
          status: Database["public"]["Enums"]["quiz_status_enum"]
          tags: string[] | null
          temp_negative_count: number | null
          temp_positive_count: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["quiz_visibility_enum"]
        }
        Insert: {
          active_reset_request_id?: string | null
          author_avatar?: string | null
          author_id: string
          author_name: string
          bookmarks_count?: number | null
          canonical_genre_id: string
          canonical_tag_ids?: string[] | null
          created_at?: string
          description: string
          difficulty: number
          flags_count?: number | null
          format?: string | null
          genre: string
          id?: string
          is_review_masked?: boolean | null
          negative_count?: number | null
          original_tags?: string[] | null
          play_count?: number | null
          positive_count?: number | null
          question_count?: number | null
          question_ids?: string[] | null
          questions?: Json | null
          review_badge?: string | null
          review_score?: number | null
          status?: Database["public"]["Enums"]["quiz_status_enum"]
          tags?: string[] | null
          temp_negative_count?: number | null
          temp_positive_count?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["quiz_visibility_enum"]
        }
        Update: {
          active_reset_request_id?: string | null
          author_avatar?: string | null
          author_id?: string
          author_name?: string
          bookmarks_count?: number | null
          canonical_genre_id?: string
          canonical_tag_ids?: string[] | null
          created_at?: string
          description?: string
          difficulty?: number
          flags_count?: number | null
          format?: string | null
          genre?: string
          id?: string
          is_review_masked?: boolean | null
          negative_count?: number | null
          original_tags?: string[] | null
          play_count?: number | null
          positive_count?: number | null
          question_count?: number | null
          question_ids?: string[] | null
          questions?: Json | null
          review_badge?: string | null
          review_score?: number | null
          status?: Database["public"]["Enums"]["quiz_status_enum"]
          tags?: string[] | null
          temp_negative_count?: number | null
          temp_positive_count?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["quiz_visibility_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          badges: Json | null
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          created_at: string
          created_quizzes_count: number | null
          current_period_end: string | null
          delete_status: string | null
          display_name: string
          email: string
          followed_genres: string[] | null
          followers_count: number | null
          following_count: number | null
          id: string
          is_banned: boolean | null
          is_premium: boolean | null
          last_reputation_calculated_at: string | null
          moderation_tier:
            | Database["public"]["Enums"]["moderation_tier_enum"]
            | null
          reputation_history: Json | null
          reputation_score: number | null
          role: string | null
          sns_links: Json | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          total_failed_questions_count: number | null
          total_play_count: number | null
          total_reactions_count: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          badges?: Json | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          created_quizzes_count?: number | null
          current_period_end?: string | null
          delete_status?: string | null
          display_name: string
          email: string
          followed_genres?: string[] | null
          followers_count?: number | null
          following_count?: number | null
          id: string
          is_banned?: boolean | null
          is_premium?: boolean | null
          last_reputation_calculated_at?: string | null
          moderation_tier?:
            | Database["public"]["Enums"]["moderation_tier_enum"]
            | null
          reputation_history?: Json | null
          reputation_score?: number | null
          role?: string | null
          sns_links?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          total_failed_questions_count?: number | null
          total_play_count?: number | null
          total_reactions_count?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          badges?: Json | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          created_quizzes_count?: number | null
          current_period_end?: string | null
          delete_status?: string | null
          display_name?: string
          email?: string
          followed_genres?: string[] | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          is_banned?: boolean | null
          is_premium?: boolean | null
          last_reputation_calculated_at?: string | null
          moderation_tier?:
            | Database["public"]["Enums"]["moderation_tier_enum"]
            | null
          reputation_history?: Json | null
          reputation_score?: number | null
          role?: string | null
          sns_links?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          total_failed_questions_count?: number | null
          total_play_count?: number | null
          total_reactions_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_not_banned: { Args: never; Returns: boolean }
    }
    Enums: {
      admin_log_action_enum: "reputation_reset" | "ban" | "unban"
      announcement_category_enum:
        | "info"
        | "maintenance"
        | "update"
        | "bug"
        | "important"
      bookmark_target_type_enum: "quiz" | "question"
      feedback_report_category_enum: "typo" | "fact" | "alternative"
      feedback_report_status_enum: "open" | "resolved" | "rejected"
      moderation_tier_enum:
        | "newcomer"
        | "contributor"
        | "moderator"
        | "senior_moderator"
        | "admin"
      quiz_status_enum: "draft" | "published" | "suspended"
      quiz_visibility_enum: "public" | "private" | "followers"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_log_action_enum: ["reputation_reset", "ban", "unban"],
      announcement_category_enum: [
        "info",
        "maintenance",
        "update",
        "bug",
        "important",
      ],
      bookmark_target_type_enum: ["quiz", "question"],
      feedback_report_category_enum: ["typo", "fact", "alternative"],
      feedback_report_status_enum: ["open", "resolved", "rejected"],
      moderation_tier_enum: [
        "newcomer",
        "contributor",
        "moderator",
        "senior_moderator",
        "admin",
      ],
      quiz_status_enum: ["draft", "published", "suspended"],
      quiz_visibility_enum: ["public", "private", "followers"],
    },
  },
} as const

