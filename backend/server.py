import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, ensure_indexes
from lib.bootstrap import bootstrap
from routers import auth, orders, products, settings


async def _startup() -> None:
    await ensure_indexes()
    await bootstrap()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.startup_task = asyncio.create_task(_startup())
    yield
    client.close()


app = FastAPI(lifespan=lifespan, title="MV Conveniência API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "MV Conveniência API"}


for module in (auth, products, orders, settings):
    api_router.include_router(module.router)
    if hasattr(module, "admin"):
        api_router.include_router(module.admin)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Include the router in the main app — must stay last
app.include_router(api_router)
