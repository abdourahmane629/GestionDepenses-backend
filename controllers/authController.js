const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Créer le transporteur email
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

/* ===== REGISTER ===== */
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

/* ===== LOGIN ===== */
exports.login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email et mot de passe requis" });

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (results.length === 0)
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });

    const user = results[0];

    // Vérifier si le compte est bloqué
    if (user.statut === "bloque")
      return res.status(403).json({ message: "Compte bloqué par l'administrateur" });

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

/* ===== GOOGLE AUTH ===== */
exports.googleAuth = async (req, res) => {
  const { id_token } = req.body;
  try {
    let googleData;

    const res1 = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
    googleData = await res1.json();

    if (googleData.error) {
      const res2 = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
        headers: { Authorization: `Bearer ${id_token}` },
      });
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
          return res.status(403).json({ message: "Compte bloqué par l'administrateur" });

        const needsPassword = !user.password || user.password === "";
        const token = jwt.sign(
          { id: user.id, nom: user.nom, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "24h" }
        );
        return res.json({
          message: "Connexion réussie", token, needsPassword,
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

/* ===== SET PASSWORD (après Google) ===== */
exports.setPassword = (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ message: "Mot de passe trop court (min 6 caractères)" });

  const hashedPassword = bcrypt.hashSync(password, 10);
  db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id], (err) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json({ message: "Mot de passe défini avec succès !" });
  });
};

/* ===== MOT DE PASSE OUBLIÉ — envoi du code ===== */
exports.forgotPassword = (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email requis" });

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (results.length === 0)
      return res.status(404).json({ message: "Aucun compte avec cet email" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    db.query(
      "UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE email = ?",
      [code, expires, email],
      async (err2) => {
        if (err2) return res.status(500).json({ message: "Erreur serveur" });

        try {
          const transporter = createTransporter();
          await transporter.sendMail({
            from: `"GestionDépenses" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Code de réinitialisation de mot de passe",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 30px;">
                <h2 style="color: #2ecc71; margin-bottom: 10px;">Réinitialisation de mot de passe</h2>
                <p style="color: #555;">Votre code de vérification est :</p>
                <div style="font-size: 40px; font-weight: bold; color: #1a1a2e;
                     background: #f5f5f5; padding: 24px; border-radius: 12px;
                     text-align: center; letter-spacing: 10px; margin: 20px 0;">
                  ${code}
                </div>
                <p style="color: #888; font-size: 13px;">Ce code expire dans <strong>15 minutes</strong>.</p>
                <p style="color: #bbb; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
              </div>
            `,
          });
          res.json({ message: "Code envoyé par email" });
        } catch (emailErr) {
          console.error("Erreur envoi email:", emailErr.message);
          res.status(500).json({ message: "Erreur lors de l'envoi de l'email" });
        }
      }
    );
  });
};

/* ===== RÉINITIALISER LE MOT DE PASSE ===== */
exports.resetPassword = (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return res.status(400).json({ message: "Champs manquants" });
  if (newPassword.length < 6)
    return res.status(400).json({ message: "Mot de passe trop court (min 6 caractères)" });

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (results.length === 0)
      return res.status(404).json({ message: "Email introuvable" });

    const user = results[0];

    if (!user.reset_code || user.reset_code !== code)
      return res.status(400).json({ message: "Code incorrect" });

    if (!user.reset_code_expires || new Date(user.reset_code_expires) < new Date())
      return res.status(400).json({ message: "Code expiré, demandez un nouveau code" });

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.query(
      "UPDATE users SET password = ?, reset_code = NULL, reset_code_expires = NULL WHERE email = ?",
      [hashedPassword, email],
      (err3) => {
        if (err3) return res.status(500).json({ message: "Erreur serveur" });
        res.json({ message: "Mot de passe réinitialisé avec succès !" });
      }
    );
  });
};

/* ===== PROFIL — récupérer ===== */
exports.getProfile = (req, res) => {
  db.query(
    "SELECT id, nom, email, role, statut, created_at FROM users WHERE id = ?",
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      if (results.length === 0)
        return res.status(404).json({ message: "Utilisateur introuvable" });
      res.json(results[0]);
    }
  );
};

/* ===== PROFIL — modifier nom/email ===== */
exports.updateProfile = (req, res) => {
  const { nom, email } = req.body;
  if (!nom || !email)
    return res.status(400).json({ message: "Nom et email requis" });

  db.query(
    "UPDATE users SET nom = ?, email = ? WHERE id = ?",
    [nom, email, req.user.id],
    (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ message: "Email déjà utilisé par un autre compte" });
        return res.status(500).json({ message: "Erreur serveur" });
      }
      res.json({ message: "Profil mis à jour !" });
    }
  );
};

/* ===== PROFIL — changer mot de passe ===== */
exports.changePassword = (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    return res.status(400).json({ message: "Champs requis" });
  if (newPassword.length < 6)
    return res.status(400).json({ message: "Nouveau mot de passe trop court (min 6 caractères)" });

  db.query("SELECT * FROM users WHERE id = ?", [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    const user = results[0];

    if (!user.password || !bcrypt.compareSync(oldPassword, user.password))
      return res.status(401).json({ message: "Ancien mot de passe incorrect" });

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, req.user.id], (err2) => {
      if (err2) return res.status(500).json({ message: "Erreur serveur" });
      res.json({ message: "Mot de passe modifié avec succès !" });
    });
  });
};
