// server/crawlers/demo.js
// 本地演示数据爬虫：无网络依赖，直接返回若干新疆本地示例岗位
// 用于在没有公网/源站封禁时也能跑通整条链路

const BaseCrawler = require('./base');

class DemoCrawler extends BaseCrawler {
  constructor() { super('demo'); }

  async fetch() {
    const now = new Date().toISOString().slice(0, 16);
    return [
      {
        title: '初级前端工程师',
        company: '乌鲁木齐云图科技',
        salary: '6-9K',
        city: '乌鲁木齐', district: '高新区',
        education: '大专', experience: '1-3年',
        job_type: '全职',
        welfare: ['五险一金', '双休', '餐补', '交通补贴'],
        description: '负责小程序、H5 端开发，熟悉 Vue/React。'},
      {
        title: '会计（含周末）',
        company: '伊犁宏源贸易',
        salary: '4-6K',
        city: '伊犁', district: '伊宁市',
        education: '本科', experience: '3-5年',
        job_type: '全职',
        welfare: ['五险一金', '节日福利'],
        description: '负责公司全盘账务处理与税务申报。',
        phone: '0991-6600123'
      },
      {
        title: '高中数学教师',
        company: '喀什市第一中学',
        salary: '5-8K',
        city: '喀什', district: '喀什市',
        education: '本科', experience: '不限',
        job_type: '全职',
        welfare: ['寒暑假', '编制', '住房补贴'],
        description: '承担高中数学教学任务，参与学科组教研。'},
      {
        title: '医院导诊（实习）',
        company: '阿克苏地区人民医院',
        salary: '2-3K',
        city: '阿克苏', district: '阿克苏市',
        education: '中专', experience: '应届',
        job_type: '实习',
        welfare: ['实习证明', '工作餐'],
        description: '门诊大厅引导患者就诊，分诊登记。'},
      {
        title: '长途货运司机',
        company: '哈密鸿运物流',
        salary: '8-12K',
        city: '哈密', district: '伊州区',
        education: '不限', experience: '3年以上',
        job_type: '全职',
        welfare: ['包住', '出差补贴'],
        description: '持有 B2/A2 驾照，负责疆内货运配送。',
        phone: '0902-2288001'
      },
      {
        title: '电商运营专员',
        company: '和田玫瑰花电商',
        salary: '4-7K',
        city: '和田', district: '和田市',
        education: '大专', experience: '1-3年',
        job_type: '全职',
        welfare: ['五险', '提成', '直播奖金'],
        description: '负责店铺日常运营、活动报名、直播带货策划。',
        publish_time: now
      },
      {
        title: '社区网格员',
        company: '昌吉州建国路街道',
        salary: '3-4K',
        city: '昌吉', district: '昌吉市',
        education: '高中', experience: '不限',
        job_type: '全职',
        welfare: ['社保', '年终奖'],
        description: '辖区信息采集、政策宣传、矛盾调解。'},
      {
        title: '数据库 DBA',
        company: '克拉玛依油田信息中心',
        salary: '12-18K',
        city: '克拉玛依', district: '克拉玛依区',
        education: '本科', experience: '5-10年',
        job_type: '全职',
        welfare: ['六险二金', '补充医疗', '带薪年假'],
        description: '维护生产环境 Oracle/PG 数据库，性能优化与备份。',
        publish_time: now
      }
    ].map(j => ({
      ...j,
      publish_time: j.publish_time || now,
      source_id: (j.company + '_' + j.title).slice(0, 60),
      url: ''
    }));
  }
}

module.exports = DemoCrawler;
