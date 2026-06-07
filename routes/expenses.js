const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth");
const {
  getExpenses, addExpense, updateExpense, deleteExpense,
  getAllUsers, deleteUser, toggleBlockUser, getGlobalStats,
} = require("../controllers/expenseController");

router.get("/stats/global", verifyToken, isAdmin, getGlobalStats);
router.get("/users", verifyToken, isAdmin, getAllUsers);
router.delete("/users/:id", verifyToken, isAdmin, deleteUser);
router.put("/users/:id/toggle", verifyToken, isAdmin, toggleBlockUser);

router.get("/", verifyToken, getExpenses);
router.post("/", verifyToken, addExpense);
router.put("/:id", verifyToken, updateExpense);
router.delete("/:id", verifyToken, deleteExpense);

module.exports = router;