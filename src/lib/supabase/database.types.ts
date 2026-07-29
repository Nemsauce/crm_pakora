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
      abandonados: {
        Row: {
          apellido: string | null
          ciudad: string | null
          codigo_externo: string
          departamento: string | null
          direccion: string | null
          estado: Database["public"]["Enums"]["estado_abandonado_enum"]
          fecha_abandono: string | null
          id: number
          nombre: string | null
          nombre_producto: string | null
          pais: Database["public"]["Enums"]["pais_enum"]
          precio: number | null
          sincronizado_en: string
          telefono: string | null
        }
        Insert: {
          apellido?: string | null
          ciudad?: string | null
          codigo_externo: string
          departamento?: string | null
          direccion?: string | null
          estado?: Database["public"]["Enums"]["estado_abandonado_enum"]
          fecha_abandono?: string | null
          id?: never
          nombre?: string | null
          nombre_producto?: string | null
          pais: Database["public"]["Enums"]["pais_enum"]
          precio?: number | null
          sincronizado_en?: string
          telefono?: string | null
        }
        Update: {
          apellido?: string | null
          ciudad?: string | null
          codigo_externo?: string
          departamento?: string | null
          direccion?: string | null
          estado?: Database["public"]["Enums"]["estado_abandonado_enum"]
          fecha_abandono?: string | null
          id?: never
          nombre?: string | null
          nombre_producto?: string | null
          pais?: Database["public"]["Enums"]["pais_enum"]
          precio?: number | null
          sincronizado_en?: string
          telefono?: string | null
        }
        Relationships: []
      }
      asistente_whatsapp_config: {
        Row: {
          id: number
          reglas: string
          updated_at: string
          updated_por: string | null
        }
        Insert: {
          id?: never
          reglas?: string
          updated_at?: string
          updated_por?: string | null
        }
        Update: {
          id?: never
          reglas?: string
          updated_at?: string
          updated_por?: string | null
        }
        Relationships: []
      }
      comentarios: {
        Row: {
          comentario: string
          created_at: string
          id: number
          order_id: number
          origen: string
        }
        Insert: {
          comentario: string
          created_at?: string
          id?: never
          order_id: number
          origen?: string
        }
        Update: {
          comentario?: string
          created_at?: string
          id?: never
          order_id?: number
          origen?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      costeos: {
        Row: {
          costos_administrativos: number
          cpa_ads: number
          cpa_manual: boolean
          cpa_porcentaje_objetivo: number
          created_at: string
          created_by: string | null
          flete_base: number
          fullfilment: number
          id: number
          importe_gastado: number | null
          nombre_producto: string
          pais: Database["public"]["Enums"]["pais_enum"]
          precio_comparacion: number | null
          precio_proveedor: number
          precio_venta: number
          tasa_cancelacion: number
          tasa_efectividad: number
          updated_at: string
        }
        Insert: {
          costos_administrativos?: number
          cpa_ads?: number
          cpa_manual?: boolean
          cpa_porcentaje_objetivo?: number
          created_at?: string
          created_by?: string | null
          flete_base?: number
          fullfilment?: number
          id?: never
          importe_gastado?: number | null
          nombre_producto: string
          pais: Database["public"]["Enums"]["pais_enum"]
          precio_comparacion?: number | null
          precio_proveedor?: number
          precio_venta?: number
          tasa_cancelacion?: number
          tasa_efectividad?: number
          updated_at?: string
        }
        Update: {
          costos_administrativos?: number
          cpa_ads?: number
          cpa_manual?: boolean
          cpa_porcentaje_objetivo?: number
          created_at?: string
          created_by?: string | null
          flete_base?: number
          fullfilment?: number
          id?: never
          importe_gastado?: number | null
          nombre_producto?: string
          pais?: Database["public"]["Enums"]["pais_enum"]
          precio_comparacion?: number | null
          precio_proveedor?: number
          precio_venta?: number
          tasa_cancelacion?: number
          tasa_efectividad?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costeos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dropi_sessions: {
        Row: {
          expires_at: string
          pais: string
          token: string
          updated_at: string
        }
        Insert: {
          expires_at: string
          pais: string
          token: string
          updated_at?: string
        }
        Update: {
          expires_at?: string
          pais?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      dropkiller_config: {
        Row: {
          activo: boolean
          country_code: string
          id: number
          platform: string
        }
        Insert: {
          activo?: boolean
          country_code: string
          id?: never
          platform: string
        }
        Update: {
          activo?: boolean
          country_code?: string
          id?: never
          platform?: string
        }
        Relationships: []
      }
      dropkiller_products_daily: {
        Row: {
          captured_at: string
          country_code: string
          created_at: string
          dropkiller_uuid: string | null
          external_id: string
          history_30d: Json | null
          id: number
          nombre_producto: string
          platform: string
          primary_image_url: string | null
          providers_count: number | null
          sale_price: number | null
          sold_units_last_30_days: number | null
          sold_units_last_7_days: number | null
          stock: number | null
          suggested_price: number | null
          total_sold_units: number | null
        }
        Insert: {
          captured_at?: string
          country_code: string
          created_at?: string
          dropkiller_uuid?: string | null
          external_id: string
          history_30d?: Json | null
          id?: never
          nombre_producto: string
          platform: string
          primary_image_url?: string | null
          providers_count?: number | null
          sale_price?: number | null
          sold_units_last_30_days?: number | null
          sold_units_last_7_days?: number | null
          stock?: number | null
          suggested_price?: number | null
          total_sold_units?: number | null
        }
        Update: {
          captured_at?: string
          country_code?: string
          created_at?: string
          dropkiller_uuid?: string | null
          external_id?: string
          history_30d?: Json | null
          id?: never
          nombre_producto?: string
          platform?: string
          primary_image_url?: string | null
          providers_count?: number | null
          sale_price?: number | null
          sold_units_last_30_days?: number | null
          sold_units_last_7_days?: number | null
          stock?: number | null
          suggested_price?: number | null
          total_sold_units?: number | null
        }
        Relationships: []
      }
      dropkiller_saved_products: {
        Row: {
          country_code: string
          dropkiller_uuid: string | null
          external_id: string
          id: number
          nombre_producto: string
          notas: string | null
          primary_image_url: string | null
          providers_count: number | null
          sale_price: number | null
          saved_at: string
          saved_by: string | null
          sold_units_last_30_days: number | null
          sold_units_last_7_days: number | null
          total_sold_units: number | null
        }
        Insert: {
          country_code: string
          dropkiller_uuid?: string | null
          external_id: string
          id?: never
          nombre_producto: string
          notas?: string | null
          primary_image_url?: string | null
          providers_count?: number | null
          sale_price?: number | null
          saved_at?: string
          saved_by?: string | null
          sold_units_last_30_days?: number | null
          sold_units_last_7_days?: number | null
          total_sold_units?: number | null
        }
        Update: {
          country_code?: string
          dropkiller_uuid?: string | null
          external_id?: string
          id?: never
          nombre_producto?: string
          notas?: string | null
          primary_image_url?: string | null
          providers_count?: number | null
          sale_price?: number | null
          saved_at?: string
          saved_by?: string | null
          sold_units_last_30_days?: number | null
          sold_units_last_7_days?: number | null
          total_sold_units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dropkiller_saved_products_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: number
          leida: boolean
          mensaje: string | null
          order_id: number | null
          task_id: number | null
          tipo: Database["public"]["Enums"]["notificacion_tipo_enum"]
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          leida?: boolean
          mensaje?: string | null
          order_id?: number | null
          task_id?: number | null
          tipo: Database["public"]["Enums"]["notificacion_tipo_enum"]
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          leida?: boolean
          mensaje?: string | null
          order_id?: number | null
          task_id?: number | null
          tipo?: Database["public"]["Enums"]["notificacion_tipo_enum"]
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          activo: boolean
          apellido: string | null
          barrio_referencia: string | null
          cantidad: number | null
          ciudad: string | null
          codigo_postal: string | null
          colonia: string | null
          comision_cod: number | null
          costo_devolucion: number | null
          costo_envio: number | null
          costo_producto: number | null
          created_at: string
          departamento: string | null
          direccion: string | null
          estado_crm: Database["public"]["Enums"]["estado_crm_enum"]
          estado_dropi: string | null
          estado_liquidacion: string | null
          fecha: string | null
          fecha_entrega_real: string | null
          fecha_liquidacion: string | null
          ganancia_esperada: number | null
          guia_envio: string | null
          id: number
          id_orden_dropi: number | null
          id_orden_shopify: string | null
          monto_a_ganar: number | null
          nivel_riesgo: string | null
          nombre: string | null
          nombre_producto: string | null
          notas_pedido: string | null
          numero_interior: string | null
          numero_orden: string | null
          pais: Database["public"]["Enums"]["pais_enum"]
          pedidos_devueltos_cliente: number | null
          pedidos_entregados_cliente: number | null
          precio: number | null
          punto_referencia: string | null
          tarea_generada_para_estado: string | null
          telefono: string | null
          total: number | null
          total_pedidos_cliente: number | null
          transportadora: string | null
          updated_at: string
          valor_liquidado: number | null
        }
        Insert: {
          activo?: boolean
          apellido?: string | null
          barrio_referencia?: string | null
          cantidad?: number | null
          ciudad?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          comision_cod?: number | null
          costo_devolucion?: number | null
          costo_envio?: number | null
          costo_producto?: number | null
          created_at?: string
          departamento?: string | null
          direccion?: string | null
          estado_crm?: Database["public"]["Enums"]["estado_crm_enum"]
          estado_dropi?: string | null
          estado_liquidacion?: string | null
          fecha?: string | null
          fecha_entrega_real?: string | null
          fecha_liquidacion?: string | null
          ganancia_esperada?: number | null
          guia_envio?: string | null
          id?: never
          id_orden_dropi?: number | null
          id_orden_shopify?: string | null
          monto_a_ganar?: number | null
          nivel_riesgo?: string | null
          nombre?: string | null
          nombre_producto?: string | null
          notas_pedido?: string | null
          numero_interior?: string | null
          numero_orden?: string | null
          pais: Database["public"]["Enums"]["pais_enum"]
          pedidos_devueltos_cliente?: number | null
          pedidos_entregados_cliente?: number | null
          precio?: number | null
          punto_referencia?: string | null
          tarea_generada_para_estado?: string | null
          telefono?: string | null
          total?: number | null
          total_pedidos_cliente?: number | null
          transportadora?: string | null
          updated_at?: string
          valor_liquidado?: number | null
        }
        Update: {
          activo?: boolean
          apellido?: string | null
          barrio_referencia?: string | null
          cantidad?: number | null
          ciudad?: string | null
          codigo_postal?: string | null
          colonia?: string | null
          comision_cod?: number | null
          costo_devolucion?: number | null
          costo_envio?: number | null
          costo_producto?: number | null
          created_at?: string
          departamento?: string | null
          direccion?: string | null
          estado_crm?: Database["public"]["Enums"]["estado_crm_enum"]
          estado_dropi?: string | null
          estado_liquidacion?: string | null
          fecha?: string | null
          fecha_entrega_real?: string | null
          fecha_liquidacion?: string | null
          ganancia_esperada?: number | null
          guia_envio?: string | null
          id?: never
          id_orden_dropi?: number | null
          id_orden_shopify?: string | null
          monto_a_ganar?: number | null
          nivel_riesgo?: string | null
          nombre?: string | null
          nombre_producto?: string | null
          notas_pedido?: string | null
          numero_interior?: string | null
          numero_orden?: string | null
          pais?: Database["public"]["Enums"]["pais_enum"]
          pedidos_devueltos_cliente?: number | null
          pedidos_entregados_cliente?: number | null
          precio?: number | null
          punto_referencia?: string | null
          tarea_generada_para_estado?: string | null
          telefono?: string | null
          total?: number | null
          total_pedidos_cliente?: number | null
          transportadora?: string | null
          updated_at?: string
          valor_liquidado?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: string
          nombre: string | null
          role: Database["public"]["Enums"]["role_enum"]
          telegram_chat_id: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          id: string
          nombre?: string | null
          role?: Database["public"]["Enums"]["role_enum"]
          telegram_chat_id?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          role?: Database["public"]["Enums"]["role_enum"]
          telegram_chat_id?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: never
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: never
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_webhook_events: {
        Row: {
          received_at: string
          webhook_id: string
        }
        Insert: {
          received_at?: string
          webhook_id: string
        }
        Update: {
          received_at?: string
          webhook_id?: string
        }
        Relationships: []
      }
      status_catalog: {
        Row: {
          activo: boolean
          categoria: Database["public"]["Enums"]["categoria_estado_enum"]
          created_at: string
          estado: string
          id: number
          notas: string | null
          transportadora: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_estado_enum"]
          created_at?: string
          estado: string
          id?: never
          notas?: string | null
          transportadora?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_estado_enum"]
          created_at?: string
          estado?: string
          id?: never
          notas?: string | null
          transportadora?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      status_history: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_estado_enum"] | null
          created_at: string
          estado: string
          id: number
          notas: string | null
          novedad: string | null
          order_id: number
          registrado_en: string
          transportadora: string | null
        }
        Insert: {
          categoria?:
            | Database["public"]["Enums"]["categoria_estado_enum"]
            | null
          created_at?: string
          estado: string
          id?: never
          notas?: string | null
          novedad?: string | null
          order_id: number
          registrado_en: string
          transportadora?: string | null
        }
        Update: {
          categoria?:
            | Database["public"]["Enums"]["categoria_estado_enum"]
            | null
          created_at?: string
          estado?: string
          id?: never
          notas?: string | null
          novedad?: string | null
          order_id?: number
          registrado_en?: string
          transportadora?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      task_handling_events: {
        Row: {
          id: number
          opened_at: string
          task_id: number
          usuario: string
        }
        Insert: {
          id?: never
          opened_at?: string
          task_id: number
          usuario: string
        }
        Update: {
          id?: never
          opened_at?: string
          task_id?: number
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_handling_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          asignado_a: string | null
          completado_en: string | null
          completado_por: string | null
          creado_por: string
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_tarea_enum"]
          fecha_limite: string | null
          id: number
          intento_numero: number
          notas_completado: string | null
          order_id: number
          resultado: string | null
          snoozed_until: string | null
          tipo: Database["public"]["Enums"]["tipo_tarea_enum"]
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a?: string | null
          completado_en?: string | null
          completado_por?: string | null
          creado_por?: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_tarea_enum"]
          fecha_limite?: string | null
          id?: never
          intento_numero?: number
          notas_completado?: string | null
          order_id: number
          resultado?: string | null
          snoozed_until?: string | null
          tipo: Database["public"]["Enums"]["tipo_tarea_enum"]
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a?: string | null
          completado_en?: string | null
          completado_por?: string | null
          creado_por?: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_tarea_enum"]
          fecha_limite?: string | null
          id?: never
          intento_numero?: number
          notas_completado?: string | null
          order_id?: number
          resultado?: string | null
          snoozed_until?: string | null
          tipo?: Database["public"]["Enums"]["tipo_tarea_enum"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_movement_catalog: {
        Row: {
          categoria: Database["public"]["Enums"]["tipo_movimiento_wallet_enum"]
          created_at: string
          identification_code: string
          nombre: string
          updated_at: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["tipo_movimiento_wallet_enum"]
          created_at?: string
          identification_code: string
          nombre: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["tipo_movimiento_wallet_enum"]
          created_at?: string
          identification_code?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallet_movements: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          guia_envio: string | null
          id: number
          id_movimiento_dropi: number
          id_orden_dropi: number | null
          identification_code: string | null
          order_id: number | null
          pais: Database["public"]["Enums"]["pais_enum"]
          previous_amount: number | null
          registrado_en: string
          tipo: string
          wallet_id: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          guia_envio?: string | null
          id?: never
          id_movimiento_dropi: number
          id_orden_dropi?: number | null
          identification_code?: string | null
          order_id?: number | null
          pais: Database["public"]["Enums"]["pais_enum"]
          previous_amount?: number | null
          registrado_en: string
          tipo: string
          wallet_id?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          guia_envio?: string | null
          id?: never
          id_movimiento_dropi?: number
          id_orden_dropi?: number | null
          identification_code?: string | null
          order_id?: number | null
          pais?: Database["public"]["Enums"]["pais_enum"]
          previous_amount?: number | null
          registrado_en?: string
          tipo?: string
          wallet_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movements_identification_code_fkey"
            columns: ["identification_code"]
            isOneToOne: false
            referencedRelation: "wallet_movement_catalog"
            referencedColumns: ["identification_code"]
          },
          {
            foreignKeyName: "wallet_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensajes_entrantes: {
        Row: {
          id: number
          mensaje_cliente: string
          order_id: number | null
          procesado: boolean
          recibido_en: string
          sugerencia_ia: string | null
          telefono_origen: string
        }
        Insert: {
          id?: never
          mensaje_cliente: string
          order_id?: number | null
          procesado?: boolean
          recibido_en?: string
          sugerencia_ia?: string | null
          telefono_origen: string
        }
        Update: {
          id?: never
          mensaje_cliente?: string
          order_id?: number | null
          procesado?: boolean
          recibido_en?: string
          sugerencia_ia?: string | null
          telefono_origen?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensajes_entrantes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensajes_salientes: {
        Row: {
          enviado_en: string
          enviado_por: string | null
          id: number
          mensaje_enviado: string
          order_id: number | null
          telefono_destino: string
        }
        Insert: {
          enviado_en?: string
          enviado_por?: string | null
          id?: never
          mensaje_enviado: string
          order_id?: number | null
          telefono_destino: string
        }
        Update: {
          enviado_en?: string
          enviado_por?: string | null
          id?: never
          mensaje_enviado?: string
          order_id?: number | null
          telefono_destino?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensajes_salientes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dinero_en_la_calle: {
        Args: never
        Returns: {
          dinero_en_la_calle: number
          nombre_producto: string
          pais: Database["public"]["Enums"]["pais_enum"]
          pedidos_por_entregar: number
        }[]
      }
      dropkiller_sweet_spot_candidates: {
        Args: never
        Returns: {
          captured_at: string
          country_code: string
          cumple_banda_sweet_spot: boolean
          cumple_consistencia: boolean
          cumple_tendencia_ascendente: boolean
          dias_con_venta_7d: number
          dropkiller_uuid: string
          es_sweet_spot: boolean
          external_id: string
          nombre_producto: string
          percentil_ritmo: number
          platform: string
          primary_image_url: string
          providers_count: number
          ritmo_reciente: number
          sale_price: number
          sold_units_last_30_days: number
          sold_units_last_7_days: number
          stock: number
          suggested_price: number
          tendencia_ratio: number
          tercio1_promedio: number
          tercio2_promedio: number
          tercio3_promedio: number
          total_sold_units: number
        }[]
      }
      dropkiller_sweet_spot_candidates_scored_v3: {
        Args: never
        Returns: {
          captured_at: string
          country_code: string
          cumple_banda_sweet_spot: boolean
          cumple_consistencia: boolean
          cumple_tendencia_ascendente: boolean
          dias_con_venta_7d: number
          es_sweet_spot: boolean
          external_id: string
          nombre_producto: string
          percentil_ritmo: number
          platform: string
          ritmo_reciente: number
          sale_price: number
          sold_units_last_30_days: number
          sold_units_last_7_days: number
          stock: number
          suggested_price: number
          tendencia_ratio: number
          tercio1_promedio: number
          tercio2_promedio: number
          tercio3_promedio: number
          total_sold_units: number
        }[]
      }
      is_authenticated_active_user: { Args: never; Returns: boolean }
      product_order_summary: {
        Args: never
        Returns: {
          cancelados: number
          confirmados: number
          confirmados_alguna_vez: number
          devoluciones: number
          en_transito: number
          entregados: number
          nombre_producto: string
          pais: Database["public"]["Enums"]["pais_enum"]
          pct_cancelacion: number
          pct_confirmacion: number
          pct_devolucion: number
          pct_entrega: number
          pendientes: number
          total: number
        }[]
      }
      reporte_semanal: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: {
          cancelados: number
          confirmados: number
          devoluciones: number
          entregas: number
          pais: Database["public"]["Enums"]["pais_enum"]
          pedidos_nuevos: number
        }[]
      }
      task_completions_by_user: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: {
          tareas_completadas: number
          tipo: string
          usuario: string
        }[]
      }
      task_handling_time_by_user: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: {
          minutos_promedio: number
          tareas_medidas: number
          usuario: string
        }[]
      }
      wallet_daily_summary: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: {
          dia: string
          entradas: number
          neto: number
          pais: Database["public"]["Enums"]["pais_enum"]
          salidas: number
        }[]
      }
      wallet_summary: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: {
          categoria: Database["public"]["Enums"]["tipo_movimiento_wallet_enum"]
          pais: Database["public"]["Enums"]["pais_enum"]
          tipo: string
          total: number
        }[]
      }
    }
    Enums: {
      categoria_estado_enum:
        | "nuevo"
        | "confirmado"
        | "guia_generada"
        | "en_ruta"
        | "novedad"
        | "proximo_a_llegar"
        | "entregado"
        | "cancelado"
        | "devolucion"
        | "sin_clasificar"
        | "en_reparto"
        | "recoger_oficina"
        | "intento_fallido"
      estado_abandonado_enum:
        | "nuevo"
        | "contactado"
        | "recuperado"
        | "descartado"
      estado_crm_enum:
        | "nuevo"
        | "en_ruta"
        | "entregado"
        | "cancelado"
        | "devolucion"
      estado_tarea_enum:
        | "pendiente"
        | "en_progreso"
        | "completada"
        | "cancelada"
      notificacion_tipo_enum:
        | "tarea_urgente_asignada"
        | "tarea_vencida"
        | "pedido_nuevo"
        | "novedad"
        | "pedido_entregado"
        | "pedido_devolucion"
        | "pedido_en_reparto"
      pais_enum: "CO" | "MX"
      role_enum: "admin"
      tipo_movimiento_wallet_enum:
        | "ganancia"
        | "costo_flete"
        | "devolucion_flete"
        | "indemnizacion"
        | "comision_referido"
        | "retiro"
        | "recarga"
        | "correccion"
        | "fulfillment"
        | "software"
        | "otro"
      tipo_tarea_enum:
        | "llamar_confirmacion"
        | "notificar_guia"
        | "presionar_entrega"
        | "notificar_proximo_llegar"
        | "resolver_novedad"
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
      categoria_estado_enum: [
        "nuevo",
        "confirmado",
        "guia_generada",
        "en_ruta",
        "novedad",
        "proximo_a_llegar",
        "entregado",
        "cancelado",
        "devolucion",
        "sin_clasificar",
        "en_reparto",
        "recoger_oficina",
        "intento_fallido",
      ],
      estado_abandonado_enum: [
        "nuevo",
        "contactado",
        "recuperado",
        "descartado",
      ],
      estado_crm_enum: [
        "nuevo",
        "en_ruta",
        "entregado",
        "cancelado",
        "devolucion",
      ],
      estado_tarea_enum: [
        "pendiente",
        "en_progreso",
        "completada",
        "cancelada",
      ],
      notificacion_tipo_enum: [
        "tarea_urgente_asignada",
        "tarea_vencida",
        "pedido_nuevo",
        "novedad",
        "pedido_entregado",
        "pedido_devolucion",
        "pedido_en_reparto",
      ],
      pais_enum: ["CO", "MX"],
      role_enum: ["admin"],
      tipo_movimiento_wallet_enum: [
        "ganancia",
        "costo_flete",
        "devolucion_flete",
        "indemnizacion",
        "comision_referido",
        "retiro",
        "recarga",
        "correccion",
        "fulfillment",
        "software",
        "otro",
      ],
      tipo_tarea_enum: [
        "llamar_confirmacion",
        "notificar_guia",
        "presionar_entrega",
        "notificar_proximo_llegar",
        "resolver_novedad",
      ],
    },
  },
} as const
