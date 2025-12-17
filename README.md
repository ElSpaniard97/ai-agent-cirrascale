# AI Troubleshooting Agent (GitHub Pages)

Static troubleshooting dashboard hosted on GitHub Pages.  
Includes intake, clarifying questions, recommended steps, command snippets, and report export.

## Run locally
- Open `index.html` directly, or use a simple local server:
  - VS Code: Live Server extension
  - Python: `python3 -m http.server 8080`

Then browse: `http://localhost:8080`

## Deploy on GitHub Pages
1. Push repo to GitHub
2. Settings → Pages
3. Build and deployment:
   - Source: Deploy from a branch
   - Branch: `main` / root
4. Save

## Customize playbooks
Edit: `data/playbooks.json`

Add more categories and procedures:
- keywords
- questions
- steps
- per-OS command lists
