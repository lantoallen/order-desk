# Order Desk

A lightweight product and order manager for **Kapehan**, a fictional Batangas coffee roaster. It is a demo project built with Express.js, Supabase, and vanilla JavaScript, with a bahay kubo-inspired interface.

- **Live app:** https://kapehan-order-desk.vercel.app
- **Browser demo (sample data, no server):** https://lantoallen.github.io/order-desk/

## Features

- Add, edit, and delete products, with optional product photos
- Replenish stock, with "Low stock" and "Sold out" tags
- Create orders, search them, filter by status, and move each one from pending to picked up
- Live tallies for waiting orders, low-stock products, and sales from picked-up orders
- Greeting that changes with the time of day, and Filipino-first wording

## Tech stack

- Express.js and Multer on the backend
- Supabase (Postgres and Storage) for data and product images
- Plain HTML, CSS, and JavaScript on the frontend
- Deployed on Vercel; the demo in `docs/` runs on GitHub Pages

## Project structure

```text
order-desk/
├── public/                  # Frontend served by Express and Vercel
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docs/                    # Browser-only demo for GitHub Pages
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── demo-api.js          # Fake API that stores sample data in the browser
├── supabase/                # Database migrations
│   └── product_image_migration.sql
├── db.js                    # Supabase client
├── server.js                # Express server and API routes
├── .env.example             # Environment variable template
└── package.json
```

## Run it locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your own values:
   ```text
   PORT=3000
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SECRET_KEY=your_supabase_secret_key
   SUPABASE_PRODUCT_IMAGES_BUCKET=product-images
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open http://localhost:3000

Never commit your `.env` file. It is already listed in `.gitignore`.

## Database

The app expects two Supabase tables:

- `products`: `id`, `name`, `price`, `stock_quantity`, `image_url`
- `orders`: `id`, `customer_name`, `product_id`, `quantity`, `total_price`, `status`, `created_at`

Run `supabase/product_image_migration.sql` to add the `image_url` column. The image storage bucket is created automatically on the first upload.

## Deploying

Push to `main` and Vercel redeploys automatically. Add the same environment variables from `.env.example` under **Project Settings → Environment Variables** on Vercel. The `PORT` variable is not needed there.

The GitHub Pages demo serves the `docs/` folder and needs no server or database.

## About

Made by Allen as a learning project. All products and orders are sample data.