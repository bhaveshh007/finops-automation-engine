# ⚡ Cloud FinOps Automation Engine & Tag-Governed Control Plane

[![AWS Region](https://img.shields.io/badge/AWS%20Region-ap--south--1-orange?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/)
[![Runtime](https://img.shields.io/badge/Runtime-Python%203.12%20%7C%20React%2018-blue?style=for-the-badge&logo=python)](https://python.org)
[![Database](https://img.shields.io/badge/Database-Amazon%20DynamoDB-4053D6?style=for-the-badge&logo=amazondynamodb)](https://aws.amazon.com/dynamodb/)
[![Security](https://img.shields.io/badge/Security-Zero--Trust%20Guardrails-emerald?style=for-the-badge&logo=shield)](https://aws.amazon.com/iam/)

An enterprise-ready, event-driven **FinOps Automation Suite** and operational dashboard engineered on AWS. The platform enforces tag-based resource scheduling, automated idle compute shut-offs, direct infrastructure CRUD operations, and an immutable compliance audit trail.

---

## 📑 Table of Contents
- [📌 Key Features](#-key-features)
- [🏛️ System Architecture](#️-system-architecture)
- [🛡️ Zero-Trust Guardrails](#️-zero-trust-guardrails)
- [📡 REST API Endpoints](#-rest-api-endpoints)
- [💻 Tech Stack](#-tech-stack)
- [🚀 Quick Start Guide](#-quick-start-guide)
- [📊 Financial Impact & Savings](#-financial-impact--savings)

---

## 📌 Key Features

- 🖥️ **Live EC2 Fleet Management**: Discover, inspect, and toggle power states of AWS EC2 instances across environments in real time.
- 🛑 **1-Click Emergency Stop**: Instantly halt all non-production dev workloads to prevent off-hours idle compute leaks.
- 🏷️ **Dynamic Tag Governance**: Edit instance tags (e.g., `AutoSchedule: true/false`) directly from the web console via AWS Boto3.
- 🛡️ **Zero-Trust Guardrails**: Production resources tagged `Environment: prod` are locked at both UI and Lambda IAM execution levels.
- 📜 **DynamoDB Audit Trail**: Every lifecycle transition and tag mutation is permanently logged with timestamps, initiator details, and cost calculations.
- 📥 **Audit Export**: Export complete compliance and execution history to CSV with a single click.
- 🧮 **Interactive ROI Simulator**: Live calculator to simulate monthly and annual cloud savings based on instance sizing and shutdown hours.

---

## 🏛️ System Architecture

```text
┌─────────────────────────┐          HTTPS / REST           ┌─────────────────────────┐
│   ⚛️ React 18 Client   │ ─────────────────────────────>   |   🌐 API Gateway       │
│   (Vite + Tailwind CSS) │                                 │   (REST Proxy ANY)      │
└─────────────────────────┘                                 └────────────┬────────────┘
                                                                        │
                                                                        ▼
┌─────────────────────────┐       PutItem / Scan           ┌─────────────────────────┐
│   🗄️ Amazon DynamoDB    │ <───────────────────────────── │   ⚡ AWS Lambda Core    │
│   (FinOps_Audit_Logs)   │                                │   (Python 3.12 + Boto3) │
└─────────────────────────┘                                └────────────┬────────────┘
                                                                        │
                                                                        ▼
                                                           ┌─────────────────────────┐
                                                           │   🖥️ Amazon EC2 Fleet   │  
                                                           │   (Dev & Prod Instances) │
                                                           └──────────────────────── ─┘



🛡️ Zero-Trust Guardrails
The engine uses multi-layered protection to guarantee zero blast radius on production instances:

Client Request ──► [ Frontend Badge Lock ] ──► [ Lambda Environment Filter ] ──► [ IAM Restricted Policy ]

 1. Frontend Safety: Instances tagged Environment: prod replace control triggers with locked Protected (Zero-Trust) badges.

 2.Lambda Pre-Execution Interceptor:

   # Backend validation block

     if tags.get("Environment") == "prod":
         return format_response(403, {
           "error": "Forbidden: Production instances are protected by FinOps Guardrails"
      })

 3. IAM Least Privilege: Scoped IAM policies prevent unauthorized operational actions across production VPC boundaries.



# Backend Deployment (AWS Lambda)
cd backend
Compress-Archive -Path lambda_function.py -DestinationPath finops_engine.zip -Force
aws lambda update-function-code --function-name FinOpsEngineCore --zip-file fileb://finops_engine.zip

# Frontend Setup
Bash
cd ../frontend
npm install
npm run dev


📊 Financial Impact & Savings Analysis

💡 Core FinOps Principle: Shutting down non-production resources for 12 hours each weeknight and all 48 hours over the weekend yields an immediate ~55% reduction in idle compute spend without touching application code.

⏱️ Fleet Runtime Reduction: Drops active operating hours from 168 hrs/week (24/7 unmanaged baseline) down to ~60 hrs/week — achieving a -64.2% reduction in compute runtime.

💵 Per-Node Cost Optimization: Reduces single t3.medium dev instance spend from ~$69.12/month down to ~$24.70/month, securing ~$44.42 in direct monthly savings per node.

🏢 Cluster-Scale ROI: For a modest 10-node development cluster, monthly spend drops from ~$691.20 to ~$247.00, delivering over ~$5,330.40 in audited annual savings.

🛡️ Zero Blast-Radius Guarantee: High-availability production instances (Environment: prod) are fully isolated from automated actions via IAM policies and runtime Lambda interceptors.

