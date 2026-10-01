"""Insert curated fictional procurement correspondence without SMTP or model calls.

Run from the repository root: python scripts/seed_interview_emails.py --db PATH
Existing messages and analysis are never overwritten. Dates are relative to import.
"""
import argparse
import sqlite3
from datetime import datetime, timedelta, timezone

# key, sender, subject, body. Reserved example.com addresses are intentional.
EMAILS = [
    ('paper', '林悦 <lin.yue@example.com>', '培训室用纸补货，麻烦本周安排',
     '采购同事好，\n下周有两场新员工培训，讲义需要提前装订。请采购 A4 复印纸箱 12 箱，总预算 500 元，7 天内送到行政库房即可。规格沿用物料库里的那款，不需要升级。\n到货后麻烦在工作群里通知我，我安排同事领取。谢谢！\n林悦｜行政支持'),
    ('bearing', '周维 <zhou.wei@example.com>', '二号输送线检修：补 30 个 6205 轴承',
     '小陈，\n二号输送线昨晚巡检发现异响，停机窗口已经排在三天后。请加急采购深沟球轴承 6205，共 30 个，预算上限 600 元，最好 2 天内到货。\n这一批是检修备件，不要替换成其他型号。若交期赶不上请先跟我确认，别直接改型号。\n周维\n设备维护组'),
    ('board', '许宁 <xu.ning@example.com>', '控制板验证需要追加开发板',
     '采购组：\n我们准备做下一轮固件验证，申请单片机开发板 STM32 20 块，合计预算 800 元，期望 14 天内交付。沿用目录型号，方便复用现有夹具。\n费用归研发验证项目 R26-014，收货地点为研发楼二层样品柜。\n许宁 / 嵌入式研发'),
    ('gloves', '吴晓 <wu.xiao@example.com>', '切割岗位劳保用品补充申请',
     '你好，切割岗位本月新增了两组轮班，请补购防割手套包 24 包，总预算 800 元，10 天内到货。\n请按“包”下单，和上次领用的包装一致，不是 24 双。到货交给车间物料员登记，后续按班组领用。\n吴晓\n安全与环境管理'),
    ('boxes', '赵航 <zhao.hang@example.com>', '月底发货的包装耗材准备',
     '采购同事，\n月底有一批备件集中出库，现申请瓦楞纸箱 50 只装，数量 40 包，预算 2,400 元，要求 12 天内送达。按目录的标准规格即可。\n仓库会分批领用，请到货前一天告知，我们留出卸货位置。\n赵航｜仓储物流'),
    ('chairs', '陈可 <chen.ke@example.com>', '项目组工位调整，申请更换 6 把办公椅',
     '大家好，\n项目组调整工位时发现几把椅子的升降杆已经失效。申请采购人体工学办公椅 6 把，总预算 2,400 元，20 天内完成交付即可，不是加急单。\n款式沿用公司目录，旧椅已登记报废。\n陈可\n综合管理部'),
    ('power', '唐宇 <tang.yu@example.com>', '测试台电源备件，请优先安排',
     '采购老师好：\n老化测试台有两路电源不稳定，维修需要工业电源 24V 10A 共 8 台，预算 700 元，希望 3 天内送到设备间。\n接线端子和安装孔位必须与现有目录型号一致。到货先联系我，不要直接放公共收货区。\n唐宇 / 测试工程'),
    ('whiteboard', '何蕾 <he.lei@example.com>', '培训教室白板采购',
     '您好，申请白板 120x90 共 4 块，用于培训教室分组讨论，总预算 400 元。30 天内送到就可以，不影响本周培训。\n请使用物料库中的标准款，验收时我们会检查边框和书写面。\n何蕾｜培训运营'),
    ('chair_budget', '宋明 <song.ming@example.com>', '临时项目室办公椅采购申请',
     '采购组好，\n临时项目室需要人体工学办公椅 10 把，部门这次能批出的总预算只有 2,000 元，要求 15 天内到货。\n我知道上次采购价格可能偏高，先按这个预算核一下；如果不够，请明确差额，我再找负责人追加。不要在未确认前超预算下单。\n宋明'),
    ('steel_budget', '刘洋 <liu.yang@example.com>', '工装试制用钢板，先核一下预算',
     '小陈你好，\n工装组需要冷轧钢板 2mm，数量 100 张，费用额度暂定 3,000 元，预计 10 天内用料。型号按现有目录。\n这是项目当前剩余额度，如果目录价已经超过额度，麻烦退回给我调整申请。\n刘洋｜工装工程'),
    ('desk_budget', '郭欣 <guo.xin@example.com>', '新会议区升降桌采购额度确认',
     '采购同事：\n申请 120cm 升降桌 5 张，总预算 1,800 元，交付时间为收到申请后 25 天内。\n预算是本次五张桌子的总额，不是单张价格。若无法覆盖请先反馈，我们可以重新讨论数量。\n郭欣\n行政事务'),
    ('capacity', '马骏 <ma.jun@example.com>', '季度劳保集中采购计划，请先评估入库',
     '采购与仓储同事好，\n季度计划拟一次采购防割手套包 6,000 包，总预算 180,000 元，要求 45 天内集中到货。\n几个班组把需求合并报上来了，还没和仓库核对存放空间。请先检查采购额度与入库容量；如有冲突，先不要下单，我们再拆分计划。\n马骏｜生产计划'),
    ('policy', '方婷 <fang.ting@example.com>', '办公区改造：升降桌集中采购需求',
     '采购部：\n办公区改造计划采购 120cm 升降桌 250 张，总预算 130,000 元，希望 60 天内完成交付。\n这是整个项目的一次性申请，尚未拆成分批采购单。请先核对是否需要走更高额度审批，确认后再安排。\n方婷\n设施管理'),
    ('missing_budget', '郑磊 <zheng.lei@example.com>', '新增工位的文件柜，预算还在确认',
     '你好，\n新工位需要四斗文件柜 8 个，最好 20 天内到货。型号就用目录里现有的。\n预算金额还在等财务确认，这封先把物料和数量同步给你，等额度确定我再补申请。\n郑磊｜行政'),
    ('missing_budget_power', '罗杰 <luo.jie@example.com>', '实验台电源更换需求',
     '采购同事好，实验台计划更换工业电源 24V 10A，数量 6 台，希望两周内到货。\n本次费用归哪个项目、可以用多少预算还没有定，请先记录需求，暂时不要下单。我确认后再补充。\n罗杰 / 实验室'),
    ('unknown', '孟倩 <meng.qian@example.com>', '视觉检测设备询采申请',
     '采购组好，\n试验线想采购桌面式激光轮廓扫描仪 LQ-900 一台，预算 38,000 元，计划 30 天内交付。\n这是新设备，以前没有买过，目录里可能还没有。若需要先建物料档案，请告知需要补哪些技术参数。\n孟倩｜质量工程'),
    ('notice', '沈佳 <shen.jia@example.com>', '周五仓库盘点，暂停普通物料领用',
     '各位同事：\n本周五下午仓库进行月末盘点，普通物料领用暂停半天，紧急维修领料请直接联系值班人员。已预约的到货仍由收货区接收。\n本邮件为作业安排通知，无需创建采购申请。\n沈佳\n仓储管理'),
    ('revised', '赵航 <zhao.hang@example.com>', '包装耗材数量已核对，以本次申请为准',
     '采购同事，\n刚和发货组核对完，之前讨论的补货计划没有提交订单。这次正式申请瓦楞纸箱 50 只装，共 18 包，总预算 1,000 元，9 天内到货。\n本次只按这封邮件里的数量申请，其他规格仍使用仓库余量，不要额外追加。谢谢。\n赵航｜仓储物流'),
]


def seed(db_path):
    conn = sqlite3.connect(db_path)
    now = datetime.now(timezone.utc)
    with conn:
        for index, (key, sender, subject, body) in enumerate(EMAILS):
            conn.execute(
                'INSERT OR IGNORE INTO emails (id,subject,sender,date,body,folder) VALUES (?,?,?,?,?,?)',
                (f'interview-v1-{key}', subject, sender,
                 (now - timedelta(hours=index * 3 + 1)).isoformat(), body, 'inbox'))
    added = conn.total_changes
    conn.close()
    return added


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True)
    args = parser.parse_args()
    print(f'Inserted {seed(args.db)} messages; existing messages preserved.')
