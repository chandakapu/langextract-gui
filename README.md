# LangExtract Web UI

A highly polished, interactive, web-based UI/UX for the **LangExtract** repository, specifically tailored to demonstrate advanced Human-Computer Interaction (HCI) concepts, Explainable AI (XAI), and Human-in-the-Loop (HITL) workflows.

---

## 🌟 Key Features & HCI Principles

This interface is built from the ground up prioritizing modern web aesthetics and usability heuristics:

1. **Explainable AI (XAI) & Trust**
   - **Confidence Metrics:** Clear visual indicators showing extraction confidence levels or LLM grounding status.
   - **Traceability:** Direct visual mapping linking extracted structured attributes/entities to their exact source text segment inside the document.

2. **Cognitive Load Reduction**
   - **Progressive Disclosure:** Keeps users focused by hiding complex details until needed, presenting simplified extraction categories first.
   - **Dual-Coding:** Combines custom curated color palettes, typography, badges, and icons to represent different extraction classes (e.g., character, emotion, entity, etc.) dynamically.

3. **Recognition vs. Recall**
   - **Pre-populated Templates:** Includes easy-to-use template guides (such as *Romeo and Juliet* character/emotion extraction or medical notes).
   - **Side-by-Side Comparison:** Dual-pane layout separating the raw source text from the structured JSON/table preview.

4. **Error Prevention & Recovery (HITL)**
   - **Interactive Editing:** Users can manually override, adjust, or correct the LLM's extractions directly in the UI.
   - **Undo/Redo Actions:** Easy flow-control mechanisms for all user corrections.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** Core HTML5, modern Javascript (ES6+), and custom responsive Vanilla CSS (Glassmorphism, curated HSL schemes, and custom animations).
- **Backend:** A lightweight Python-based FastAPI server connecting the `langextract` library directly to the interactive frontend.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js (if applicable)

### Running the Project

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the backend:
   ```bash
   python main.py
   ```
3. Open `index.html` in your browser, or access the dev server.

---

## 👥 Development Team & Roles

- **`ui-designer` (Frontend / UX Architect):** Focuses on premium CSS styles, animations, responsiveness, and glassmorphic designs.
- **`backend-integrator` (Python / API Engineer):** Focuses on the FastAPI server, JSON REST APIs, and Gemini API integration.
- **`hci-evaluator` (Usability & Accessibility Auditor):** Ensures Jakob Nielsen's 10 Usability Heuristics are met along with WCAG 2.1 accessibility compliance.

---

## ⚖️ Attribution & License

This project relies on the core **LangExtract** engine originally developed by Google. We want to express our gratitude to the Google team for their work.

- **Original Core Repository:** [google/langextract](https://github.com/google/langextract)
- **Original License:** Apache License 2.0 (included in the `langextract` submodule/directory)

This Web GUI wrapper is maintained independently as a project for the Human-Computer Interaction (HCI) course.

