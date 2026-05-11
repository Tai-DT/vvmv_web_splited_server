#!/usr/bin/env python3
"""
Test Pipeline Runner
Test pipeline với sample data nhỏ
"""

import json
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def create_sample_data():
    """Tạo sample data nhỏ để test"""
    logger.info("Creating sample test data...")
    
    # Tạo sample directory
    sample_dir = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv/sample-data")
    sample_dir.mkdir(exist_ok=True)
    
    # Tạo cấu trúc thư mục giống data gốc
    declarations_dir = sample_dir / "han-2024" / "declarations" / "direction=N" / "year=0000" / "month=00" / "customs=01B1"
    declarations_dir.mkdir(parents=True, exist_ok=True)
    
    # Sample records
    sample_records = [
        {
            "declarationId": "106503",
            "declarationNumber": None,
            "direction": "N",
            "declarationDate": None,
            "taxCode": "0101431115",
            "customsCode": "01B1",
            "operationCode": "A41",
            "header": {
                "_DToKhaiMDID": 106503,
                "_XorN": "N",
                "MA_LH": "A41",
                "MA_HQ": "01B1",
                "TEN_HQ": "Hải quan Hà Nội",
                "MA_DV": "0101431115",
                "DIA_CHI_DV": "Tầng 8, Số 36 Cát Linh, Phường Cát Linh, Quận Đống Đa, Thành phố Hà Nội, Việt Nam",
                "SO_DT_DV": "02438430540",
                "DV_DT": "KOMATSU PARTS ASIA CO., LTD",
                "NGAYDEN": "2025-06-19T00:00:00.000Z",
                "VAN_DON": "2506006",
                "MA_CK": "VNHAN",
                "TEN_CK": "HA NOI",
                "MA_PTTT": "KC",
                "MA_NT": "USD",
                "PHI_VC": 14596318,
                "TONGTGKB": 7880.56,
                "SOHANG": 51,
                "NGAY_HDTM": "2025-06-19T00:00:00.000Z",
                "TONGTG_HDTM": 9768.94
            },
            "vnaccs2": {
                "DTOKHAIMD_VNACCS2ID": 105626,
                "_DTOKHAIMDID": 106503,
                "CANHAN_TOCHUC": "4",
                "DIA_CHI_DT1": "AMATANAKORN INDUSTRIAL ESTATE",
                "NGAY_VAN_DON": "2025-06-18T00:00:00.000Z"
            },
            "cargo": [
                {
                    "_DHangMDDKID": 1115578,
                    "_DToKhaiMDID": 106503,
                    "MA_LH": "A41",
                    "MA_HQ": "01B1",
                    "STTHANG": 1,
                    "MA_HANGKB": "85365099",
                    "TEN_HANG": "Công tắc đóng ngắt mạch điện không có cầu chì, điện áp hoạt động 24v, dòng điện lớn hơn 16A, 421-43-32912, phụ tùng thay thế máy công trình hiệu Komatsu, mới 100%",
                    "NUOC_XX": "JP",
                    "MA_DVT": "PCE",
                    "LUONG": 5,
                    "DGIA_KB": 238.47,
                    "TRIGIA_KB": 1192.35,
                    "TS_XNK_MA_BT": "B01"
                },
                {
                    "_DHangMDDKID": 1115579,
                    "_DToKhaiMDID": 106503,
                    "MA_LH": "A41",
                    "MA_HQ": "01B1",
                    "STTHANG": 2,
                    "MA_HANGKB": "87089999",
                    "TEN_HANG": "Bộ phận động cơ diesel cho máy công cụ, model 4D92, mới 100%",
                    "NUOC_XX": "JP",
                    "MA_DVT": "SET",
                    "LUONG": 2,
                    "DGIA_KB": 1500.00,
                    "TRIGIA_KB": 3000.00,
                    "TS_XNK_MA_BT": "B01"
                }
            ]
        },
        {
            "declarationId": "106504",
            "declarationNumber": None,
            "direction": "X",
            "declarationDate": None,
            "taxCode": "0101234567",
            "customsCode": "01DD",
            "operationCode": "A12",
            "header": {
                "_DToKhaiMDID": 106504,
                "_XorN": "X",
                "MA_LH": "A12",
                "MA_HQ": "01DD",
                "TEN_HQ": "Hải quan Đà Nẵng",
                "MA_DV": "0101234567",
                "DIA_CHI_DV": "Số 123 Nguyễn Văn Linh, Quận Hải Châu, TP. Đà Nẵng",
                "SO_DT_DV": "02363841234",
                "DV_DT": "VIETNAM TEXTILE EXPORT JSC",
                "NGAYDEN": "2025-06-20T00:00:00.000Z",
                "VAN_DON": "2506007",
                "MA_CK": "VNDAD",
                "TEN_CK": "DA NANG",
                "MA_PTTT": "TT",
                "MA_NT": "USD",
                "PHI_VC": 8500000,
                "TONGTGKB": 15000.00,
                "SOHANG": 25,
                "NGAY_HDTM": "2025-06-20T00:00:00.000Z",
                "TONGTG_HDTM": 15000.00
            },
            "vnaccs2": {
                "DTOKHAIMD_VNACCS2ID": 105627,
                "_DTOKHAIMDID": 106504,
                "CANHAN_TOCHUC": "4",
                "DIA_CHI_DT1": "123 BACH DANG STREET",
                "NGAY_VAN_DON": "2025-06-19T00:00:00.000Z"
            },
            "cargo": [
                {
                    "_DHangMDDKID": 1115580,
                    "_DToKhaiMDID": 106504,
                    "MA_LH": "A12",
                    "MA_HQ": "01DD",
                    "STTHANG": 1,
                    "MA_HANGKB": "62063000",
                    "TEN_HANG": "Áo sơ mi nam cotton 100%, mã sản phẩm ASM-001, size L, màu trắng",
                    "NUOC_XX": "VN",
                    "MA_DVT": "PCS",
                    "LUONG": 1000,
                    "DGIA_KB": 8.50,
                    "TRIGIA_KB": 8500.00,
                    "TS_XNK_MA_BT": "A01"
                },
                {
                    "_DHangMDDKID": 1115581,
                    "_DToKhaiMDID": 106504,
                    "MA_LH": "A12",
                    "MA_HQ": "01DD",
                    "STTHANG": 2,
                    "MA_HANGKB": "62034200",
                    "TEN_HANG": "Quần jean nam denim blue, mã sản phẩm QJ-002, size 32, màu xanh đậm",
                    "NUOC_XX": "VN",
                    "MA_DVT": "PCS",
                    "LUONG": 800,
                    "DGIA_KB": 12.50,
                    "TRIGIA_KB": 10000.00,
                    "TS_XNK_MA_BT": "A01"
                }
            ]
        }
    ]
    
    # Write sample data to JSONL file
    sample_file = declarations_dir / "part-0001.jsonl"
    with open(sample_file, 'w', encoding='utf-8') as f:
        for record in sample_records:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    
    logger.info(f"Created sample data with {len(sample_records)} records at {sample_file}")
    return str(sample_dir)

