const jwt = require("jsonwebtoken");
const db = require("../config/db");

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Token manquant" });

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.user = decoded;

    // Vérifier en temps réel si l'utilisateur est bloqué
    db.query("SELECT statut FROM users WHERE id = ?", [decoded.id], (err, results) => {
      if (!err && results.length > 0 && results[0].statut === "bloque") {
        return res.status(403).json({ message: "Compte bloqué par l'administrateur" });
      }
      next();
    });
  } catch (err) {
    return res.status(403).json({ message: "Token invalide" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Accès réservé aux admins" });
  }
  next();
};

module.exports = { verifyToken, isAdmin };
