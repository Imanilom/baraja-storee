const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

require('./registerModels');
const Product = require('../modules/products/product.model');
const Category = require('../modules/products/category.model');
const Unit = require('../modules/products/unit.model');
const User = require('../modules/users/user.model');
const Location = require('../modules/locations/location.model');
const Supplier = require('../modules/suppliers/supplier.model');
const Marketlist = require('../modules/marketlists/marketlist.model');
const MarketlistItem = require('../modules/marketlists/marketlist-item.model');
const MarketlistApproval = require('../modules/approvals/marketlist-approval.model');
const MarketlistNote = require('../modules/notes/marketlist-note.model');
const GoodsReceipt = require('../modules/receiving/goods-receipt.model');
const GoodsReceiptItem = require('../modules/receiving/goods-receipt-item.model');
const Invoice = require('../modules/invoices/invoice.model');
const ProductPrice = require('../modules/prices/product-price.model');
const Purchase = require('../modules/purchases/purchase.model');
const PurchaseItem = require('../modules/purchases/purchase-item.model');
const DebtPayment = require('../modules/purchases/debt-payment.model');
const { ROLES } = require('@purchasing/constants');

const rawStockItems = [
  // --- 1. DAGING, UNGGAS & SEAFOOD (PERISHABLE) ---
  { name: 'Daging Ayam Paha Fillet', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 56750, stock: 1 },
  { name: 'Daging Ayam Paha Utuh', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 37500, stock: 12 },
  { name: 'Daging Bebek', category: 'Daging & Unggas', type: 'perishable', unit: 'EKR', price: 41000, stock: 7 },
  { name: 'Daging Cumi Kupas / Tube', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 77875, stock: 0.5 },
  { name: 'Daging Sapi Buntut', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 105000, stock: 15 },
  { name: 'Daging Udang Besar', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 80000, stock: 1 },
  { name: 'Daging Sapi Sirloin (Has Luar)', category: 'Daging & Unggas', type: 'perishable', unit: 'PCS', price: 27500, stock: 0 },
  { name: 'Daging Sapi Tenderloin (Has Dalam)', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 170000, stock: 4 },
  { name: 'Daging Sapi Iga', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 105000, stock: 14 },
  { name: 'Daging Kambing', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 160000, stock: 3 },
  { name: 'Iga Kambing', category: 'Daging & Unggas', type: 'perishable', unit: 'KG', price: 125000, stock: 9 },
  { name: 'Daging Paru', category: 'Daging & Unggas', type: 'perishable', unit: 'PCS', price: 90000, stock: 0 },
  { name: 'Bakso Sumber Selera', category: 'Daging & Unggas', type: 'perishable', unit: 'BKS', price: 37500, stock: 6 },
  { name: 'Nugget Kanzler', category: 'Daging & Unggas', type: 'perishable', unit: 'BKS', price: 39000, stock: 8 },
  { name: 'Smoked Beef Hanzel', category: 'Daging & Unggas', type: 'perishable', unit: 'BKS', price: 25500, stock: 3 },
  { name: 'Sosis Oren Salam', category: 'Daging & Unggas', type: 'perishable', unit: 'BKS', price: 29000, stock: 7 },
  { name: 'Dumpling Keju', category: 'Daging & Unggas', type: 'perishable', unit: 'BKS', price: 28500, stock: 3 },
  { name: 'Wonton', category: 'Daging & Unggas', type: 'perishable', unit: 'PACK', price: 7000, stock: 37 },
  { name: 'Churros', category: 'Daging & Unggas', type: 'perishable', unit: 'PCS', price: 2000, stock: 120 },
  { name: 'French Fries 2 Kg', category: 'Daging & Unggas', type: 'perishable', unit: 'BKS', price: 56000, stock: 30 },

  // --- 2. SAYURAN SEGAR (PERISHABLE) ---
  { name: 'Caisim', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 8000, stock: 2 },
  { name: 'Kecambah', category: 'Sayuran Segar', type: 'perishable', unit: 'GR', price: 24000, stock: 0.2 },
  { name: 'Kentang Sayur', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 12800, stock: 1.2 },
  { name: 'Baby Kentang', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 8000, stock: 1.5 },
  { name: 'Kol Putih', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 8000, stock: 3 },
  { name: 'Selada', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 18000, stock: 2 },
  { name: 'Selada Romaine', category: 'Sayuran Segar', type: 'perishable', unit: 'GR', price: 33000, stock: 0.5 },
  { name: 'Sereh Sayur', category: 'Sayuran Segar', type: 'perishable', unit: 'IKT', price: 7700, stock: 1 },
  { name: 'Timun', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 7208, stock: 5 },
  { name: 'Tomat', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 9423, stock: 3 },
  { name: 'Tomat Cherry', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 9625, stock: 0.5 },
  { name: 'Wortel', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 15214, stock: 6 },
  { name: 'Singkong', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 8000, stock: 3 },
  { name: 'Daun Bawang', category: 'Sayuran Segar', type: 'perishable', unit: 'KG', price: 10000, stock: 1.5 },
  { name: 'Daun Jeruk', category: 'Sayuran Segar', type: 'perishable', unit: 'GR', price: 20000, stock: 0.25 },
  { name: 'Daun Pisang', category: 'Sayuran Segar', type: 'perishable', unit: 'BKS', price: 10000, stock: 2 },
  { name: 'Daun Salam', category: 'Sayuran Segar', type: 'perishable', unit: 'IKT', price: 5000, stock: 1 },
  { name: 'Belimbing Wuluh', category: 'Sayuran Segar', type: 'perishable', unit: 'GR', price: 35000, stock: 0.25 },

  // --- 3. BUAH SEGAR (PERISHABLE) ---
  { name: 'Buah Alpukat', category: 'Buah Segar', type: 'perishable', unit: 'KG', price: 26328, stock: 7 },
  { name: 'Buah Lemon', category: 'Buah Segar', type: 'perishable', unit: 'KG', price: 59950, stock: 1.2 },
  { name: 'Buah Pisang Ambon', category: 'Buah Segar', type: 'perishable', unit: 'ART', price: 30000, stock: 1 },
  { name: 'Buah Pisang Saba', category: 'Buah Segar', type: 'perishable', unit: 'ART', price: 25000, stock: 4 },
  { name: 'Buah Strawberry', category: 'Buah Segar', type: 'perishable', unit: 'KG', price: 70000, stock: 0.5 },
  { name: 'Cherry Tangkai', category: 'Buah Segar', type: 'perishable', unit: 'KG', price: 495000, stock: 1.75 },
  { name: 'Jeruk Nipis', category: 'Buah Segar', type: 'perishable', unit: 'KG', price: 15000, stock: 1 },

  // --- 4. DAIRY, TELUR & OLAHAN BASAH (PERISHABLE) ---
  { name: 'Susu Greenfield Fresh Milk', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 19973, stock: 248 },
  { name: 'Milk Life Fresh Milk', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 18500, stock: 0 },
  { name: 'Cooking Cream Rich', category: 'Dairy & Telur', type: 'perishable', unit: 'BTL', price: 52000, stock: 3 },
  { name: 'Whippy Cream', category: 'Dairy & Telur', type: 'perishable', unit: 'BKS', price: 30000, stock: 2 },
  { name: 'Keju Mozzarella Arla', category: 'Dairy & Telur', type: 'perishable', unit: 'BKS', price: 255000, stock: 0 },
  { name: 'Keju Mozzarella Greenfield', category: 'Dairy & Telur', type: 'perishable', unit: 'BKS', price: 113400, stock: 0 },
  { name: 'Keju Meg Serbaguna', category: 'Dairy & Telur', type: 'perishable', unit: 'BKS', price: 110000, stock: 1 },
  { name: 'Keju Parmesan', category: 'Dairy & Telur', type: 'perishable', unit: 'KG', price: 300000, stock: 1 },
  { name: 'Telur Ayam Negeri', category: 'Dairy & Telur', type: 'perishable', unit: 'KG', price: 26000, stock: 45 },
  { name: 'Telur Asin', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 4000, stock: 5 },
  { name: 'Telur Puyuh', category: 'Dairy & Telur', type: 'perishable', unit: 'GR', price: 45000, stock: 0.25 },
  { name: 'Tahu Putih', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 700, stock: 0 },
  { name: 'Tahu Pong', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 600, stock: 12 },
  { name: 'Tempe Papan', category: 'Dairy & Telur', type: 'perishable', unit: 'PPN', price: 5000, stock: 2 },
  { name: 'Indoeskrim Bulk Cokelat 8L', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 154359, stock: 2 },
  { name: 'Indoeskrim Bulk Vanilla 8L', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 154359, stock: 2 },
  { name: 'Indoeskrim Bulk Strawberry 8L', category: 'Dairy & Telur', type: 'perishable', unit: 'PCS', price: 154359, stock: 2 },

  // --- 5. PASTRY, BAKERY & CAKE (PERISHABLE) ---
  { name: 'Belgian Chocolatine', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 18500, stock: 8 },
  { name: 'Pain Au Choc', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 16500, stock: 16 },
  { name: 'Butter Croissant', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 9750, stock: 14 },
  { name: 'Cheese Croissant', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 17000, stock: 18 },
  { name: 'Croissant Almond', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 18000, stock: 22 },
  { name: 'Dirty Piscok Croissant', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 19000, stock: 12 },
  { name: 'Roticen Ube Cranberry Cheese', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 18000, stock: 12 },
  { name: 'Roticen Cranberry Cheese', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 18000, stock: 16 },
  { name: 'Cocoa Milk Pastry', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 19000, stock: 16 },
  { name: 'Choco Lunette', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 16000, stock: 8 },
  { name: 'Matcha Lunette', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 16000, stock: 6 },
  { name: 'Blueberry Lunette', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 16000, stock: 5 },
  { name: 'Japanese Cheesecake Danish', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 13150, stock: 8 },
  { name: 'Matcha Cheese Pistachio', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 19000, stock: 14 },
  { name: 'Milo Ovomaltine Danish', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 15000, stock: 12 },
  { name: 'Vanilla Almond Danish', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 16500, stock: 23 },
  { name: 'Bika Ambon', category: 'Pastry & Bakery', type: 'perishable', unit: 'BKS', price: 146000, stock: 1 },
  { name: 'Klapertart', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 12000, stock: 5 },
  { name: 'Burnt Cheesecake Matcha', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 19000, stock: 4 },
  { name: 'Burnt Cheesecake Choco', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 19000, stock: 5 },
  { name: 'Burnt Cheesecake Mix', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 18000, stock: 8 },
  { name: 'Roti Baraja', category: 'Pastry & Bakery', type: 'perishable', unit: 'PCS', price: 18000, stock: 4 },

  // --- 6. SIRUP, GULA & PEMANIS (GROCERIES) ---
  { name: 'Davinci Grenadine Pomegranate', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 129000, stock: 4 },
  { name: 'Davinci Syrup Caramel', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 129000, stock: 4 },
  { name: 'Davinci Syrup Vanilla', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 129000, stock: 2 },
  { name: 'Davinci Dry Bitter Orange', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 125000, stock: 0 },
  { name: 'Davinci Syrup Blue Ocean', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 119000, stock: 0 },
  { name: 'Davinci Syrup Rose', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 119000, stock: 0 },
  { name: 'Davinci Syrup Tropical Passion Fruit', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 119000, stock: 0 },
  { name: 'Dripp Butterscotch Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 3 },
  { name: 'Dripp Passion Fruit Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 4 },
  { name: 'Dripp Lychee Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 4 },
  { name: 'Dripp Vanilla Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 1 },
  { name: 'Dripp Tiramisu Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 3 },
  { name: 'Dripp Hazelnut Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 5 },
  { name: 'Dripp Apel Malang Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 5 },
  { name: 'Dripp Kiwi Fruit Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 150000, stock: 2 },
  { name: 'Dripp Rose Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 3 },
  { name: 'Dripp Caramel Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 1 },
  { name: 'Dripp Strawberry Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 2 },
  { name: 'Dripp Peach Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 6 },
  { name: 'Dripp Harum Manis', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 0 },
  { name: 'Dripp Elderflower', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 1 },
  { name: 'Dripp Mint', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 110000, stock: 1 },
  { name: 'Multibev Caramel Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 54000, stock: 4 },
  { name: 'Multibev Salt Caramel', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 95000, stock: 2 },
  { name: 'Fabbri Pineapple Syrup', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 270000, stock: 1 },
  { name: 'Sugar Syrup Toffin 5L', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 125000, stock: 2 },
  { name: 'Sunquick Lemon', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 35000, stock: 5 },
  { name: 'Sunquick Orange Besar', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 79000, stock: 2 },
  { name: 'Gula Aren Cair', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 60000, stock: 2 },
  { name: 'Gulare', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 58000, stock: 1 },
  { name: 'Gula Pasir Kristal', category: 'Sirup & Gula', type: 'groceries', unit: 'KG', price: 17400, stock: 4 },
  { name: 'Gula Pasir Sachet', category: 'Sirup & Gula', type: 'groceries', unit: 'BKS', price: 21500, stock: 1 },
  { name: 'Gula Pasir Sachet Tropicana', category: 'Sirup & Gula', type: 'groceries', unit: 'BKS', price: 78000, stock: 3 },
  { name: 'Gula Halus', category: 'Sirup & Gula', type: 'groceries', unit: 'BKS', price: 10000, stock: 2 },
  { name: 'Gula Merah', category: 'Sirup & Gula', type: 'groceries', unit: 'KG', price: 20000, stock: 0.65 },
  { name: 'Madurasa Murni (Enak)', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 116500, stock: 12 },
  { name: 'Morin Topping Caramel', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 25000, stock: 6 },
  { name: 'Morin Topping Chocolate', category: 'Sirup & Gula', type: 'groceries', unit: 'BTL', price: 30000, stock: 3 },
  { name: 'GoldenFil Choco Crunchy', category: 'Sirup & Gula', type: 'groceries', unit: 'DUS', price: 61000, stock: 1 },
  { name: 'Aren Stick', category: 'Sirup & Gula', type: 'groceries', unit: 'BKS', price: 60000, stock: 0 },

  // --- 7. KOPI, TEH & POWDER MINUMAN (GROCERIES) ---
  { name: 'Beans Baraja Signature Espresso', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 185000, stock: 18 },
  { name: 'Beans Hellbraun Arabika Natural', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 145000, stock: 41 },
  { name: 'Beans Hellbraun Robusta Natural', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 75000, stock: 15 },
  { name: 'Beans Fullwash Roastery', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 165000, stock: 15 },
  { name: 'Beans Natural Anaerobic Roastery', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 225000, stock: 5 },
  { name: 'Beans Mandheling', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 205000, stock: 0 },
  { name: 'Beans Single Origin 150 Gr', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 135000, stock: 4 },
  { name: 'Sumatra Karo Melon 200gr', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 145000, stock: 2 },
  { name: 'Sumatra Karo Strawberry 200gr', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 145000, stock: 2 },
  { name: 'Avatra Aceh 200gr', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 145000, stock: 2 },
  { name: 'Bali Singaraja 200gr', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 145000, stock: 2 },
  { name: 'Argopuro Specialty 200gr', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 135000, stock: 5 },
  { name: 'Beans Seasonal Exclusive', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 420000, stock: 1 },
  { name: 'Dilco Chocolate Powder', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 330000, stock: 0 },
  { name: 'Diltea Matcha Powder', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 260000, stock: 2 },
  { name: 'Taro Powder', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 120000, stock: 1 },
  { name: 'Redvelvet Powder', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 120000, stock: 1 },
  { name: 'Lipton Peppermint Tea', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 57500, stock: 6 },
  { name: 'Teh Tong Tji Celup', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 45700, stock: 2 },
  { name: 'Teh Upet', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'BKS', price: 29000, stock: 4 },
  { name: 'SKM Nestle Carnation', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KLG', price: 15150, stock: 8 },
  { name: 'Susu Oatside Barista Blend', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'PCS', price: 45000, stock: 1 },
  { name: 'Creamer Nabati', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'KG', price: 59800, stock: 6 },
  { name: 'Cremiera', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'PACK', price: 60000, stock: 4 },
  { name: 'Pouch Kopi 1kg Roastery', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'PCS', price: 2500, stock: 15 },
  { name: 'Pouch Kopi 150gr Roastery', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'PCS', price: 2300, stock: 25 },
  { name: 'Pouch Kopi 100gr Roastery', category: 'Kopi, Teh & Powder', type: 'groceries', unit: 'PCS', price: 1200, stock: 15 },

  // --- 8. BUMBU DAPUR, SAUS & REMPAH (GROCERIES) ---
  { name: 'Bawang Bombay', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 27800, stock: 2.4 },
  { name: 'Bawang Merah', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 40778, stock: 2 },
  { name: 'Bawang Putih', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 35250, stock: 1.5 },
  { name: 'Bawang Goreng Renyah', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 55000, stock: 4 },
  { name: 'Cabai Hijau Besar', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 20200, stock: 1.3 },
  { name: 'Cabai Keriting', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 30000, stock: 1.75 },
  { name: 'Cabai Merah Besar', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 35600, stock: 1.65 },
  { name: 'Cabai Rawit Hijau', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 55143, stock: 1.5 },
  { name: 'Cabai Rawit Merah', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 72647, stock: 2.2 },
  { name: 'Jahe Segar', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 36625, stock: 0.25 },
  { name: 'Kunyit Pasar', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 11000, stock: 1.5 },
  { name: 'Kunyit Bubuk', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 20000, stock: 2 },
  { name: 'Lengkuas', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 12000, stock: 0.3 },
  { name: 'Bunga Lawang', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 150000, stock: 0.75 },
  { name: 'Cengkeh Pasar', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 170000, stock: 0.25 },
  { name: 'Kapulaga', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 160000, stock: 0.8 },
  { name: 'Kayu Manis', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 90000, stock: 0.35 },
  { name: 'Kemiri Bulat', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 53000, stock: 1.7 },
  { name: 'Ketumbar Biji', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'KG', price: 22000, stock: 0.4 },
  { name: 'Kluwek', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 38000, stock: 1 },
  { name: 'Lada Hitam Yutakachi 1kg', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 200000, stock: 1 },
  { name: 'Lada Putih Yutakachi 1kg', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 219000, stock: 0 },
  { name: 'Garam Dapur 1kg', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 16917, stock: 3 },
  { name: 'Micin MSG 1kg', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 48000, stock: 3 },
  { name: 'Chicken Powder Knorr', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 94107, stock: 4 },
  { name: 'Curry Powder', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'PCS', price: 35000, stock: 1 },
  { name: 'Garam Masala', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 25700, stock: 1 },
  { name: 'HP Sauce', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'PCS', price: 52500, stock: 3 },
  { name: 'Delmonte Extra Hot Pouch', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 22875, stock: 3 },
  { name: 'Delmonte Tomato Pouch', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 17000, stock: 2 },
  { name: 'Mayonaise Maestro', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 29000, stock: 3 },
  { name: 'Kecap Asin 620ml', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'PCS', price: 45000, stock: 2 },
  { name: 'Kecap Ikan Merah Besar (Asin)', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BTL', price: 30000, stock: 1 },
  { name: 'Kecap Inggris Sedap Wangi 620 ML', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'PCS', price: 45000, stock: 1 },
  { name: 'Kikkoman Kecap Asin', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'PCS', price: 22300, stock: 1 },
  { name: 'Saus Tiram Panda 510gr', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BTL', price: 45000, stock: 1 },
  { name: 'Saus Maggi Seasoning', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'PCS', price: 34000, stock: 0 },
  { name: 'Tomyum Paste Knorr', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 289000, stock: 1 },
  { name: 'Demi Glace Knorr', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'DUS', price: 168000, stock: 0 },
  { name: 'Oregano Yutakachi', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 55000, stock: 0 },
  { name: 'Parsley Bubuk', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BKS', price: 68000, stock: 0 },
  { name: 'Cuka Dapur', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BTL', price: 16500, stock: 0 },
  { name: 'Minyak Wijen Oh Guan', category: 'Bumbu Dapur & Rempah', type: 'groceries', unit: 'BTL', price: 39000, stock: 1 },

  // --- 9. BAHAN POKOK & SEMBAKO KERING (GROCERIES) ---
  { name: 'Beras Ramos Super', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'KG', price: 14600, stock: 120 },
  { name: 'Minyak Goreng Jerigen 18 Liter', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 425000, stock: 1 },
  { name: 'Margarine 1kg', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 22100, stock: 4 },
  { name: 'Tepung Terigu Segitiga Biru', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 9500, stock: 3 },
  { name: 'Tepung Maizena Curah', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 14000, stock: 4 },
  { name: 'Tepung Tapioka Rose Brand', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 11000, stock: 3 },
  { name: 'Tepung Panir Panko', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 22000, stock: 0 },
  { name: 'Tepung Panir Putih', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 20000, stock: 4 },
  { name: 'Baking Powder Koepoe', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 5500, stock: 1 },
  { name: 'Ragi Fermipan', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 17000, stock: 1 },
  { name: 'Santan Kara Kemasan', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'PCS', price: 72500, stock: 4 },
  { name: 'La Fonte Spaghetti 11 Inc', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 15967, stock: 7 },
  { name: 'Mie Atom Bulan', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 6350, stock: 12 },
  { name: 'Kacang Tanah Kupas', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'KG', price: 20000, stock: 1.4 },
  { name: 'Ebi Udang Kering', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'KG', price: 450000, stock: 0.5 },
  { name: 'Emping Mentah 1/2kg', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 90000, stock: 3 },
  { name: 'Kerupuk Udang Finna', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 29500, stock: 6 },
  { name: 'Almond Slice 250gr', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 55000, stock: 0.25 },
  { name: 'Oreo Crumbs', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 78000, stock: 2 },
  { name: 'Granola Superindo', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 32900, stock: 3 },
  { name: 'Lychee Kaleng', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'PCS', price: 39000, stock: 6 },
  { name: 'Jamur Kaleng Champignon', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'KLG', price: 19000, stock: 2 },
  { name: 'Biji Selasih Yutakachi', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'KG', price: 75000, stock: 0.75 },
  { name: 'Wijen Putih', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'KG', price: 39000, stock: 0 },
  { name: 'Paper Rice Vietnam', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'BKS', price: 45000, stock: 0 },
  { name: 'Galon Air Amidis', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'PCS', price: 19000, stock: 15 },
  { name: 'Galon Air Vit', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'PCS', price: 15000, stock: 3 },
  { name: 'Aqua 660ml Dus', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'DUS', price: 45300, stock: 25 },
  { name: 'Aqua 330ml Dus', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'DUS', price: 34500, stock: 5 },
  { name: 'Vit 220ml Dus', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'DUS', price: 14500, stock: 4 },
  { name: 'Hydrococo 250ml', category: 'Bahan Pokok & Sembako', type: 'groceries', unit: 'PCS', price: 24000, stock: 1 },

  // --- 10. PACKAGING, CUP & PLASTIK (GROCERIES) ---
  { name: 'Paper Food Baraja', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PACK', price: 150000, stock: 6 },
  { name: 'TA Bowl Paper', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 28000, stock: 2 },
  { name: 'TA Box Lunch', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1300, stock: 2000 },
  { name: 'TA Box Cake', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1700, stock: 1037 },
  { name: 'TA Cup Holder', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1350, stock: 0 },
  { name: 'TA Cup Hot 10 OZ', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1330, stock: 454 },
  { name: 'TA Cup Ice 12 OZ', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1280, stock: 625 },
  { name: 'TA Cup Ice 14 OZ', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1280, stock: 900 },
  { name: 'TA Cup Ice 16 OZ', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1500, stock: 135 },
  { name: 'TA Cup Sauce', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 243000, stock: 1 },
  { name: 'TA Botol Kale 250ml', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 1500, stock: 18 },
  { name: 'Botol Kale 1 Liter', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BTL', price: 5000, stock: 10 },
  { name: 'TA Paperbag Croissant', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 75000, stock: 7 },
  { name: 'TA Plastik 10 (01)', category: 'Packaging & Kemasan', type: 'groceries', unit: 'PCS', price: 520, stock: 6 },
  { name: 'TA Plastik 15 (02)', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 21500, stock: 6 },
  { name: 'TA Plastik 24 (03)', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 22000, stock: 10 },
  { name: 'TA Sedotan Ice', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 10000, stock: 12 },
  { name: 'TA Sedotan Hot', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 30000, stock: 1 },
  { name: 'Toothpick / Tusuk Gigi', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 5000, stock: 4 },
  { name: 'TA Sticker Baraja', category: 'Packaging & Kemasan', type: 'groceries', unit: 'BKS', price: 27000, stock: 0 }
];

async function seedDatabase() {
  console.log('========================================================');
  console.log('🔄 MEMULAI PROSES RESET DATABASE & SEED STOCK OPNAME');
  console.log('========================================================');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI tidak ditemukan di file .env');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB successfully!\n');

  try {
    // 1. Drop all products and transactions
    console.log('🗑️  1. Membersihkan semua koleksi barang, transaksi, marketlist, receiving, dan invoice...');
    await Promise.all([
      Product.deleteMany({}),
      Category.deleteMany({}),
      Unit.deleteMany({}),
      Marketlist.deleteMany({}),
      MarketlistItem.deleteMany({}),
      MarketlistApproval.deleteMany({}),
      MarketlistNote.deleteMany({}),
      GoodsReceipt.deleteMany({}),
      GoodsReceiptItem.deleteMany({}),
      Invoice.deleteMany({}),
      ProductPrice.deleteMany({}),
      Purchase.deleteMany({}),
      PurchaseItem.deleteMany({}),
      DebtPayment.deleteMany({})
    ]);
    console.log('✅ Koleksi barang dan transaksi berhasil di-drop/dikosongkan.\n');

    // 2. Ensure Locations exist
    let centralLoc = await Location.findOne({ code: 'LOC-CENTRAL' });
    if (!centralLoc) {
      centralLoc = await Location.create({
        name: 'Gudang Pusat Baraja Coffee',
        code: 'LOC-CENTRAL',
        address: 'Gudang Pusat PT Sari Coffee Nusantara'
      });
    }

    // 3. Ensure Default Users exist
    console.log('👥 2. Memeriksa user akun utama...');
    const defaultUsers = [
      { name: 'Super Admin', email: 'admin@baraja.com', pass: 'admin123', role: ROLES.ADMIN },
      { name: 'Tim Purchasing', email: 'purchasing@baraja.com', pass: 'purchasing123', role: ROLES.PURCHASING },
      { name: 'Tim Receiver (Gudang)', email: 'receiver@baraja.com', pass: 'receiver123', role: ROLES.RECEIVER },
      { name: 'Tim Accounting', email: 'accounting@baraja.com', pass: 'accounting123', role: ROLES.ACCOUNTING },
      { name: 'Management Baraja', email: 'management@baraja.com', pass: 'management123', role: ROLES.MANAGEMENT }
    ];

    for (const u of defaultUsers) {
      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        const hash = await User.hashPassword(u.pass);
        await User.create({
          name: u.name,
          email: u.email,
          password_hash: hash,
          role: u.role,
          location_id: centralLoc._id
        });
        console.log(`   + Dibuat user: ${u.email} (${u.role})`);
      }
    }

    // 4. Ensure Suppliers exist
    console.log('\n🏢 3. Menyiapkan data supplier rekanan...');
    const suppliersData = [
      { name: 'CV Sembako Makmur Mandiri', code: 'SUP-SEMBAKO', contact_person: 'Pak Budi', phone: '08123456789' },
      { name: 'PT Unggas & Daging Segar', code: 'SUP-DAGING', contact_person: 'Pak Agus', phone: '08129876543' },
      { name: 'Baraja Roastery Internal', code: 'SUP-ROASTERY', contact_person: 'Gofur', phone: '08137788990' },
      { name: 'Aneka Plastik & Packaging Packaging', code: 'SUP-PACKAGING', contact_person: 'Ibu Linda', phone: '08135566778' }
    ];
    const supplierMap = {};
    for (const s of suppliersData) {
      let supp = await Supplier.findOne({ code: s.code });
      if (!supp) {
        supp = await Supplier.create(s);
      }
      supplierMap[s.code] = supp._id;
    }

    // 5. Insert Units
    console.log('📏 4. Menyiapkan master Satuan (Units)...');
    const unitsData = [
      { name: 'Kilogram', abbreviation: 'KG' },
      { name: 'Gram', abbreviation: 'GR' },
      { name: 'Liter', abbreviation: 'LTR' },
      { name: 'Pieces', abbreviation: 'PCS' },
      { name: 'Pack', abbreviation: 'PACK' },
      { name: 'Bungkus', abbreviation: 'BKS' },
      { name: 'Dus/Karton', abbreviation: 'DUS' },
      { name: 'Botol', abbreviation: 'BTL' },
      { name: 'Kaleng', abbreviation: 'KLG' },
      { name: 'Ekor', abbreviation: 'EKR' },
      { name: 'Ikat', abbreviation: 'IKT' },
      { name: 'Papan', abbreviation: 'PPN' },
      { name: 'Arit/Sisir', abbreviation: 'ART' }
    ];
    const unitMap = {};
    for (const u of unitsData) {
      let unit = await Unit.findOne({ abbreviation: u.abbreviation });
      if (!unit) {
        unit = await Unit.create(u);
      }
      unitMap[u.abbreviation] = unit._id;
    }

    // 6. Insert Categories with Type (perishable vs groceries)
    console.log('🏷️  5. Menyiapkan Kategori (Perishable vs Groceries)...');
    const categoriesData = [
      { name: 'Daging & Unggas', type: 'perishable', description: 'Ayam, sapi, kambing, bebek, seafood segar & frozen' },
      { name: 'Sayuran Segar', type: 'perishable', description: 'Sayuran hijau, rempah basah, lalapan segar' },
      { name: 'Buah Segar', type: 'perishable', description: 'Buah-buahan segar untuk jus & garnish' },
      { name: 'Dairy & Telur', type: 'perishable', description: 'Susu segar, keju, telur, es krim & olahan basah' },
      { name: 'Pastry & Bakery', type: 'perishable', description: 'Croissant, cake, roti basah & pastry' },
      { name: 'Sirup & Gula', type: 'groceries', description: 'Sirup berperisa, gula pasir, gula aren, madu, topping' },
      { name: 'Kopi, Teh & Powder', type: 'groceries', description: 'Biji kopi espresso, manual brew, teh, powder minuman' },
      { name: 'Bumbu Dapur & Rempah', type: 'groceries', description: 'Bumbu kering, garam, penyedap, saus, rempah-rempah' },
      { name: 'Bahan Pokok & Sembako', type: 'groceries', description: 'Beras, minyak goreng, tepung, mie, pasta, bahan kering' },
      { name: 'Packaging & Kemasan', type: 'groceries', description: 'Cup kopi, paper bowl, box makanan, sedotan, plastik' }
    ];

    const categoryMap = {};
    for (const c of categoriesData) {
      let cat = await Category.findOne({ name: c.name });
      if (!cat) {
        cat = await Category.create(c);
      } else {
        cat.type = c.type;
        cat.description = c.description;
        await cat.save();
      }
      categoryMap[c.name] = cat._id;
    }

    // 7. Insert All Products from Stock Opname
    console.log('📦 6. Memasukkan Produk-produk Hasil Stock Opname...');
    let perishableCount = 0;
    let groceriesCount = 0;

    let index = 1;
    for (const item of rawStockItems) {
      const catId = categoryMap[item.category];
      const unitId = unitMap[item.unit] || unitMap['PCS'];
      const prefix = item.type === 'perishable' ? 'PRS' : 'GRC';
      const sku = `${prefix}-${String(index).padStart(4, '0')}`;

      // Choose suitable default supplier
      let defaultSuppId = supplierMap['SUP-SEMBAKO'];
      if (item.category === 'Daging & Unggas') defaultSuppId = supplierMap['SUP-DAGING'];
      else if (item.category === 'Packaging & Kemasan') defaultSuppId = supplierMap['SUP-PACKAGING'];
      else if (item.category === 'Kopi, Teh & Powder') defaultSuppId = supplierMap['SUP-ROASTERY'];

      await Product.create({
        name: item.name,
        sku,
        category_id: catId,
        item_type: item.type,
        unit_id: unitId,
        specification: `Item hasil stock opname Baraja Coffee (${item.category})`,
        last_purchase_price: item.price || 0,
        current_stock: item.stock || 0,
        last_supplier_id: defaultSuppId,
        is_active: true
      });

      if (item.type === 'perishable') perishableCount++;
      else groceriesCount++;

      index++;
    }

    console.log(`\n========================================================`);
    console.log(`🎉 BERHASIL MENYIMPAN MASTER INVENTORI HASIL STOCK OPNAME!`);
    console.log(`========================================================`);
    console.log(`Total Produk Tersimpan : ${rawStockItems.length} produk`);
    console.log(`- Perishable (Barang Basah/Mudah Rusak) : ${perishableCount} produk`);
    console.log(`- Groceries (Barang Kering/Tahan Lama)  : ${groceriesCount} produk`);
    console.log(`Total Kategori         : ${categoriesData.length} kategori`);
    console.log(`Total Satuan           : ${unitsData.length} satuan`);
    console.log(`Status Transaksi       : Bersih (0 transaksi aktif)`);
    console.log(`========================================================\n`);
  } catch (err) {
    console.error('Error saat seed stock opname:', err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

