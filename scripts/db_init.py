# backend/core/db_init.py
try:
    import sqlite3
except Exception:
    import pysqlite3 as sqlite3

from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "backend" / "data" / "procurement.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

schema = """
CREATE TABLE IF NOT EXISTS vendors(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  category TEXT,
  approved INTEGER DEFAULT 1,
  ext_score REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT,
  unit_price REAL DEFAULT 0,
  default_vendor_id INTEGER,
  FOREIGN KEY(default_vendor_id) REFERENCES vendors(id)
);
CREATE TABLE IF NOT EXISTS inventory(
  item_id INTEGER PRIMARY KEY,
  qty_on_hand INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 0,
  min_qty INTEGER DEFAULT 0,
  FOREIGN KEY(item_id) REFERENCES items(id)
);
CREATE TABLE IF NOT EXISTS policies(
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  qty INTEGER,
  vendor_id INTEGER,
  amount REAL,
  pdf_path TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(item_id) REFERENCES items(id),
  FOREIGN KEY(vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    subject TEXT,
    sender TEXT,
    date TEXT,
    body TEXT,
    folder TEXT,
    is_read BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    analysis_status TEXT,
    analysis_error TEXT,
    attachments TEXT
);
CREATE TABLE IF NOT EXISTS email_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    priority TEXT,
    summary TEXT,
    item_id INTEGER,
    item_name TEXT,
    item_unit_price REAL,
    item_quantity INTEGER,
    vendor_id INTEGER,
    vendor_name TEXT,
    vendor_email TEXT,
    vendor_phone TEXT,
    total_cost REAL,
    budget REAL,
    compliance_explanation TEXT,
    order_id INTEGER,
    FOREIGN KEY(email_id) REFERENCES emails(id),
    FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS forecasts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stats_json TEXT,
    markdown TEXT,
    chart_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

"""

conn = sqlite3.connect(str(DB_PATH))
conn.executescript(schema)

# seed a couple of rows
#conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,approved,ext_score) VALUES (1,'顶点公司','sales@acme.example',1,82)")
#conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (1,'M4 Stainless Screws','M4-SS-100','box',12.50,1)")
#conn.execute("INSERT OR IGNORE INTO policies(key,value) VALUES ('max_single_order_amount','50000')")
#conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (1, 0, 1000, 50)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (1,'顶点工业供应','sales@vertexindustrial.com','555-0101',1,90)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (2,'新星元器件公司','sales@novacomponents.com','555-0102',1,88)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (3,'精密零件有限公司','orders@precisionparts.com','555-0103',1,85)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (4,'环球科技制造','orders@globaltechmfg.com','555-0104',1,87)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (5,'常青材料','sales@evergreenmats.com','555-0105',1,92)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (6,'顶峰电子','supply@summitelec.com','555-0106',1,89)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (7,'顶点五金集团','orders@apexhardware.com','555-0107',1,84)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (8,'蓝波机械','sales@bluewavemach.com','555-0108',1,83)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (9,'核联系统','orders@corelinksys.com','555-0109',1,86)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (10,'优选维保耗材','sales@primemro.com','555-0110',1,82)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (11,'哨兵安全设备','orders@sentinelsafety.com','555-0111',1,80)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (12,'欧米伽紧固件','supply@omegafasteners.com','555-0112',1,81)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (13,'泰坦办公方案','sales@titanoffice.com','555-0113',1,91)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (14,'地平线 IT 分销','orders@horizonit.com','555-0114',1,85)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (15,'瀑布物流装备','supply@cascadelogistics.com','555-0115',1,87)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (16,'顶点动力系统','sales@vertexpower.com','555-0116',1,86)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (17,'子午线控制','orders@meridiancontrols.com','555-0117',1,84)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (18,'阿特拉斯机械','sales@atlasmech.com','555-0118',1,83)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (19,'纽克斯自动化','orders@nexusautomation.com','555-0119',1,82)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (20,'顶点公司','sales@acme.example','555-0120',1,82)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (21,'量子计算硬件','sales@quantumhw.com','555-0121',1,95)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (22,'明途照明','orders@brightpathlight.com','555-0122',1,93)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (23,'猎鹰航空零件','supply@falconaero.com','555-0123',1,90)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (24,'恒星电机','sales@stellarmotors.com','555-0124',1,89)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (25,'山脊工具','orders@ridgelinetools.com','555-0125',1,88)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (26,'港湾货运供应','supply@harborsupply.com','555-0126',1,87)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (27,'先锋化工','sales@pioneerchem.com','555-0127',1,85)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (28,'猎户座机器人','orders@orionrobotics.com','555-0128',1,86)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (29,'太平洋包装','sales@pacificpack.com','555-0129',1,88)")
conn.execute("INSERT OR IGNORE INTO vendors(id,name,email,phone,approved,ext_score) VALUES (30,'铁甲轴承','supply@ironcladbearings.com','555-0130',1,84)")

