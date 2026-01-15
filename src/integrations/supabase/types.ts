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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      choir_members: {
        Row: {
          active: boolean | null
          birth_date: string | null
          created_at: string | null
          email: string | null
          id: string
          naipe: string | null
          name: string
          parish: string | null
          phone: string | null
          photo_url: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          birth_date?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          naipe?: string | null
          name: string
          parish?: string | null
          phone?: string | null
          photo_url?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          birth_date?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          naipe?: string | null
          name?: string
          parish?: string | null
          phone?: string | null
          photo_url?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "choir_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          member_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          member_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "choir_members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_song_types: {
        Row: {
          created_at: string
          event_id: string
          id: string
          order_index: number
          song_type_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          order_index?: number
          song_type_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          order_index?: number
          song_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_song_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_song_types_song_type_id_fkey"
            columns: ["song_type_id"]
            isOneToOne: false
            referencedRelation: "song_types"
            referencedColumns: ["id"]
          },
        ]
      }
      event_songs: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          order_index: number
          song_id: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          order_index?: number
          song_id: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          order_index?: number
          song_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_songs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          date: string
          id: string
          location: string | null
          name: string
          notes: string | null
          pdf_theme: string
          song_sheet_url: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          date: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          pdf_theme?: string
          song_sheet_url?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          date?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          pdf_theme?: string
          song_sheet_url?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          birth_date: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          naipe: string | null
          parish: string | null
          phone: string | null
          tenant_id: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          naipe?: string | null
          parish?: string | null
          phone?: string | null
          tenant_id?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          naipe?: string | null
          parish?: string | null
          phone?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsal_attendance: {
        Row: {
          attended: boolean
          created_at: string
          id: string
          member_id: string | null
          rehearsal_id: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          created_at?: string
          id?: string
          member_id?: string | null
          rehearsal_id: string
          user_id: string
        }
        Update: {
          attended?: boolean
          created_at?: string
          id?: string
          member_id?: string | null
          rehearsal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehearsal_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "choir_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehearsal_attendance_rehearsal_id_fkey"
            columns: ["rehearsal_id"]
            isOneToOne: false
            referencedRelation: "rehearsals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehearsal_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsals: {
        Row: {
          created_at: string
          date: string
          event_id: string | null
          id: string
          location: string | null
          notes: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehearsals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehearsals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      song_audios: {
        Row: {
          audio_url: string
          created_at: string
          id: string
          naipe: string
          name: string
          song_id: string
          tenant_id: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string
          id?: string
          naipe: string
          name: string
          song_id: string
          tenant_id?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string
          id?: string
          naipe?: string
          name?: string
          song_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "song_audios_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_audios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      song_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "song_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          chords: string | null
          created_at: string | null
          id: string
          lyrics: string | null
          name: string
          notes: string | null
          sheet_music_pdf_url: string | null
          sheet_music_url: string | null
          tenant_id: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          chords?: string | null
          created_at?: string | null
          id?: string
          lyrics?: string | null
          name: string
          notes?: string | null
          sheet_music_pdf_url?: string | null
          sheet_music_url?: string | null
          tenant_id?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          chords?: string | null
          created_at?: string | null
          id?: string
          lyrics?: string | null
          name?: string
          notes?: string | null
          sheet_music_pdf_url?: string | null
          sheet_music_url?: string | null
          tenant_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_chord_preferences: {
        Row: {
          created_at: string
          font_size: number
          id: string
          song_id: string | null
          transpose: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          font_size?: number
          id?: string
          song_id?: string | null
          transpose?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          font_size?: number
          id?: string
          song_id?: string | null
          transpose?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chord_preferences_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
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
      app_role: ["admin", "user", "super_admin"],
    },
  },
} as const
