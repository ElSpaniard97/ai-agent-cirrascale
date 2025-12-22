# AI Infrastructure Troubleshooting Agent

> **Diagnostics-first. Approval-gated remediation. Ticket-safe output.**

A production-ready web application for AI-assisted infrastructure troubleshooting, designed for real-world IT operations workflows. Enforces diagnostics before remediation, requires explicit approval for production-impacting changes, and produces clean outputs suitable for incident tickets.

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/elspaniard97/imbedded-csrma-ai-agent)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## ✨ Key Features

- **🔍 Diagnostics-First Workflow** - Always starts with evidence collection before suggesting changes
- **🛡️ Explicit Remediation Approval Gate** - Production-impacting changes require explicit user consent
- **📋 Structured Troubleshooting** - Preset templates for common scenarios across domains
- **📊 Ticket-Safe Output** - Copy/export features designed for incident documentation
- **🎨 Modern, Lightweight UI** - Clean interface with dark/light/system theme support
- **🔐 Secure Architecture** - No API keys in frontend, JWT authentication, server-side settings
- **📸 Image Analysis** - Upload screenshots for visual diagnostics (GPT-4o Vision)
- **📄 Script Library** - Upload and reference automation scripts during troubleshooting
- **⚡ Fast & Responsive** - Optimized performance with efficient API usage

---

## 🧠 Supported Domains

### Networking
- Switch/router triage, VLANs, trunks, STP, routing
- MTU issues, packet loss, interface errors
- Network device configuration analysis

### Server OS / Services
- Linux & Windows health diagnostics
- Log analysis (journalctl, Event Viewer)
- CPU/memory/disk performance issues
- Service failures and dependencies

### Scripts / Automation
- PowerShell, Python, Bash debugging
- Ansible, Terraform, YAML/JSON validation
- Error analysis and code corrections
- Syntax and logic verification

### Hardware
- Dell iDRAC, HPE iLO, Supermicro IPMI
- PSU alerts, thermal issues, fan failures
- RAID status, storage diagnostics
- ECC memory errors

---

## 🏗 Architecture Overview

```
┌─────────────────────────┐
│   Browser (GitHub Pages) │
│   - Static HTML/CSS/JS   │
│   - No secrets/API keys  │
└───────────┬─────────────┘
            │ HTTPS
            │ POST /api/chat
            │ Authorization: Bearer <JWT>
            ▼
┌─────────────────────────┐
│   Render Backend         │
│   - Node.js + Express    │
│   - JWT Authentication   │
│   - OpenAI API calls     │
│   - Script storage       │
│   - Settings persistence │
└───────────┬─────────────┘
            │
            │ OpenAI API
            ▼
┌─────────────────────────┐
│   OpenAI GPT-4o-mini     │
│   - Chat completions     │
│   - Vision (images)      │
└─────────────────────────┘
```

**Frontend:** Static site hosted on GitHub Pages  
**Backend:** Node.js service on Render (free tier compatible)  
**AI Provider:** OpenAI API (GPT-4o-mini for cost efficiency)

---

## 🌐 Live URLs

| Service | URL |
|---------|-----|
| **Frontend** | https://elspaniard97.github.io/imbedded-csrma-ai-agent/ |
| **Backend** | https://imbedded-csrma-ai-agent.onrender.com |
| **Health Check** | https://imbedded-csrma-ai-agent.onrender.com/healthz |

---

## 📂 Project Structure

```
/
├── index.html              # Main HTML file
├── main.css                # Stylesheet with theme support
├── app.js                  # Frontend JavaScript
├── server.js               # Backend Node.js server
├── package.json            # Node.js dependencies
├── README.md               # This file
└── .gitignore             # Git ignore rules
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for backend)
- OpenAI API key
- GitHub account (for frontend hosting)
- Render account (for backend hosting)

### Environment Variables (Backend)

Create these in your Render dashboard or `.env` file:

```bash
# Required
OPENAI_API_KEY=sk-proj-...                          # Your OpenAI API key
JWT_SECRET=your-long-random-secret-here             # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ADMIN_USERNAME=admin                                 # Your admin username
ADMIN_PASSWORD_HASH=<bcrypt-hash>                   # Generate with: node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"

