export type TaskWhatsAppOrder = {
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  nombre_producto: string | null;
  cantidad: number | null;
  total: number | null;
  direccion: string | null;
  barrio_referencia: string | null;
  ciudad: string | null;
  departamento: string | null;
  guia_envio: string | null;
  transportadora: string | null;
  pais: "CO" | "MX";
};

type TaskWhatsAppTask = {
  tipo: string;
  titulo?: string | null;
  descripcion?: string | null;
};

const EN_REPARTO_TASK_TITLE =
  "Confirmar que el cliente esté pendiente de recibir";

const currencyFormatter = {
  CO: new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }),
  MX: new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }),
} satisfies Record<TaskWhatsAppOrder["pais"], Intl.NumberFormat>;

function clean(value: string | null) {
  return value?.trim() ?? "";
}

function getGreeting(nombre: string) {
  return nombre ? `Hola ${nombre}!` : "Hola!";
}

function getFullName(order: TaskWhatsAppOrder) {
  return [clean(order.nombre), clean(order.apellido)].filter(Boolean).join(" ");
}

function getProductAndQuantity(order: TaskWhatsAppOrder) {
  const product = clean(order.nombre_producto);

  if (order.cantidad !== null && order.cantidad > 1) {
    return [product, `x${order.cantidad}`].filter(Boolean).join(" ");
  }

  return product;
}

function getFormattedTotal(order: TaskWhatsAppOrder) {
  if (order.total === null || !Number.isFinite(order.total)) {
    return "";
  }

  return currencyFormatter[order.pais].format(order.total);
}

function getFullAddress(order: TaskWhatsAppOrder) {
  return [
    order.direccion,
    order.barrio_referencia,
    order.ciudad,
    order.departamento,
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

export function buildTaskWhatsAppMessage(
  tarea: TaskWhatsAppTask,
  order: TaskWhatsAppOrder,
): string | null {
  if (order.pais === "MX" && tarea.tipo === "llamar_confirmacion") {
    return null;
  }

  const nombre = clean(order.nombre);
  const greeting = `${getGreeting(nombre)} 😊 Te escribe Leidy de Pakora.`;

  if (tarea.tipo === "llamar_confirmacion") {
    const nombreCompleto = getFullName(order);
    const telefono = clean(order.telefono);
    const productoYCantidad = getProductAndQuantity(order);
    const valor = getFormattedTotal(order);
    const direccionCompleta = getFullAddress(order);

    return `${greeting}\n\nEstamos realizando la validación final de tu pedido antes de prepararlo y generar la guía de envío 📦✅\n\nPor favor, confírmanos que los siguientes datos son correctos:\n\nNombre: ${nombreCompleto}\nTeléfono: ${telefono}\nProducto: ${productoYCantidad}\nValor a pagar: ${valor}\nDirección: ${direccionCompleta}\n\n¿Nos confirmas que podemos realizar el envío con estos datos? Si necesitas corregir algo, indícanos por favor.\n\nQuedamos atentos. 💛`;
  }

  if (tarea.tipo === "notificar_guia") {
    const guia = clean(order.guia_envio);
    const transportadora = clean(order.transportadora);

    return `${greeting}\n\nTu guía de envío ya fue generada 📦✅\n\nNúmero de guía: ${guia}\nTransportadora: ${transportadora}\n\nCon este número puedes rastrear el estado de tu paquete directamente con la transportadora 🚚💨\n\nQuedamos atentos a cualquier cosa. 💛`;
  }

  if (tarea.tipo === "notificar_proximo_llegar") {
    return `${greeting}\n\n¡Buenas noticias! Tu pedido ya esta en reparto y llegará pronto 📦🚚\n\nLa entrega puede realizarse durante el día de hoy o mañana. Por favor, mantente pendiente de tu teléfono por si el repartidor necesita contactarte.\n\nQuedamos atentos a cualquier cosa. 💛`;
  }

  if (
    tarea.tipo === "presionar_entrega" &&
    tarea.titulo === EN_REPARTO_TASK_TITLE &&
    !tarea.descripcion?.trim()
  ) {
    return `${greeting}\n\n¡Buenas noticias! Tu pedido ya fue asignado a un mensajero y llegará pronto 📦🚚\n\nLa entrega puede realizarse durante el día de hoy o mañana. Por favor, mantente pendiente de tu teléfono por si el repartidor necesita contactarte.\n\nQuedamos atentos a cualquier cosa. 💛`;
  }

  return null;
}
