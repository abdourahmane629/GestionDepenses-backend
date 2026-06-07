const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Abdou660",
  database: process.env.DB_NAME || "gestion_depenses",
  port: parseInt(process.env.DB_PORT || "3306"),
});

db.connect((err) => {
  if (err) {
    console.error("❌ Erreur connexion MySQL:", err.message);
    return;
  }
  console.log("✅ Connecté à MySQL !");
});

module.exports = db;