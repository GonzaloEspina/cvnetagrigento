const BASE_URL = process.env.APPSHEET_BASE_URL;
const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

const BASE_DATOS_TABLE = process.env.APPSHEET_BASE_DATOS_TABLE || "Base de Datos";
const POSTULACIONES_TABLE = process.env.APPSHEET_POSTULACIONES_TABLE || "Postulaciones";
const EMPLEOS_TABLE = process.env.APPSHEET_EMPLEOS_TABLE || "Empleos";

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

async function appsheetAction(table, body) {
  const url = `${BASE_URL.replace(/\/$/, "")}/tables/${encodeURIComponent(table)}/Action`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApplicationAccessKey: APP_KEY,
    },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }

  if (!resp.ok) {
    const message = typeof json === "string" ? json : JSON.stringify(json);
    throw new Error(message || "AppSheet error");
  }

  return json;
}

function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.Rows)) return data.Rows;
  if (Array.isArray(data.rows)) return data.rows;
  return [];
}

module.exports = {
  BASE_DATOS_TABLE,
  POSTULACIONES_TABLE,
  EMPLEOS_TABLE,
  digitsOnly,
  appsheetAction,
  normalizeRows,
};
