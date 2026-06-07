const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = (req, res) => {
  const { nom, email, password, role } = req.body;
  if (!nom || !email || !password)
    return res.status(400).json({ message: "Champs obligatoires manquants" });

  const hashedPassword = bcrypt.hashSync(password, 10);
  const userRole = role === "admin" ? "admin" : "user";

  db.query(
    "INSERT INTO users (nom, email, password, role) VALUES (?, ?, ?, ?)",
    [nom, email, hashedPassword, userRole],
    (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ message: "Email déjà utilisé" });
        return res.status(500).json({ message: "Erreur serveur" });
      }
      res.status(201).json({ message: "Compte créé avec succès !" });
    }
  );
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email et mot de passe requis" });

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (results.length === 0)
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });

    const user = results[0];
    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });

    const token = jwt.sign(
      { id: user.id, nom: user.nom, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({
      message: "Connexion réussie", token,
      user: { id: user.id, nom: user.nom, email: user.email, role: user.role },
    });
  });
};

exports.googleAuth = async (req, res) => {
  const { id_token } = req.body;
  try {
    let googleData;

    // Essai 1 : id_token
    const res1 = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`
    );
    googleData = await res1.json();

    // Essai 2 : access_token si id_token échoue
    if (googleData.error) {
      const res2 = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo`,
        { headers: { Authorization: `Bearer ${id_token}` } }
      );
      googleData = await res2.json();
    }

    if (!googleData.email) {
      return res.status(401).json({ message: "Token Google invalide" });
    }

    const email = googleData.email;
    const name = googleData.name || googleData.given_name || email.split("@")[0];

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });

      if (results.length > 0) {
        const user = results[0];
        if (user.statut === "bloque")
          return res.status(403).json({ message: "Compte bloqué" });

        const needsPassword = !user.password || user.password === "";

        const token = jwt.sign(
          { id: user.id, nom: user.nom, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "24h" }
        );
        return res.json({
          message: "Connexion réussie", token,
          needsPassword,
          user: { id: user.id, nom: user.nom, email: user.email, role: user.role },
        });
      }

      db.query(
        "INSERT INTO users (nom, email, password, role, statut) VALUES (?, ?, '', 'user', 'actif')",
        [name, email],
        (err2, result) => {
          if (err2) return res.status(500).json({ message: "Erreur serveur" });
          const newUser = { id: result.insertId, nom: name, email, role: "user" };
          const token = jwt.sign(newUser, process.env.JWT_SECRET, { expiresIn: "24h" });
          res.status(201).json({ message: "Compte créé !", token, needsPassword: true, user: newUser });
        }
      );
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.setPassword = (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ message: "Mot de passe trop court (min 6 caractères)" });

  const hashedPassword = bcrypt.hashSync(password, 10);
  db.query(
    "UPDATE users SET password = ? WHERE id = ?",
    [hashedPassword, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      res.json({ message: "Mot de passe défini avec succès !" });
    }
  );
};