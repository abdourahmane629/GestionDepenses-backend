const express = require("express");
const router = express.Router();
const { register, login, googleAuth, setPassword } = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/set-password", verifyToken, setPassword);

module.exports = router;