#!/usr/bin/env python3
"""
Data Processor for VVMV Customs Data
Chuẩn hóa dữ liệu hải quan cho LLM training
"""

import json
import os
import re
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging
from collections import defaultdict
import unicodedata

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_processing.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VVMVDataProcessor:
    """Main class for processing VVMV customs data"""
    
    def __init__(self, source_dir: str, output_dir: str):
        self.source_dir = Path(source_dir)
        self.output_dir = Path(output_dir)
        self.stats = defaultdict(int)
        
        # Create output directories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        (self.output_dir / 'raw').mkdir(exist_ok=True)
        (self.output_dir / 'cleaned').mkdir(exist_ok=True)
        (self.output_dir / 'processed').mkdir(exist_ok=True)
        (self.output_dir / 'metadata').mkdir(exist_ok=True)
        
    def find_all_jsonl_files(self) -> List[Path]:
        """Find all JSONL files in source directory"""
        jsonl_files = []
        for file_path in self.source_dir.rglob("*.jsonl"):
            jsonl_files.append(file_path)
        logger.info(f"Found {len(jsonl_files)} JSONL files")
        return jsonl_files
    
    def load_jsonl_file(self, file_path: Path) -> List[Dict]:
        """Load and parse JSONL file"""
        records = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line:
                        try:
                            record = json.loads(line)
                            # Add source metadata
                            record['_source_file'] = str(file_path)
                            record['_source_line'] = line_num
                            records.append(record)
                        except json.JSONDecodeError as e:
                            logger.warning(f"JSON decode error in {file_path}:{line_num}: {e}")
                            self.stats['json_errors'] += 1
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            self.stats['file_errors'] += 1
        
        return records
    
    def clean_text(self, text: Any) -> str:
        """Clean and normalize Vietnamese text"""
        if text is None:
            return ""
        
        text = str(text)
        
        # Normalize Unicode
        text = unicodedata.normalize('NFKC', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Remove control characters except newlines and tabs
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
        
        return text
    
    def standardize_date(self, date_str: Optional[str]) -> Optional[str]:
        """Standardize date format to ISO 8601"""
        if not date_str or date_str == 'null':
            return None
        
        # Common Vietnamese date formats
        patterns = [
            r'(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.?\d*Z?',  # ISO format
            r'(\d{2})/(\d{2})/(\d{4})',  # DD/MM/YYYY
            r'(\d{2})-(\d{2})-(\d{4})',  # DD-MM-YYYY
        ]
        
        for pattern in patterns:
            match = re.match(pattern, date_str)
            if match:
                try:
                    if len(match.groups()) == 6:  # ISO format
                        year, month, day, hour, minute, second = match.groups()
                        return f"{year}-{month}-{day}T{hour}:{minute}:{second}Z"
                    elif len(match.groups()) == 3:  # Date only
                        if len(match.group(1)) == 4:  # YYYY-MM-DD
                            year, month, day = match.groups()
                        else:  # DD/MM/YYYY or DD-MM-YYYY
                            day, month, year = match.groups()
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                except ValueError:
                    continue
        
        return date_str  # Return original if no pattern matched
    
    def validate_record(self, record: Dict) -> bool:
        """Validate record structure and required fields"""
        required_fields = ['declarationId', 'direction', 'taxCode', 'customsCode']
        
        for field in required_fields:
            if field not in record or record[field] is None:
                self.stats['missing_required'] += 1
                return False
        
        # Validate direction
        if record['direction'] not in ['N', 'X']:
            self.stats['invalid_direction'] += 1
            return False
        
        # Validate tax code format (10 digits)
        tax_code = str(record['taxCode'])
        if not re.match(r'^\d{10}$', tax_code):
            self.stats['invalid_tax_code'] += 1
            return False
        
        # Validate customs code format
        customs_code = str(record['customsCode'])
        if not re.match(r'^\d{2}[A-Z0-9]{2}$', customs_code):
            self.stats['invalid_customs_code'] += 1
            return False
        
        return True
    
    def clean_record(self, record: Dict) -> Dict:
        """Clean and standardize a single record"""
        cleaned = record.copy()
        
        # Clean text fields
        for key, value in cleaned.items():
            if isinstance(value, str):
                cleaned[key] = self.clean_text(value)
        
        # Standardize dates
        date_fields = ['declarationDate', 'NGAY_DK', 'NGAYDEN', 'NGAY_GP', 'NGAY_HD', 
                      'NGAY_HHHD', 'NGAY_KB', 'NGAY_TH', 'NGAY_VANDON', 'NGAY_HDTM',
                      'NGAY_THN_THX', 'NGAY_GIAOTK', 'NGAY_HOANTHANH', 'NGAY_THUC_XN']
        
        for field in date_fields:
            if field in cleaned:
                cleaned[field] = self.standardize_date(cleaned[field])
        
        # Clean nested structures
        if 'header' in cleaned and isinstance(cleaned['header'], dict):
            for key, value in cleaned['header'].items():
                if isinstance(value, str):
                    cleaned['header'][key] = self.clean_text(value)
        
        if 'vnaccs2' in cleaned and isinstance(cleaned['vnaccs2'], dict):
            for key, value in cleaned['vnaccs2'].items():
                if isinstance(value, str):
                    cleaned['vnaccs2'][key] = self.clean_text(value)
        
        if 'cargo' in cleaned and isinstance(cleaned['cargo'], list):
            for cargo_item in cleaned['cargo']:
                if isinstance(cargo_item, dict):
                    for key, value in cargo_item.items():
                        if isinstance(value, str):
                            cargo_item[key] = self.clean_text(value)
        
        return cleaned
    
    def process_all_files(self):
        """Process all JSONL files and create cleaned dataset"""
        logger.info("Starting data processing...")
        
        jsonl_files = self.find_all_jsonl_files()
        all_records = []
        
        for file_path in jsonl_files:
            logger.info(f"Processing {file_path}")
            records = self.load_jsonl_file(file_path)
            
            for record in records:
                if self.validate_record(record):
                    cleaned_record = self.clean_record(record)
                    all_records.append(cleaned_record)
                    self.stats['processed_records'] += 1
                else:
                    self.stats['invalid_records'] += 1
        
        # Save cleaned data
        self.save_cleaned_data(all_records)
        
        # Generate statistics
        self.generate_statistics()
        
        logger.info(f"Processing complete. Processed {self.stats['processed_records']} records.")
    
    def save_cleaned_data(self, records: List[Dict]):
        """Save cleaned data to JSONL and Parquet formats"""
        logger.info("Saving cleaned data...")
        
        # Save as JSONL
        jsonl_path = self.output_dir / 'cleaned' / 'vvmv_cleaned.jsonl'
        with open(jsonl_path, 'w', encoding='utf-8') as f:
            for record in records:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        
        # Save as Parquet for efficient processing
        df = pd.DataFrame(records)
        parquet_path = self.output_dir / 'cleaned' / 'vvmv_cleaned.parquet'
        df.to_parquet(parquet_path, index=False)
        
        logger.info(f"Saved {len(records)} records to {jsonl_path} and {parquet_path}")
    
    def generate_statistics(self):
        """Generate processing statistics"""
        stats = dict(self.stats)
        stats['total_records_found'] = stats.get('processed_records', 0) + stats.get('invalid_records', 0)
        stats['processing_date'] = datetime.now().isoformat()
        
        # Save statistics
        stats_path = self.output_dir / 'metadata' / 'processing_stats.json'
        with open(stats_path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Statistics saved to {stats_path}")
        
        # Print summary
        print("\n" + "="*50)
        print("PROCESSING SUMMARY")
        print("="*50)
        for key, value in stats.items():
            print(f"{key}: {value}")
        print("="*50)

def main():
    """Main execution function"""
    source_dir = "/Volumes/FastVault-Apps/Projects/ai-vvmv/vvmv-dumps"
    output_dir = "/Volumes/FastVault-Apps/Projects/ai-vvmv/llm-dataset"
    
    processor = VVMVDataProcessor(source_dir, output_dir)
    processor.process_all_files()

if __name__ == "__main__":
    main()