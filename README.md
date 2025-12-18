AI Infrastructure Troubleshooting Agent

A change-controlled AI troubleshooting assistant for enterprise IT environments.
Designed to standardize diagnostics and safely gate remediation across networking, servers, scripts, and hardware components.

🔗 Live Agent:
https://chatgpt.com/g/g-69441b1b5d0c81918300df5e63b0e079-ai-infrastructure-troubleshooting-agent

🔗 Live Showcase Site (GitHub Pages):
https://<your-username>.github.io/<your-repo-name>/

Overview

This project showcases a published ChatGPT GPT that mirrors real-world IT operational workflows:

Diagnostics first (read-only, evidence-based)

Explicit intent detection before changes

Human approval before remediation

Clear rollback and validation guidance

The repository contains a static GitHub Pages site used to document, demonstrate, and launch the agent.

Key Capabilities
🔹 Networking (Switches / Routers)

Interface errors, VLAN/trunk issues

STP, routing, MTU, packet loss

CLI output analysis (read-only first)

🔹 Server OS & Services

Linux / Windows diagnostics

CPU, memory, disk, services, logs

Connectivity, DNS, TLS, ports

🔹 Script & Automation Troubleshooting

PowerShell, Python, Bash

Ansible, Terraform, YAML/JSON

Stack traces, root cause analysis, corrected snippets

🔹 Hardware & Components

Vendor-aware triage (Dell / HPE)

iDRAC / iLO / IPMI alerts

PSU, thermals, RAID, memory (ECC)

Safe escalation and RMA guidance

How the Agent Works
1. Diagnostics Mode (Default)

Asks clarifying questions

Analyzes logs, configs, scripts, or screenshots

Identifies likely root causes

Provides read-only verification commands only

Produces a remediation plan (but does not execute it)

2. Intent Detection

The agent waits for explicit user intent such as:

“apply”, “fix”, “proceed”, “make the change”, “run it”

3. Approval Gate

Before remediation, the agent requires confirmation of:

Production impact awareness

Maintenance window approval

Backup / restore availability

Rollback plan acceptance

4. Remediation Mode (Only After Approval)

Step-by-step change instructions

Validation checks

Rollback/backout procedures

Repository Structure
/
├── index.html      # GitHub Pages landing page
├── style.css       # Styling (dark/light theme)
├── script.js       # UI behavior (copy buttons, theme toggle)
└── README.md       # Project documentation

Using the Agent

Open the agent using the Launch Agent button on the site
or directly via the link above.

Paste:

Logs

CLI output

Error messages

Screenshots

Full scripts (if needed)

Review diagnostics and proposed plan.

Explicitly approve remediation when ready.

GitHub Pages Deployment

To host the showcase site:

Push all files to the repository root:

index.html

style.css

script.js

Go to Repository Settings → Pages

Set:

Source: main branch

Folder: / (root)

Save and wait for Pages to deploy.
