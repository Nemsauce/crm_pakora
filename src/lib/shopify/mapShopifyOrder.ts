type JsonRecord = Record<string, unknown>;

type ShopifyAddress = {
  first_name?: unknown;
  last_name?: unknown;
  phone?: unknown;
  address1?: unknown;
  address2?: unknown;
  city?: unknown;
  province?: unknown;
};

type ShopifyLineItem = {
  title?: unknown;
  quantity?: number | null;
  price?: string | number | null;
};

type ShopifyNoteAttribute = {
  name?: unknown;
  value?: unknown;
};

type ShopifyOrder = JsonRecord & {
  id?: string | number;
  name?: string | null;
  order_number?: string | number | null;
  created_at?: unknown;
  processed_at?: unknown;
  phone?: unknown;
  note?: unknown;
  total_price?: string | number | null;
  billing_address?: ShopifyAddress | null;
  line_items?: ShopifyLineItem[] | null;
  note_attributes?: ShopifyNoteAttribute[] | null;
};

export type MappedShopifyOrder = {
  numero_orden: string | null;
  id_orden_shopify: string;
  fecha: string;
  nombre: string;
  apellido: string;
  telefono: string;
  direccion: string;
  barrio_referencia: string;
  ciudad: string;
  departamento: string;
  nombre_producto: string;
  cantidad: number;
  precio: number;
  total: number;
  notas_pedido: string | null;
  estado_crm: "nuevo";
  activo: true;
  comentario: string | null;
};

function sanitize(value: unknown) {
  if (!value) return "";

  return String(value).replace(/[\x00-\x1F\x7F]/g, " ").trim();
}

function readOrder(rawOrder: unknown): ShopifyOrder {
  if (!rawOrder || typeof rawOrder !== "object" || Array.isArray(rawOrder)) {
    throw new Error("Invalid Shopify order payload");
  }

  return rawOrder as ShopifyOrder;
}

function readAddress(value: ShopifyAddress | null | undefined) {
  return value && typeof value === "object" ? value : {};
}

function readFirstLineItem(order: ShopifyOrder) {
  return (order.line_items || [])[0] || {};
}

function parseAmount(value: string | number | null | undefined) {
  return Number.parseFloat(String(value || 0));
}

function mapDate(order: ShopifyOrder) {
  try {
    const dateValue =
      order.created_at || order.processed_at || new Date().toISOString();
    return String(dateValue).slice(0, 10);
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function mapShopifyOrderCO(rawOrder: unknown): MappedShopifyOrder {
  const order = readOrder(rawOrder);
  const lineItem = readFirstLineItem(order);
  const noteAttributes = order.note_attributes || [];
  const getAttribute = (name: string) => {
    const attribute = noteAttributes.find((item) => item.name === name);
    return attribute ? sanitize(attribute.value) : "";
  };
  const address = readAddress(order.billing_address);
  const comentario = sanitize(order.note || "");

  return {
    numero_orden: order.name as string | null,
    id_orden_shopify: String(order.id),
    fecha: mapDate(order),
    nombre: sanitize(address.first_name || getAttribute("Nombre")),
    apellido: sanitize(address.last_name || getAttribute("Apellido")),
    telefono: sanitize(order.phone || address.phone),
    direccion: sanitize(address.address1),
    barrio_referencia: sanitize(address.address2),
    ciudad: sanitize(address.city),
    departamento: sanitize(address.province),
    nombre_producto: sanitize(lineItem.title),
    cantidad: lineItem.quantity || 1,
    precio: parseAmount(lineItem.price),
    total: parseAmount(order.total_price),
    notas_pedido: sanitize(order.note),
    estado_crm: "nuevo",
    activo: true,
    comentario,
  };
}

export function mapShopifyOrderMX(rawOrder: unknown): MappedShopifyOrder {
  const order = readOrder(rawOrder);
  const billing = readAddress(order.billing_address);
  const lineItem = readFirstLineItem(order);
  const notas = sanitize(order.note);
  const comentario = notas.length > 0 ? notas : null;

  return {
    numero_orden: order.order_number ? `#${order.order_number}` : null,
    id_orden_shopify: String(order.id),
    fecha: mapDate(order),
    nombre: sanitize(billing.first_name),
    apellido: sanitize(billing.last_name),
    telefono: sanitize(billing.phone || order.phone),
    direccion: sanitize(billing.address1),
    barrio_referencia: sanitize(billing.address2),
    ciudad: sanitize(billing.city),
    departamento: sanitize(billing.province),
    nombre_producto: sanitize(lineItem.title),
    cantidad: lineItem.quantity || 1,
    precio: parseAmount(lineItem.price),
    total: parseAmount(order.total_price),
    notas_pedido: notas || null,
    estado_crm: "nuevo",
    activo: true,
    comentario,
  };
}
