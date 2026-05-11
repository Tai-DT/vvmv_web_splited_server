#!/usr/bin/env python3
"""
Dataset Generator for LLM Training
Tạo các dataset-specific formats cho LLM training
"""

import json
import random
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any, Tuple
import logging
from datetime import datetime
from collections import Counter

logger = logging.getLogger(__name__)

class LLMDatasetGenerator:
    """Generate datasets for different LLM tasks"""
    
    def __init__(self, input_dir: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create task-specific directories
        (self.output_dir / 'classification').mkdir(exist_ok=True)
        (self.output_dir / 'ner').mkdir(exist_ok=True)
        (self.output_dir / 'qa').mkdir(exist_ok=True)
        (self.output_dir / 'generation').mkdir(exist_ok=True)
        (self.output_dir / 'splits').mkdir(exist_ok=True)
        
        # Load cleaned data
        self.data = self.load_cleaned_data()
        
    def load_cleaned_data(self) -> List[Dict]:
        """Load cleaned data from JSONL file"""
        jsonl_path = self.input_dir / 'cleaned' / 'vvmv_cleaned.jsonl'
        
        records = []
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                record = json.loads(line.strip())
                records.append(record)
        
        logger.info(f"Loaded {len(records)} cleaned records")
        return records
    
    def generate_classification_dataset(self):
        """Generate dataset for customs declaration classification"""
        logger.info("Generating classification dataset...")
        
        classification_data = []
        
        for record in self.data:
            # Extract features for classification
            features = {
                'instruction': "Phân loại tờ khai hải quan sau:",
                'input': self.format_declaration_summary(record),
                'output': self.get_classification_label(record),
                'metadata': {
                    'declaration_id': record.get('declarationId'),
                    'customs_code': record.get('customsCode'),
                    'direction': record.get('direction'),
                    'operation_code': record.get('operationCode')
                }
            }
            classification_data.append(features)
        
        # Save classification dataset
        self.save_dataset(classification_data, 'classification', 'customs_classification.jsonl')
        
        # Create train/val/test splits
        self.create_splits(classification_data, 'classification')
        
        logger.info(f"Generated {len(classification_data)} classification samples")
    
    def generate_ner_dataset(self):
        """Generate dataset for Named Entity Recognition"""
        logger.info("Generating NER dataset...")
        
        ner_data = []
        
        for record in self.data:
            # Create text and entity annotations
            text = self.create_ner_text(record)
            entities = self.extract_entities(record)
            
            ner_sample = {
                'text': text,
                'entities': entities,
                'metadata': {
                    'declaration_id': record.get('declarationId'),
                    'customs_code': record.get('customsCode')
                }
            }
            ner_data.append(ner_sample)
        
        # Save NER dataset
        self.save_dataset(ner_data, 'ner', 'customs_entities.jsonl')
        
        # Create train/val/test splits
        self.create_splits(ner_data, 'ner')
        
        logger.info(f"Generated {len(ner_data)} NER samples")
    
    def generate_qa_dataset(self):
        """Generate Question-Answering dataset"""
        logger.info("Generating QA dataset...")
        
        qa_data = []
        
        for record in self.data:
            # Create context from declaration
            context = self.create_qa_context(record)
            
            # Generate multiple question-answer pairs
            qa_pairs = self.generate_qa_pairs(record, context)
            
            for qa_pair in qa_pairs:
                qa_sample = {
                    'context': context,
                    'question': qa_pair['question'],
                    'answer': qa_pair['answer'],
                    'metadata': {
                        'declaration_id': record.get('declarationId'),
                        'question_type': qa_pair['type']
                    }
                }
                qa_data.append(qa_sample)
        
        # Save QA dataset
        self.save_dataset(qa_data, 'qa', 'customs_qa.jsonl')
        
        # Create train/val/test splits
        self.create_splits(qa_data, 'qa')
        
        logger.info(f"Generated {len(qa_data)} QA samples")
    
    def generate_document_generation_dataset(self):
        """Generate dataset for document generation"""
        logger.info("Generating document generation dataset...")
        
        generation_data = []
        
        for record in self.data:
            # Create structured input
            structured_input = self.create_structured_input(record)
            
            # Create target output (full declaration)
            target_output = self.create_declaration_text(record)
            
            generation_sample = {
                'input': structured_input,
                'output': target_output,
                'metadata': {
                    'declaration_id': record.get('declarationId'),
                    'customs_code': record.get('customsCode'),
                    'direction': record.get('direction')
                }
            }
            generation_data.append(generation_sample)
        
        # Save generation dataset
        self.save_dataset(generation_data, 'generation', 'declaration_generation.jsonl')
        
        # Create train/val/test splits
        self.create_splits(generation_data, 'generation')
        
        logger.info(f"Generated {len(generation_data)} generation samples")
    
    def format_declaration_summary(self, record: Dict) -> str:
        """Format declaration summary for classification"""
        header = record.get('header', {})
        cargo = record.get('cargo', [])
        
        summary_parts = []
        
        # Basic info
        summary_parts.append(f"Mã HQ: {record.get('customsCode')}")
        summary_parts.append(f"Hướng: {'Nhập khẩu' if record.get('direction') == 'N' else 'Xuất khẩu'}")
        summary_parts.append(f"Mã thuế: {record.get('taxCode')}")
        
        # Company info
        company_name = header.get('DV_DT', '')
        if company_name:
            summary_parts.append(f"Doanh nghiệp: {company_name}")
        
        # Cargo info
        if cargo:
            cargo_count = len(cargo)
            first_cargo = cargo[0].get('TEN_HANG', '')
            summary_parts.append(f"Số mặt hàng: {cargo_count}")
            if first_cargo:
                summary_parts.append(f"Hàng hóa chính: {first_cargo[:100]}...")
        
        # Value info
        total_value = header.get('TONGTGKB', 0)
        if total_value:
            summary_parts.append(f"Trị giá: {total_value}")
        
        return " | ".join(summary_parts)
    
    def get_classification_label(self, record: Dict) -> str:
        """Get classification label for declaration"""
        direction = "Nhập khẩu" if record.get('direction') == 'N' else "Xuất khẩu"
        operation_code = record.get('operationCode', '')
        customs_code = record.get('customsCode', '')
        
        # Create detailed classification
        label = f"{direction} - Mã hoạt động: {operation_code} - Mã HQ: {customs_code}"
        return label
    
    def create_ner_text(self, record: Dict) -> str:
        """Create text for NER annotation"""
        header = record.get('header', {})
        cargo = record.get('cargo', [])
        
        text_parts = []
        
        # Company information
        company_name = header.get('DV_DT', '')
        company_address = header.get('DIA_CHI_DV', '')
        tax_code = record.get('taxCode', '')
        
        if company_name:
            text_parts.append(f"Doanh nghiệp: {company_name}")
        if company_address:
            text_parts.append(f"Địa chỉ: {company_address}")
        if tax_code:
            text_parts.append(f"Mã số thuế: {tax_code}")
        
        # Declaration information
        customs_code = record.get('customsCode', '')
        direction = "nhập khẩu" if record.get('direction') == 'N' else "xuất khẩu"
        
        text_parts.append(f"Tờ khai {direction} tại mã hải quan {customs_code}")
        
        # Cargo information
        if cargo:
            text_parts.append("Danh sách hàng hóa:")
            for i, item in enumerate(cargo[:3]):  # Limit to first 3 items
                item_name = item.get('TEN_HANG', '')
                item_code = item.get('MA_HANGKB', '')
                quantity = item.get('LUONG', 0)
                unit = item.get('MA_DVT', '')
                
                if item_name:
                    cargo_text = f"- {item_name}"
                    if item_code:
                        cargo_text += f" (Mã HS: {item_code})"
                    if quantity and unit:
                        cargo_text += f", Số lượng: {quantity} {unit}"
                    text_parts.append(cargo_text)
        
        return " ".join(text_parts)
    
    def extract_entities(self, record: Dict) -> List[Dict]:
        """Extract entities for NER"""
        entities = []
        text = self.create_ner_text(record)
        header = record.get('header', {})
        cargo = record.get('cargo', [])
        
        # Company entities
        company_name = header.get('DV_DT', '')
        if company_name and company_name in text:
            start = text.find(company_name)
            entities.append({
                'text': company_name,
                'label': 'COMPANY',
                'start': start,
                'end': start + len(company_name)
            })
        
        # Tax code entities
        tax_code = record.get('taxCode', '')
        if tax_code and tax_code in text:
            start = text.find(tax_code)
            entities.append({
                'text': tax_code,
                'label': 'TAX_CODE',
                'start': start,
                'end': start + len(tax_code)
            })
        
        # Customs code entities
        customs_code = record.get('customsCode', '')
        if customs_code and customs_code in text:
            start = text.find(customs_code)
            entities.append({
                'text': customs_code,
                'label': 'CUSTOMS_CODE',
                'start': start,
                'end': start + len(customs_code)
            })
        
        # HS Code entities
        for item in cargo:
            hs_code = item.get('MA_HANGKB', '')
            if hs_code and hs_code in text:
                start = text.find(hs_code)
                entities.append({
                    'text': hs_code,
                    'label': 'HS_CODE',
                    'start': start,
                    'end': start + len(hs_code)
                })
        
        return entities
    
    def create_qa_context(self, record: Dict) -> str:
        """Create context for QA"""
        header = record.get('header', {})
        cargo = record.get('cargo', [])
        
        context_parts = []
        
        # Declaration header
        context_parts.append("THÔNG TIN TỜ KHAI:")
        context_parts.append(f"Mã tờ khai: {record.get('declarationId')}")
        context_parts.append(f"Mã hải quan: {record.get('customsCode')}")
        context_parts.append(f"Hướng: {'Nhập khẩu' if record.get('direction') == 'N' else 'Xuất khẩu'}")
        context_parts.append(f"Ngày đăng ký: {header.get('NGAY_DK', 'Chưa có')}")
        
        # Company info
        context_parts.append("\nTHÔNG TIN DOANH NGHIỆP:")
        context_parts.append(f"Tên: {header.get('DV_DT', 'Chưa có')}")
        context_parts.append(f"Địa chỉ: {header.get('DIA_CHI_DV', 'Chưa có')}")
        context_parts.append(f"Mã số thuế: {record.get('taxCode', 'Chưa có')}")
        
        # Cargo info
        if cargo:
            context_parts.append(f"\nTHÔNG TIN HÀNG HÓA ({len(cargo)} mặt hàng):")
            for i, item in enumerate(cargo[:5]):  # Limit to first 5 items
                context_parts.append(f"{i+1}. {item.get('TEN_HANG', 'Chưa có tên')}")
                context_parts.append(f"   Mã HS: {item.get('MA_HANGKB', 'Chưa có')}")
                context_parts.append(f"   Số lượng: {item.get('LUONG', 0)} {item.get('MA_DVT', '')}")
                context_parts.append(f"   Trị giá: {item.get('TRIGIA_KB', 0)}")
        
        # Value info
        context_parts.append(f"\nTHÔNG TIN GIÁ TRỊ:")
        context_parts.append(f"Tổng trị giá kê khai: {header.get('TONGTGKB', 0)}")
        context_parts.append(f"Tiền tệ: {header.get('MA_NT', 'VND')}")
        
        return "\n".join(context_parts)
    
    def generate_qa_pairs(self, record: Dict, context: str) -> List[Dict]:
        """Generate question-answer pairs"""
        header = record.get('header', {})
        cargo = record.get('cargo', [])
        
        qa_pairs = []
        
        # Basic info questions
        qa_pairs.append({
            'question': 'Mã hải quan của tờ khai này là gì?',
            'answer': f"Mã hải quan là {record.get('customsCode')}",
            'type': 'basic_info'
        })
        
        qa_pairs.append({
            'question': 'Đây là tờ khai nhập khẩu hay xuất khẩu?',
            'answer': f"Đây là tờ khai {'nhập khẩu' if record.get('direction') == 'N' else 'xuất khẩu'}",
            'type': 'basic_info'
        })
        
        # Company questions
        company_name = header.get('DV_DT', '')
        if company_name:
            qa_pairs.append({
                'question': 'Doanh nghiệp thực hiện tờ khai này là gì?',
                'answer': f"Doanh nghiệp là {company_name}",
                'type': 'company_info'
            })
        
        # Cargo questions
        if cargo:
            qa_pairs.append({
                'question': f'Tờ khai này có bao nhiêu mặt hàng?',
                'answer': f'Tờ khai có {len(cargo)} mặt hàng',
                'type': 'cargo_info'
            })
            
            first_cargo = cargo[0]
            cargo_name = first_cargo.get('TEN_HANG', '')
            if cargo_name:
                qa_pairs.append({
                    'question': 'Hàng hóa chính trong tờ khai là gì?',
                    'answer': f"Hàng hóa chính là {cargo_name}",
                    'type': 'cargo_info'
                })
        
        # Value questions
        total_value = header.get('TONGTGKB', 0)
        if total_value:
            qa_pairs.append({
                'question': 'Tổng trị giá của tờ khai là bao nhiêu?',
                'answer': f"Tổng trị giá là {total_value} {header.get('MA_NT', 'VND')}",
                'type': 'value_info'
            })
        
        return qa_pairs
    
    def create_structured_input(self, record: Dict) -> str:
        """Create structured input for document generation"""
        header = record.get('header', {})
        cargo = record.get('cargo', [])
        
        input_parts = []
        
        # Basic declaration info
        input_parts.append("DECLARATION_INFO:")
        input_parts.append(f"customs_code: {record.get('customsCode')}")
        input_parts.append(f"direction: {record.get('direction')}")
        input_parts.append(f"operation_code: {record.get('operationCode')}")
        input_parts.append(f"tax_code: {record.get('taxCode')}")
        
        # Company info
        input_parts.append("\nCOMPANY_INFO:")
        input_parts.append(f"name: {header.get('DV_DT', '')}")
        input_parts.append(f"address: {header.get('DIA_CHI_DV', '')}")
        input_parts.append(f"phone: {header.get('SO_DT_DV', '')}")
        
        # Cargo info
        if cargo:
            input_parts.append("\nCARGO_INFO:")
            for i, item in enumerate(cargo):
                input_parts.append(f"item_{i+1}:")
                input_parts.append(f"  name: {item.get('TEN_HANG', '')}")
                input_parts.append(f"  hs_code: {item.get('MA_HANGKB', '')}")
                input_parts.append(f"  quantity: {item.get('LUONG', 0)}")
                input_parts.append(f"  unit: {item.get('MA_DVT', '')}")
                input_parts.append(f"  value: {item.get('TRIGIA_KB', 0)}")
        
        return "\n".join(input_parts)
    
    def create_declaration_text(self, record: Dict) -> str:
        """Create full declaration text"""
        header = record.get('header', {})
        cargo = record.get('cargo', [])
        
        text_parts = []
        
        # Header
        text_parts.append("TỜ KHAI HẢI QUAN")
        text_parts.append("="*50)
        
        # Basic info
        text_parts.append(f"Mã tờ khai: {record.get('declarationId')}")
        text_parts.append(f"Mã hải quan: {record.get('customsCode')}")
        text_parts.append(f"Loại hình: {'Nhập khẩu' if record.get('direction') == 'N' else 'Xuất khẩu'}")
        text_parts.append(f"Ngày đăng ký: {header.get('NGAY_DK', 'Chưa có')}")
        
        # Company info
        text_parts.append("\nTHÔNG TIN DOANH NGHIỆP")
        text_parts.append("-"*30)
        text_parts.append(f"Tên doanh nghiệp: {header.get('DV_DT', 'Chưa có')}")
        text_parts.append(f"Địa chỉ: {header.get('DIA_CHI_DV', 'Chưa có')}")
        text_parts.append(f"Mã số thuế: {record.get('taxCode', 'Chưa có')}")
        text_parts.append(f"Điện thoại: {header.get('SO_DT_DV', 'Chưa có')}")
        
        # Cargo info
        if cargo:
            text_parts.append(f"\nDANH MỤC HÀNG HÓA ({len(cargo)} mặt hàng)")
            text_parts.append("-"*30)
            for i, item in enumerate(cargo):
                text_parts.append(f"{i+1}. {item.get('TEN_HANG', 'Chưa có tên')}")
                text_parts.append(f"   Mã HS: {item.get('MA_HANGKB', 'Chưa có')}")
                text_parts.append(f"   Số lượng: {item.get('LUONG', 0)} {item.get('MA_DVT', '')}")
                text_parts.append(f"   Đơn giá: {item.get('DGIA_KB', 0)}")
                text_parts.append(f"   Trị giá: {item.get('TRIGIA_KB', 0)}")
        
        # Summary
        text_parts.append("\nTỔNG KẾT")
        text_parts.append("-"*30)
        text_parts.append(f"Tổng số mặt hàng: {len(cargo)}")
        text_parts.append(f"Tổng trị giá: {header.get('TONGTGKB', 0)} {header.get('MA_NT', 'VND')}")
        
        return "\n".join(text_parts)
    
    def save_dataset(self, data: List[Dict], task_type: str, filename: str):
        """Save dataset to JSONL file"""
        filepath = self.output_dir / task_type / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            for item in data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        logger.info(f"Saved {len(data)} samples to {filepath}")
    
    def create_splits(self, data: List[Dict], task_type: str, train_ratio=0.8, val_ratio=0.1, test_ratio=0.1):
        """Create train/val/test splits"""
        random.shuffle(data)
        
        total_size = len(data)
        train_size = int(total_size * train_ratio)
        val_size = int(total_size * val_ratio)
        
        train_data = data[:train_size]
        val_data = data[train_size:train_size + val_size]
        test_data = data[train_size + val_size:]
        
        # Save splits
        splits_dir = self.output_dir / 'splits' / task_type
        splits_dir.mkdir(parents=True, exist_ok=True)
        
        for split_name, split_data in [('train', train_data), ('val', val_data), ('test', test_data)]:
            filename = f"{task_type}_{split_name}.jsonl"
            filepath = splits_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                for item in split_data:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        logger.info(f"Created splits for {task_type}: train={len(train_data)}, val={len(val_data)}, test={len(test_data)}")
    
    def generate_all_datasets(self):
        """Generate all datasets"""
        logger.info("Starting dataset generation...")
        
        self.generate_classification_dataset()
        self.generate_ner_dataset()
        self.generate_qa_dataset()
        self.generate_document_generation_dataset()
        
        logger.info("Dataset generation complete!")
    
    def generate_dataset_summary(self):
        """Generate summary of all datasets"""
        summary = {
            'generation_date': datetime.now().isoformat(),
            'total_records': len(self.data),
            'datasets': {}
        }
        
        task_types = ['classification', 'ner', 'qa', 'generation']
        
        for task_type in task_types:
            dataset_dir = self.output_dir / task_type
            splits_dir = self.output_dir / 'splits' / task_type
            
            dataset_info = {
                'total_samples': 0,
                'splits': {}
            }
            
            # Count main dataset
            main_file = dataset_dir / f"{task_type}.jsonl"
            if main_file.exists():
                with open(main_file, 'r', encoding='utf-8') as f:
                    dataset_info['total_samples'] = sum(1 for _ in f)
            
            # Count splits
            for split in ['train', 'val', 'test']:
                split_file = splits_dir / f"{task_type}_{split}.jsonl"
                if split_file.exists():
                    with open(split_file, 'r', encoding='utf-8') as f:
                        dataset_info['splits'][split] = sum(1 for _ in f)
            
            summary['datasets'][task_type] = dataset_info
        
        # Save summary
        summary_path = self.output_dir / 'metadata' / 'dataset_summary.json'
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Dataset summary saved to {summary_path}")
        
        # Print summary
        print("\n" + "="*50)
        print("DATASET GENERATION SUMMARY")
        print("="*50)
        for task_type, info in summary['datasets'].items():
            print(f"\n{task_type.upper()}:")
            print(f"  Total samples: {info['total_samples']}")
            for split, count in info['splits'].items():
                print(f"  {split}: {count}")
        print("="*50)

def main():
    """Main execution function"""
    input_dir = "/Volumes/FastVault-Apps/Projects/ai-vvmv/llm-dataset"
    output_dir = "/Volumes/FastVault-Apps/Projects/ai-vvmv/llm-dataset"
    
    generator = LLMDatasetGenerator(input_dir, output_dir)
    generator.generate_all_datasets()
    generator.generate_dataset_summary()

if __name__ == "__main__":
    main()