import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

const BASE_URL = process.env.APPSHEET_BASE_URL;
const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

if (!BASE_URL) {
  console.warn("Falta APPSHEET_BASE_URL en .env");
}
if (!APP_KEY) {
  console.warn("Falta APPSHEET_ACCESS_KEY en .env");
}

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

app.get("/api/base-datos", async (req, res) => {
  try {
    const dniDigits = digitsOnly(req.query.dni);
    if (!dniDigits) {
      return res.status(400).json({ found: false, message: "DNI requerido" });
    }

    const filter = `([DNI] = \"${dniDigits}\")`;
    let rows = [];

    try {
      const result = await appsheetAction(BASE_DATOS_TABLE, {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: filter,
      });
      rows = normalizeRows(result).filter(
        (row) => digitsOnly(row?.DNI ?? row?.["DNI"]) === dniDigits
      );
    } catch (error) {
      rows = [];
    }

    if (!rows.length) {
      const result = await appsheetAction(BASE_DATOS_TABLE, {
        Action: "Read",
        Properties: {},
        Rows: [],
      });
      const all = normalizeRows(result);
      const match = all.filter(
        (row) => digitsOnly(row?.DNI ?? row?.["DNI"]) === dniDigits
      );
      rows = match.length ? [match[0]] : [];
    }

    if (!rows.length) {
      return res.json({ found: false });
    }

    return res.json({ found: true, row: rows[0] });
  } catch (error) {
    return res.status(500).json({ found: false, error: error.message });
  }
});

app.get("/api/base-datos/all", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const result = await appsheetAction(BASE_DATOS_TABLE, {
      Action: "Read",
      Properties: {},
      Rows: [],
    });
    const rows = normalizeRows(result);
    return res.json({ count: rows.length, rows: rows.slice(0, limit) });
  } catch (error) {
    return res.status(500).json({ count: 0, rows: [], error: error.message });
  }
});

app.get("/api/postulaciones/exists", async (req, res) => {
  try {
    const dniDigits = digitsOnly(req.query.dni);
    const empleo = String(req.query.empleo || "").trim();
    if (!dniDigits || !empleo) {
      return res.status(400).json({ exists: false, message: "DNI y empleo requeridos" });
    }

    const idCandidato = `${dniDigits}-${empleo.toUpperCase()}`;
    const filter = `([ID Candidato] = \"${idCandidato}\")`;

    let rows = [];
    try {
      const result = await appsheetAction(POSTULACIONES_TABLE, {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: filter,
      });
      rows = normalizeRows(result).filter(
        (row) => String(row?.["ID Candidato"] ?? row?.["ID Candidato"]) === idCandidato
      );
    } catch (error) {
      rows = [];
    }

    if (!rows.length) {
      const result = await appsheetAction(POSTULACIONES_TABLE, {
        Action: "Read",
        Properties: {},
        Rows: [],
      });
      const all = normalizeRows(result);
      const match = all.find(
        (row) => String(row?.["ID Candidato"] ?? row?.["ID Candidato"]) === idCandidato
      );
      rows = match ? [match] : [];
    }

    return res.json({ exists: rows.length > 0 });
  } catch (error) {
    return res.status(500).json({ exists: false, error: error.message });
  }
});

app.get("/api/empleos", async (req, res) => {
  try {
    const empleo = String(req.query.empleo || "").trim();
    if (!empleo) {
      return res.status(400).json({ found: false, message: "Empleo requerido" });
    }

    const filter = `([Empleo] = \"${empleo}\")`;
    let rows = [];

    try {
      const result = await appsheetAction(EMPLEOS_TABLE, {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: filter,
      });
      rows = normalizeRows(result).filter(
        (row) => String(row?.Empleo ?? row?.["Empleo"]) === empleo
      );
    } catch (error) {
      rows = [];
    }

    if (!rows.length) {
      const result = await appsheetAction(EMPLEOS_TABLE, {
        Action: "Read",
        Properties: {},
        Rows: [],
      });
      const all = normalizeRows(result);
      const match = all.find(
        (row) => String(row?.Empleo ?? row?.["Empleo"]) === empleo
      );
      rows = match ? [match] : [];
    }

    if (!rows.length) {
      return res.json({ found: false });
    }

    const row = rows[0];
    return res.json({
      found: true,
      empleo: row?.Empleo ?? row?.["Empleo"] ?? "",
      descripcion: row?.["Descripción"] ?? row?.Descripcion ?? "",
    });
  } catch (error) {
    return res.status(500).json({ found: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
