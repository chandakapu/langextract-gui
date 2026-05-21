# Copyright 2026 Google LLC.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import sys
import logging
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("langextract-gui")

# Add the parent directory to the Python path to ensure local langextract is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

app = FastAPI(
    title="LangExtract HCI Web Studio",
    description="Interactive visual workbench for structured text extraction with LLMs.",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Predefined templates matching standard tasks
TEMPLATES = {
    "romeo_juliet": {
        "name": "Romeo & Juliet (Characters & Emotions)",
        "description": "Extract characters, their emotions, and romantic/metaphorical relationships from dramatic dialogue.",
        "prompt": "Extract characters, emotions, and relationships in order of appearance.\nUse exact text for extractions. Do not paraphrase or overlap entities.\nProvide meaningful attributes for each entity to add context.",
        "schema": {
            "character": {
                "emotional_state": "Current emotion or state of mind (e.g. wonder, sorrow)"
            },
            "emotion": {
                "feeling": "Description of the feeling captured by the expression"
            },
            "relationship": {
                "type": "The style or context of relationship described (e.g. metaphor, marriage)"
            }
        },
        "examples": [
            {
                "text": "ROMEO. But soft! What light through yonder window breaks? It is the east, and Juliet is the sun.",
                "extractions": [
                    {
                        "extraction_class": "character",
                        "extraction_text": "ROMEO",
                        "attributes": {"emotional_state": "wonder"}
                    },
                    {
                        "extraction_class": "emotion",
                        "extraction_text": "But soft!",
                        "attributes": {"feeling": "gentle awe"}
                    },
                    {
                        "extraction_class": "relationship",
                        "extraction_text": "Juliet is the sun",
                        "attributes": {"type": "metaphor"}
                    }
                ]
            }
        ],
        "input_text": "Lady Juliet gazed longingly at the stars, her heart aching for Romeo. But soft! She whispered, \"My love is as deep as the sea.\""
    },
    "clinical_note": {
        "name": "Clinical Trial Medication & Dosage",
        "description": "Identify medical treatments, including medication names, dosages, administration routes, and dosage frequencies.",
        "prompt": "Extract medications, dosages, and frequencies from the clinical note.\nUse exact text for all extractions. Ensure attributes capture medical context accurately.",
        "schema": {
            "medication": {
                "generic_name": "Generic chemical name of the drug",
                "class": "Drug class (e.g. biguanide, beta-blocker)"
            },
            "dosage": {
                "amount": "The numeric quantity/concentration (e.g., 500mg, 10mg)",
                "route": "Administration route (e.g. oral, intravenous)"
            },
            "frequency": {
                "interval": "Standard medical shorthand or description (e.g. BID, once daily)"
            }
        },
        "examples": [
            {
                "text": "Patient was started on Metformin 500mg orally twice daily for diabetes control.",
                "extractions": [
                    {
                        "extraction_class": "medication",
                        "extraction_text": "Metformin",
                        "attributes": {"generic_name": "metformin", "class": "biguanide"}
                    },
                    {
                        "extraction_class": "dosage",
                        "extraction_text": "500mg",
                        "attributes": {"amount": "500mg", "route": "oral"}
                    },
                    {
                        "extraction_class": "frequency",
                        "extraction_text": "twice daily",
                        "attributes": {"interval": "twice daily"}
                    }
                ]
            }
        ],
        "input_text": "DISCHARGE SUMMARY:\nHe was prescribed Lisinopril 10mg once daily for hypertension. For pain, take Acetaminophen 325mg as needed every 6 hours."
    },
    "recipes": {
        "name": "Recipe Ingredients & Methods",
        "description": "Parse recipes into ingredient components, specific volumes/weights, and procedural cooking instructions.",
        "prompt": "Extract ingredients, quantities, and preparation steps from the recipe text.\nEnsure text matches verbatim and attributes describe culinary units and details.",
        "schema": {
            "ingredient": {
                "name": "Ingredient standard name",
                "state": "State of preparation (e.g., chopped, melted, sifted)"
            },
            "quantity": {
                "amount": "Numeric amount",
                "unit": "Measurement unit (e.g. cups, grams, tbsp)"
            },
            "step": {
                "action": "Core culinary action verb"
            }
        },
        "examples": [
            {
                "text": "Add 2 cups of chopped onions to the pan and saute until translucent.",
                "extractions": [
                    {
                        "extraction_class": "ingredient",
                        "extraction_text": "onions",
                        "attributes": {"name": "onion", "state": "chopped"}
                    },
                    {
                        "extraction_class": "quantity",
                        "extraction_text": "2 cups",
                        "attributes": {"amount": "2", "unit": "cups"}
                    },
                    {
                        "extraction_class": "step",
                        "extraction_text": "saute until translucent",
                        "attributes": {"action": "saute"}
                    }
                ]
            }
        ],
        "input_text": "To bake the bread, combine 500g of white flour with 7g of dry yeast. Mix with 350ml of warm water, then knead for 10 minutes."
    }
}

class ExtractionItem(BaseModel):
    extraction_class: str
    extraction_text: str
    attributes: Dict[str, Any] = Field(default_factory=dict)

class ExampleItem(BaseModel):
    text: str
    extractions: List[ExtractionItem]

class ExtractRequest(BaseModel):
    text: str
    prompt_description: str
    examples: List[ExampleItem]
    model_id: str = "gemini-3.5-flash"
    api_key: Optional[str] = None
    temperature: Optional[float] = None

class SaveRequest(BaseModel):
    text: str
    document_id: str
    extractions: List[Dict[str, Any]]
    filename: str = "custom_extraction.jsonl"

@app.get("/api/templates")
def get_templates():
    """Retrieve all pre-configured prompt, schema, and example templates."""
    return TEMPLATES

@app.post("/api/extract")
def run_extraction(request: ExtractRequest):
    """Execute LangExtract using the live Python package."""
    try:
        # Import langextract lazily to prevent load errors if virtual environment isn't fully configured
        import langextract as lx
        
        # Prepare example data structure
        lx_examples = []
        for ex in request.examples:
            lx_extractions = []
            for ext in ex.extractions:
                lx_extractions.append(
                    lx.data.Extraction(
                        extraction_class=ext.extraction_class,
                        extraction_text=ext.extraction_text,
                        attributes=ext.attributes
                    )
                )
            lx_examples.append(
                lx.data.ExampleData(
                    text=ex.text,
                    extractions=lx_extractions
                )
            )
            
        # Determine API Key: use request param or check environment
        api_key = request.api_key or os.environ.get("LANGEXTRACT_API_KEY")
        if not api_key and "gemini" in request.model_id.lower():
            # If no API key is set, we throw an informative warning
            raise HTTPException(
                status_code=400,
                detail="A Gemini API Key is required for cloud-hosted Gemini models. Please enter your API Key in the settings sidebar."
            )

        logger.info(f"Running extract with model: {request.model_id}")
        
        # Invoke LangExtract
        result = lx.extract(
            text_or_documents=request.text,
            prompt_description=request.prompt_description,
            examples=lx_examples,
            model_id=request.model_id,
            api_key=api_key,
            temperature=request.temperature,
            show_progress=False
        )
        
        # Parse output into clean JSON serializable response
        serialized_extractions = []
        for ext in result.extractions:
            char_interval = None
            if ext.char_interval:
                char_interval = {
                    "start_pos": ext.char_interval.start_pos,
                    "end_pos": ext.char_interval.end_pos
                }
            
            serialized_extractions.append({
                "extraction_class": ext.extraction_class,
                "extraction_text": ext.extraction_text,
                "char_interval": char_interval,
                "alignment_status": ext.alignment_status.value if ext.alignment_status else None,
                "extraction_index": ext.extraction_index,
                "attributes": ext.attributes or {}
            })
            
        return {
            "document_id": result.document_id,
            "text": result.text,
            "extractions": serialized_extractions
        }

    except ImportError as e:
        logger.error(f"ImportError during extract: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to load LangExtract package. Ensure that dependencies are fully installed in the environment."
        )
    except Exception as e:
        logger.error(f"Exception during extraction run: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save")
def save_extraction(request: SaveRequest):
    """Save the annotated document (including user edits) to a local JSONL file."""
    try:
        import langextract as lx
        
        # Convert requests annotations to lx.data.Extraction format
        lx_extractions = []
        for idx, ext in enumerate(request.extractions):
            char_interval = None
            if ext.get("char_interval"):
                char_interval = lx.data.CharInterval(
                    start_pos=ext["char_interval"]["start_pos"],
                    end_pos=ext["char_interval"]["end_pos"]
                )
            
            lx_extractions.append(
                lx.data.Extraction(
                    extraction_class=ext["extraction_class"],
                    extraction_text=ext["extraction_text"],
                    char_interval=char_interval,
                    extraction_index=ext.get("extraction_index", idx),
                    attributes=ext.get("attributes", {})
                )
            )
            
        annotated_doc = lx.data.AnnotatedDocument(
            document_id=request.document_id,
            text=request.text,
            extractions=lx_extractions
        )
        
        # Ensure target file name is secure and written within workspace
        filename = os.path.basename(request.filename)
        if not filename.endswith(".jsonl"):
            filename += ".jsonl"
            
        output_dir = os.path.join(parent_dir, "gui_exports")
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)
        
        lx.io.save_annotated_documents([annotated_doc], output_name=filename, output_dir=output_dir)
        
        return {
            "status": "success",
            "filepath": filepath,
            "message": f"Successfully exported extraction document to {filepath}"
        }
        
    except Exception as e:
        logger.error(f"Failed to save document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount static folder
static_dir = os.path.join(current_dir, "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
