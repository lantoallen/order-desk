# Order Desk

A lightweight order and product management application built with Express.js, Supabase, and vanilla JavaScript.

## 🚀 Features

- **Product Management:** Manage product listings and upload product images.
- **Order Tracking:** Track and view incoming orders.
- **Database Integration:** Powered by Supabase for reliable data storage.

## 📁 Project Structure

``` text
order-desk/
├── public/                  # Frontend static files
│   ├── index.html
│   ├── style.css
│   └── app.js
├── supabase/                # Database migrations & schemas
│   └── product_image_migration.sql
├── db.js                    # Database connection module
├── server.js                # Express server entry point
├── .env.example             # Environment variable template
└── package.json