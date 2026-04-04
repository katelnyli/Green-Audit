from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import audit

app = FastAPI(title="Green Audit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audit.router, prefix="/audit")
