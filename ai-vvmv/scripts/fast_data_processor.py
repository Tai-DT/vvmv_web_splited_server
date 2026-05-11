#!/usr/bin/env python3
"""
Fast Data Processor for VVMV Customs Data
Phiên bản tối ưu để xử lý dữ liệu lớn nhanh hơn
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
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, as_completed
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fast_data_processing.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class FastVVMVDataProcessor:
    """Optimized data processor for large VVMV datasets"""
    
    def __init__(self, source_dir: str, output_dir: str):
        self.source_dir = Path(source_dir)
        self.output_dir = Path(output_dir)
        self.stats = defaultdict(int)
        self.start_time = time.time()
        
        # Create output directories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        (self.output_dir / 'raw').mkdir(exist_ok=True)
        (self.output_dir / 'cleaned').mkdir(exist_ok=True)
        (self.output_dir / 'metadata').mkdir(exist_ok=True)
        
    def find_all_jsonl_files(self) -> List[Path]:
        """Find all JSONL files in source directory"""
        jsonl_files = []
        for file_path in self.source_dir.rglob("*.jsonl"):
            jsonl_files.append(file_path)
        logger.info(f"Found {len(jsonl_files)} JSONL files")
        return jsonl_files
    
    def process_single_file(self, file_path: Path) -> List[Dict]:
        """Process a single JSONL file"""
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
        """Fast text cleaning"""
        if text is None:
            return ""
        
        text = str(text)
        
        # Normalize Unicode
        text = unicodedata.normalize('NFKC', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        return text
    
    def standardize_date(self, date_str: Optional[str]) -> Optional[str]:
        """Fast date standardization"""
        if not date_str or date_str == 'null':
            return None
        
        # Simple ISO format check
        if re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$', str(date_str)):
            return date_str
        
        return date_str
    
    def validate_record(self, record: Dict) -> bool:
        """Fast record validation"""
        required_fields = ['declarationId', 'direction', 'taxCode', 'customsCode']
        
        # Quick required field check
        for field in required_fields:
            if field not in record or record[field] is None:
                self.stats['missing_required'] += 1
                return False
        
        # Quick format validation
        if record['direction'] not in ['N', 'X']:
            self.stats['invalid_direction'] += 1
            return False
        
        tax_code = str(record['taxCode'])
        if not (len(tax_code) == 10 and tax_code.isdigit()):
            self.stats['invalid_tax_code'] += 1
            return False
        
        customs_code = str(record['customsCode'])
        if not re.match(r'^\d{2}[A-Z0-9]{2}$', customs_code):
            self.stats['invalid_customs_code'] += 1
            return False
        
        return True
    
    def clean_record(self, record: Dict) -> Dict:
        """Fast record cleaning"""
        cleaned = record.copy()
        
        # Clean key text fields only
        text_fields = ['taxCode', 'customsCode', 'operationCode']
        for field in text_fields:
            if field in cleaned and isinstance(cleaned[field], str):
                cleaned[field] = self.clean_text(cleaned[field])
        
        # Standardize key dates
        date_fields = ['declarationDate']
        for field in date_fields:
            if field in cleaned:
                cleaned[field] = self.standardize_date(cleaned[field])
        
        return cleaned
    
    def process_files_parallel(self, jsonl_files: List[Path], num_workers: int = None) -> List[Dict]:
        """Process files in parallel"""
        if num_workers is None:
            num_workers = min(mp.cpu_count(), 8)  # Limit to 8 workers
        
        logger.info(f"Processing {len(jsonl_files)} files with {num_workers} workers")
        
        all_records = []
        processed_files = 0
        
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            # Submit all files
            future_to_file = {
                executor.submit(self.process_single_file, file_path): file_path 
                for file_path in jsonl_files
            }
            
            # Process completed files
            for future in as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    records = future.result()
                    processed_files += 1
                    
                    # Process records
                    for record in records:
                        if self.validate_record(record):
                            cleaned_record = self.clean_record(record)
                            all_records.append(cleaned_record)
                            self.stats['processed_records'] += 1
                        else:
                            self.stats['invalid_records'] += 1
                    
                    # Progress update
                    if processed_files % 100 == 0:
                        elapsed = time.time() - self.start_time
                        rate = processed_files / elapsed
                        eta = (len(jsonl_files) - processed_files) / rate
                        logger.info(f"Processed {processed_files}/{len(jsonl_files)} files "
                                  f"({processed_files/len(jsonl_files)*100:.1f}%) - "
                                  f"Rate: {rate:.1f} files/sec - ETA: {eta/60:.1f} min")
                
                except Exception as e:
                    logger.error(f"Error processing {file_path}: {e}")
                    self.stats['file_errors'] += 1
        
        return all_records
    
    def save_cleaned_data(self, records: List[Dict]):
        """Save cleaned data efficiently"""
        logger.info("Saving cleaned data...")
        
        # Save as JSONL in chunks
        jsonl_path = self.output_dir / 'cleaned' / 'vvmv_cleaned.jsonl'
        chunk_size = 10000
        
        with open(jsonl_path, 'w', encoding='utf-8') as f:
            for i in range(0, len(records), chunk_size):
                chunk = records[i:i+chunk_size]
                for record in chunk:
                    f.write(json.dumps(record, ensure_ascii=False) + '\n')
                
                # Progress update
                if (i // chunk_size + 1) % 10 == 0:
                    logger.info(f"Saved {min(i+chunk_size, len(records))}/{len(records)} records")
        
        # Save as Parquet for efficiency
        try:
            df = pd.DataFrame(records)
            parquet_path = self.output_dir / 'cleaned' / 'vvmv_cleaned.parquet'
            df.to_parquet(parquet_path, index=False, engine='pyarrow')
            logger.info(f"Saved Parquet file: {parquet_path}")
        except Exception as e:
            logger.warning(f"Could not save Parquet file: {e}")
        
        logger.info(f"Saved {len(records)} records to {jsonl_path}")
    
    def generate_statistics(self):
        """Generate processing statistics"""
        stats = dict(self.stats)
        stats['total_records_found'] = stats.get('processed_records', 0) + stats.get('invalid_records', 0)
        stats['processing_date'] = datetime.now().isoformat()
        stats['processing_time_seconds'] = time.time() - self.start_time
        stats['processing_time_formatted'] = f"{stats['processing_time_seconds']/60:.1f} minutes"
        
        # Save statistics
        stats_path = self.output_dir / 'metadata' / 'processing_stats.json'
        with open(stats_path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Statistics saved to {stats_path}")
        
        # Print summary
        print("\n" + "="*50)
        print("FAST PROCESSING SUMMARY")
        print("="*50)
        for key, value in stats.items():
            print(f"{key}: {value}")
        print("="*50)
    
    def process_all_files(self):
        """Process all files with optimized approach"""
        logger.info("Starting fast data processing...")
        
        # Find all files
        jsonl_files = self.find_all_jsonl_files()
        
        # Process files in parallel
        all_records = self.process_files_parallel(jsonl_files)
        
        # Save results
        self.save_cleaned_data(all_records)
        
        # Generate statistics
        self.generate_statistics()
        
        elapsed = time.time() - self.start_time
        logger.info(f"Fast processing complete in {elapsed/60:.1f} minutes!")
        logger.info(f"Processed {self.stats['processed_records']} records from {len(jsonl_files)} files")

def main():
    """Main execution function"""
    source_dir = "/Volumes/FastVault-Apps/Projects/ai-vvmv/vvmv-dumps"
    output_dir = "/Volumes/FastVault-Apps/Projects/ai-vvmv/llm-dataset"
    
    processor = FastVVMVDataProcessor(source_dir, output_dir)
    processor.process_all_files()

if __name__ == "__main__":
    main()