"""将 db_init.py 种子数据中的英文物料/供应商名替换为中文（一劳永逸）。

用法:
    python scripts/zh_seed.py

执行后 db_init.py 的种子即为中文，之后重建数据库也不再变回英文。
"""
from pathlib import Path

DB_INIT = Path(__file__).resolve().parents[1] / "scripts" / "db_init.py"

# 英文名 -> 中文名（与 zh_catalog.py 保持一致的翻译）
VENDORS_EN2ZH = {
    "Vertex Industrial Supply": "顶点工业供应",
    "Nova Components Co.": "新星元器件公司",
    "Precision Parts Ltd.": "精密零件有限公司",
    "Global Tech Manufacturing": "环球科技制造",
    "Evergreen Materials": "常青材料",
    "Summit Electronics": "顶峰电子",
    "Apex Hardware Group": "顶点五金集团",
    "BlueWave Machinery": "蓝波机械",
    "CoreLink Systems": "核联系统",
    "Prime MRO Supplies": "优选维保耗材",
    "Sentinel Safety Equipment": "哨兵安全设备",
    "Omega Fasteners": "欧米伽紧固件",
    "Titan Office Solutions": "泰坦办公方案",
    "Horizon IT Distribution": "地平线 IT 分销",
    "Cascade Logistics Gear": "瀑布物流装备",
    "Vertex Power Systems": "顶点动力系统",
    "Meridian Controls": "子午线控制",
    "Atlas Mechanical": "阿特拉斯机械",
    "Nexus Automation": "纽克斯自动化",
    "Acme Corp": "顶点公司",
    "Quantum Computing Hardware": "量子计算硬件",
    "BrightPath Lighting": "明途照明",
    "Falcon Aerospace Parts": "猎鹰航空零件",
    "Stellar Motors": "恒星电机",
    "RidgeLine Tools": "山脊工具",
    "Harbor Freight Supply": "港湾货运供应",
    "Pioneer Chemicals": "先锋化工",
    "Orion Robotics": "猎户座机器人",
    "Pacific Packaging": "太平洋包装",
    "Ironclad Bearings": "铁甲轴承",
}

