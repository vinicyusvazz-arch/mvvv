"""Idempotent startup: default admin password, store settings, first-run catalogue.

Never deletes or overwrites anything that already exists — owner data is permanent.
"""
import logging
import os
import uuid

from lib.auth import hash_password
from lib.db import db
from models.schemas import now_utc

logger = logging.getLogger(__name__)

U = "?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
IMG = {
    "beer": "https://images.unsplash.com/photo-1765991564151-5b37e4bd7be8" + U,
    "beer_combo": "https://images.unsplash.com/photo-1642647237318-3e30ff181a3c" + U,
    "whiskey": "https://images.unsplash.com/photo-1580537922571-ca7180cd700e" + U,
    "gin": "https://images.unsplash.com/photo-1663738797534-d9c327516967" + U,
    "champagne": "https://images.unsplash.com/photo-1774814129847-cc9ce65c5b79" + U,
    "snacks": "https://images.unsplash.com/photo-1699666397768-0126340e880a" + U,
    "energy": "https://images.unsplash.com/photo-1560689189-65b6ed6228e7" + U,
    "energy2": "https://images.unsplash.com/photo-1677177751361-0416255ff002" + U,
    "wine": "https://images.unsplash.com/photo-1554230561-31bdc707b537" + U,
    "ice": "https://images.unsplash.com/photo-1788628956194-0bad2385d7aa" + U,
}

SEED = [
    ("Combo Resenha 12 Latas + Gelo", "12 latas de cerveja 350ml trincando + 1 saco de gelo 5kg. Perfeito pra resenha.", "Combos", 69.9, 79.9, 25, True, True, "beer_combo"),
    ("Combo Whisky + 4 Energéticos", "1 Whisky 1L + 4 energéticos 473ml + gelo. O clássico da noite.", "Combos", 149.9, 169.9, 10, True, True, "energy2"),
    ("Combo Gin Tônica", "Gin 750ml + 4 águas tônicas + gelo de coco. Refrescância garantida.", "Combos", 119.9, None, 8, True, True, "gin"),
    ("Cerveja Lata 350ml", "Cerveja pilsen gelada, lata 350ml.", "Cervejas", 4.99, None, 200, False, False, "beer"),
    ("Cerveja Long Neck 330ml", "Long neck premium bem gelada.", "Cervejas", 7.5, None, 120, True, False, "beer"),
    ("Whisky 12 anos 1L", "Whisky escocês 12 anos, garrafa 1 litro.", "Destilados", 139.9, None, 12, False, False, "whiskey"),
    ("Gin London Dry 750ml", "Gin seco importado, ideal para drinks.", "Destilados", 89.9, None, 15, False, False, "gin"),
    ("Espumante Brut 750ml", "Espumante brut para celebrar qualquer momento.", "Vinhos & Espumantes", 54.9, 64.9, 10, False, False, "champagne"),
    ("Vinho Tinto Seco 750ml", "Tinto seco encorpado, ótimo custo-benefício.", "Vinhos & Espumantes", 42.9, None, 14, False, False, "wine"),
    ("Energético 473ml", "Energético lata grande 473ml.", "Refrigerantes & Energéticos", 11.9, None, 60, False, False, "energy"),
    ("Gelo em Cubos 5kg", "Saco de gelo filtrado 5kg.", "Gelo & Carvão", 12.0, None, 40, False, False, "ice"),
    ("Batata Chips 120g", "Batata chips crocante, sabor original.", "Petiscos & Snacks", 9.9, None, 35, False, False, "snacks"),
]

DEFAULT_STORES = [
    {"id": "sjr", "name": "MV de SJR", "whatsapp": "", "address": "São José de Ribamar - MA", "hours": "Todos os dias, 10h às 02h"},
    {"id": "pitangueiras", "name": "MV de Pitangueiras", "whatsapp": "", "address": "Pitangueiras, São José de Ribamar - MA", "hours": "Todos os dias, 10h às 02h"},
]


async def bootstrap() -> None:
    try:
        if not await db.admin.find_one({"key": "admin"}):
            pw = os.environ.get("DEFAULT_ADMIN_PASSWORD", "mvadmin2026")
            await db.admin.insert_one({"key": "admin", "password_hash": hash_password(pw), "updated_at": now_utc()})
            logger.info("Default admin password created")

        if not await db.settings.find_one({"key": "public"}):
            await db.settings.insert_one(
                {"key": "public", "stores": DEFAULT_STORES, "announcement": "Delivery em toda São José de Ribamar • Geladas trincando 🍻"}
            )

        # catalogue seeded exactly once, ever — flag stays even if owners archive everything
        if not await db.meta.find_one({"key": "seeded"}):
            if await db.products.count_documents({}) == 0:
                now = now_utc()
                docs = [
                    {
                        "id": str(uuid.uuid4()), "name": n, "description": d, "category": c, "price": p,
                        "old_price": op, "stock": s, "featured": f, "is_combo": combo, "image_url": IMG[img],
                        "archived": False, "created_at": now, "updated_at": now,
                    }
                    for (n, d, c, p, op, s, f, combo, img) in SEED
                ]
                await db.products.insert_many(docs)
            await db.meta.insert_one({"key": "seeded", "at": now_utc()})
    except Exception as exc:  # never block boot
        logger.error("bootstrap failed: %s", exc)
