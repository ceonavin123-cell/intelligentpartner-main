export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_assessments: {
        Row: {
          agent: Database["public"]["Enums"]["agent_type"]
          company_id: string
          created_at: string
          findings: Json
          id: string
          risk_score: number | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          agent: Database["public"]["Enums"]["agent_type"]
          company_id: string
          created_at?: string
          findings?: Json
          id?: string
          risk_score?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["agent_type"]
          company_id?: string
          created_at?: string
          findings?: Json
          id?: string
          risk_score?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_assessments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          agent: Database["public"]["Enums"]["agent_type"]
          company_id: string
          created_at: string
          id: string
          importance: number
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          agent: Database["public"]["Enums"]["agent_type"]
          company_id: string
          created_at?: string
          id?: string
          importance?: number
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["agent_type"]
          company_id?: string
          created_at?: string
          id?: string
          importance?: number
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent: Database["public"]["Enums"]["agent_type"] | null
          content: string
          created_at: string
          id: string
          metadata: Json
          role: Database["public"]["Enums"]["message_role"]
          thread_id: string
        }
        Insert: {
          agent?: Database["public"]["Enums"]["agent_type"] | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["message_role"]
          thread_id: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["agent_type"] | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["message_role"]
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          company_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string | null
          name: string
          owner_id: string
          research_summary: string | null
          status: Database["public"]["Enums"]["company_status"]
          token_limit: number | null
          token_used: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          name: string
          owner_id: string
          research_summary?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          token_limit?: number | null
          token_used?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          name?: string
          owner_id?: string
          research_summary?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          token_limit?: number | null
          token_used?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          mime: string | null
          name: string
          size_bytes: number | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          mime?: string | null
          name: string
          size_bytes?: number | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          mime?: string | null
          name?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          brief: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          report_type: string
          slug: string
          updated_at: string
        }
        Insert: {
          brief: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          report_type?: string
          slug: string
          updated_at?: string
        }
        Update: {
          brief?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          report_type?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          agents_involved: Database["public"]["Enums"]["agent_type"][]
          company_id: string
          content: string
          created_at: string
          id: string
          thread_id: string | null
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
        }
        Insert: {
          agents_involved?: Database["public"]["Enums"]["agent_type"][]
          company_id: string
          content: string
          created_at?: string
          id?: string
          thread_id?: string | null
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Update: {
          agents_involved?: Database["public"]["Enums"]["agent_type"][]
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          thread_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          agent: Database["public"]["Enums"]["agent_type"] | null
          company_id: string
          created_at: string
          excerpt: string | null
          id: string
          title: string | null
          url: string
        }
        Insert: {
          agent?: Database["public"]["Enums"]["agent_type"] | null
          company_id: string
          created_at?: string
          excerpt?: string | null
          id?: string
          title?: string | null
          url: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["agent_type"] | null
          company_id?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_memories: {
        Row: {
          id: string
          company_id: string
          agent: string
          category: string
          content: string
          source: string
          confidence: number
          decay_rate: number
          current_weight: number
          embedding: string | null
          metadata: Json
          created_at: string
          updated_at: string
          last_accessed_at: string
          access_count: number
        }
        Insert: {
          id?: string
          company_id: string
          agent?: string
          category?: string
          content: string
          source?: string
          confidence?: number
          decay_rate?: number
          current_weight?: number
          embedding?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          last_accessed_at?: string
          access_count?: number
        }
        Update: {
          id?: string
          company_id?: string
          agent?: string
          category?: string
          content?: string
          source?: string
          confidence?: number
          decay_rate?: number
          current_weight?: number
          embedding?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          last_accessed_at?: string
          access_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "semantic_memories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      procedural_memories: {
        Row: {
          id: string
          company_id: string
          pattern_type: string
          pattern_text: string
          evidence: Json
          confidence: number
          times_observed: number
          first_observed_at: string
          last_observed_at: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          pattern_type?: string
          pattern_text: string
          evidence?: Json
          confidence?: number
          times_observed?: number
          first_observed_at?: string
          last_observed_at?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          pattern_type?: string
          pattern_text?: string
          evidence?: Json
          confidence?: number
          times_observed?: number
          first_observed_at?: string
          last_observed_at?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedural_memories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_connections: {
        Row: {
          id: string
          company_id: string
          source_memory_id: string
          source_memory_type: string
          target_memory_id: string
          target_memory_type: string
          connection_type: string
          strength: number
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          source_memory_id: string
          source_memory_type: string
          target_memory_id: string
          target_memory_type: string
          connection_type?: string
          strength?: number
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          source_memory_id?: string
          source_memory_type?: string
          target_memory_id?: string
          target_memory_type?: string
          connection_type?: string
          strength?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_scores: {
        Row: {
          id: string
          company_id: string
          total_memories: number
          semantic_count: number
          procedural_count: number
          connection_count: number
          avg_confidence: number
          intelligence_score: number
          predictions_made: number
          risks_flagged: number
          calculated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          total_memories?: number
          semantic_count?: number
          procedural_count?: number
          connection_count?: number
          avg_confidence?: number
          intelligence_score?: number
          predictions_made?: number
          risks_flagged?: number
          calculated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          total_memories?: number
          semantic_count?: number
          procedural_count?: number
          connection_count?: number
          avg_confidence?: number
          intelligence_score?: number
          predictions_made?: number
          risks_flagged?: number
          calculated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          id: string
          company_id: string
          document_id: string
          document_name: string
          chunk_index: number
          content: string
          embedding: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          document_id: string
          document_name: string
          chunk_index: number
          content: string
          embedding: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          document_id?: string
          document_name?: string
          chunk_index?: number
          content?: string
          embedding?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_graph: {
        Row: {
          id: string
          company_id: string
          entity: string
          relation: string
          target: string
          source_doc: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          entity: string
          relation: string
          target: string
          source_doc: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          entity?: string
          relation?: string
          target?: string
          source_doc?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_graph_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agent_type:
        | "cfo"
        | "coo"
        | "tax"
        | "orchestrator"
        | "marketing"
        | "bizdev"
      company_status: "researching" | "ready" | "in_progress" | "archived"
      message_role: "user" | "assistant" | "system" | "tool"
      report_type: "assessment" | "sow" | "work_output" | "summary"
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
  public: {
    Enums: {
      agent_type: ["cfo", "coo", "tax", "orchestrator", "marketing", "bizdev"],
      company_status: ["researching", "ready", "in_progress", "archived"],
      message_role: ["user", "assistant", "system", "tool"],
      report_type: ["assessment", "sow", "work_output", "summary"],
    },
  },
} as const
