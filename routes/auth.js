const express = require("express");
const router = express.Router();
const {
  register,
  login,
  googleAuth,
  setPassword,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
} = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/set-password", verifyToken, setPassword);

// Mot de passe oublié
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Profil
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.put("/change-password", verifyToken, changePassword);

module.exports = router;