# ---------------- Items ----------------
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (1,'冷轧钢板 2mm','RAW-STEEL-2MM','sheet',45,5)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (2,'铝合金棒 6061','RAW-ALU-6061','bar',32,5)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (3,'铜线 12AWG 卷','RAW-CU-12AWG','roll',120,5)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (4,'聚碳酸酯树脂颗粒','RAW-PC-RESIN','kg',8,5)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (5,'不锈钢管 304','RAW-SS-TUBE','meter',28,5)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (6,'黄铜棒 C360','RAW-BRASS-360','meter',40,5)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (7,'工业润滑油 20L 桶','RAW-LUBE-20L','drum',85,27)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (8,'环氧粘合剂套件','RAW-EPOXY-KIT','kit',55,27)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (9,'单片机开发板 STM32','ELC-MCU-STM32','unit',25,6)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (10,'工业电源 24V 10A','ELC-PSU-24V','unit',65,16)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (11,'温度传感器模块','ELC-SENSOR-TEMP','unit',18,6)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (12,'7 寸触摸显示屏','ELC-DISP-7IN','unit',95,6)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (13,'伺服驱动控制器 48V','ELC-CTRL-48V','unit',150,17)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (14,'继电器模块 8 路','ELC-RELAY-8CH','unit',22,6)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (15,'高压保险丝 32A','ELC-FUSE-32A','unit',6,6)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (16,'工业变频器 3kW','ELC-INV-3KW','unit',480,16)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (17,'LED 指示灯面板','ELC-LED-PANEL','unit',14,22)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (18,'多针连接器套件','ELC-CONN-SET','set',30,6)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (19,'紧凑型 PLC 控制器','ELC-PLC-COMPACT','unit',720,17)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (20,'电子控制模块','ELC-MODULE-CTRL','unit',340,17)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (21,'交流感应电机 2.2kW','MEC-MOTOR-2KW','unit',380,24)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (22,'离心泵 5HP','MEC-PUMP-5HP','unit',520,8)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (23,'黄铜球阀 DN50','MEC-VALVE-DN50','unit',75,8)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (24,'深沟球轴承 6205','MEC-BEAR-6205','unit',12,30)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (25,'直齿轮 模数 2','MEC-GEAR-M2','unit',28,30)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (26,'弹性联轴器套件','MEC-COUPL-SET','set',45,30)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (27,'不锈钢紧固件套件 M6','MEC-FAST-M6','kit',35,12)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (28,'螺旋弹簧套装','MEC-SPRING-ASST','set',40,12)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (29,'镀锌安装支架','MEC-BRACK-GAL','unit',9,7)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (30,'液压缸 2T','MEC-CYL-2T','unit',640,8)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (31,'锂电池电芯 3.7V','ENE-CELL-3V7','unit',8,16)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (32,'单晶太阳能板 400W','ENE-SOLAR-400W','unit',210,16)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (33,'工业电池充电器','ENE-CHGR-IND','unit',350,16)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (34,'便携式发电机 3kW','ENE-GEN-3KW','unit',890,8)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (35,'无绳电钻','MFG-DRILL-CORD','unit',120,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (36,'CNC 铣刀套件','MFG-CNC-CUTTER','set',260,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (37,'工业砂轮','MFG-GRIND-WHEEL','unit',18,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (38,'电焊机 200A','MFG-WELD-200A','unit',540,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (39,'数显精密卡尺','MFG-CALIPER','unit',42,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (40,'气动冲击扳手','MFG-WRENCH-PNEU','unit',230,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (41,'6 寸台钳','MFG-VISE-6IN','unit',95,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (42,'切割炬套件','MFG-TORCH-KIT','kit',310,25)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (43,'工程软件授权','RND-SW-LICENSE','unit',1500,19)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (44,'3D 打印耗材 PLA','RND-FILAMENT-PLA','spool',22,19)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (45,'原型 PCB 批次','RND-PCB-PROTO','batch',180,6)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (46,'双通道示波器','RND-SCOPE-2CH','unit',620,19)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (47,'紧凑型实验室离心机','RND-CENTRIFUGE','unit',1150,19)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (48,'开发板套件','RND-DEV-KIT','kit',130,19)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (49,'暖通空气过滤器 20x20','ENG-FILTER-HVAC','unit',15,10)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (50,'ANSI 安全帽','ENG-HELMET','unit',12,11)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (51,'防割手套包','ENG-GLOVE-PACK','pack',25,11)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (52,'灭火器 5kg','ENG-EXTINGUISHER','unit',65,11)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (53,'橡胶垫片板','ENG-GASKET-RUB','sheet',8,27)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (54,'管道密封胶带','ENG-SEAL-TAPE','roll',3,27)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (55,'工业密封胶筒','ENG-SEALANT-CART','unit',9,27)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (56,'工业管道风机','ENG-FAN-DUCT','unit',140,10)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (57,'压力表 0-100psi','ENG-GAUGE-100','unit',28,10)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (58,'车间 LED 泛光灯','ENG-LIGHT-FLOOD','unit',55,22)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (59,'1U 机架服务器','IT-SERVER-1U','unit',3200,21)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (60,'14 寸商务笔记本','IT-LAPTOP-14','unit',1450,14)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (61,'企业级路由器','IT-ROUTER-ENT','unit',480,14)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (62,'24 口管理型交换机','IT-SWITCH-24','unit',620,14)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (63,'激光多功能一体机','IT-PRINTER-MFP','unit',380,13)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (64,'27 寸 IPS 显示器','IT-MONITOR-27','unit',260,14)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (65,'机械键盘','IT-KEYBOARD','unit',95,14)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (66,'4 盘位 NAS 存储','IT-NAS-4BAY','unit',720,21)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (67,'无线条码扫描枪','IT-SCANNER-WL','unit',140,14)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (68,'不间断电源 UPS','IT-UPS-1500','unit',210,16)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (69,'重型托盘 1200x1000','OPS-PALLET-HD','unit',22,29)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (70,'瓦楞纸箱 50 只装','OPS-BOX-PACK','pack',45,29)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (71,'仓库贴标机','OPS-LABEL-MACHINE','unit',180,13)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (72,'叉车替换轮胎','OPS-FORK-TIRE','unit',85,8)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (73,'输送滚筒 500mm','OPS-ROLLER-500','unit',30,8)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (74,'拉伸缠绕膜卷','OPS-WRAP-ROLL','roll',18,29)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (75,'人体工学办公椅','OFF-CHAIR-ERG','unit',320,13)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (76,'120cm 升降桌','OFF-DESK-120','unit',480,13)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (77,'A4 复印纸箱','OFF-PAPER-A4','box',28,13)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (78,'白板 120x90','OFF-WHITEBOARD','unit',65,13)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (79,'四斗文件柜','OFF-CABINET-4D','unit',240,13)")
conn.execute("INSERT OR IGNORE INTO items(id,name,sku,unit,unit_price,default_vendor_id) VALUES (80,'桌面文具套装','OFF-STATION-SET','set',35,13)")

# ---------------- Policies ----------------
conn.execute("INSERT OR IGNORE INTO policies(key,value) VALUES ('max_single_order_amount','100000')")
conn.execute("INSERT OR IGNORE INTO policies(key,value) VALUES ('min_vendor_score','80')")
conn.execute("INSERT OR IGNORE INTO policies(key,value) VALUES ('max_open_orders','500')")

# ---------------- Inventory (Expanded Capacity) ----------------
# Provide baseline inventory for ALL items (1-80)
for i in range(1, 81):
    conn.execute(f"INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES ({i}, 200, 5000, 50)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (54,20,200,40)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (55,20,200,40)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (56,10,100,20)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (57,15,150,30)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (58,50,500,100)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (59,30,300,60)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (60,40,400,80)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (61,10,100,20)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (62,15,150,30)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (63,25,250,50)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (64,20,200,40)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (65,30,300,60)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (66,25,250,50)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (67,20,200,40)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (68,15,150,30)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (69,100,1000,200)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (70,80,800,160)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (71,40,400,80)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (72,120,1200,240)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (73,200,2000,400)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (74,300,3000,600)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (75,50,500,100)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (76,100,1000,200)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (77,20,200,40)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (78,10,100,20)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (79,80,800,160)")
conn.execute("INSERT OR IGNORE INTO inventory(item_id, qty_on_hand, max_capacity, min_qty) VALUES (80,40,400,80)")

# Update existing inventory limits to support more storage
conn.execute("UPDATE inventory SET max_capacity = max_capacity * 2 WHERE item_id <= 50")
conn.execute("UPDATE policies SET value = '100000' WHERE key = 'max_single_order_amount'")





# ---------------- Mock Orders ----------------
import csv
CSV_PATH = Path(__file__).resolve().parents[1] / "seed-data" / "mock_orders.csv"

if CSV_PATH.exists():
    print(f"Loading mock orders from {CSV_PATH}...")
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # order_id,order_date,item_id,vendor_id,quantity,unit_price,total_price
            conn.execute("""
                INSERT OR IGNORE INTO orders (id, created_at, item_id, vendor_id, qty, amount, status)
                VALUES (?, ?, ?, ?, ?, ?, 'received')
            """, (
                row['order_id'],
                row['order_date'],
                row['item_id'],
                row['vendor_id'],
                row['quantity'],
                row['total_price']
            ))
    print("Mock orders loaded.")
else:
    print(f"Warning: Mock orders file not found at {CSV_PATH}")

conn.commit()
conn.close()
print(f"Initialized DB at {DB_PATH}")

