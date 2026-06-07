require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Créer les tables automatiquement si elles n'existent pas
const initDB = () => {
  const createUsers = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) DEFAULT '',
      role ENUM('user', 'admin') DEFAULT 'user',
      statut ENUM('actif', 'bloque') DEFAULT 'actif',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createUsers, (err) => {
    if (err) return console.error("❌ Erreur création table users:", err.message);
    console.log("✅ Table users OK");

    // Vérifier si la colonne s'appelle 'titre' (ancienne version) ou 'title'
    db.query("SHOW COLUMNS FROM expenses LIKE 'titre'", (errCheck, cols) => {
      const needsMigration = !errCheck && cols && cols.length > 0;

      if (needsMigration) {
        // Recréer la table avec les bons noms de colonnes
        db.query("DROP TABLE IF EXISTS expenses", (errDrop) => {
          if (errDrop) return console.error("❌ Erreur DROP expenses:", errDrop.message);
          console.log("🔄 Table expenses recréée avec les bons noms de colonnes");
          createExpensesTable();
        });
      } else {
        createExpensesTable();
      }
    });
  });

  function createExpensesTable() {
    db.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) return console.error("❌ Erreur création table expenses:", err.message);
      console.log("✅ Table expenses OK");
    });
  }
};

initDB();

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/expenses", require("./routes/expenses"));

// Test
app.get("/", (req, res) => {
  res.json({ message: "✅ API GestionDepenses fonctionne !" });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});