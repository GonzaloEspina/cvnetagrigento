const { EMPLEOS_TABLE, appsheetAction, normalizeRows } = require("./_utils");

module.exports = async (req, res) => {
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
};