def test_pipeline():
    """Test pipeline với sample data"""
    logger.info("Starting pipeline test...")
    
    # Create sample data
    sample_source = create_sample_data()
    
    # Test data processor
    logger.info("Testing data processor...")
    try:
        import sys
        sys.path.append('/Volumes/FastVault-Apps/Projects/ai-vvmv')
        from scripts.data_processor import VVMVDataProcessor
        
        processor = VVMVDataProcessor(
            source_dir=sample_source,
            output_dir="/Volumes/FastVault-Apps/Projects/ai-vvmv/test-output"
        )
        processor.process_all_files()
        logger.info("✓ Data processor test passed")
    except Exception as e:
        logger.error(f"✗ Data processor test failed: {e}")
        return False
    
    # Test dataset generator
    logger.info("Testing dataset generator...")
    try:
        from scripts.dataset_generator import LLMDatasetGenerator
        
        generator = LLMDatasetGenerator(
            input_dir="/Volumes/FastVault-Apps/Projects/ai-vvmv/test-output",
            output_dir="/Volumes/FastVault-Apps/Projects/ai-vvmv/test-output"
        )
        generator.generate_all_datasets()
        logger.info("✓ Dataset generator test passed")
    except Exception as e:
        logger.error(f"✗ Dataset generator test failed: {e}")
        return False
    
    # Test data validator
    logger.info("Testing data validator...")
    try:
        from scripts.data_validator import VVMVDataValidator
        
        validator = VVMVDataValidator(
            dataset_dir="/Volumes/FastVault-Apps/Projects/ai-vvmv/test-output"
        )
        validator.run_full_validation()
        logger.info("✓ Data validator test passed")
    except Exception as e:
        logger.error(f"✗ Data validator test failed: {e}")
        return False
    
    logger.info("✓ All pipeline tests passed!")
    return True

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    success = test_pipeline()
    if success:
        print("\n" + "="*50)
        print("PIPELINE TEST SUCCESSFUL!")
        print("="*50)
        print("Sample output created at: test-output/")
        print("You can now run the full pipeline with:")
        print("python run_pipeline.py")
    else:
        print("\n" + "="*50)
        print("PIPELINE TEST FAILED!")
        print("="*50)
        print("Check logs for details")