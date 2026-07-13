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
      ai_turn_counts_global: {
        Row: {
          count: number
          count_date: string
          user_id: string
        }
        Insert: {
          count?: number
          count_date: string
          user_id: string
        }
        Update: {
          count?: number
          count_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_turn_counts_global_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_turn_counts_per_quiz: {
        Row: {
          count: number
          count_date: string
          quiz_id: string
          user_id: string
        }
        Insert: {
          count?: number
          count_date: string
          quiz_id: string
          user_id: string
        }
        Update: {
          count?: number
          count_date?: string
          quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_turn_counts_per_quiz_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_turn_counts_per_quiz_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_outbox: {
        Row: {
          event_id: string
          event_type: string
          last_error: string | null
          occurred_at: string
          payload: Json
          retry_count: number
          sent_at: string | null
          status: string
          table_name: string
        }
        Insert: {
          event_id?: string
          event_type: string
          last_error?: string | null
          occurred_at?: string
          payload: Json
          retry_count?: number
          sent_at?: string | null
          status?: string
          table_name: string
        }
        Update: {
          event_id?: string
          event_type?: string
          last_error?: string | null
          occurred_at?: string
          payload?: Json
          retry_count?: number
          sent_at?: string | null
          status?: string
          table_name?: string
        }
        Relationships: []
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
          completed_at: string | null
          difficulty_vote: number | null
          elapsed_seconds: number
          failed_question_ids: string[] | null
          gave_up_lateral: boolean | null
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
          completed_at?: string | null
          difficulty_vote?: number | null
          elapsed_seconds: number
          failed_question_ids?: string[] | null
          gave_up_lateral?: boolean | null
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
          completed_at?: string | null
          difficulty_vote?: number | null
          elapsed_seconds?: number
          failed_question_ids?: string[] | null
          gave_up_lateral?: boolean | null
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
      badges: {
        Row: {
          description: string
          icon_name: string
          id: string
          title: string
        }
        Insert: {
          description: string
          icon_name: string
          id: string
          title: string
        }
        Update: {
          description?: string
          icon_name?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          target_id: string
          target_type: Database["public"]["Enums"]["bookmark_target_type_enum"]
          user_id: string
        }
        Insert: {
          created_at?: string
          target_id: string
          target_type: Database["public"]["Enums"]["bookmark_target_type_enum"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      daily_usage_counters: {
        Row: {
          count: number
          counter_date: string
          counter_key: string
          user_id: string
        }
        Insert: {
          count?: number
          counter_date: string
          counter_key: string
          user_id: string
        }
        Update: {
          count?: number
          counter_date?: string
          counter_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_usage_counters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      difficulty_votes: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          updated_at: string
          user_id: string | null
          vote: number
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          updated_at?: string
          user_id?: string | null
          vote: number
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          updated_at?: string
          user_id?: string | null
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "difficulty_votes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "difficulty_votes_user_id_fkey"
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
          question_id: string | null
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
          question_id?: string | null
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
          question_id?: string | null
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
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
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
      genre_request_votes: {
        Row: {
          opinion: string
          request_id: string
          voted_at: string
          voter_id: string
          weight: number
        }
        Insert: {
          opinion: string
          request_id: string
          voted_at?: string
          voter_id: string
          weight: number
        }
        Update: {
          opinion?: string
          request_id?: string
          voted_at?: string
          voter_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "genre_request_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "genre_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genre_request_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      genre_requests: {
        Row: {
          created_at: string
          description: string
          display_name: string
          genre_id: string
          icon_image_url: string | null
          id: string
          requester_id: string | null
          status: string
          updated_at: string
          votes_against_count: number
          votes_for_count: number
          weighted_votes_against: number
          weighted_votes_for: number
        }
        Insert: {
          created_at?: string
          description?: string
          display_name: string
          genre_id: string
          icon_image_url?: string | null
          id?: string
          requester_id?: string | null
          status?: string
          updated_at?: string
          votes_against_count?: number
          votes_for_count?: number
          weighted_votes_against?: number
          weighted_votes_for?: number
        }
        Update: {
          created_at?: string
          description?: string
          display_name?: string
          genre_id?: string
          icon_image_url?: string | null
          id?: string
          requester_id?: string | null
          status?: string
          updated_at?: string
          votes_against_count?: number
          votes_for_count?: number
          weighted_votes_against?: number
          weighted_votes_for?: number
        }
        Relationships: [
          {
            foreignKeyName: "genre_requests_created_by_fkey"
            columns: ["requester_id"]
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
      merge_request_votes: {
        Row: {
          opinion: string
          request_id: string
          voted_at: string
          voter_id: string
          weight: number
        }
        Insert: {
          opinion: string
          request_id: string
          voted_at?: string
          voter_id: string
          weight: number
        }
        Update: {
          opinion?: string
          request_id?: string
          voted_at?: string
          voter_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "merge_request_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "merge_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_request_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_requests: {
        Row: {
          created_at: string
          id: string
          reason: string
          requester_id: string | null
          source_id: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
          votes_against_count: number
          votes_for_count: number
          weighted_votes_against: number
          weighted_votes_for: number
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string
          requester_id?: string | null
          source_id: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
          votes_against_count?: number
          votes_for_count?: number
          weighted_votes_against?: number
          weighted_votes_for?: number
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          requester_id?: string | null
          source_id?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
          votes_against_count?: number
          votes_for_count?: number
          weighted_votes_against?: number
          weighted_votes_for?: number
        }
        Relationships: [
          {
            foreignKeyName: "merge_requests_created_by_fkey"
            columns: ["requester_id"]
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
      ng_words: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          normalized_word: string
          updated_at: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_word: string
          updated_at?: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_word?: string
          updated_at?: string
          word?: string
        }
        Relationships: []
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
          owner_quiz_id: string | null
          question_text: string
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
          owner_quiz_id?: string | null
          question_text: string
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
          owner_quiz_id?: string | null
          question_text?: string
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
            foreignKeyName: "questions_owner_quiz_id_fkey"
            columns: ["owner_quiz_id"]
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
      quiz_questions: {
        Row: {
          display_order: number
          question_id: string
          quiz_id: string
        }
        Insert: {
          display_order: number
          question_id: string
          quiz_id: string
        }
        Update: {
          display_order?: number
          question_id?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_reviews: {
        Row: {
          created_at: string
          quiz_id: string
          reason: string | null
          reviewer_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          quiz_id: string
          reason?: string | null
          reviewer_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          quiz_id?: string
          reason?: string | null
          reviewer_id?: string
          type?: string
          updated_at?: string
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
      quiz_tags: {
        Row: {
          original_label: string
          quiz_id: string
          tag_id: string
        }
        Insert: {
          original_label: string
          quiz_id: string
          tag_id: string
        }
        Update: {
          original_label?: string
          quiz_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tags_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "metadata_tags"
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
          created_at: string
          description: string
          difficulty: number
          difficulty_votes_count: number
          difficulty_votes_sum: number
          flags_count: number | null
          format: string | null
          genre: string
          id: string
          is_review_masked: boolean | null
          likes_count: number
          negative_count: number | null
          play_count: number | null
          positive_count: number | null
          question_count: number | null
          review_badge: string | null
          review_score: number | null
          status: Database["public"]["Enums"]["quiz_status_enum"]
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
          created_at?: string
          description: string
          difficulty: number
          difficulty_votes_count?: number
          difficulty_votes_sum?: number
          flags_count?: number | null
          format?: string | null
          genre: string
          id?: string
          is_review_masked?: boolean | null
          likes_count?: number
          negative_count?: number | null
          play_count?: number | null
          positive_count?: number | null
          question_count?: number | null
          review_badge?: string | null
          review_score?: number | null
          status?: Database["public"]["Enums"]["quiz_status_enum"]
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
          created_at?: string
          description?: string
          difficulty?: number
          difficulty_votes_count?: number
          difficulty_votes_sum?: number
          flags_count?: number | null
          format?: string | null
          genre?: string
          id?: string
          is_review_masked?: boolean | null
          likes_count?: number
          negative_count?: number | null
          play_count?: number | null
          positive_count?: number | null
          question_count?: number | null
          review_badge?: string | null
          review_score?: number | null
          status?: Database["public"]["Enums"]["quiz_status_enum"]
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
      reactions: {
        Row: {
          created_at: string
          quiz_id: string
          receiver_id: string
          sender_id: string
          type: string
        }
        Insert: {
          created_at?: string
          quiz_id: string
          receiver_id: string
          sender_id: string
          type: string
        }
        Update: {
          created_at?: string
          quiz_id?: string
          receiver_id?: string
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_limits: {
        Row: {
          author_id: string
          sender_id: string
          total_delta: number
        }
        Insert: {
          author_id: string
          sender_id: string
          total_delta?: number
        }
        Update: {
          author_id?: string
          sender_id?: string
          total_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "reputation_limits_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_limits_sender_id_fkey"
            columns: ["sender_id"]
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
      stripe_processed_events: {
        Row: {
          event_id: string
          processed_at: string
          type: string
        }
        Insert: {
          event_id: string
          processed_at?: string
          type: string
        }
        Update: {
          event_id?: string
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_genre_follows: {
        Row: {
          created_at: string
          genre_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          genre_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          genre_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_genre_follows_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "metadata_genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_genre_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          category: string
          created_at: string
          detail: string
          id: string
          reporter_id: string
          status: string
          target_uid: string
        }
        Insert: {
          category: string
          created_at?: string
          detail: string
          id?: string
          reporter_id: string
          status?: string
          target_uid: string
        }
        Update: {
          category?: string
          created_at?: string
          detail?: string
          id?: string
          reporter_id?: string
          status?: string
          target_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_target_uid_fkey"
            columns: ["target_uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          created_at: string
          created_quizzes_count: number | null
          current_period_end: string | null
          delete_status: string | null
          display_name: string
          email: string
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
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          created_quizzes_count?: number | null
          current_period_end?: string | null
          delete_status?: string | null
          display_name: string
          email: string
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
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          created_quizzes_count?: number | null
          current_period_end?: string | null
          delete_status?: string | null
          display_name?: string
          email?: string
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
      analytics_export_purge_sent: { Args: never; Returns: undefined }
      analytics_export_retry_notify: { Args: never; Returns: undefined }
      claim_pending_analytics_events: {
        Args: { p_batch_size?: number }
        Returns: {
          event_id: string
          event_type: string
          occurred_at: string
          payload: Json
          retry_count: number
          table_name: string
        }[]
      }
      delete_genre_with_reassignment: {
        Args: { p_genre_id: string; p_reassign_to_id?: string }
        Returns: number
      }
      get_banned_users: {
        Args: {
          p_banned_from: string
          p_banned_to: string
          p_keyword: string
          p_limit: number
          p_offset: number
        }
        Returns: {
          banned_at: string
          banned_by_executor_id: string
          banned_reason: string
          display_name: string
          uid: string
        }[]
      }
      get_reported_users_ranking: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          display_name: string
          is_banned: boolean
          latest_report_at: string
          moderation_tier: Database["public"]["Enums"]["moderation_tier_enum"]
          total_report_count: number
          uid: string
        }[]
      }
      get_user_admin_logs: {
        Args: { p_target_uid: string }
        Returns: {
          action: Database["public"]["Enums"]["admin_log_action_enum"]
          created_at: string
          executor_id: string
          id: string
          reason: string
        }[]
      }
      get_user_open_report_count: {
        Args: { p_target_uid: string }
        Returns: number
      }
      handle_adjust_failed_questions_count: {
        Args: { p_delta: number; p_user_id: string }
        Returns: undefined
      }
      handle_ban_user: {
        Args: { p_reason: string; p_target_uid: string }
        Returns: undefined
      }
      handle_bookmark_toggle: {
        Args: { p_target_id: string; p_target_type: string; p_user_id: string }
        Returns: boolean
      }
      handle_check_and_award_badges: {
        Args: { p_badge_ids: string[]; p_user_id: string }
        Returns: string[]
      }
      handle_complete_lateral_attempt: {
        Args: {
          p_attempt_id: string
          p_elapsed_seconds: number
          p_is_correct: boolean
          p_quiz_id: string
          p_total_questions: number
          p_truth_attempt: Json
          p_user_id: string
        }
        Returns: undefined
      }
      handle_create_merge_request: {
        Args: {
          p_reason: string
          p_source_id: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      handle_create_ng_word: {
        Args: { p_word: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          normalized_word: string
          updated_at: string
          word: string
        }
        SetofOptions: {
          from: "*"
          to: "ng_words"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      handle_downgrade_tier: {
        Args: {
          p_new_tier: Database["public"]["Enums"]["moderation_tier_enum"]
          p_reason: string
          p_target_uid: string
        }
        Returns: undefined
      }
      handle_flag_content: {
        Args: { p_quiz_id: string; p_reason: string }
        Returns: undefined
      }
      handle_follow_user: {
        Args: { p_follower_id: string; p_following_id: string }
        Returns: boolean
      }
      handle_give_up_lateral_attempt: {
        Args: {
          p_attempt_id: string
          p_elapsed_seconds: number
          p_quiz_id: string
        }
        Returns: undefined
      }
      handle_increment_daily_usage_counter: {
        Args: { p_counter_key: string; p_today: string; p_user_id: string }
        Returns: number
      }
      handle_record_ai_turn: {
        Args: {
          p_attempt_id: string
          p_global_limit: number
          p_history_entry: Json
          p_per_quiz_limit: number
          p_quiz_id: string
          p_user_id: string
        }
        Returns: {
          global_count: number
          per_quiz_count: number
        }[]
      }
      handle_remove_failed_questions: {
        Args: {
          p_quiz_id: string
          p_solved_question_ids: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      handle_reorder_questions: {
        Args: { p_question_ids: string[]; p_quiz_id: string }
        Returns: number
      }
      handle_report_user: {
        Args: { p_category: string; p_detail: string; p_target_uid: string }
        Returns: undefined
      }
      handle_reset_user_reports: {
        Args: { p_reason: string; p_target_uid: string }
        Returns: undefined
      }
      handle_reset_user_reputation: {
        Args: { p_reason: string; p_target_uid: string }
        Returns: undefined
      }
      handle_resolve_flag: {
        Args: { p_action: string; p_quiz_id: string }
        Returns: undefined
      }
      handle_retract_review: {
        Args: { p_quiz_id: string; p_reviewer_id: string }
        Returns: undefined
      }
      handle_save_attempt: {
        Args: {
          p_elapsed_seconds: number
          p_failed_question_ids: string[]
          p_mode: string
          p_question_answer_details: Json
          p_question_answers: Json
          p_quiz_id: string
          p_score: number
          p_total_questions: number
          p_user_id: string
        }
        Returns: string
      }
      handle_set_ng_word_active: {
        Args: { p_id: string; p_is_active: boolean }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          normalized_word: string
          updated_at: string
          word: string
        }
        SetofOptions: {
          from: "*"
          to: "ng_words"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      handle_start_lateral_attempt: {
        Args: {
          p_ai_turn_limit: number
          p_quiz_id: string
          p_total_questions: number
          p_user_id: string
        }
        Returns: string
      }
      handle_submit_difficulty_vote: {
        Args: { p_quiz_id: string; p_user_id: string; p_vote: number }
        Returns: undefined
      }
      handle_submit_genre_request: {
        Args: {
          p_description: string
          p_display_name: string
          p_genre_id: string
          p_icon_image_url: string
        }
        Returns: string
      }
      handle_submit_review: {
        Args: {
          p_quiz_id: string
          p_reason: string
          p_reviewer_id: string
          p_type: string
        }
        Returns: undefined
      }
      handle_toggle_reaction: {
        Args: { p_quiz_id: string; p_sender_id: string }
        Returns: boolean
      }
      handle_unban_user: { Args: { p_target_uid: string }; Returns: undefined }
      handle_unfollow_user: {
        Args: { p_follower_id: string; p_following_id: string }
        Returns: boolean
      }
      handle_update_feedback_report: {
        Args: {
          p_category: string
          p_content: string
          p_report_id: string
          p_reporter_id: string
        }
        Returns: undefined
      }
      handle_update_ng_word: {
        Args: { p_id: string; p_word: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          normalized_word: string
          updated_at: string
          word: string
        }
        SetofOptions: {
          from: "*"
          to: "ng_words"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      handle_vote_genre_request: {
        Args: { p_opinion: string; p_request_id: string }
        Returns: undefined
      }
      handle_vote_merge_request: {
        Args: { p_opinion: string; p_request_id: string }
        Returns: undefined
      }
      increment_analytics_outbox_retry: {
        Args: { p_error?: string; p_event_ids: string[] }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_moderator_or_admin: { Args: never; Returns: boolean }
      is_not_banned: { Args: never; Returns: boolean }
      notify_analytics_export: { Args: never; Returns: undefined }
      record_leaderboard_entry: {
        Args: {
          p_board: string
          p_display_name: string
          p_elapsed_seconds: number
          p_quiz_id: string
          p_score: number
          p_user_id: string
        }
        Returns: undefined
      }
      resolve_vote_weight: { Args: { p_user_id: string }; Returns: number }
    }
    Enums: {
      admin_log_action_enum:
        | "reputation_reset"
        | "ban"
        | "unban"
        | "tier_downgrade"
        | "report_reset"
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
      admin_log_action_enum: [
        "reputation_reset",
        "ban",
        "unban",
        "tier_downgrade",
        "report_reset",
      ],
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

