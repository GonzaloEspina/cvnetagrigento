// Implementación basada en la versión original que funcionaba (commit bfcb105)

function valueToString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const cand = v.value ?? v.displayValue ?? v.text ?? v.label ?? null;
    if (cand === null || cand === undefined) {
      try { return String(v); } catch (e) { return ""; }
    }
    if (typeof cand === "object") return JSON.stringify(cand);
    return String(cand);
  }
  return String(v);
}

function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.rows && Array.isArray(data.rows)) return data.rows;
  if (data.Rows && Array.isArray(data.Rows)) return data.Rows;
  return [data];
}

function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
}

function digitsOnly(v) {
  if (v === null || v === undefined) return "";
  return valueToString(v).replace(/\D/g, "");
}

function rowContainsEmail(row, emailLower) {
  try {
    for (const key of Object.keys(row || {})) {
      const v = row[key];
      if (v === null || v === undefined) continue;
      const s = valueToString(v).trim().toLowerCase();
      if (s === emailLower) return true;
      if (s.includes(emailLower)) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contacto } = req.body || {};
    console.log('🔍 ORIGINAL LOGIC - Searching for:', contacto);
    
    if (!contacto) {
      return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
    }

    const input = String(contacto).trim();
    const emailMode = isEmail(input);
    
    console.log('📋 Search parameters:', { input, emailMode });

    // Configuración AppSheet
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
    
    console.log('🔧 AppSheet config:', { BASE, hasKey: !!APP_KEY });

    // Función doAction EXACTA del appsheetService.js original
    async function doAction(tableName, body) {
      const url = `${BASE}/tables/${encodeURIComponent(tableName)}/Action`;
      const headers = {
        "Content-Type": "application/json",
      };
      
      // Usar ApplicationAccessKey como en el original (no "ApplicationAccessKey")
      if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
      
      console.log("[AppSheet] POST", url, "body:", JSON.stringify(body));
      console.log("[AppSheet] request headers:", headers);

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // log response headers como el original
      try {
        const hdrs = {};
        resp.headers.forEach((v,k) => hdrs[k] = v);
        console.log("[AppSheet] response headers:", hdrs);
      } catch(e) { /* ignore */ }

      const raw = await resp.text().catch(() => "");
      console.log(`[AppSheet] response status ${resp.status} raw:`, raw);

      let json = null;
      try { 
        json = raw ? JSON.parse(raw) : null; 
      } catch (err) { 
        console.warn("[AppSheet] response not JSON");
        json = raw; 
      }

      return json;
    }

    // Funciones auxiliares del appsheetService.js original
    async function readRows(tableName) {
      const body = { Action: "Read", Properties: {}, Rows: [] };
      return await doAction(tableName, body);
    }

    async function findRows(table, filter) {
      const body = { Action: "Find", Properties: {}, Rows: [], Filter: filter || "" };
      return await doAction(table, body);
    }

    // LÓGICA EXACTA del clientsController.js original
    let rows = [];
    const CLIENTES_TABLE = "Clientes";
    const esc = v => String(v || "").replace(/"/g, '\\"');

    if (emailMode) {
      // Búsqueda por email usando findRows con Filter (como el original)
      const filter = `([Correo] = "${esc(input)}")`;
      console.log('[findClient] Searching by email with filter:', filter);
      
      try {
        const clientResp = await findRows(CLIENTES_TABLE, filter);
        rows = normalizeRows(clientResp) || [];
        console.log('[findClient] findRows por email results:', rows.length);
      } catch (e) {
        console.warn("[findClient] findRows por email falló, intentar readRows", e?.message ?? e);
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
        console.log('[findClient] readRows fallback results:', rows.length);
      }
    } else {
      // Búsqueda por teléfono: intentar findRows con OR de columnas, fallback a readRows
      const digitsTarget = digitsOnly(input);
      const escVal = v => String(v || "").replace(/"/g, '\\"');
      const phoneCols = ['Teléfono','Telefono','Tel','phone','Phone','TelefonoContacto'];
      const phoneFilters = phoneCols.map(c => `([${c}] = "${escVal(digitsTarget)}")`);
      
      console.log('[findClient] Searching by phone with filters:', phoneFilters.join(" OR "));
      
      try {
        const resp = await findRows(CLIENTES_TABLE, phoneFilters.join(" OR "));
        rows = normalizeRows(resp) || [];
        console.log("[findClient] findRows por teléfono count:", (rows || []).length);
      } catch (e) {
        console.warn("[findClient] findRows por teléfono falló, intentando readRows", e?.message ?? e);
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
        console.log("[findClient] readRows phone fallback results:", rows.length);
      }
    }

    // Filtrado robusto según modo (EXACTO del clientsController original)
    if (emailMode) {
      const emailLower = input.toLowerCase();
      rows = (rows || []).filter(r => {
        const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
        if (c === emailLower) {
          console.log('[findClient] ✅ Email exact match found:', c);
          return true;
        }
        return rowContainsEmail(r, emailLower);
      });
    } else {
      // Filtrado por teléfono exacto del clientsController original
      const digitsTarget = digitsOnly(input);
      console.log("[findClient] phone search target (input):", input, "digitsTarget:", digitsTarget);
      
      // Log de muestra
      try {
        console.log("[findClient] sample phones (raw):", (rows || []).slice(0,10).map(r => valueToString(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "")));
        console.log("[findClient] sample phones (digits):", (rows || []).slice(0,10).map(r => digitsOnly(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "")));
      } catch(e) { /* ignore logging errors */ }

      rows = (rows || []).filter(r => {
        const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
        const phoneStr = valueToString(phoneRaw).trim();
        const pd = digitsOnly(phoneRaw);
        
        // igualdad estricta con lo que envía el front (sin modificaciones)
        if (phoneStr && phoneStr === input) {
          console.log('[findClient] ✅ Phone exact match:', phoneStr);
          return true;
        }
        // fallback: igualdad por dígitos
        if (pd && pd === digitsTarget) {
          console.log('[findClient] ✅ Phone digits match:', pd);
          return true;
        }
        return false;
      });
    }

    // Fallback final: leer todo y filtrar localmente (como el original)
    if (!rows || rows.length === 0) {
      console.log('[findClient] No results, trying fallback readRows');
      const all = await readRows(CLIENTES_TABLE);
      const allRows = normalizeRows(all) || [];
      console.log('[findClient] fallback readRows count:', allRows.length);
      
      if (emailMode) {
        const emailLower = input.toLowerCase();
        rows = allRows.filter(r => {
          const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
          if (c === emailLower) return true;
          return rowContainsEmail(r, emailLower);
        });
      } else {
        const digitsTarget = digitsOnly(input);
        console.log("[findClient] fallback readRows phone target:", input, digitsTarget);
        rows = allRows.filter(r => {
          const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
          const phoneStr = valueToString(phoneRaw).trim();
          const pd = digitsOnly(phoneRaw);
          if (phoneStr && phoneStr === input) return true;
          if (pd && pd === digitsTarget) return true;
          return false;
        });
      }
    }

    console.log('🎯 Final filtered results:', rows.length);

    // Si no encontramos cliente
    if (!rows || rows.length === 0) {
      const contactType = emailMode ? "correo" : "teléfono";
      const prefill = emailMode ? { Correo: input } : { Telefono: input };
      const message = `No se encontró el ${contactType} ingresado, por favor complete sus datos para sacar un turno.`;
      return res.status(200).json({ found: false, contactType, prefill, message });
    }

    // Cliente encontrado - IMPLEMENTACIÓN COMPLETA del clientsController.js original
    const client = rows[0];
    
    // Extraer Row ID del cliente (necesario para buscar turnos y membresías)
    function extractClientRowId(client) {
      return client["Row ID"] ?? client["RowID"] ?? client["RowId"] ?? client._RowNumber ?? client._rowNumber ?? client.id ?? client["Key"] ?? null;
    }
    
    const clientRowId = extractClientRowId(client);
    console.log('🎉 SUCCESS! Client found:', client["Nombre y Apellido"] || client.Nombre, 'Row ID:', clientRowId);

    // Normalizar correo: buscar entre varias columnas y asignar sólo si es email válido
    const emailCols = ['Correo','Email','Mail','mail','correo','email'];
    let foundEmail = "";
    for (const col of emailCols) {
      const v = valueToString(client[col] ?? "");
      if (isEmail(v.trim())) { foundEmail = v.trim(); break; }
    }
    client.Correo = foundEmail || "";
    // limpiar duplicados/otras columnas
    for (const col of emailCols) {
      if (col === 'Correo') continue;
      client[col] = client.Correo ? client.Correo : "";
    }

    // OBTENER TURNOS DEL CLIENTE (filtrado localmente por seguridad)
    let upcoming = [];
    let memberships = [];
    
    try {
      // Buscar turnos por Cliente ID
      const filterTurnos = clientRowId ? `([Cliente ID] = "${String(clientRowId).replace(/"/g,'\\"')}")` : null;
      let turnosResp = filterTurnos ? await findRows("Turnos", filterTurnos) : await readRows("Turnos");
      let turnosRows = normalizeRows(turnosResp) || [];

      console.log("[findClient] distinct cliente IDs in turnos (sample):", Array.from(new Set((turnosRows || []).map(t => String(t["Cliente ID"] ?? t["ClienteID"] ?? t.Cliente ?? "").trim()).filter(Boolean))).slice(0,20));

      if (clientRowId) {
        const cid = String(clientRowId).trim();
        const matched = (turnosRows || []).filter(t => {
          const tid = String(t["Cliente ID"] ?? t["ClienteID"] ?? t["Cliente Id"] ?? t["Cliente"] ?? t.Cliente ?? "").trim();
          if (tid === cid) return true;
          if (String(t["Cliente Key"] ?? t["Cliente_Key"] ?? t["ClienteId"] ?? "").trim() === cid) return true;
          for (const k of Object.keys(t || {})) {
            const v = t[k];
            if (v === null || v === undefined) continue;
            if (String(v).trim() === cid) return true;
          }
          return false;
        });
        turnosRows = matched;
      } else {
        turnosRows = (turnosRows || []).filter(t => {
          const contactoTurno = String(t.Contacto ?? t["Contacto"] ?? "").trim().toLowerCase();
          if (contactoTurno && contactoTurno === input.toLowerCase()) return true;
          return rowContainsEmail(t, input.toLowerCase());
        });
      }

      // FILTRAR SOLO TURNOS DESDE HOY EN ADELANTE
      const pad2 = (n) => String(n).padStart(2, "0");
      const now = new Date();
      const todayIso = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth()+1)}-${pad2(now.getUTCDate())}`;

      const isoCandidatesFromString = (s) => {
        if (!s) return [];
        const out = new Set();
        const str = String(s).trim();
        // ISO explícito yyyy-mm-dd
        const mIso = str.match(/(\d{4}-\d{2}-\d{2})/);
        if (mIso) out.add(mIso[1]);
        // buscar D/M/Y o M/D/Y variantes
        for (const m of str.matchAll(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g)) {
          let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
          if (y < 100) y += 2000;
          if (a > 12 && b <= 12) {
            out.add(new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10));
          } else if (b > 12 && a <= 12) {
            out.add(new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10));
          } else {
            const d1 = new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10);
            out.add(d1);
            const d2 = new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10);
            if (d2 !== d1) out.add(d2);
          }
        }
        return Array.from(out);
      };

      // solo conservar turnos cuya fecha sea >= todayIso
      upcoming = (turnosRows || []).filter(t => {
        const s = String(t.Fecha ?? t['Fecha'] ?? "");
        const candidates = isoCandidatesFromString(s);
        if (!candidates || candidates.length === 0) return false;
        return candidates.some(c => c >= todayIso);
      });
      console.log("[findClient] upcoming count after date filter (>=today):", upcoming.length);

      // BUSCAR MEMBRESÍAS POR CLIENTE ROW ID
      try {
        memberships = [];
        console.log("[findClient] clientRowId:", clientRowId);
        if (clientRowId) {
          const escClient = v => String(v || "").replace(/"/g, '\\"');
          const filter = `([Cliente] = "${escClient(clientRowId)}")`;
          console.log("[findClient] fetching memberships with filter:", filter);
          let membRows = [];
          try {
            const membResp = await findRows("Membresías Activas", filter);
            console.log("[findClient] Membresías Activas findRows raw:", membResp);
            membRows = normalizeRows(membResp) || [];
          } catch (err) {
            console.warn("[findClient] findRows Membresías Activas falló (no crítico):", err?.message ?? err);
          }

          // filtrar localmente por coincidencia exacta/contains en el campo Cliente
          const matchId = String(clientRowId).trim();
          let filtered = (membRows || []).filter(m => {
            const cli = valueToString(m["Cliente"] ?? m.Cliente ?? "").trim();
            return cli === matchId || cli.includes(matchId);
          });

          // si no encontramos nada con findRows, hacer readRows y filtrar localmente (más robusto)
          if (!filtered || filtered.length === 0) {
            try {
              const all = await readRows("Membresías Activas");
              const allRows = normalizeRows(all) || [];
              filtered = (allRows || []).filter(m => {
                const cli = valueToString(m["Cliente"] ?? m.Cliente ?? "").trim();
                return cli === matchId || cli.includes(matchId);
              });
              console.log("[findClient] Membresías Activas readRows filtered count:", filtered.length);
            } catch (e) {
              console.warn("[findClient] readRows Membresías Activas falló:", e?.message ?? e);
              filtered = [];
            }
          }

          memberships = (filtered || []).map(m => ({
            "Row ID": valueToString(m["Row ID"] ?? m.RowID ?? m["RowID"] ?? ""),
            Membresía: valueToString(m["Membresía"] ?? m.Membresia ?? m["Membresía "] ?? ""),
            "Fecha de Inicio": valueToString(m["Fecha de Inicio"] ?? m.FechaInicio ?? ""),
            Vencimiento: valueToString(m["Vencimiento"] ?? m.Vencimiento ?? ""),
            "Turnos Restantes": valueToString(m["Turnos Restantes"] ?? m["Turnos Restantes "] ?? m.TurnosRestantes ?? ""),
            Estado: valueToString(m["Estado"] ?? m.Estado ?? "")
          }));
        }
      } catch (err2) {
        console.warn("[findClient] error procesando membresías:", err2?.message ?? err2);
        memberships = [];
      }
      console.log("[findClient] memberships count:", memberships.length);

    } catch (e) {
      console.error("[findClient] error obteniendo turnos:", e);
      upcoming = [];
    }

    return res.status(200).json({ 
      found: true, 
      client, 
      upcoming, 
      memberships 
    });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({
      found: false,
      message: "Error interno al buscar cliente.",
      error: error.message
    });
  }
}