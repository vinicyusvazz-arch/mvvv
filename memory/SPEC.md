# MV Conveniência — SPEC

Mobile-first e-commerce for MV Conveniência (São José de Ribamar - MA), 2 units: `sjr` (MV de SJR) and `pitangueiras` (MV de Pitangueiras). UI in pt-BR.

## Customer (/)
- Catalogue of non-archived products (GET /api/products), category pills + search, featured/combos carousel, product detail dialog.
- Cart (localStorage `mv_cart_v1`, lines resolved against live catalogue; qty capped at stock). Stock 0 => "Esgotado" (product still visible).
- Checkout in cart sheet: unit, delivery (SJR only, bairro select) or retirada, name/phone, payment pix/cartao/dinheiro(+troco), notes.
- POST /api/orders: server prices, atomic stock decrement (409 if insufficient), sequential order number (starts 1001), builds WhatsApp comanda, returns wa.me URL to the unit's number (or generic wa.me if number empty). Frontend opens WhatsApp.

## Admin (/admin → /admin/painel) — discreet lock icon in footer
- Single password (PBKDF2 in `admin` collection), JWT httpOnly cookie `mv_admin` 12h. Brute-force guard 8 fails/15min/IP. Changing password invalidates other sessions.
- Products: create/edit (photo via camera capture or upload → compressed client side → POST /api/admin/images stored in Mongo `images`, served at /api/images/{id}), stock stepper, featured toggle, archive/restore. NO hard delete exists anywhere.
- Orders: "Limpar pedidos" button → POST /api/admin/orders/clear {password, reset_numbering} re-checks admin password (401 if wrong), deletes ALL orders (stock untouched), optional counter reset (next = 1001). List/filter by status, change status (cancel restores stock), WhatsApp client, copy comanda.
- Settings: single "WhatsApp das lojas" field (writes the same number into both stores' `whatsapp`); per unit hours text + open_time/close_time (HH:MM, past-midnight ok, equal = 24h) per unit, announcement bar, password change. GET /api/settings returns computed `is_open` (America/Fortaleza) → "Aberto agora/Fechado" badges + closed notice in checkout (orders still allowed).
- New-order alert: dashboard polls /api/admin/stats every 15s; when orders_new grows → toast + WebAudio chime (bell toggle, localStorage `mv_admin_sound`) + count in tab title.
- Stats: GET /api/admin/stats (today in America/Fortaleza).

## Data (Mongo)
products, images, orders, settings{key:public}, admin{key:admin}, meta{key:seeded}, counters{key:orders}.
Seed (lib/bootstrap.py at startup): 12 products once ever (meta flag); never overwrites/deletes.

## Branding assets (frontend/public)
- mvlogo.png (circular "Conveniência MV Depósito de Bebidas" badge, transparent corners) → header, footer, admin header, favicons, apple-touch-icon.
- mvpoint.webp ("MV é o Point!", background removed) → hero (floating), admin login, order-success screen.
- Asset URLs use ?v=2 cache-buster; bump when replacing files.