# Optional
PORT=10000                                          # Default: 10000
SETTINGS_PATH=/data/settings.json                   # Settings storage path
SCRIPTS_DIR=/data/scripts                           # Scripts storage directory
```

**⚠️ IMPORTANT:** `ADMIN_PASSWORD_HASH` must be a bcrypt hash, not a plain password!

Generate a password hash:
```bash
node -e "console.log(require('bcryptjs').hashSync('YourSecurePassword123', 10))"
```

---

## 🔧 Setup Instructions

### Frontend Setup (GitHub Pages)

1. **Fork/Clone Repository**
   ```bash
   git clone https://github.com/elspaniard97/imbedded-csrma-ai-agent.git
   cd imbedded-csrma-ai-agent
   ```

2. **Enable GitHub Pages**
   - Go to repo Settings → Pages
   - Source: "Deploy from branch"
   - Branch: `main`
   - Folder: `/ (root)`
   - Save

3. **Configure Backend URL**
   
   Edit `index.html` (lines 97-102):
   ```javascript
   window.BACKEND_URL = "https://your-backend.onrender.com/api/chat";
   window.LOGIN_URL = "https://your-backend.onrender.com/auth/login";
   ```

### Backend Setup (Render)

1. **Create Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - New → Web Service
   - Connect your GitHub repository
   - Settings:
     - **Name:** `ai-troubleshooting-backend`
     - **Environment:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Instance Type:** Free (or paid for better performance)

2. **Set Environment Variables**
   
   Add in Render dashboard (Environment tab):
   ```
   OPENAI_API_KEY=sk-proj-...
   JWT_SECRET=<32-byte-hex-string>
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD_HASH=$2a$10$...
   ```

3. **Deploy**
   - Render will auto-deploy on push to main branch
   - First deploy takes ~5 minutes
   - Health check: `https://your-app.onrender.com/healthz`

### Local Development (Optional)

```bash
# Install dependencies
npm install

# Set environment variables
export OPENAI_API_KEY="sk-proj-..."
export JWT_SECRET="your-secret"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD_HASH="$2a$10$..."

# Start server (with hot reload)
npm run dev

# Server runs on http://localhost:10000
```

Update `index.html` for local testing:
```javascript
window.BACKEND_URL = "http://localhost:10000/api/chat";
window.LOGIN_URL = "http://localhost:10000/auth/login";
```

---

## 📋 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Service info | No |
| GET | `/healthz` | Health check | No |
| POST | `/auth/login` | User authentication | No |
| GET | `/api/settings` | Get user settings | Yes |
| PUT | `/api/settings` | Save user settings | Yes |
| GET | `/api/scripts` | List user scripts | Yes |
| POST | `/api/scripts` | Upload script | Yes |
| GET | `/api/scripts/:id` | Get script by ID | Yes |
| DELETE | `/api/scripts/:id` | Delete script | Yes |
| POST | `/api/chat` | Main AI interaction | Yes |

---

## 🔐 Security Features

- ✅ **JWT Authentication** - 8-hour token expiration
- ✅ **API Keys Server-Side Only** - No secrets in frontend code
- ✅ **CORS Allowlist** - Restricted origin access
- ✅ **Bcrypt Password Hashing** - Secure credential storage
- ✅ **Input Sanitization** - Protection against injection attacks
- ✅ **File Upload Restrictions** - Size limits and type validation
- ✅ **Rate Limiting Ready** - Easy to add with express-rate-limit
- ✅ **Secure Defaults** - HTTPS enforced in production

---

## 🎯 Usage Workflow

1. **Select a Preset Template**
   - Choose Network, Server, Script, or Hardware
   - Structured intake form populates message box

2. **Provide Context**
   - Paste logs, error messages, or configuration
   - Optionally attach screenshots for visual analysis
   - Upload scripts to the library for reference

3. **Run Diagnostics Mode**
   - AI provides evidence collection commands
   - Suggests verification steps
   - Ranks likely causes

4. **Review Findings**
   - Analyze provided diagnostic steps
   - Collect additional evidence as suggested

5. **Toggle Remediation (If Needed)**
   - Enable "Remediation Approved" only when:
     - ✅ Maintenance window exists
     - ✅ Backups/restore points available
     - ✅ Rollback plan acceptable
   - Receive step-by-step fix with rollback procedures

6. **Export Results**
   - **Copy Ticket Notes:** Formatted summary for ticket systems
   - **Export TXT:** Human-readable transcript
   - **Export JSON:** Structured data for automation

---

## 🧾 Ticket-Safe Output Examples

### Copy Ticket Notes
```
Ticket Notes (AI-assisted)
Timestamp: 2024-01-15T10:30:00.000Z
Tool: Infra Troubleshooting Agent
Mode: Diagnostics Only

[AI response formatted for ticket systems]
```

