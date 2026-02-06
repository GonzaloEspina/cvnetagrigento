const { POSTULACIONES_TABLE, appsheetAction, normalizeRows } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const dni = String(req.query.dni || "").trim();
    const empleo = String(req.query.empleo || "").trim();
    if (!dni || !empleo) {
      return res.status(400).json({ exists: false, message: "DNI y empleo requeridos" });
    }

    const idCandidato = `${dni}-${empleo.toUpperCase()}`;
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
};