ITEMS_EN2ZH = {
    "Cold-Rolled Steel Sheet 2mm": "冷轧钢板 2mm",
    "Aluminum Alloy Bar 6061": "铝合金棒 6061",
    "Copper Wire 12AWG Roll": "铜线 12AWG 卷",
    "Polycarbonate Resin Granules": "聚碳酸酯树脂颗粒",
    "Stainless Steel Tube 304": "不锈钢管 304",
    "Brass Rod C360": "黄铜棒 C360",
    "Industrial Lubricant 20L Drum": "工业润滑油 20L 桶",
    "Epoxy Adhesive Kit": "环氧粘合剂套件",
    "Microcontroller Board STM32": "单片机开发板 STM32",
    "Industrial Power Supply 24V 10A": "工业电源 24V 10A",
    "Temperature Sensor Module": "温度传感器模块",
    "7-inch Touch Display Panel": "7 寸触摸显示屏",
    "Servo Drive Controller 48V": "伺服驱动控制器 48V",
    "Relay Module 8-Channel": "继电器模块 8 路",
    "High-Voltage Fuse 32A": "高压保险丝 32A",
    "Industrial Inverter 3kW": "工业变频器 3kW",
    "LED Indicator Panel": "LED 指示灯面板",
    "Multi-pin Connector Set": "多针连接器套件",
    "PLC Controller Compact": "紧凑型 PLC 控制器",
    "Electronic Control Module": "电子控制模块",
    "AC Induction Motor 2.2kW": "交流感应电机 2.2kW",
    "Centrifugal Pump 5HP": "离心泵 5HP",
    "Ball Valve DN50 Brass": "黄铜球阀 DN50",
    "Deep Groove Ball Bearing 6205": "深沟球轴承 6205",
    "Spur Gear Module 2": "直齿轮 模数 2",
    "Flexible Coupling Set": "弹性联轴器套件",
    "Stainless Fastener Kit M6": "不锈钢紧固件套件 M6",
    "Helical Spring Assortment": "螺旋弹簧套装",
    "Mounting Bracket Galvanized": "镀锌安装支架",
    "Hydraulic Cylinder 2T": "液压缸 2T",
    "Lithium Battery Cell 3.7V": "锂电池电芯 3.7V",
    "Solar Panel 400W Mono": "单晶太阳能板 400W",
    "Industrial Battery Charger": "工业电池充电器",
    "Portable Generator 3kW": "便携式发电机 3kW",
    "Cordless Drill Driver": "无绳电钻",
    "CNC Milling Cutter Set": "CNC 铣刀套件",
    "Industrial Grinding Wheel": "工业砂轮",
    "Welding Machine 200A": "电焊机 200A",
    "Precision Caliper Digital": "数显精密卡尺",
    "Impact Wrench Pneumatic": "气动冲击扳手",
    "Bench Vise 6-Inch": "6 寸台钳",
    "Cutting Torch Kit": "切割炬套件",
    "Engineering Software License": "工程软件授权",
    "3D Printer Filament PLA": "3D 打印耗材 PLA",
    "Prototype PCB Batch": "原型 PCB 批次",
    "Oscilloscope 2-Channel": "双通道示波器",
    "Lab Centrifuge Compact": "紧凑型实验室离心机",
    "Development Board Kit": "开发板套件",
    "HVAC Air Filter 20x20": "暖通空气过滤器 20x20",
    "Safety Helmet ANSI": "ANSI 安全帽",
    "Cut-Resistant Gloves Pack": "防割手套包",
    "Fire Extinguisher 5kg": "灭火器 5kg",
    "Rubber Gasket Sheet": "橡胶垫片板",
    "Pipe Sealant Tape": "管道密封胶带",
    "Industrial Sealant Cartridge": "工业密封胶筒",
    "Duct Fan Industrial": "工业管道风机",
    "Pressure Gauge 0-100psi": "压力表 0-100psi",
    "Workshop LED Floodlight": "车间 LED 泛光灯",
    "Rack Server 1U": "1U 机架服务器",
    "Business Laptop 14in": "14 寸商务笔记本",
    "Network Router Enterprise": "企业级路由器",
    "Managed Switch 24-Port": "24 口管理型交换机",
    "Laser Printer MFP": "激光多功能一体机",
    "27-inch Monitor IPS": "27 寸 IPS 显示器",
    "Mechanical Keyboard": "机械键盘",
    "NAS Storage 4-Bay": "4 盘位 NAS 存储",
    "Barcode Scanner Wireless": "无线条码扫描枪",
    "Uninterruptible Power Supply": "不间断电源 UPS",
    "Heavy-Duty Pallet 1200x1000": "重型托盘 1200x1000",
    "Corrugated Box Pack 50": "瓦楞纸箱 50 只装",
    "Warehouse Labeling Machine": "仓库贴标机",
    "Forklift Replacement Tire": "叉车替换轮胎",
    "Conveyor Roller 500mm": "输送滚筒 500mm",
    "Stretch Wrap Film Roll": "拉伸缠绕膜卷",
    "Ergonomic Office Chair": "人体工学办公椅",
    "Standing Desk 120cm": "120cm 升降桌",
    "A4 Copy Paper Box": "A4 复印纸箱",
    "Whiteboard 120x90": "白板 120x90",
    "Filing Cabinet 4-Drawer": "四斗文件柜",
    "Desktop Stationery Set": "桌面文具套装",
}


def main():
    text = DB_INIT.read_text(encoding="utf-8")
    mapping = {**VENDORS_EN2ZH, **ITEMS_EN2ZH}

    replaced = 0
    for en, zh in mapping.items():
        needle = f"'{en}'"
        if needle in text:
            text = text.replace(needle, f"'{zh}'")
            replaced += 1
        else:
            print(f"[警告] 未找到英文名: {en}")

    DB_INIT.write_text(text, encoding="utf-8")
    print(f"已将 db_init.py 中 {replaced} 个名称替换为中文。")


if __name__ == "__main__":
    main()
