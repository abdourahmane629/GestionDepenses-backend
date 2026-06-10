const db = require("../config/db");

/* ===== GET — globales + les siennes ===== */
exports.getCategories = (req, res) => {
  db.query(
    `SELECT * FROM categories
     WHERE user_id IS NULL OR user_id = ?
     ORDER BY is_default DESC, user_id IS NULL DESC, label ASC`,
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      res.json(results);
    }
  );
};

/* ===== POST — ajouter une catégorie ===== */
exports.addCategory = (req, res) => {
  const { label, color } = req.body;
  if (!label || !label.trim())
    return res.status(400).json({ message: "Nom de catégorie requis" });

  // Admin → catégorie globale (user_id = NULL), utilisateur → catégorie personnelle
  const userId = req.user.role === "admin" ? null : req.user.id;

  db.query(
    "INSERT INTO categories (label, color, user_id, is_default) VALUES (?, ?, ?, 0)",
    [label.trim(), color || "#95a5a6", userId],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ message: "Cette catégorie existe déjà" });
        return res.status(500).json({ message: "Erreur serveur" });
      }
      res.status(201).json({
        message: "Catégorie ajoutée !",
        category: {
          id: result.insertId,
          label: label.trim(),
          color: color || "#95a5a6",
          user_id: userId,
          is_default: 0,
        },
      });
    }
  );
};

/* ===== DELETE — supprimer une catégorie (non-défaut) ===== */
exports.deleteCategory = (req, res) => {
  const { id } = req.params;

  // Les catégories par défaut ne peuvent pas être supprimées
  const query = req.user.role === "admin"
    ? "DELETE FROM categories WHERE id = ? AND is_default = 0"
    : "DELETE FROM categories WHERE id = ? AND user_id = ? AND is_default = 0";
  const params = req.user.role === "admin" ? [id] : [id, req.user.id];

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "Catégorie introuvable ou non supprimable" });
    res.json({ message: "Catégorie supprimée" });
  });
};
