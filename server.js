require("dotenv").config();

const path = require("path");
const supabase = require("./db");
const cors = require("cors");
const express = require("express");
const multer = require("multer");

const app = express();
const port = process.env.PORT || 3000;
const productImagesBucket = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
const allowedStatuses = new Set(["pending", "preparing", "ready", "picked_up"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    const error = new Error("Product image must be an image file");
    error.status = 400;
    callback(error);
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

function sendDatabaseError(res, error) {
  return res.status(500).json({ error: error.message });
}

function productValues(body) {
  const name = body.name?.trim();
  const price = Number(body.price);
  const stockQuantity = Number(body.stock_quantity);

  if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
    return { error: "Name, a non-negative price, and a non-negative whole stock quantity are required" };
  }

  return { values: { name, price, stock_quantity: stockQuantity } };
}

async function ensureProductImagesBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) throw listError;
  if (buckets.some((bucket) => bucket.name === productImagesBucket)) return;

  const { error: createError } = await supabase.storage.createBucket(productImagesBucket, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });

  if (createError) throw createError;
}

async function uploadProductImage(file, productId) {
  await ensureProductImagesBucket();
  const extension = file.mimetype.split("/")[1] || "image";
  const path = `${productId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(productImagesBucket)
    .upload(path, file.buffer, { contentType: file.mimetype });

  if (uploadError) throw uploadError;

  return supabase.storage.from(productImagesBucket).getPublicUrl(path).data.publicUrl;
}

app.get("/api/products", async (req, res) => {
  const { data, error } = await supabase.from("products").select("*").order("name");

  if (error) {
    return sendDatabaseError(res, error);
  }

  res.json(data);
});

app.post("/api/products", upload.single("image"), async (req, res) => {
  const product = productValues(req.body);

  if (product.error) return res.status(400).json({ error: product.error });

  const { data: createdProduct, error: createError } = await supabase
    .from("products")
    .insert(product.values)
    .select()
    .single();

  if (createError) return sendDatabaseError(res, createError);

  if (!req.file) return res.status(201).json(createdProduct);

  try {
    const imageUrl = await uploadProductImage(req.file, createdProduct.id);
    const { data, error } = await supabase
      .from("products")
      .update({ image_url: imageUrl })
      .eq("id", createdProduct.id)
      .select()
      .single();

    if (error) return sendDatabaseError(res, error);
    return res.status(201).json(data);
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

app.patch("/api/products/:id", upload.single("image"), async (req, res) => {
  const product = productValues(req.body);

  if (product.error) return res.status(400).json({ error: product.error });

  try {
    if (req.file) product.values.image_url = await uploadProductImage(req.file, req.params.id);
  } catch (error) {
    return sendDatabaseError(res, error);
  }

  const { data, error } = await supabase
    .from("products")
    .update(product.values)
    .eq("id", req.params.id)
    .select()
    .maybeSingle();

  if (error) return sendDatabaseError(res, error);
  if (!data) return res.status(404).json({ error: "Product not found" });

  res.json(data);
});

app.patch("/api/products/:id/stock", async (req, res) => {
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "Replenishment quantity must be a positive whole number" });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", req.params.id)
    .maybeSingle();

  if (productError) return sendDatabaseError(res, productError);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const { data, error } = await supabase
    .from("products")
    .update({ stock_quantity: product.stock_quantity + quantity })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return sendDatabaseError(res, error);
  res.json(data);
});

app.delete("/api/products/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) return sendDatabaseError(res, error);
  if (!data) return res.status(404).json({ error: "Product not found" });

  res.json({ message: "Product deleted" });
});

app.get("/api/orders", async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(name)")
    .order("created_at", { ascending: false });

  if (error) {
    return sendDatabaseError(res, error);
  }

  res.json(data);
});

app.post("/api/orders", async (req, res) => {
  const { customer_name, product_id, quantity } = req.body;
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("price")
    .eq("id", product_id)
    .single();

  if (productError) {
    return sendDatabaseError(res, productError);
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_name,
      product_id,
      quantity,
      total_price: product.price * quantity,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return sendDatabaseError(res, error);
  }

  res.status(201).json(data);
});

app.patch("/api/orders/:id", async (req, res) => {
  const { status } = req.body;

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ error: "Invalid order status" });
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) {
    return sendDatabaseError(res, error);
  }

  res.json(data);
});

app.delete("/api/orders/:id", async (req, res) => {
  const { error } = await supabase.from("orders").delete().eq("id", req.params.id);

  if (error) {
    return sendDatabaseError(res, error);
  }

  res.json({ message: "Order deleted" });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError || error.status === 400) {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Order Desk API listening on http://localhost:${port}`);
});