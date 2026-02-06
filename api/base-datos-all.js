import { BASE_DATOS_TABLE, appsheetAction, normalizeRows } from "./_utils.js";

export default async (req, res) => {
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
};
