const mysql = require("mysql2");

// Railway injecte MYSQL_URL automatiquement
const connectionConfig = process.env.MYSQL_URL
  ? { uri: process.env.MYSQL_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
      user: process.env.DB_USER || process.env.MYSQLUSER || "root",
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "Abdou660",
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || "gestion_depenses",
      port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || "3306"),
      ssl: { rejectUnauthorized: false },
    };

const db = mysql.createConnection(connectionConfig);

db.connect((err) => {
  if (err) {
    console.error("❌ Erreur connexion MySQL:", err.message);
    return;
  }
  console.log("✅ Connecté à MySQL !");
});

module.exports = db;