# Phase 2 — Step 2.2: Teacher Upload UI — Pre-flight Report
**Date:** 2026-04-17
**Phase:** 2 — Content Pipeline
**Status:** ✅ Pre-flight Checks Complete

This report documents the results of the 7 mandatory pre-flight verification questions and the behavior of the backend API endpoints as of the latest test run.

---

## 1. API Verification Results (Curl Tests)

### Question 1: `/api/upload` Response Shape
- **Result:** Returns `{ url: string }`.
- **Actual Response:** `{"message":"File uploaded successfully","url":"http://localhost:3001/uploads/..."}`
- **Constraint:** Use exactly `url` in the frontend unboxing.

### Question 2: `/files/register` Behavior
- **Result:** Returns **HTTP 201**.
- **Accepted Body:** Successfully accepted `{"type","label","url"}` structure.
- **Constraint:** Path is `/api/v1/lectures/:id/files/register`.

### Question 3: `POST /transcripts` Response Shape
- **Result:** Returns **`{ transcript: { id: "..." } }`**.
- **Constraint:** Nested unwrap required: `data.transcript.id`.

### Question 4: `POST /transcripts/:id/process` Response Shape
- **Result:** Returns **`{ jobId: "..." }`**.
- **Actual Response:** `{"message":"Processing enqueued.","jobId":"...","summaryType":"BRIEF","pollUrl":"..."}`
- **Constraint:** Use `jobId` for subsequent polling.

### Question 5: `GET /ai/jobs/:id` Response Shape
- **Result:** Returns job properties **directly** (unwrapped).
- **Actual Response:** `{"id":"...","status":"PENDING","errorMessage":null,...}`
- **Constraint:** Access properties like `data.status` and `data.errorMessage` directly.

---

## 2. Source Code Audits (`api.ts`)

### Question 6: `api()` Functional Signature
- **Result:** **Yes**, it already accepts a second `RequestInit` argument.
- **Signature:** `export async function api<T>(path: string, options?: RequestInit & { skipAuth?: boolean }): Promise<T>`

### Question 7: `api()` Content-Type Handling
- **Result:** **No**, it does not set `Content-Type: application/json` automatically.
- **Decision:** Part A of the implementation MUST update `api()` to inject this header when the body is a string.

---

## 3. Implementation Guardrails

- **Upload Endpoint:** Verified at `http://localhost:3001/api/upload` (NOT `/api/v1/upload`).
- **Authorization:** Standard Bearer tokens verified as working for all endpoints.
- **Job Polling:** Verified status starts as `PENDING`.

---
**Report generated for immediate download and review.**
