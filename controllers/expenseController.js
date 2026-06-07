const db = require("../config/db");

exports.getExpenses = (req, res) => {
  let sql, params;
  if (req.user.role === "admin") {
    sql = `SELECT e.*, u.nom as user_nom FROM expenses e 
           JOIN users u ON e.user_id = u.id 
           ORDER BY e.created_at DESC`;
    params = [];
  } else {
    sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC";
    params = [req.user.id];
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json(results);
  });
};

exports.addExpense = (req, res) => {
  const { title, amount, category, date } = req.body;
  if (!title || !amount || !category || !date)
    return res.status(400).json({ message: "Champs obligatoires manquants" });
  const sql = "INSERT INTO expenses (user_id, title, amount, category, date) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [req.user.id, title, amount, category, date], (err, result) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.status(201).json({ message: "Dépense ajoutée !", id: result.insertId });
  });
};

exports.updateExpense = (req, res) => {
  const { id } = req.params;
  const { title, amount, category, date } = req.body;
  let sql, params;
  if (req.user.role === "admin") {
    sql = "UPDATE expenses SET title=?, amount=?, category=?, date=? WHERE id=?";
    params = [title, amount, category, date, id];
  } else {
    sql = "UPDATE expenses SET title=?, amount=?, category=?, date=? WHERE id=? AND user_id=?";
    params = [title, amount, category, date, id, req.user.id];
  }
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Dépense non trouvée" });
    res.json({ message: "Dépense modifiée !" });
  });
};

exports.deleteExpense = (req, res) => {
  const { id } = req.params;
  let sql, params;
  if (req.user.role === "admin") {
    sql = "DELETE FROM expenses WHERE id = ?";
    params = [id];
  } else {
    sql = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
    params = [id, req.user.id];
  }
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Dépense non trouvée" });
    res.json({ message: "Dépense supprimée !" });
  });
};

exports.getAllUsers = (req, res) => {
  const sql = "SELECT id, nom, email, role, statut, created_at FROM users";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json(results);
  });
};

exports.deleteUser = (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ message: "Vous ne pouvez pas vous supprimer vous-même" });
  db.query("DELETE FROM users WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json({ message: "Utilisateur supprimé !" });
  });
};

exports.toggleBlockUser = (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ message: "Impossible de vous bloquer vous-même" });
  db.query("SELECT statut FROM users WHERE id = ?", [id], (err, results) => {
    if (err || results.length === 0)
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    const newStatut = results[0].statut === "bloque" ? "actif" : "bloque";
    db.query("UPDATE users SET statut = ? WHERE id = ?", [newStatut, id], (err2) => {
      if (err2) return res.status(500).json({ message: "Erreur serveur" });
      res.json({
        message: `Utilisateur ${newStatut === "bloque" ? "bloqué" : "débloqué"} !`,
        statut: newStatut,
      });
    });
  });
};

exports.getGlobalStats = (req, res) => {
  db.query("SELECT COUNT(DISTINCT id) as total_users FROM users", (err, summaryResult) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    db.query("SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses GROUP BY category", (err2, categoryResult) => {
      if (err2) return res.status(500).json({ message: "Erreur serveur" });
      db.query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses", (err3, totalResult) => {
        if (err3) return res.status(500).json({ message: "Erreur serveur" });
        res.json({
          total_users: summaryResult[0].total_users,
          total_amount: totalResult[0].total,
          categories: categoryResult,
        });
      });
    });
  });
};