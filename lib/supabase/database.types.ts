export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  private: {
    Tables: {
      account_number_configuration: {
        Row: {
          created_at: string
          created_by: string
          prefix: string
          singleton: boolean
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          prefix: string
          singleton?: boolean
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          prefix?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      client_purge_entity_manifest: {
        Row: {
          challenge_id: string
          entity_id: string
          entity_type: string
        }
        Insert: {
          challenge_id: string
          entity_id: string
          entity_type: string
        }
        Update: {
          challenge_id?: string
          entity_id?: string
          entity_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_purge_entity_manifest_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "client_purge_operations"
            referencedColumns: ["challenge_id"]
          },
        ]
      }
      client_purge_operations: {
        Row: {
          actor_id: string
          challenge_digest: string
          challenge_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          idempotency_key: string
          ignored_unsafe_storage_references: number
          last_error_code: string | null
          prefix_claim_token: string | null
          prefix_claimed_at: string | null
          reference_after_bucket: string | null
          reference_after_object_path: string | null
          reference_claim_token: string | null
          reference_claimed_at: string | null
          retry_after: string | null
          scope_digest: string | null
          stage: string
          status: string
          storage_cycle_stage: string | null
          storage_phase: string
          support_email_manifest: Json
          sweep_not_before: string | null
          target_email: string
          target_email_digest: string
          target_user_id: string
          updated_at: string
          verify_prefix_index: number
        }
        Insert: {
          actor_id: string
          challenge_digest: string
          challenge_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          idempotency_key: string
          ignored_unsafe_storage_references?: number
          last_error_code?: string | null
          prefix_claim_token?: string | null
          prefix_claimed_at?: string | null
          reference_after_bucket?: string | null
          reference_after_object_path?: string | null
          reference_claim_token?: string | null
          reference_claimed_at?: string | null
          retry_after?: string | null
          scope_digest?: string | null
          stage?: string
          status?: string
          storage_cycle_stage?: string | null
          storage_phase?: string
          support_email_manifest?: Json
          sweep_not_before?: string | null
          target_email: string
          target_email_digest: string
          target_user_id: string
          updated_at?: string
          verify_prefix_index?: number
        }
        Update: {
          actor_id?: string
          challenge_digest?: string
          challenge_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          idempotency_key?: string
          ignored_unsafe_storage_references?: number
          last_error_code?: string | null
          prefix_claim_token?: string | null
          prefix_claimed_at?: string | null
          reference_after_bucket?: string | null
          reference_after_object_path?: string | null
          reference_claim_token?: string | null
          reference_claimed_at?: string | null
          retry_after?: string | null
          scope_digest?: string | null
          stage?: string
          status?: string
          storage_cycle_stage?: string | null
          storage_phase?: string
          support_email_manifest?: Json
          sweep_not_before?: string | null
          target_email?: string
          target_email_digest?: string
          target_user_id?: string
          updated_at?: string
          verify_prefix_index?: number
        }
        Relationships: []
      }
      client_purge_storage_manifest: {
        Row: {
          bucket: string
          challenge_id: string
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          deleted_at: string | null
          object_path: string
          ownership_scope: string
          processing_status: string
          verified_at: string | null
        }
        Insert: {
          bucket: string
          challenge_id: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          object_path: string
          ownership_scope: string
          processing_status?: string
          verified_at?: string | null
        }
        Update: {
          bucket?: string
          challenge_id?: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          object_path?: string
          ownership_scope?: string
          processing_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_purge_storage_manifest_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "client_purge_operations"
            referencedColumns: ["challenge_id"]
          },
        ]
      }
      client_purge_storage_scan_queue: {
        Row: {
          bucket: string
          challenge_id: string
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          cycle_stage: string
          id: number
          next_offset: number
          prefix: string
          status: string
          updated_at: string
        }
        Insert: {
          bucket: string
          challenge_id: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          cycle_stage: string
          id?: never
          next_offset?: number
          prefix: string
          status?: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          challenge_id?: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          cycle_stage?: string
          id?: never
          next_offset?: number
          prefix?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_purge_storage_scan_queue_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "client_purge_operations"
            referencedColumns: ["challenge_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_internal_account_number: { Args: never; Returns: string }
      audit_event_matches_client: {
        Args: {
          p_actor_id: string
          p_challenge_id: string
          p_entity_id: string
          p_entity_type: string
          p_metadata: Json
          p_target_user_id: string
        }
        Returns: boolean
      }
      claim_transactional_emails_internal: {
        Args: { p_limit: number; p_recipient_id: string }
        Returns: Database["public"]["Tables"]["transactional_email_outbox"]["Row"][]
        SetofOptions: {
          from: "*"
          to: "transactional_email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      client_purge_lock_key: { Args: { p_owner_id: string }; Returns: number }
      client_purge_residuals: {
        Args: { p_challenge_id: string; p_target_user_id: string }
        Returns: Json
      }
      client_purge_scope_digest: {
        Args: {
          p_challenge_id: string
          p_support_emails: Json
          p_target_user_id: string
        }
        Returns: string
      }
      client_purge_storage_lock_key: {
        Args: { p_bucket: string; p_object_path: string }
        Returns: number
      }
      client_purge_storage_references: {
        Args: { p_target_user_id: string }
        Returns: {
          bucket: string
          object_path: string
          ownership_scope: string
          ownership_valid: boolean
        }[]
      }
      ensure_active_user: { Args: never; Returns: string }
      ensure_branch_manager: { Args: never; Returns: string }
      initialize_client_purge_storage_cycle: {
        Args: {
          p_challenge_id: string
          p_cycle_stage: string
          p_target_user_id: string
        }
        Returns: undefined
      }
      is_active_staff: { Args: { required_roles?: string[] }; Returns: boolean }
      is_client_storage_object_key: {
        Args: { p_owner_id: string; p_path: string }
        Returns: boolean
      }
      is_client_storage_path: {
        Args: { p_owner_id: string; p_path: string }
        Returns: boolean
      }
      is_valid_iban: { Args: { p_iban: string }; Returns: boolean }
      lock_client_mutation: { Args: { p_owner_id: string }; Returns: undefined }
      new_document_paths_are_owned: {
        Args: { p_new_paths: Json; p_old_paths?: Json; p_owner_id: string }
        Returns: boolean
      }
      normalize_iban: { Args: { p_iban: string }; Returns: string }
      refresh_client_purge_entity_manifest: {
        Args: { p_challenge_id: string; p_target_user_id: string }
        Returns: undefined
      }
      require_active_purge_admin: {
        Args: { p_actor_id: string }
        Returns: undefined
      }
      seed_client_purge_storage_roots: {
        Args: {
          p_challenge_id: string
          p_cycle_stage: string
          p_target_user_id: string
        }
        Returns: undefined
      }
      try_guard_client_mutation: {
        Args: { p_owner_id: string }
        Returns: undefined
      }
      uuid_or_null: { Args: { p_value: string }; Returns: string }
      validate_kyc_submission: {
        Args: {
          p_address: Json
          p_date_of_birth: string
          p_document_expires_on: string
          p_document_number: string
          p_document_object_paths: Json
          p_document_type: string
          p_first_name: string
          p_income_range: string
          p_issuing_country: string
          p_last_name: string
          p_nationality: string
          p_occupation: string
          p_place_of_birth: string
        }
        Returns: undefined
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
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      brand_settings: {
        Row: {
          app_icon_192_path: string
          app_icon_512_path: string
          apple_touch_icon_path: string
          bank_name: string
          created_at: string
          email_logo_path: string
          favicon_16_path: string
          favicon_32_path: string
          favicon_48_path: string
          favicon_ico_path: string
          maskable_icon_path: string
          pdf_logo_path: string
          primary_logo_height: number
          primary_logo_path: string
          primary_logo_width: number
          reversed_logo_height: number
          reversed_logo_path: string
          reversed_logo_width: number
          revision: number
          singleton: boolean
          social_card_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_icon_192_path: string
          app_icon_512_path: string
          apple_touch_icon_path: string
          bank_name: string
          created_at?: string
          email_logo_path: string
          favicon_16_path: string
          favicon_32_path: string
          favicon_48_path: string
          favicon_ico_path: string
          maskable_icon_path: string
          pdf_logo_path: string
          primary_logo_height: number
          primary_logo_path: string
          primary_logo_width: number
          reversed_logo_height: number
          reversed_logo_path: string
          reversed_logo_width: number
          revision?: number
          singleton?: boolean
          social_card_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_icon_192_path?: string
          app_icon_512_path?: string
          apple_touch_icon_path?: string
          bank_name?: string
          created_at?: string
          email_logo_path?: string
          favicon_16_path?: string
          favicon_32_path?: string
          favicon_48_path?: string
          favicon_ico_path?: string
          maskable_icon_path?: string
          pdf_logo_path?: string
          primary_logo_height?: number
          primary_logo_path?: string
          primary_logo_width?: number
          reversed_logo_height?: number
          reversed_logo_path?: string
          reversed_logo_width?: number
          revision?: number
          singleton?: boolean
          social_card_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      external_loan_fundings: {
        Row: {
          confirmation_note: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          evidence_object_path: string
          executed_at: string
          executed_by: string
          execution_note: string | null
          external_reference: string
          loan_id: string
          recorded_at: string
        }
        Insert: {
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          evidence_object_path: string
          executed_at: string
          executed_by: string
          execution_note?: string | null
          external_reference: string
          loan_id: string
          recorded_at?: string
        }
        Update: {
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          evidence_object_path?: string
          executed_at?: string
          executed_by?: string
          execution_note?: string | null
          external_reference?: string
          loan_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_loan_fundings_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "external_loan_fundings_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "external_loan_fundings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      external_transfer_executions: {
        Row: {
          confirmation_note: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          evidence_object_path: string
          executed_at: string
          executed_by: string
          execution_note: string | null
          external_reference: string
          recorded_at: string
          transfer_id: string
        }
        Insert: {
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          evidence_object_path: string
          executed_at: string
          executed_by: string
          execution_note?: string | null
          external_reference: string
          recorded_at?: string
          transfer_id: string
        }
        Update: {
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          evidence_object_path?: string
          executed_at?: string
          executed_by?: string
          execution_note?: string | null
          external_reference?: string
          recorded_at?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_transfer_executions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "external_transfer_executions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "external_transfer_executions_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: true
            referencedRelation: "transfer_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger_entries: {
        Row: {
          account_id: string
          amount_minor: number
          balance_after_minor: number
          balance_before_minor: number
          booked_at: string
          booked_by: string | null
          created_at: string
          currency: string
          description: string
          entry_key: string
          entry_kind: string
          id: string
          internal_reference: string | null
          metadata: Json
          owner_id: string
          sequence_no: number
          source_loan_id: string | null
          source_transfer_id: string | null
          value_date: string
        }
        Insert: {
          account_id: string
          amount_minor: number
          balance_after_minor: number
          balance_before_minor: number
          booked_at?: string
          booked_by?: string | null
          created_at?: string
          currency: string
          description: string
          entry_key: string
          entry_kind: string
          id?: string
          internal_reference?: string | null
          metadata?: Json
          owner_id: string
          sequence_no: number
          source_loan_id?: string | null
          source_transfer_id?: string | null
          value_date: string
        }
        Update: {
          account_id?: string
          amount_minor?: number
          balance_after_minor?: number
          balance_before_minor?: number
          booked_at?: string
          booked_by?: string | null
          created_at?: string
          currency?: string
          description?: string
          entry_key?: string
          entry_kind?: string
          id?: string
          internal_reference?: string | null
          metadata?: Json
          owner_id?: string
          sequence_no?: number
          source_loan_id?: string | null
          source_transfer_id?: string | null
          value_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_source_loan_id_fkey"
            columns: ["source_loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_source_transfer_id_fkey"
            columns: ["source_transfer_id"]
            isOneToOne: false
            referencedRelation: "transfer_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_positions: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          account_status: string
          account_type: string
          amount_minor: number
          as_of: string
          bic: string | null
          branch_code: string | null
          branch_name: string | null
          created_at: string
          currency: string
          declaration_idempotency_key: string | null
          declared_by: string | null
          external_identifier_masked: string | null
          iban: string | null
          id: string
          institution_name: string | null
          is_demo: boolean
          label: string
          opened_at: string | null
          owner_id: string
          position_kind: string
          reserved_minor: number
          source_kyc_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          account_status?: string
          account_type?: string
          amount_minor?: number
          as_of?: string
          bic?: string | null
          branch_code?: string | null
          branch_name?: string | null
          created_at?: string
          currency: string
          declaration_idempotency_key?: string | null
          declared_by?: string | null
          external_identifier_masked?: string | null
          iban?: string | null
          id?: string
          institution_name?: string | null
          is_demo?: boolean
          label: string
          opened_at?: string | null
          owner_id: string
          position_kind?: string
          reserved_minor?: number
          source_kyc_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          account_status?: string
          account_type?: string
          amount_minor?: number
          as_of?: string
          bic?: string | null
          branch_code?: string | null
          branch_name?: string | null
          created_at?: string
          currency?: string
          declaration_idempotency_key?: string | null
          declared_by?: string | null
          external_identifier_masked?: string | null
          iban?: string | null
          id?: string
          institution_name?: string | null
          is_demo?: boolean
          label?: string
          opened_at?: string | null
          owner_id?: string
          position_kind?: string
          reserved_minor?: number
          source_kyc_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_positions_declared_by_fkey"
            columns: ["declared_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "financial_positions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "financial_positions_source_kyc_id_fkey"
            columns: ["source_kyc_id"]
            isOneToOne: false
            referencedRelation: "kyc_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_applications: {
        Row: {
          address: Json
          correction_due_at: string | null
          correction_reason_code: string | null
          date_of_birth: string
          document_expires_on: string | null
          document_number: string | null
          document_object_paths: Json
          document_type: string | null
          fatca: boolean
          first_name: string
          id: string
          idempotency_key: string
          income_range: string
          issuing_country: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        Insert: {
          address: Json
          correction_due_at?: string | null
          correction_reason_code?: string | null
          date_of_birth: string
          document_expires_on?: string | null
          document_number?: string | null
          document_object_paths: Json
          document_type?: string | null
          fatca: boolean
          first_name: string
          id?: string
          idempotency_key: string
          income_range: string
          issuing_country?: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items?: string[]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          address?: Json
          correction_due_at?: string | null
          correction_reason_code?: string | null
          date_of_birth?: string
          document_expires_on?: string | null
          document_number?: string | null
          document_object_paths?: Json
          document_type?: string | null
          fatca?: boolean
          first_name?: string
          id?: string
          idempotency_key?: string
          income_range?: string
          issuing_country?: string | null
          last_name?: string
          nationality?: string
          occupation?: string
          owner_id?: string
          pep?: boolean
          place_of_birth?: string
          requested_items?: string[]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kyc_applications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "kyc_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kyc_drafts: {
        Row: {
          created_at: string
          current_step: number
          document_object_paths: Json
          owner_id: string
          payload: Json
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          document_object_paths?: Json
          owner_id: string
          payload?: Json
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          document_object_paths?: Json
          owner_id?: string
          payload?: Json
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kyc_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          kyc_id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          kyc_id: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          kyc_id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_events_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "kyc_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_review_checklists: {
        Row: {
          adulthood: string
          created_at: string
          data_consistency: string
          document_quality: string
          fatca: string
          internal_comments: string | null
          kyc_id: string
          pep: string
          selfie_match: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adulthood?: string
          created_at?: string
          data_consistency?: string
          document_quality?: string
          fatca?: string
          internal_comments?: string | null
          kyc_id: string
          pep?: string
          selfie_match?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adulthood?: string
          created_at?: string
          data_consistency?: string
          document_quality?: string
          fatca?: string
          internal_comments?: string | null
          kyc_id?: string
          pep?: string
          selfie_match?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_review_checklists_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: true
            referencedRelation: "kyc_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_review_checklists_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          credited_position_id: string | null
          currency: string
          disbursed_at: string | null
          disbursed_by: string | null
          document_object_paths: Json
          duration_months: number
          id: string
          idempotency_key: string
          indicative_annual_rate: number | null
          indicative_monthly_payment_minor: number | null
          internal_disbursement_reference: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        Insert: {
          credited_position_id?: string | null
          currency: string
          disbursed_at?: string | null
          disbursed_by?: string | null
          document_object_paths: Json
          duration_months: number
          id?: string
          idempotency_key: string
          indicative_annual_rate?: number | null
          indicative_monthly_payment_minor?: number | null
          internal_disbursement_reference?: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status?: string
          submitted_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          credited_position_id?: string | null
          currency?: string
          disbursed_at?: string | null
          disbursed_by?: string | null
          document_object_paths?: Json
          duration_months?: number
          id?: string
          idempotency_key?: string
          indicative_annual_rate?: number | null
          indicative_monthly_payment_minor?: number | null
          internal_disbursement_reference?: string | null
          motive?: string
          motive_code?: string
          owner_id?: string
          reference?: string
          requested_amount_minor?: number
          status?: string
          submitted_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_credited_position_id_fkey"
            columns: ["credited_position_id"]
            isOneToOne: false
            referencedRelation: "financial_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_disbursed_by_fkey"
            columns: ["disbursed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      loan_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          loan_id: string
          metadata: Json
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          loan_id: string
          metadata?: Json
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          loan_id?: string
          metadata?: Json
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_product_settings: {
        Row: {
          created_at: string
          currency: string
          duration_step_months: number
          fixed_annual_rate: number
          is_active: boolean
          maximum_amount_minor: number
          maximum_duration_months: number
          minimum_amount_minor: number
          minimum_duration_months: number
          reference_prefix: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          currency: string
          duration_step_months: number
          fixed_annual_rate: number
          is_active?: boolean
          maximum_amount_minor: number
          maximum_duration_months: number
          minimum_amount_minor: number
          minimum_duration_months: number
          reference_prefix: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          duration_step_months?: number
          fixed_annual_rate?: number
          is_active?: boolean
          maximum_amount_minor?: number
          maximum_duration_months?: number
          minimum_amount_minor?: number
          minimum_duration_months?: number
          reference_prefix?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_product_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      loan_review_checks: {
        Row: {
          check_kind: string
          created_at: string
          id: number
          loan_id: string
          note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          check_kind: string
          created_at?: string
          id?: never
          loan_id: string
          note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          check_kind?: string
          created_at?: string
          id?: never
          loan_id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_review_checks_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_review_checks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_path: string | null
          created_at: string
          id: string
          message: string
          message_key: string
          message_params: Json
          notification_type: string
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          action_path?: string | null
          created_at?: string
          id?: string
          message: string
          message_key: string
          message_params?: Json
          notification_type: string
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          action_path?: string | null
          created_at?: string
          id?: string
          message?: string
          message_key?: string
          message_params?: Json
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      official_documents: {
        Row: {
          account_id: string | null
          brand_logo_path_snapshot: string
          brand_name_snapshot: string
          brand_revision_snapshot: number
          content_hash: string | null
          created_at: string
          document_number: string
          document_type: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          issued_at: string | null
          issued_by: string
          language: string
          loan_id: string | null
          localization_revision: number
          owner_id: string
          period_end: string | null
          period_start: string | null
          requested_at: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          snapshot: Json
          snapshot_hash: string
          status: string
          storage_path: string | null
          supersedes_document_id: string | null
          title: string
          transfer_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          account_id?: string | null
          brand_logo_path_snapshot?: string
          brand_name_snapshot?: string
          brand_revision_snapshot?: number
          content_hash?: string | null
          created_at?: string
          document_number: string
          document_type: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          is_demo?: boolean
          issued_at?: string | null
          issued_by: string
          language?: string
          loan_id?: string | null
          localization_revision?: number
          owner_id: string
          period_end?: string | null
          period_start?: string | null
          requested_at?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          snapshot: Json
          snapshot_hash: string
          status?: string
          storage_path?: string | null
          supersedes_document_id?: string | null
          title: string
          transfer_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          account_id?: string | null
          brand_logo_path_snapshot?: string
          brand_name_snapshot?: string
          brand_revision_snapshot?: number
          content_hash?: string | null
          created_at?: string
          document_number?: string
          document_type?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          is_demo?: boolean
          issued_at?: string | null
          issued_by?: string
          language?: string
          loan_id?: string | null
          localization_revision?: number
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          requested_at?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          snapshot?: Json
          snapshot_hash?: string
          status?: string
          storage_path?: string | null
          supersedes_document_id?: string | null
          title?: string
          transfer_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "official_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_documents_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "official_documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "official_documents_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "official_documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: true
            referencedRelation: "official_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_documents_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfer_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_status: string
          access_status_reason: string | null
          base_currency: string
          created_at: string
          display_name: string
          email: string
          phone: string | null
          preferred_currency: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_status?: string
          access_status_reason?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string
          email: string
          phone?: string | null
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_status?: string
          access_status_reason?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string
          email?: string
          phone?: string | null
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          endpoint_hash: string
          expiration_time: number | null
          failure_count: number
          id: string
          last_error: string | null
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          endpoint_hash: string
          expiration_time?: number | null
          failure_count?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          endpoint_hash?: string
          expiration_time?: number | null
          failure_count?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_push_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_hash_snapshot: string
          id: string
          last_error: string | null
          last_http_status: number | null
          sent_at: string | null
          status: string
          subscription_id: string | null
          transcript_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_hash_snapshot: string
          id?: string
          last_error?: string | null
          last_http_status?: number | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          transcript_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_hash_snapshot?: string
          id?: string
          last_error?: string | null
          last_http_status?: number | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          transcript_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_push_deliveries_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "support_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      support_transcripts: {
        Row: {
          completed_at: string | null
          created_at: string
          email_attempts: number
          email_last_error: string | null
          email_provider_message_id: string | null
          email_request_payload: Json | null
          email_sent_at: string | null
          email_status: string
          event_at: string
          id: string
          identity_error: string | null
          identity_status: string
          notification_display_name: string | null
          notification_email: string | null
          notification_language: string | null
          payload: Json
          processing_started_at: string | null
          processing_token: string | null
          raw_body: string
          raw_body_sha256: string
          tawk_chat_id: string
          tawk_event_id: string
          tawk_property_id: string
          updated_at: string
          user_id: string | null
          visitor_email_normalized: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email_attempts?: number
          email_last_error?: string | null
          email_provider_message_id?: string | null
          email_request_payload?: Json | null
          email_sent_at?: string | null
          email_status?: string
          event_at: string
          id?: string
          identity_error?: string | null
          identity_status: string
          notification_display_name?: string | null
          notification_email?: string | null
          notification_language?: string | null
          payload: Json
          processing_started_at?: string | null
          processing_token?: string | null
          raw_body: string
          raw_body_sha256: string
          tawk_chat_id: string
          tawk_event_id: string
          tawk_property_id: string
          updated_at?: string
          user_id?: string | null
          visitor_email_normalized?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email_attempts?: number
          email_last_error?: string | null
          email_provider_message_id?: string | null
          email_request_payload?: Json | null
          email_sent_at?: string | null
          email_status?: string
          event_at?: string
          id?: string
          identity_error?: string | null
          identity_status?: string
          notification_display_name?: string | null
          notification_email?: string | null
          notification_language?: string | null
          payload?: Json
          processing_started_at?: string | null
          processing_token?: string | null
          raw_body?: string
          raw_body_sha256?: string
          tawk_chat_id?: string
          tawk_event_id?: string
          tawk_property_id?: string
          updated_at?: string
          user_id?: string | null
          visitor_email_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_transcripts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      support_user_identities: {
        Row: {
          created_at: string
          id: string
          normalized_email: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_email: string
          user_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          normalized_email?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      transactional_email_outbox: {
        Row: {
          attempts: number
          claim_token: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_key: string
          id: string
          last_error: string | null
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_id: string
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_key: string
          id?: string
          last_error?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient_email: string
          recipient_id: string
          sent_at?: string | null
          status?: string
          template_key: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_key?: string
          id?: string
          last_error?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient_email?: string
          recipient_id?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactional_email_outbox_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transfer_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          metadata: Json
          reason: string | null
          to_status: string | null
          transfer_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          metadata?: Json
          reason?: string | null
          to_status?: string | null
          transfer_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          metadata?: Json
          reason?: string | null
          to_status?: string | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_events_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfer_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_intents: {
        Row: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_minor: number
          beneficiary_details?: Json
          currency: string
          id?: string
          idempotency_key: string
          internal_execution_reference?: string | null
          motive?: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at?: string | null
          settled_by?: string | null
          source_position_id: string
          status?: string
          submitted_at?: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_minor?: number
          beneficiary_details?: Json
          currency?: string
          id?: string
          idempotency_key?: string
          internal_execution_reference?: string | null
          motive?: string | null
          owner_id?: string
          quote_as_of?: string
          quote_rate?: number
          recipient_account_masked?: string
          recipient_name?: string
          settled_at?: string | null
          settled_by?: string | null
          source_position_id?: string
          status?: string
          submitted_at?: string
          target_amount_minor?: number
          target_currency?: string
          transfer_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfer_intents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transfer_intents_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transfer_intents_source_position_id_fkey"
            columns: ["source_position_id"]
            isOneToOne: false
            referencedRelation: "financial_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_review_checks: {
        Row: {
          check_kind: string
          created_at: string
          id: number
          note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          transfer_id: string
          updated_at: string
        }
        Insert: {
          check_kind: string
          created_at?: string
          id?: never
          note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          transfer_id: string
          updated_at?: string
        }
        Update: {
          check_kind?: string
          created_at?: string
          id?: never
          note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          transfer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_review_checks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transfer_review_checks_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfer_intents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_financial_position: {
        Args: {
          p_as_of: string
          p_delta_minor: number
          p_position_id: string
          p_reason: string
        }
        Returns: {
          account_holder_name: string | null
          account_number: string | null
          account_status: string
          account_type: string
          amount_minor: number
          as_of: string
          bic: string | null
          branch_code: string | null
          branch_name: string | null
          created_at: string
          currency: string
          declaration_idempotency_key: string | null
          declared_by: string | null
          external_identifier_masked: string | null
          iban: string | null
          id: string
          institution_name: string | null
          is_demo: boolean
          label: string
          opened_at: string | null
          owner_id: string
          position_kind: string
          reserved_minor: number
          source_kyc_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "financial_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_ack_client_purge_storage_work: {
        Args: {
          p_actor_id: string
          p_challenge_id: string
          p_claim_token: string
          p_kind: string
          p_result: Json
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_assert_client_purge_auth_ready: {
        Args: {
          p_actor_id: string
          p_challenge_id: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_begin_client_purge: {
        Args: {
          p_actor_id: string
          p_challenge_digest: string
          p_challenge_id: string
          p_idempotency_key: string
          p_target_email_digest: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_claim_client_purge_storage_work: {
        Args: {
          p_actor_id: string
          p_challenge_id: string
          p_limit?: number
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_finalize_client_purge: {
        Args: {
          p_actor_id: string
          p_challenge_id: string
          p_target_user_id: string
        }
        Returns: boolean
      }
      admin_get_client_purge_preview: {
        Args: { p_actor_id: string; p_target_user_id: string }
        Returns: Json
      }
      admin_get_client_purge_status: {
        Args: { p_actor_id: string; p_target_user_id: string }
        Returns: Json
      }
      admin_list_client_purge_candidates: {
        Args: {
          p_actor_id: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          access_status: string
          account_count: number
          created_at: string
          display_name: string
          document_count: number
          email: string
          kyc_status: string
          loan_count: number
          purge_stage: string
          purge_status: string
          purge_sweep_not_before: string
          total_count: number
          transfer_count: number
          user_id: string
        }[]
      }
      admin_list_pending_client_purges: {
        Args: { p_limit?: number }
        Returns: {
          actor_id: string
          challenge_digest: string
          challenge_id: string
          idempotency_key: string
          stage: string
          target_email_digest: string
          target_user_id: string
        }[]
      }
      admin_mark_client_purge_stage: {
        Args: {
          p_actor_id: string
          p_challenge_id: string
          p_error_code?: string
          p_stage: string
        }
        Returns: undefined
      }
      admin_prepare_client_purge: {
        Args: {
          p_actor_id: string
          p_challenge_digest: string
          p_idempotency_key: string
          p_target_email: string
          p_target_email_digest: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_purge_client_relational_data: {
        Args: {
          p_actor_id: string
          p_challenge_id: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_resume_client_purge: {
        Args: {
          p_actor_id: string
          p_target_email_digest: string
          p_target_user_id: string
        }
        Returns: Json
      }
      begin_kyc_review: {
        Args: { p_kyc_id: string }
        Returns: {
          address: Json
          correction_due_at: string | null
          correction_reason_code: string | null
          date_of_birth: string
          document_expires_on: string | null
          document_number: string | null
          document_object_paths: Json
          document_type: string | null
          fatca: boolean
          first_name: string
          id: string
          idempotency_key: string
          income_range: string
          issuing_country: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "kyc_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_adjust_balance: {
        Args: {
          p_account_id: string
          p_idempotency_key: string
          p_reason: string
          p_target_amount_minor: number
          p_value_date: string
        }
        Returns: {
          account_holder_name: string | null
          account_number: string | null
          account_status: string
          account_type: string
          amount_minor: number
          as_of: string
          bic: string | null
          branch_code: string | null
          branch_name: string | null
          created_at: string
          currency: string
          declaration_idempotency_key: string | null
          declared_by: string | null
          external_identifier_masked: string | null
          iban: string | null
          id: string
          institution_name: string | null
          is_demo: boolean
          label: string
          opened_at: string | null
          owner_id: string
          position_kind: string
          reserved_minor: number
          source_kyc_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "financial_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_approve_loan: {
        Args: { p_loan_id: string; p_note?: string }
        Returns: {
          credited_position_id: string | null
          currency: string
          disbursed_at: string | null
          disbursed_by: string | null
          document_object_paths: Json
          duration_months: number
          id: string
          idempotency_key: string
          indicative_annual_rate: number | null
          indicative_monthly_payment_minor: number | null
          internal_disbursement_reference: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_approve_transfer: {
        Args: { p_note?: string; p_transfer_id: string }
        Returns: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "transfer_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_declare_account: {
        Args: {
          p_account_holder_name: string
          p_account_type: string
          p_bic: string
          p_branch_code: string
          p_branch_name: string
          p_currency: string
          p_iban: string
          p_idempotency_key: string
          p_institution_name: string
          p_is_demo: boolean
          p_label: string
          p_opened_at: string
          p_opening_balance_minor: number
          p_owner_id: string
          p_reason: string
        }
        Returns: {
          account_holder_name: string | null
          account_number: string | null
          account_status: string
          account_type: string
          amount_minor: number
          as_of: string
          bic: string | null
          branch_code: string | null
          branch_name: string | null
          created_at: string
          currency: string
          declaration_idempotency_key: string | null
          declared_by: string | null
          external_identifier_masked: string | null
          iban: string | null
          id: string
          institution_name: string | null
          is_demo: boolean
          label: string
          opened_at: string | null
          owner_id: string
          position_kind: string
          reserved_minor: number
          source_kyc_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "financial_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_disburse_loan: {
        Args: {
          p_destination_position_id: string
          p_loan_id: string
          p_note: string
        }
        Returns: {
          credited_position_id: string | null
          currency: string
          disbursed_at: string | null
          disbursed_by: string | null
          document_object_paths: Json
          duration_months: number
          id: string
          idempotency_key: string
          indicative_annual_rate: number | null
          indicative_monthly_payment_minor: number | null
          internal_disbursement_reference: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_finalize_transfer: {
        Args: { p_note?: string; p_transfer_id: string }
        Returns: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "transfer_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_issue_official_document: {
        Args: {
          p_account_id: string
          p_document_type: string
          p_idempotency_key: string
          p_language: string
          p_loan_id: string
          p_owner_id: string
          p_period_end: string
          p_period_start: string
          p_title: string
          p_transfer_id: string
        }
        Returns: {
          account_id: string | null
          brand_logo_path_snapshot: string
          brand_name_snapshot: string
          brand_revision_snapshot: number
          content_hash: string | null
          created_at: string
          document_number: string
          document_type: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          issued_at: string | null
          issued_by: string
          language: string
          loan_id: string | null
          localization_revision: number
          owner_id: string
          period_end: string | null
          period_start: string | null
          requested_at: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          snapshot: Json
          snapshot_hash: string
          status: string
          storage_path: string | null
          supersedes_document_id: string | null
          title: string
          transfer_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "official_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_reject_loan: {
        Args: { p_loan_id: string; p_reason: string }
        Returns: {
          credited_position_id: string | null
          currency: string
          disbursed_at: string | null
          disbursed_by: string | null
          document_object_paths: Json
          duration_months: number
          id: string
          idempotency_key: string
          indicative_annual_rate: number | null
          indicative_monthly_payment_minor: number | null
          internal_disbursement_reference: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_reject_transfer: {
        Args: { p_reason: string; p_transfer_id: string }
        Returns: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "transfer_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_review_transfer_check: {
        Args: { p_check_kind: string; p_note?: string; p_transfer_id: string }
        Returns: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "transfer_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_manager_revoke_official_document: {
        Args: { p_document_id: string; p_reason: string }
        Returns: {
          account_id: string | null
          brand_logo_path_snapshot: string
          brand_name_snapshot: string
          brand_revision_snapshot: number
          content_hash: string | null
          created_at: string
          document_number: string
          document_type: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          issued_at: string | null
          issued_by: string
          language: string
          loan_id: string | null
          localization_revision: number
          owner_id: string
          period_end: string | null
          period_start: string | null
          requested_at: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          snapshot: Json
          snapshot_hash: string
          status: string
          storage_path: string | null
          supersedes_document_id: string | null
          title: string
          transfer_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "official_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_support_transcript: {
        Args: { p_claim_token: string; p_transcript_id: string }
        Returns: boolean
      }
      claim_transactional_emails: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          claim_token: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_key: string
          id: string
          last_error: string | null
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_id: string
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactional_email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_transactional_emails_for_recipient: {
        Args: { p_limit?: number; p_recipient_id: string }
        Returns: {
          attempts: number
          claim_token: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_key: string
          id: string
          last_error: string | null
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_id: string
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactional_email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_official_document: {
        Args: {
          p_content_hash: string
          p_document_id: string
          p_error: string
          p_storage_path: string
          p_succeeded: boolean
        }
        Returns: {
          account_id: string | null
          brand_logo_path_snapshot: string
          brand_name_snapshot: string
          brand_revision_snapshot: number
          content_hash: string | null
          created_at: string
          document_number: string
          document_type: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          issued_at: string | null
          issued_by: string
          language: string
          loan_id: string | null
          localization_revision: number
          owner_id: string
          period_end: string | null
          period_start: string | null
          requested_at: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          snapshot: Json
          snapshot_hash: string
          status: string
          storage_path: string | null
          supersedes_document_id: string | null
          title: string
          transfer_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "official_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_transactional_email: {
        Args: {
          p_claim_token: string
          p_email_id: string
          p_error?: string
          p_provider_message_id?: string
          p_succeeded: boolean
        }
        Returns: undefined
      }
      create_official_document_localized_reissue: {
        Args: { p_idempotency_key: string; p_source_document_id: string }
        Returns: {
          account_id: string | null
          brand_logo_path_snapshot: string
          brand_name_snapshot: string
          brand_revision_snapshot: number
          content_hash: string | null
          created_at: string
          document_number: string
          document_type: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          issued_at: string | null
          issued_by: string
          language: string
          loan_id: string | null
          localization_revision: number
          owner_id: string
          period_end: string | null
          period_start: string | null
          requested_at: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          snapshot: Json
          snapshot_hash: string
          status: string
          storage_path: string | null
          supersedes_document_id: string | null
          title: string
          transfer_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "official_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_app_role: { Args: never; Returns: string }
      decide_kyc_application: {
        Args: {
          p_decision: string
          p_kyc_id: string
          p_note: string
          p_reason_code: string
        }
        Returns: {
          address: Json
          correction_due_at: string | null
          correction_reason_code: string | null
          date_of_birth: string
          document_expires_on: string | null
          document_number: string | null
          document_object_paths: Json
          document_type: string | null
          fatca: boolean
          first_name: string
          id: string
          idempotency_key: string
          income_range: string
          issuing_country: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "kyc_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_official_document_localized_reissue: {
        Args: { p_replacement_document_id: string }
        Returns: {
          account_id: string | null
          brand_logo_path_snapshot: string
          brand_name_snapshot: string
          brand_revision_snapshot: number
          content_hash: string | null
          created_at: string
          document_number: string
          document_type: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          issued_at: string | null
          issued_by: string
          language: string
          loan_id: string | null
          localization_revision: number
          owner_id: string
          period_end: string | null
          period_start: string | null
          requested_at: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          snapshot: Json
          snapshot_hash: string
          status: string
          storage_path: string | null
          supersedes_document_id: string | null
          title: string
          transfer_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "official_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_account_number_configuration: {
        Args: never
        Returns: {
          capacity: number
          prefix: string
          prefix_length: number
          updated_at: string
        }[]
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      provision_demo_accounts: {
        Args: {
          p_admin_user_id: string
          p_client_user_id: string
          p_environment: string
        }
        Returns: Json
      }
      publish_brand_settings: {
        Args: {
          p_app_icon_192_path: string
          p_app_icon_512_path: string
          p_apple_touch_icon_path: string
          p_bank_name: string
          p_email_logo_path: string
          p_expected_revision: number
          p_favicon_16_path: string
          p_favicon_32_path: string
          p_favicon_48_path: string
          p_favicon_ico_path: string
          p_maskable_icon_path: string
          p_pdf_logo_path: string
          p_primary_logo_height: number
          p_primary_logo_path: string
          p_primary_logo_width: number
          p_reversed_logo_height: number
          p_reversed_logo_path: string
          p_reversed_logo_width: number
          p_social_card_path: string
        }
        Returns: {
          app_icon_192_path: string
          app_icon_512_path: string
          apple_touch_icon_path: string
          bank_name: string
          created_at: string
          email_logo_path: string
          favicon_16_path: string
          favicon_32_path: string
          favicon_48_path: string
          favicon_ico_path: string
          maskable_icon_path: string
          pdf_logo_path: string
          primary_logo_height: number
          primary_logo_path: string
          primary_logo_width: number
          reversed_logo_height: number
          reversed_logo_path: string
          reversed_logo_width: number
          revision: number
          singleton: boolean
          social_card_path: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "brand_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_admin_credentials_update: {
        Args: {
          p_actor_id: string
          p_email_changed: boolean
          p_password_changed: boolean
        }
        Returns: number
      }
      record_financial_position: {
        Args: {
          p_amount_minor: number
          p_as_of: string
          p_currency: string
          p_external_identifier_masked: string
          p_label: string
          p_owner_id: string
          p_reason: string
        }
        Returns: {
          account_holder_name: string | null
          account_number: string | null
          account_status: string
          account_type: string
          amount_minor: number
          as_of: string
          bic: string | null
          branch_code: string | null
          branch_name: string | null
          created_at: string
          currency: string
          declaration_idempotency_key: string | null
          declared_by: string | null
          external_identifier_masked: string | null
          iban: string | null
          id: string
          institution_name: string | null
          is_demo: boolean
          label: string
          opened_at: string | null
          owner_id: string
          position_kind: string
          reserved_minor: number
          source_kyc_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "financial_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_push_subscription: {
        Args: {
          p_auth_key: string
          p_endpoint: string
          p_expected_user_id: string
          p_expiration_time?: number
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
      release_support_transcript_claim: {
        Args: {
          p_claim_token: string
          p_completed?: boolean
          p_transcript_id: string
        }
        Returns: boolean
      }
      request_kyc_information: {
        Args: {
          p_due_at: string
          p_kyc_id: string
          p_note: string
          p_reason_code: string
          p_requested_items: string[]
        }
        Returns: {
          address: Json
          correction_due_at: string | null
          correction_reason_code: string | null
          date_of_birth: string
          document_expires_on: string | null
          document_number: string | null
          document_object_paths: Json
          document_type: string | null
          fatca: boolean
          first_name: string
          id: string
          idempotency_key: string
          income_range: string
          issuing_country: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "kyc_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resubmit_kyc_application: {
        Args: {
          p_changes: Json
          p_document_object_paths: Json
          p_kyc_id: string
        }
        Returns: {
          address: Json
          correction_due_at: string | null
          correction_reason_code: string | null
          date_of_birth: string
          document_expires_on: string | null
          document_number: string | null
          document_object_paths: Json
          document_type: string | null
          fatca: boolean
          first_name: string
          id: string
          idempotency_key: string
          income_range: string
          issuing_country: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "kyc_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_kyc_application: {
        Args: { p_kyc_id: string; p_note: string; p_status: string }
        Returns: {
          address: Json
          correction_due_at: string | null
          correction_reason_code: string | null
          date_of_birth: string
          document_expires_on: string | null
          document_number: string | null
          document_object_paths: Json
          document_type: string | null
          fatca: boolean
          first_name: string
          id: string
          idempotency_key: string
          income_range: string
          issuing_country: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "kyc_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_loan_check: {
        Args: {
          p_check_kind: string
          p_loan_id: string
          p_note?: string
          p_status: string
        }
        Returns: {
          credited_position_id: string | null
          currency: string
          disbursed_at: string | null
          disbursed_by: string | null
          document_object_paths: Json
          duration_months: number
          id: string
          idempotency_key: string
          indicative_annual_rate: number | null
          indicative_monthly_payment_minor: number | null
          internal_disbursement_reference: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_transfer_check: {
        Args: {
          p_check_kind: string
          p_note?: string
          p_status: string
          p_transfer_id: string
        }
        Returns: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "transfer_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_kyc_draft: {
        Args: {
          p_current_step: number
          p_document_object_paths: Json
          p_payload: Json
          p_preferred_language: string
        }
        Returns: {
          created_at: string
          current_step: number
          document_object_paths: Json
          owner_id: string
          payload: Json
          preferred_language: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_account_number_prefix: {
        Args: { p_prefix: string }
        Returns: {
          capacity: number
          prefix: string
          prefix_length: number
          updated_at: string
        }[]
      }
      set_user_access_status: {
        Args: { p_reason: string; p_status: string; p_user_id: string }
        Returns: {
          access_status: string
          access_status_reason: string | null
          base_currency: string
          created_at: string
          display_name: string
          email: string
          phone: string | null
          preferred_currency: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_kyc_application: {
        Args: {
          p_address: Json
          p_date_of_birth: string
          p_document_expires_on: string
          p_document_number: string
          p_document_object_paths: Json
          p_document_type: string
          p_fatca: boolean
          p_first_name: string
          p_idempotency_key: string
          p_income_range: string
          p_issuing_country: string
          p_last_name: string
          p_nationality: string
          p_occupation: string
          p_pep: boolean
          p_place_of_birth: string
        }
        Returns: {
          address: Json
          correction_due_at: string | null
          correction_reason_code: string | null
          date_of_birth: string
          document_expires_on: string | null
          document_number: string | null
          document_object_paths: Json
          document_type: string | null
          fatca: boolean
          first_name: string
          id: string
          idempotency_key: string
          income_range: string
          issuing_country: string | null
          last_name: string
          nationality: string
          occupation: string
          owner_id: string
          pep: boolean
          place_of_birth: string
          requested_items: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "kyc_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_loan_application: {
        Args: {
          p_currency: string
          p_document_object_paths: Json
          p_duration_months: number
          p_idempotency_key: string
          p_motive_code: string
          p_requested_amount_minor: number
        }
        Returns: {
          credited_position_id: string | null
          currency: string
          disbursed_at: string | null
          disbursed_by: string | null
          document_object_paths: Json
          duration_months: number
          id: string
          idempotency_key: string
          indicative_annual_rate: number | null
          indicative_monthly_payment_minor: number | null
          internal_disbursement_reference: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_transfer_intent: {
        Args: {
          p_amount_minor: number
          p_beneficiary_details: Json
          p_currency: string
          p_idempotency_key: string
          p_motive: string
          p_quote_as_of: string
          p_quote_rate: number
          p_recipient_account_masked: string
          p_recipient_name: string
          p_source_position_id: string
          p_target_amount_minor: number
          p_target_currency: string
          p_transfer_type: string
        }
        Returns: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "transfer_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_loan: {
        Args: {
          p_action: string
          p_evidence_object_path?: string
          p_executed_at?: string
          p_external_reference?: string
          p_loan_id: string
          p_reason?: string
        }
        Returns: {
          credited_position_id: string | null
          currency: string
          disbursed_at: string | null
          disbursed_by: string | null
          document_object_paths: Json
          duration_months: number
          id: string
          idempotency_key: string
          indicative_annual_rate: number | null
          indicative_monthly_payment_minor: number | null
          internal_disbursement_reference: string | null
          motive: string
          motive_code: string
          owner_id: string
          reference: string
          requested_amount_minor: number
          status: string
          submitted_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_transfer: {
        Args: {
          p_action: string
          p_evidence_object_path?: string
          p_executed_at?: string
          p_external_reference?: string
          p_reason?: string
          p_transfer_id: string
        }
        Returns: {
          amount_minor: number
          beneficiary_details: Json
          currency: string
          id: string
          idempotency_key: string
          internal_execution_reference: string | null
          motive: string | null
          owner_id: string
          quote_as_of: string
          quote_rate: number
          recipient_account_masked: string
          recipient_name: string
          settled_at: string | null
          settled_by: string | null
          source_position_id: string
          status: string
          submitted_at: string
          target_amount_minor: number
          target_currency: string
          transfer_type: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "transfer_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unregister_push_subscription: {
        Args: { p_endpoint: string; p_expected_user_id: string }
        Returns: boolean
      }
      update_kyc_review_checklist: {
        Args: {
          p_adulthood: string
          p_data_consistency: string
          p_document_quality: string
          p_fatca: string
          p_internal_comments: string
          p_kyc_id: string
          p_pep: string
          p_selfie_match: string
        }
        Returns: {
          adulthood: string
          created_at: string
          data_consistency: string
          document_quality: string
          fatca: string
          internal_comments: string | null
          kyc_id: string
          pep: string
          selfie_match: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "kyc_review_checklists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_loan_product_settings: {
        Args: {
          p_currency: string
          p_duration_step_months: number
          p_fixed_annual_rate: number
          p_is_active: boolean
          p_maximum_amount_minor: number
          p_maximum_duration_months: number
          p_minimum_amount_minor: number
          p_minimum_duration_months: number
          p_reference_prefix: string
        }
        Returns: {
          created_at: string
          currency: string
          duration_step_months: number
          fixed_annual_rate: number
          is_active: boolean
          maximum_amount_minor: number
          maximum_duration_months: number
          minimum_amount_minor: number
          minimum_duration_months: number
          reference_prefix: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "loan_product_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  private: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
