# Cloud FinOps Automation Engine & Tag-Governed Control Plane

[![AWS Region](https://img.shields.io/badge/AWS%20Region-ap--south--1-orange?logo=amazon-aws)](https://aws.amazon.com/)
[![Runtime](https://img.shields.io/badge/Runtime-Python%203.12%20%7C%20React%2018-blue?logo=python)](https://python.org)
[![Zero-Trust](https://img.shields.io/badge/Security-Zero--Trust%20Guardrails-emerald)](#zero-trust-guardrail-architecture)

An enterprise-grade, event-driven FinOps automation suite and client-side operations dashboard engineered on AWS. The platform enforces tag-based lifecycle schedules, automated idle resource shut-offs, dynamic cloud CRUD operations, and an immutable compliance audit trail.

---

## 🏛️ System Architecture

```text
┌─────────────────┐       HTTPS / REST       ┌────────────────────────┐
│  React Client   │ ───────────────────────> │  Amazon API Gateway    │
│  (Vite+Tailwind)│                          │  (Regional REST Proxy) │
└─────────────────┘                          └──────────┬─────────────┘
                                                        │
                                                        ▼
┌─────────────────┐   EventBridge Cron        ┌────────────────────────┐
│ Amazon DynamoDB │ <──────────────────────── │   AWS Lambda Core      │
│  (Audit Trail)  │      PutItem / Scan       │  (Boto3 / Python 3.12) │
└─────────────────┘                           └──────────┬─────────────┘
                                                        │
                                                        ▼
                                              ┌────────────────────────┐
                                              │   Amazon EC2 Fleet     │
                                              │   (Dev / Prod Nodes)   │
                                              └────────────────────────┘


Key Components
Client Plane: React 18 single-page application built with Vite, Tailwind CSS, Lucide Icons, and Recharts. Provides live telemetry, search/filtering, an interactive ROI savings simulator, and direct cloud controls.

API Plane: Amazon API Gateway with greedy proxy integration (/{proxy+}) and full CORS preflight termination.

Compute Plane: Serverless Python Lambda (FinOpsEngineCore) running Boto3 to evaluate instance metadata, mutate instance power states, and enforce security policies.

Governance & Storage: Amazon DynamoDB (FinOps_Audit_Logs) storing immutable timestamps, user actions, and dollar-denominated savings calculations.

Security Boundary: IAM condition keys and backend validation blocking modifications to instances tagged Environment: prod.



.

🔒 Zero-Trust Guardrail Architecture
The engine implements strict blast-radius isolation:

Frontend Enforcement: Non-dev instances are locked with visual zero-trust status chips; operational triggers are permanently disabled.

Backend Interceptor: Lambda evaluates EC2 instance tags before executing any boto3 lifecycle call:

if tags.get("Environment") == "prod":
    return format_response(403, {"error": "Protected prod instance: Action aborted by FinOps Guardrails"})

IAM Scoping: The Lambda execution role enforces least-privilege policies, preventing unauthorized modifications across production VPC boundaries.


🚀 API Specification

EndpointMethodPayload / ParamsDescription/api/instancesGETNoneScans and returns live EC2 fleet status, tags, and schedules/api/actionPOST`{"instanceId": "...", "action": "STARTSTOP"}`/api/bulk-actionPOST{"targetEnv": "dev", "action": "STOP"}Mass-shuts down non-production resources in 1 click/api/tagPOST{"instanceId": "...", "tagKey": "...", "tagValue": "..."}Dynamically mutates AWS resource tags/api/audit-logsGETNoneRetrieves latest compliance and financial execution records



🛠️ Local Development Setup
1. Backend Deployment

cd backend
Compress-Archive -Path lambda_function.py -DestinationPath finops_engine.zip -Force
aws lambda update-function-code --function-name FinOpsEngineCore --zip-file fileb://finops_engine.zip


2. Frontend Launch

cd ../frontend
npm install
npm run dev

Visit http://localhost:5173 to launch the control plane.
