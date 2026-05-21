// Copyright 2026 Google LLC.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * LangExtract HCI Web Studio - Client Controller
 * Reactive state management, XAI Traceability & HITL Engine.
 */

// Application State
let state = {
    templates: {},
    currentTemplateKey: "",
    classes: [], // Active list of extraction classes
    documentId: "",
    rawText: "",
    extractions: [], // Array of active extractions
    examples: [], // Few-shot examples from current template
    isVisualizing: false,
    selectedSpan: null // Temporary holder for text selections {text, start, end}
};

// DOM Elements
const selectTemplate = document.getElementById("select-template");
const selectModel = document.getElementById("select-model");
const inputApiKey = document.getElementById("input-api-key");
const textareaPrompt = document.getElementById("textarea-prompt");
const schemaClassesList = document.getElementById("schema-classes-list");
const inputNewClass = document.getElementById("input-new-class");
const btnAddClass = document.getElementById("btn-add-class");
const btnRun = document.getElementById("btn-run");
const btnSave = document.getElementById("btn-save");
const btnClearExtractions = document.getElementById("btn-clear-extractions");
const textareaDocInput = document.getElementById("textarea-doc-input");
const textViewer = document.getElementById("text-viewer");
const extractionsContainer = document.getElementById("extractions-container");
const extractionsEmpty = document.getElementById("extractions-empty");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const selectionPopover = document.getElementById("selection-popover");
const spanHoverCard = document.getElementById("span-hover-card");
const docIdBadge = document.getElementById("doc-id-badge");

// Modal Elements
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalEntityText = document.getElementById("modal-entity-text");
const modalEntityClass = document.getElementById("modal-entity-class");
const modalAttributesList = document.getElementById("modal-attributes-list");
const modalAddAttribute = document.getElementById("modal-add-attribute");
const modalCancel = document.getElementById("modal-cancel");
const modalSave = document.getElementById("modal-save");
const modalClose = document.getElementById("modal-close");

// Target Edit Entity index
let editingEntityIndex = null;

// Initialize Web Studio
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Fetch available templates
    await fetchTemplates();
    
    // 2. Load API Key from Session Storage if available
    const savedKey = sessionStorage.getItem("langextract_api_key");
    if (savedKey) {
        inputApiKey.value = savedKey;
    }
    
    // 3. Setup Listeners
    setupEventListeners();
    
    // 4. Default to first template to reduce cognitive load on cold-start
    if (selectTemplate.options.length > 1) {
        selectTemplate.selectedIndex = 1;
        applyTemplate(selectTemplate.value);
    }
});

// Event Listeners Configuration
function setupEventListeners() {
    // Template loading
    selectTemplate.addEventListener("change", (e) => {
        applyTemplate(e.target.value);
    });
    
    // Save API key locally in session
    inputApiKey.addEventListener("input", (e) => {
        sessionStorage.setItem("langextract_api_key", e.target.value);
    });
    
    // Schema Builder Actions
    btnAddClass.addEventListener("click", addCustomClass);
    inputNewClass.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addCustomClass();
    });
    
    // Run & Save actions
    btnRun.addEventListener("click", executeExtraction);
    btnSave.addEventListener("click", saveAnnotationsToFile);
    btnClearExtractions.addEventListener("click", resetToRawTextState);
    
    // Text Selection Event for HITL Span Labeling
    textViewer.addEventListener("mouseup", handleTextSelection);
    
    // Close Selection Popover if clicking elsewhere
    document.addEventListener("mousedown", (e) => {
        if (!selectionPopover.contains(e.target) && e.target !== textViewer) {
            hideSelectionPopover();
        }
        if (!spanHoverCard.contains(e.target) && !e.target.classList.contains("grounded-span")) {
            hideHoverCard();
        }
    });
    
    // Modal controls
    modalClose.addEventListener("click", closeModal);
    modalCancel.addEventListener("click", closeModal);
    modalSave.addEventListener("click", applyModalChanges);
    modalAddAttribute.addEventListener("click", () => addAttributeRow());
}

