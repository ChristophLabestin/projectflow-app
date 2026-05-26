#!/usr/bin/env python3
"""Small ProjectFlow Codex session client."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib import error, request


DEFAULT_API_BASE_URL = "https://europe-west3-project-manager-9d0ad.cloudfunctions.net/api"


def run_git(args: list[str]) -> str:
    try:
        return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return ""


def repo_root() -> Path:
    root = run_git(["rev-parse", "--show-toplevel"])
    return Path(root) if root else Path.cwd()


def load_project_link() -> dict[str, Any]:
    link_path = repo_root() / ".projectflow" / "project.json"
    if not link_path.exists():
        return {}
    try:
        return json.loads(link_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def default_external_key(title: str, project_id: str) -> str:
    import hashlib

    source = "|".join([
        str(repo_root()),
        run_git(["rev-parse", "--abbrev-ref", "HEAD"]),
        project_id,
        title,
    ])
    return "codex:" + hashlib.sha256(source.encode("utf-8")).hexdigest()[:24]


def parse_json(value: str | None, label: str) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{label} must be valid JSON: {exc}") from exc


def resolve_project_id(args: argparse.Namespace, link: dict[str, Any]) -> str:
    project_id = args.project_id or os.getenv("PROJECTFLOW_PROJECT_ID") or link.get("defaultProjectId")
    if not project_id:
        raise SystemExit("Missing project id. Pass --project-id or set PROJECTFLOW_PROJECT_ID.")
    return project_id


def resolve_tenant_id(args: argparse.Namespace, link: dict[str, Any]) -> str | None:
    return args.tenant_id or os.getenv("PROJECTFLOW_TENANT_ID") or link.get("tenantId")


def build_payload(args: argparse.Namespace, project_id: str, link: dict[str, Any]) -> dict[str, Any]:
    title = getattr(args, "title", "") or getattr(args, "request", "") or "Codex session"
    external_key = args.external_key or default_external_key(title, project_id)
    files = getattr(args, "files", None) or []
    commands = getattr(args, "commands", None) or []

    payload: dict[str, Any] = {
        "projectId": project_id,
        "tenantId": resolve_tenant_id(args, link),
        "externalKey": external_key,
        "title": title,
        "summary": getattr(args, "summary", None),
        "request": getattr(args, "request", None),
        "entity": getattr(args, "entity", None),
        "phase": getattr(args, "phase", None),
        "status": getattr(args, "status", None),
        "repoPath": getattr(args, "repo_path", None) or str(repo_root()),
        "repoName": getattr(args, "repo_name", None) or repo_root().name,
        "branch": getattr(args, "branch", None) or run_git(["rev-parse", "--abbrev-ref", "HEAD"]),
        "commitSha": getattr(args, "commit_sha", None) or run_git(["rev-parse", "HEAD"]),
        "validationStatus": getattr(args, "validation_status", None),
        "filesTouched": files,
        "commands": commands,
        "metadata": parse_json(getattr(args, "metadata_json", None), "--metadata-json"),
    }

    follow_up_titles = getattr(args, "follow_up_titles", None) or []
    follow_up_json = getattr(args, "follow_up_json", None) or []
    follow_ups = [parse_json(item, "--follow-up-json") for item in follow_up_json]
    follow_ups.extend({"title": item} for item in follow_up_titles)
    if follow_ups:
        payload["followUps"] = follow_ups

    return {key: value for key, value in payload.items() if value not in (None, "", [])}


def call_api(method: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    api_base_url = os.getenv("PROJECTFLOW_API_BASE_URL", DEFAULT_API_BASE_URL).rstrip("/")
    token = os.getenv("PROJECTFLOW_API_TOKEN")
    if not token:
        raise SystemExit("Missing PROJECTFLOW_API_TOKEN.")

    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        api_base_url + path,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with request.urlopen(req, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw)
        except Exception:
            detail = {"success": False, "error": raw}
        raise SystemExit(json.dumps({
            "success": False,
            "status": exc.code,
            "response": detail,
        }, indent=2)) from exc


def add_common_flags(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--project-id")
    parser.add_argument("--tenant-id")
    parser.add_argument("--external-key")
    parser.add_argument("--title")
    parser.add_argument("--summary")
    parser.add_argument("--request")
    parser.add_argument("--phase")
    parser.add_argument("--status")
    parser.add_argument("--repo-path")
    parser.add_argument("--repo-name")
    parser.add_argument("--branch")
    parser.add_argument("--commit-sha")
    parser.add_argument("--validation-status")
    parser.add_argument("--file", dest="files", action="append")
    parser.add_argument("--command", dest="commands", action="append")
    parser.add_argument("--metadata-json")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Codex sessions to ProjectFlow.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start")
    add_common_flags(start)
    start.add_argument("--entity", choices=["task", "initiative"], default="task")

    checkpoint = subparsers.add_parser("checkpoint")
    add_common_flags(checkpoint)
    checkpoint.add_argument("--session-id")

    finish = subparsers.add_parser("finish")
    add_common_flags(finish)
    finish.add_argument("--session-id")
    finish.add_argument("--follow-up-title", dest="follow_up_titles", action="append")
    finish.add_argument("--follow-up-json", action="append")

    followups = subparsers.add_parser("followups")
    add_common_flags(followups)
    followups.add_argument("--session-id")
    followups.add_argument("--session-external-key")
    followups.add_argument("--follow-up-title", dest="follow_up_titles", action="append")
    followups.add_argument("--follow-up-json", action="append")

    args = parser.parse_args()
    link = load_project_link()
    project_id = resolve_project_id(args, link)
    payload = build_payload(args, project_id, link)

    if args.command == "start":
        result = call_api("POST", f"/projectflow/projects/{project_id}/codex/sessions/start", payload)
    elif args.command == "checkpoint":
        session_id = getattr(args, "session_id", None)
        suffix = f"/{session_id}/checkpoint" if session_id else "/checkpoint"
        result = call_api("POST", f"/projectflow/projects/{project_id}/codex/sessions{suffix}", payload)
    elif args.command == "finish":
        session_id = getattr(args, "session_id", None)
        suffix = f"/{session_id}/finish" if session_id else "/finish"
        result = call_api("POST", f"/projectflow/projects/{project_id}/codex/sessions{suffix}", payload)
    else:
        if getattr(args, "session_external_key", None):
            payload["sessionExternalKey"] = args.session_external_key
        result = call_api("POST", f"/projectflow/projects/{project_id}/codex/followups/bulk-create", payload)

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
