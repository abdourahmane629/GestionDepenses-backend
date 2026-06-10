const express = require("express");
const router = express.Router();
const { getCategories, addCategory, deleteCategory } = require("../controllers/categoriesController");
const { verifyToken } = require("../middleware/auth");

router.get("/", verifyToken, getCategories);
router.post("/", verifyToken, addCategory);
router.delete("/:id", verifyToken, deleteCategory);

module.exports = router;