// ----------------------------------------------------
// Templates & State Setups
// ----------------------------------------------------

async function fetchTemplates() {
    showLoading("Loading templates...");
    try {
        const response = await fetch("/api/templates");
        if (!response.ok) throw new Error("Failed to load templates.");
        state.templates = await response.json();
        
        // Populate template select dropdown
        Object.keys(state.templates).forEach(key => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = state.templates[key].name;
            selectTemplate.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
        alert("Server communication error. Make sure FastAPI server is running.");
    } finally {
        hideLoading();
    }
}

function applyTemplate(key) {
    if (!key || !state.templates[key]) {
        state.currentTemplateKey = "";
        return;
    }
    
    const t = state.templates[key];
    state.currentTemplateKey = key;
    
    // Populating instructions & input content
    textareaPrompt.value = t.prompt;
    textareaDocInput.value = t.input_text;
    state.examples = t.examples;
    
    // Set schema classes
    state.classes = Object.keys(t.schema);
    renderSchemaClasses();
    
    // Reset workspace view
    resetToRawTextState();
}

function renderSchemaClasses() {
    schemaClassesList.innerHTML = "";
    state.classes.forEach((className, idx) => {
        const classColorIdx = (idx % 4) + 1; // map 1-4
        
        const tag = document.createElement("div");
        tag.className = `schema-tag class-${classColorIdx}`;
        tag.innerHTML = `
            <span>${className}</span>
            <button class="remove-btn" onclick="removeSchemaClass('${className}')">&times;</button>
        `;
        schemaClassesList.appendChild(tag);
    });
}

function removeSchemaClass(name) {
    state.classes = state.classes.filter(c => c !== name);
    renderSchemaClasses();
}

function addCustomClass() {
    const val = inputNewClass.value.trim().toLowerCase();
    if (!val) return;
    if (state.classes.includes(val)) {
        alert("Class already exists!");
        return;
    }
    state.classes.push(val);
    renderSchemaClasses();
    inputNewClass.value = "";
}

function resetToRawTextState() {
    state.extractions = [];
    state.documentId = "";
    state.isVisualizing = false;
    
    // Toggle displays
    textareaDocInput.style.display = "block";
    textViewer.style.display = "none";
    textViewer.innerHTML = "";
    
    extractionsContainer.style.display = "none";
    extractionsEmpty.style.display = "flex";
    btnClearExtractions.style.display = "none";
    docIdBadge.textContent = "";
}

// ----------------------------------------------------
// Traceability Rendering Engine (XAI Visuals)
// ----------------------------------------------------

/**
 * Re-renders the document view, injecting interactive spans 
 * mapped to exact character intervals, sorting from left to right.
 */
function renderInteractiveSpans() {
    const raw = state.rawText;
    
    // Clean and sort valid extractions that contain valid grounding offsets
    const grounded = state.extractions
        .filter(ext => ext.char_interval && ext.char_interval.start_pos !== null && ext.char_interval.end_pos !== null)
        .sort((a, b) => a.char_interval.start_pos - b.char_interval.start_pos);
        
    let outputHTML = "";
    let currentIndex = 0;
    
    for (let i = 0; i < grounded.length; i++) {
        const ext = grounded[i];
        const { start_pos, end_pos } = ext.char_interval;
        
        // Handle potential overlapping intervals safely by skipping overlaps
        if (start_pos < currentIndex) {
            continue; 
        }
        
        // Append raw ungrounded text leading up to this span
        outputHTML += escapeHTML(raw.substring(currentIndex, start_pos));
        
        // Color indexes based on matching schema positions
        const classColorIdx = (state.classes.indexOf(ext.extraction_class) % 4) + 1 || "unknown";
        
        // Wrap extraction range in interactive span tags
        outputHTML += `<span class="grounded-span class-${classColorIdx}" data-index="${ext.extraction_index}">${escapeHTML(raw.substring(start_pos, end_pos))}</span>`;
        
        currentIndex = end_pos;
    }
    
    // Append remaining tail text
    outputHTML += escapeHTML(raw.substring(currentIndex));
    
    textViewer.innerHTML = outputHTML;
    textViewer.style.display = "block";
    textareaDocInput.style.display = "none";
    
    // Apply synchronized event listeners onto all freshly created spans
    setupSpanEventListeners();
}

function setupSpanEventListeners() {
    const spans = textViewer.querySelectorAll(".grounded-span");
    spans.forEach(span => {
        const index = parseInt(span.getAttribute("data-index"));
        
        // Traceability Synchronized hover trigger (Left to Right pane)
        span.addEventListener("mouseenter", (e) => {
            highlightEntityCard(index, true);
            showHoverCard(index, e);
        });
        
        span.addEventListener("mouseleave", () => {
            highlightEntityCard(index, false);
            // We do not hide hovercard instantly to let user click edit inside
        });
        
        span.addEventListener("click", (e) => {
            e.stopPropagation();
            openEditModal(index);
        });
    });
}

/**
 * Iterates state extraction items and renders matching visual card stacks
 * grouped elegantly by Class matching dual-coding theory rules.
 */
function renderExtractionsPanel() {
    if (state.extractions.length === 0) {
        extractionsContainer.style.display = "none";
        extractionsEmpty.style.display = "flex";
        btnClearExtractions.style.display = "none";
        return;
    }
    
    extractionsEmpty.style.display = "none";
    extractionsContainer.style.display = "flex";
    extractionsContainer.innerHTML = "";
    btnClearExtractions.style.display = "block";
    
    // Group extractions by class
    const groups = {};
    state.classes.forEach(cls => groups[cls] = []);
    groups["unclassified"] = [];
    
    state.extractions.forEach(ext => {
        if (groups[ext.extraction_class]) {
            groups[ext.extraction_class].push(ext);
        } else {
            groups["unclassified"].push(ext);
        }
    });
    
    // Populate cards
    Object.keys(groups).forEach(cls => {
        const list = groups[cls];
        if (list.length === 0) return;
        
        const groupColorIdx = (state.classes.indexOf(cls) % 4) + 1 || "unknown";
        
        const groupEl = document.createElement("div");
        groupEl.className = "extraction-group";
        groupEl.innerHTML = `
            <div class="extraction-group-title">${cls.toUpperCase()}</div>
            <div class="entity-list"></div>
        `;
        
        const listEl = groupEl.querySelector(".entity-list");
        
        list.forEach(ext => {
            const card = document.createElement("div");
            card.className = `entity-card`;
            card.setAttribute("id", `entity-card-${ext.extraction_index}`);
            
            // Build attributes listing
            let attributesHTML = "";
            if (ext.attributes && Object.keys(ext.attributes).length > 0) {
                attributesHTML = `<div class="entity-attributes">`;
                Object.entries(ext.attributes).forEach(([key, val]) => {
                    attributesHTML += `
                        <div class="attribute-key">${key}:</div>
                        <div class="attribute-val">${escapeHTML(String(val))}</div>
                    `;
                });
                attributesHTML += `</div>`;
            }
            
            card.innerHTML = `
                <div class="entity-card-header">
                    <div class="entity-name">${escapeHTML(ext.extraction_text)}</div>
                    <span class="entity-badge class-${groupColorIdx}">${ext.extraction_class}</span>
                </div>
                ${attributesHTML}
                <div class="entity-actions">
                    <button class="btn btn-sm" onclick="event.stopPropagation(); openEditModal(${ext.extraction_index})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteExtraction(${ext.extraction_index})">Delete</button>
                </div>
            `;
            
            // Synchronized hover events (Right to Left pane)
            card.addEventListener("mouseenter", () => {
                highlightDocumentSpan(ext.extraction_index, true);
            });
            card.addEventListener("mouseleave", () => {
                highlightDocumentSpan(ext.extraction_index, false);
            });
            card.addEventListener("click", () => {
                highlightDocumentSpan(ext.extraction_index, true);
                scrollToSpan(ext.extraction_index);
            });
            
            listEl.appendChild(card);
        });
        
        extractionsContainer.appendChild(groupEl);
    });
}

// ----------------------------------------------------
// Traceability Helper Functions (Hover sync / Scrolling)
// ----------------------------------------------------

function highlightEntityCard(index, active) {
    const card = document.getElementById(`entity-card-${index}`);
    if (!card) return;
    if (active) {
        card.classList.add("active");
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
        card.classList.remove("active");
    }
}

function highlightDocumentSpan(index, active) {
    const span = textViewer.querySelector(`.grounded-span[data-index="${index}"]`);
    if (!span) return;
    if (active) {
        span.classList.add("highlight-active");
    } else {
        span.classList.remove("highlight-active");
    }
}

function scrollToSpan(index) {
    const span = textViewer.querySelector(`.grounded-span[data-index="${index}"]`);
    if (span) {
        span.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function showHoverCard(index, event) {
    const ext = state.extractions.find(e => e.extraction_index === index);
    if (!ext) return;
    
    // Build values list
    let attrs = "";
    if (ext.attributes) {
        Object.entries(ext.attributes).forEach(([k, v]) => {
            attrs += `<div><strong>${k}:</strong> ${escapeHTML(String(v))}</div>`;
        });
    }
    
    spanHoverCard.innerHTML = `
        <h4>${escapeHTML(ext.extraction_text)}</h4>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.25rem;">
            Class: <span style="font-weight:600;">${ext.extraction_class}</span>
        </div>
        <div style="font-size:0.7rem; font-family:var(--font-mono); margin-bottom:0.4rem;">
            Offset: [${ext.char_interval.start_pos}, ${ext.char_interval.end_pos}]
        </div>
        <div style="border-top:1px dashed var(--border-color); padding-top:0.4rem; font-size:0.75rem;">
            ${attrs || "<em>No attributes defined</em>"}
        </div>
        <div style="margin-top:0.5rem; display:flex; justify-content:flex-end; gap:0.25rem;">
            <button class="btn btn-sm" style="font-size:0.7rem; padding:0.15rem 0.35rem;" onclick="openEditModal(${index})">Edit</button>
            <button class="btn btn-sm btn-danger" style="font-size:0.7rem; padding:0.15rem 0.35rem;" onclick="deleteExtraction(${index})">Delete</button>
        </div>
    `;
    
    // Position near span relative to page-content viewport
    const contentRect = textViewer.parentElement.getBoundingClientRect();
    const x = event.clientX - contentRect.left + textViewer.parentElement.scrollLeft;
    const y = event.clientY - contentRect.top + textViewer.parentElement.scrollTop - 100;
    
    spanHoverCard.style.left = `${x}px`;
    spanHoverCard.style.top = `${y}px`;
    spanHoverCard.style.display = "flex";
}

function hideHoverCard() {
    spanHoverCard.style.display = "none";
}

// ----------------------------------------------------
// Human-in-the-Loop Span Selection (Interactive Editing)
// ----------------------------------------------------

/**
 * Translates clientside browser mouse selection into absolute 
 * characters indices mapped against the raw text, prompting entity creation.
 */
function handleTextSelection(e) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    
    const selectedText = sel.toString().trim();
    if (!selectedText) return;
    
    // Get cursor positioning
    const range = sel.getRangeAt(0);
    
    // Resolve absolute offset inside textViewer element
    const container = textViewer;
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    
    const start = preSelectionRange.toString().length;
    const end = start + selectedText.length;
    
    state.selectedSpan = {
        text: selectedText,
        start_pos: start,
        end_pos: end
    };
    
    // Render popover options
    renderSelectionPopover(e.clientX, e.clientY);
}

function renderSelectionPopover(clientX, clientY) {
    selectionPopover.innerHTML = "";
    
    // Add interactive creation buttons for each schema class
    state.classes.forEach((cls, idx) => {
        const btn = document.createElement("button");
        btn.textContent = `+ ${cls}`;
        btn.addEventListener("click", () => {
            hideSelectionPopover();
            openAddModal(cls);
        });
        selectionPopover.appendChild(btn);
    });
    
    // Add custom class action
    const customBtn = document.createElement("button");
    customBtn.textContent = "+ custom...";
    customBtn.style.fontStyle = "italic";
    customBtn.addEventListener("click", () => {
        hideSelectionPopover();
        const customClass = prompt("Enter custom class name:").trim().toLowerCase();
        if (customClass) {
            if (!state.classes.includes(customClass)) {
                state.classes.push(customClass);
                renderSchemaClasses();
            }
            openAddModal(customClass);
        }
    });
    selectionPopover.appendChild(customBtn);
    
    // Position popover relative to document panel container
    const contentRect = textViewer.parentElement.getBoundingClientRect();
    const x = clientX - contentRect.left + textViewer.parentElement.scrollLeft;
    const y = clientY - contentRect.top + textViewer.parentElement.scrollTop - 40;
    
    selectionPopover.style.left = `${x}px`;
    selectionPopover.style.top = `${y}px`;
    selectionPopover.style.display = "flex";
}

function hideSelectionPopover() {
    selectionPopover.style.display = "none";
}

// ----------------------------------------------------
// Entity Modal & Human Correction Actions
// ----------------------------------------------------

function openAddModal(className) {
    editingEntityIndex = null;
    modalTitle.textContent = "Add Custom Extraction";
    modalEntityText.value = state.selectedSpan.text;
    
    // Clear and build select
    modalEntityClass.innerHTML = "";
    state.classes.forEach(cls => {
        const opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        if (cls === className) opt.selected = true;
        modalEntityClass.appendChild(opt);
    });
    
    modalAttributesList.innerHTML = "";
    // Pre-populate empty attribute row based on schema definition
    const activeTemplate = state.templates[state.currentTemplateKey];
    if (activeTemplate && activeTemplate.schema[className]) {
        Object.keys(activeTemplate.schema[className]).forEach(attrKey => {
            addAttributeRow(attrKey, "");
        });
    } else {
        addAttributeRow("", "");
    }
    
    openModal();
}

function openEditModal(index) {
    const ext = state.extractions.find(e => e.extraction_index === index);
    if (!ext) return;
    
    editingEntityIndex = index;
    modalTitle.textContent = "Edit Extraction Attributes";
    modalEntityText.value = ext.extraction_text;
    
    // Populate dropdown
    modalEntityClass.innerHTML = "";
    state.classes.forEach(cls => {
        const opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        if (cls === ext.extraction_class) opt.selected = true;
        modalEntityClass.appendChild(opt);
    });
    
    modalAttributesList.innerHTML = "";
    
    if (ext.attributes && Object.keys(ext.attributes).length > 0) {
        Object.entries(ext.attributes).forEach(([k, v]) => {
            addAttributeRow(k, v);
        });
    } else {
        addAttributeRow("", "");
    }
    
    hideHoverCard();
    openModal();
}

function addAttributeRow(key = "", val = "") {
    const row = document.createElement("div");
    row.className = "attribute-input-row";
    row.innerHTML = `
        <input type="text" placeholder="Key" class="attr-key" value="${escapeHTML(key)}" style="width:30%;">
        <input type="text" placeholder="Value" class="attr-val" value="${escapeHTML(String(val))}">
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    modalAttributesList.appendChild(row);
}

function openModal() {
    modalOverlay.classList.add("active");
}

function closeModal() {
    modalOverlay.classList.remove("active");
    window.getSelection().removeAllRanges();
}

function deleteExtraction(index) {
    state.extractions = state.extractions.filter(e => e.extraction_index !== index);
    hideHoverCard();
    
    // Refresh visual state
    renderInteractiveSpans();
    renderExtractionsPanel();
}

function applyModalChanges() {
    const targetClass = modalEntityClass.value;
    const targetText = modalEntityText.value;
    
    // Gather attributes map
    const attributes = {};
    const rows = modalAttributesList.querySelectorAll(".attribute-input-row");
    rows.forEach(row => {
        const k = row.querySelector(".attr-key").value.trim();
        const v = row.querySelector(".attr-val").value.trim();
        if (k && v) {
            attributes[k] = v;
        }
    });
    
    if (editingEntityIndex !== null) {
        // Edit flow
        const ext = state.extractions.find(e => e.extraction_index === editingEntityIndex);
        if (ext) {
            ext.extraction_class = targetClass;
            ext.attributes = attributes;
        }
    } else {
        // Add flow: create unique serial extraction index
        const nextIndex = state.extractions.reduce((max, ext) => Math.max(max, ext.extraction_index), -1) + 1;
        
        state.extractions.push({
            extraction_class: targetClass,
            extraction_text: targetText,
            char_interval: {
                start_pos: state.selectedSpan.start_pos,
                end_pos: state.selectedSpan.end_pos
            },
            attributes: attributes,
            alignment_status: "match_exact",
            extraction_index: nextIndex
        });
    }
    
    closeModal();
    
    // Dynamic Rerender loop
    renderInteractiveSpans();
    renderExtractionsPanel();
}

// ----------------------------------------------------
// Uvicorn API Connections
// ----------------------------------------------------

async function executeExtraction() {
    const text = textareaDocInput.value.trim();
    const promptDescription = textareaPrompt.value.trim();
    
    if (!text) {
        alert("Please enter a target document first!");
        return;
    }
    if (!promptDescription) {
        alert("Extraction instructions cannot be empty!");
        return;
    }
    
    // Read local selections
    const modelId = selectModel.value;
    const apiKey = inputApiKey.value.trim();
    
    // Construct prompt validation examples dynamically based on current template schema
    // In our backend server.py, we support mock mappings using standard schema attributes
    const requestExamples = [];
    if (state.examples && state.examples.length > 0) {
        state.examples.forEach(ex => {
            requestExamples.push({
                text: ex.text,
                extractions: ex.extractions.map(ext => ({
                    extraction_class: ext.extraction_class,
                    extraction_text: ext.extraction_text,
                    attributes: ext.attributes || {}
                }))
            });
        });
    }
    
    showLoading(`Executing standard schema constraints with ${modelId}...`);
    
    try {
        const response = await fetch("/api/extract", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                prompt_description: promptDescription,
                examples: requestExamples,
                model_id: modelId,
                api_key: apiKey || null
            })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Error communicating with server.");
        }
        
        // Update application state
        state.rawText = data.text;
        state.documentId = data.document_id;
        state.extractions = data.extractions;
        state.isVisualizing = true;
        
        // Populate view indicators
        docIdBadge.textContent = state.documentId;
        
        // Render panels reactive loop
        renderInteractiveSpans();
        renderExtractionsPanel();
        
    } catch (err) {
        alert(`Extraction Failed: ${err.message}`);
        console.error(err);
    } finally {
        hideLoading();
    }
}

async function saveAnnotationsToFile() {
    if (state.extractions.length === 0) {
        alert("There are no extractions to save!");
        return;
    }
    
    const filename = prompt("Enter file name for saving (e.g. custom_extraction.jsonl):", "annotated_spans.jsonl");
    if (!filename) return;
    
    showLoading("Saving annotated JSONL output...");
    
    try {
        const response = await fetch("/api/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: state.rawText,
                document_id: state.documentId,
                extractions: state.extractions,
                filename: filename
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to save file.");
        
        alert(`Success!\nAnnotations saved locally inside workspace folder:\n${data.filepath}`);
        
    } catch (err) {
        alert(`Export failed: ${err.message}`);
        console.error(err);
    } finally {
        hideLoading();
    }
}

// ----------------------------------------------------
// UI Styling & Utilities
// ----------------------------------------------------

function showLoading(msg) {
    loadingText.textContent = msg;
    loadingOverlay.classList.add("active");
}

function hideLoading() {
    loadingOverlay.classList.remove("active");
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
