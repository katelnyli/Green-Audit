import asyncio
import json
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.audit import AuditRequest, AuditStarted, AuditStatus

router = APIRouter()

# In-memory store — fine for a hackathon
_jobs: dict[str, AuditStatus] = {}


@router.post("", response_model=AuditStarted)
async def start_audit(req: AuditRequest):
    audit_id = str(uuid4())
    _jobs[audit_id] = AuditStatus(audit_id=audit_id, status="queued")
    asyncio.create_task(_run_audit(audit_id, str(req.url), req.credentials))
    return AuditStarted(audit_id=audit_id)


@router.get("/{audit_id}", response_model=AuditStatus)
async def get_audit(audit_id: str):
    job = _jobs.get(audit_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Audit not found")
    return job


@router.get("/{audit_id}/stream")
async def stream_audit(audit_id: str):
    async def event_stream():
        while True:
            job = _jobs.get(audit_id)
            if job is None:
                yield f"data: {json.dumps({'error': 'not found'})}\n\n"
                break
            yield f"data: {job.model_dump_json()}\n\n"
            if job.status in ("done", "error"):
                break
            await asyncio.sleep(1)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


async def _run_audit(audit_id: str, url: str, credentials: dict | None):
    from app.services.orchestrator import run_full_audit

    try:
        result = await run_full_audit(
            audit_id=audit_id,
            url=url,
            credentials=credentials,
            on_progress=lambda phase, progress, total, current_url: _update_progress(
                audit_id, phase, progress, total, current_url
            ),
            on_live_url=lambda live_url: _set_live_url(audit_id, live_url),
            on_agent_live_url=lambda idx, live_url: _add_agent_live_url(audit_id, idx, live_url),
            on_page_discovered=lambda page_url: _add_discovered_page(audit_id, page_url),
            on_agent_status=lambda status: _set_agent_status(audit_id, status),
        )
        job = _jobs[audit_id]
        job.status = "done"
        job.result = result
    except Exception as e:
        job = _jobs.get(audit_id)
        if job:
            job.status = "error"
            job.error = str(e)


def _update_progress(audit_id: str, phase: str, progress: int, total: int, current_url: str):
    job = _jobs.get(audit_id)
    if job:
        job.status = phase  # type: ignore[assignment]
        job.progress = progress
        job.total = total
        job.current_url = current_url


def _set_live_url(audit_id: str, live_url: str):
    job = _jobs.get(audit_id)
    if job:
        job.live_url = live_url


def _add_agent_live_url(audit_id: str, idx: int, live_url: str):
    job = _jobs.get(audit_id)
    if not job:
        return
    urls = list(job.live_urls)
    # Grow the list to fit this index if needed
    while len(urls) <= idx:
        urls.append("")
    urls[idx] = live_url
    job.live_urls = urls


def _add_discovered_page(audit_id: str, page_url: str):
    job = _jobs.get(audit_id)
    if job and page_url not in job.pages_discovered:
        job.pages_discovered = job.pages_discovered + [page_url]
        job.current_url = page_url


def _set_agent_status(audit_id: str, status: str):
    job = _jobs.get(audit_id)
    if job:
        job.agent_status = status
