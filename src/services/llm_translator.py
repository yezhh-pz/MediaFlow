import json
import json_repair
from typing import List, Dict, Optional
from openai import OpenAI
from loguru import logger
from concurrent.futures import ThreadPoolExecutor

from src.config import settings
from src.models.schemas import SubtitleSegment
from src.prompts.translate import get_standard_prompt, get_reflection_prompt

class LLMTranslator:
    def __init__(self):
        self.api_key = settings.LLM_API_KEY
        self.base_url = settings.LLM_BASE_URL
        self.model = settings.LLM_MODEL
        self.client = None
        
        if self.api_key and self.api_key != "sk-...":
            self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        else:
            logger.warning("LLM API Key not configured. Translation will fail.")

    def _call_llm(self, messages: List[Dict]) -> str:
        if not self.client:
            raise ValueError("LLM Client not initialized. Check API Key.")
            
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM Call Failed: {e}")
            raise e

    def _translate_batch_standard(self, segments: List[SubtitleSegment], target_language: str) -> Dict[str, str]:
        """Standard batch translation."""
        prompt = get_standard_prompt(target_language)
        input_dict = {str(seg.id): seg.text for seg in segments}
        input_json = json.dumps(input_dict, ensure_ascii=False)
        
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": input_json}
        ]
        
        # Agent Loop with Retry
        for attempt in range(3):
            try:
                content = self._call_llm(messages)
                # Parse JSON (use json_repair for robustness)
                parsed = json_repair.loads(content)
                
                # Check consistency
                if not isinstance(parsed, dict):
                    raise ValueError("Output is not a dictionary")
                
                # Validate keys
                missing_keys = [k for k in input_dict.keys() if k not in parsed]
                if missing_keys:
                    raise ValueError(f"Missing keys: {missing_keys}")
                    
                return {k: str(v) for k, v in parsed.items()}
                
            except Exception as e:
                logger.warning(f"Batch translation attempt {attempt+1} failed: {e}")
                # Feedback loop
                messages.append({"role": "assistant", "content": content})
                messages.append({"role": "user", "content": f"Error: {str(e)}. Please correct the JSON format and ensure all keys are present."})
        
        raise RuntimeError("Failed to translate batch after 3 attempts")

    def _translate_batch_reflect(self, segments: List[SubtitleSegment], target_language: str) -> Dict[str, str]:
        """Reflection-based batch translation (slower, higher quality)."""
        prompt = get_reflection_prompt(target_language)
        input_dict = {str(seg.id): seg.text for seg in segments}
        input_json = json.dumps(input_dict, ensure_ascii=False)
        
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": input_json}
        ]
        
        for attempt in range(3):
            try:
                content = self._call_llm(messages)
                parsed = json_repair.loads(content)
                
                result = {}
                for k, v in parsed.items():
                    # Extract 'final' field
                    if isinstance(v, dict) and "final" in v:
                        result[k] = v["final"]
                    elif isinstance(v, str):
                        # Fallback if structure is wrong but content exists
                        result[k] = v
                    else:
                        result[k] = str(v)
                
                return result
                
            except Exception as e:
                logger.warning(f"Reflection translation attempt {attempt+1} failed: {e}")
                messages.append({"role": "assistant", "content": content})
                messages.append({"role": "user", "content": f"Error: {str(e)}. Ensure JSON logic follows instructions."})
                
        raise RuntimeError("Failed to translate batch (reflect) after 3 attempts")

    def translate_segments(self, segments: List[SubtitleSegment], target_language: str, mode: str = "standard", batch_size: int = 10, progress_callback=None) -> List[SubtitleSegment]:
        """
        Main entry point. Batches segments and translates them.
        """
        if not segments:
            return []
            
        translated_segments = []
        total_batches = (len(segments) + batch_size - 1) // batch_size
        
        for i in range(0, len(segments), batch_size):
            batch = segments[i:i+batch_size]
            current_batch_index = i // batch_size
            
            if progress_callback:
                progress_callback(
                    int((current_batch_index / total_batches) * 100), 
                    f"Translating batch {current_batch_index + 1}/{total_batches}..."
                )
            
            try:
                if mode == "reflect":
                    result_map = self._translate_batch_reflect(batch, target_language)
                else:
                    result_map = self._translate_batch_standard(batch, target_language)
                
                # Apply translations
                for seg in batch:
                    # Create copy/new segment? Or modify in place? 
                    # Let's create new to be safe/functional
                    new_seg = seg.model_copy()
                    trans_text = result_map.get(str(seg.id), seg.text)
                    new_seg.text = trans_text
                    translated_segments.append(new_seg)
                    
            except Exception as e:
                logger.error(f"Failed batch {current_batch_index}: {e}")
                # Fallback: keep original text
                translated_segments.extend(batch)
        
        if progress_callback:
            progress_callback(100, "Translation completed")
            
        return translated_segments

llm_translator = LLMTranslator()