### Export TXT
```
=== USER ===
Network issue: users can't access fileserver...

=== ASSISTANT ===
Quick Triage:
- Likely layer 2/3 connectivity issue...
```

### Export JSON
```json
{
  "exported_at": "2024-01-15T10:30:00.000Z",
  "tool": "Infra Troubleshooting Agent",
  "mode": "diagnostics_only",
  "history": [...],
  "selectedScriptIds": [...]
}
```

---

## 🎨 Customization

### Themes
Three theme options available in Settings:
- **System** - Follows OS preference
- **Dark** - Manual dark mode
- **Light** - Manual light mode

### Presets
Edit preset templates in `app.js` (lines ~900-1000):
```javascript
const presets = {
  network: `Your custom template...`,
  // ... more presets
};
```

### Styling
Customize colors and design in `main.css`:
```css
:root {
  --primary: #3b82f6;    /* Brand color */
  --danger: #ef4444;     /* Warning color */
  --radius: 14px;        /* Border radius */
  /* ... more tokens */
}
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue:** "Unauthorized" errors after login  
**Solution:** Check JWT_SECRET is set correctly on backend

**Issue:** CORS errors in console  
**Solution:** Verify frontend URL is in ALLOWED_ORIGINS (server.js)

**Issue:** "OpenAI API key not configured"  
**Solution:** Set OPENAI_API_KEY in Render environment variables

**Issue:** Login fails with correct password  
**Solution:** Ensure ADMIN_PASSWORD_HASH is a bcrypt hash, not plain text

**Issue:** Scripts not saving  
**Solution:** Check that `/data` directory has write permissions on Render

**Issue:** Images not analyzed  
**Solution:** Ensure file size < 6MB and format is supported (JPEG, PNG, etc.)

### Debug Mode

Enable verbose logging:
```bash
# Backend
export DEBUG=*
npm start

# Check Render logs
# Dashboard → Your Service → Logs
```

---

## 🛣 Roadmap

### Planned Features
- [ ] **Streaming Responses** - Real-time AI output
- [ ] **Multi-User Support** - Database-backed user accounts
- [ ] **Rate Limiting** - API request throttling
- [ ] **Audit Logging** - Track all user actions
- [ ] **Integration APIs** - Slack, Teams, PagerDuty webhooks
- [ ] **Advanced Analytics** - Usage metrics and insights
- [ ] **Response Caching** - Faster replies for common queries
- [ ] **Mobile App** - Native iOS/Android clients

### Completed (v1.2.0)
- [x] Image analysis with GPT-4o Vision
- [x] Script library with upload/management
- [x] Server-side settings persistence
- [x] Improved error handling
- [x] Better UI/UX with animations
- [x] Keyboard shortcuts (Ctrl+Enter)
- [x] Accessibility improvements

---

## 📊 Performance Notes

### Backend Optimization
- **History Limit:** Last 12 messages (prevents context overflow)
- **Script Truncation:** 6,000 chars per script (cost control)
- **Max Scripts:** 3 attachments per conversation
- **Token Limits:** 3,000 max completion tokens

### Cost Estimates (GPT-4o-mini)
- **Input:** ~$0.15 per 1M tokens
- **Output:** ~$0.60 per 1M tokens
- **Typical Session:** ~$0.01-0.05 per conversation
- **Monthly (moderate use):** ~$5-20

### Render Free Tier Limitations
- **Spin Down:** After 15 min inactivity
- **First Request:** ~30s cold start
- **Solution:** Upgrade to paid tier for always-on

---

## 🤝 Contributing

Contributions welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use 2-space indentation
- Follow existing naming conventions
- Add comments for complex logic
- Test thoroughly before submitting

---

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2024 Ezekiel Correa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 👤 Author

**Ezekiel Correa**  
IT Infrastructure / Automation / AI-assisted Operations

- GitHub: [@elspaniard97](https://github.com/elspaniard97)
- Project: [imbedded-csrma-ai-agent](https://github.com/elspaniard97/imbedded-csrma-ai-agent)

---

## 🙏 Acknowledgments

- OpenAI for GPT-4o API
- Render for free hosting
- GitHub Pages for static site hosting
- The open-source community

---

## 📞 Support

For issues, questions, or feature requests:
- Open an issue: [GitHub Issues](https://github.com/elspaniard97/imbedded-csrma-ai-agent/issues)
- Check existing issues before creating new ones
- Provide detailed reproduction steps for bugs

---

**⚡ Built with passion for IT operations teams who need fast, reliable diagnostics.**
