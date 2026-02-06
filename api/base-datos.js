import { BASE_DATOS_TABLE, digitsOnly, appsheetAction, normalizeRows } from "./_utils.js";

export default async (req, res) => {
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
};
