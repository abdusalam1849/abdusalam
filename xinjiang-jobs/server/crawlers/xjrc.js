// server/crawlers/xjrc.js
// 新疆人才网（www.xjhr.com）真实抓取 — 基于真实页面结构适配
//
// 真实 URL 规律（2026 年 9 月实测）：
//   - 职位列表入口：/jobbak/c{cityCode}j{jobTypeCode}t{welfareCode}y{page}/
//       · c4000 = 新疆维吾尔自治区
//       · j0 = 不限职位类型；j7400 = 前端开发；j5100 = 公务员/事业单位
//       · t0 = 不限福利；t1 = 企业年金；t15 = 周末双休 ...
//       · y1/p2/ 表示 y1 视图下第 2 页
//   - 职位详情：/zhaopin/job_{jobId}.html
//   - 企业主页：/zhaopin/{companyId}.html
//
// 列表页每条职位 4 个字段（按 <li> 顺序）：
//   1. 职位名 + 详情链接
//   2. 公司名 + 公司主页链接
//   3. 薪资（如 "5.0K-8.0K"）
//   4. 刷新时间（如 "50分钟内"、"2026-10-09"）
//
// 详情页字段：
//   - 职位名（面包屑最后一项）
//   - 公司名（链接到 /zhaopin/{id}.html）
//   - 薪资
//   - 福利标签（*餐补* *五险* *住房公积金*）
//   - 学历/经验："大专 / 经验不限"
//   - 地点："乌鲁木齐市*(详细地址)*" — 隐藏的真实地址在 *...* 内
//   - 招聘人数：「招聘若干人」
//   - 职位描述：在「职位描述」之后
//
// 因 WebFetch 返回 markdown 不含真实 HTML class，本爬虫用以下双重保险解析：
//   1) 主路径：基于 URL 正则（/zhaopin/job_\d+\.html）+ 邻近文本提取字段
//   2) 辅路径：多组 cheerio 选择器容错（站点改版时尽量命中）
//
// 沙箱环境因新疆本地站对沙箱 IP 不可达，会返回 0 条并打印警告，不抛错。
// 部署到国内服务器后即可正常抓取。

const cheerio = require('cheerio');
const BaseCrawler = require('./base');

// 新疆职位分类代码（用于按类型抓取，j0 表示全部）
const JOB_TYPES = [
  { code: 0,    name: '不限' },
  { code: 7400, name: '前端开发' },
  { code: 7500, name: '移动研发' },
  { code: 7600, name: '测试工程师' },
  { code: 1900, name: '行政/文员' },
  { code: 1300, name: '财务/审计/税务' },
  { code: 2200, name: '教育/培训' },
  { code: 2400, name: '医疗/医药' },
  { code: 5100, name: '公务员/事业单位/科研' },
  { code: 2800, name: '百货零售' },
  { code: 3600, name: '技工/普工' },
  { code: 6100, name: '交通运输' }
];

// 城市代码（新疆维吾尔自治区 = 4000）
const CITY_CODE_XJ = 4000;

// 把 "大专 / 经验不限" 拆成 { education, experience }
function parseEduExp(text) {
  const out = { education: '', experience: '' };
  if (!text) return out;
  const parts = text.split('/').map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (/不限|大专|本科|硕士|博士|高中|中专|初中/.test(p)) out.education = p;
    else if (/经验|应届|不限/.test(p)) out.experience = p;
  }
  return out;
}

// 把 "乌鲁木齐市*(乌鲁木齐新市区苏州东街650号招商银行苏州路支行)*" 拆成 { city, district, address }
function parseLocation(text) {
  const out = { city: '', district: '', address: '' };
  if (!text) return out;
  // 隐藏地址在 *...* 中，去掉外层括号
  const m = text.match(/\*\(?([^*)]+)\)?\*/);
  if (m) out.address = m[1].trim();
  // 显式城市：xxx市 后跟可能 district
  const clean = text.replace(/\*[^*]+\*/, '').trim();
  const cm = clean.match(/^([^\s市]+市)([^\s（]*)/);
  if (cm) {
    out.city = cm[1];
    out.district = cm[2] || '';
  } else if (clean) {
    out.city = clean;
  }
  return out;
}

// 把 "招聘若干人" / "招2人" 解析为数字（0 表示若干）
function parseHeadcount(text) {
  if (!text) return 0;
  if (/若干|不限/.test(text)) return 0;
  const m = text.match(/(\d+)\s*人/);
  return m ? parseInt(m[1]) : 0;
}

// 把 "4小时内" / "50分钟内" / "2026-10-09" 解析为相对时间戳
function parseRefreshTime(text, fetchedAt) {
  if (!text || !fetchedAt) return 0;
  const now = fetchedAt;
  if (/(\d+)\s*秒内/.test(text)) return now - parseInt(RegExp.$1) * 1000;
  if (/(\d+)\s*分钟内/.test(text)) return now - parseInt(RegExp.$1) * 60000;
  if (/(\d+)\s*小时内/.test(text)) return now - parseInt(RegExp.$1) * 3600000;
  if (/(\d+)\s*天内/.test(text)) return now - parseInt(RegExp.$1) * 86400000;
  // 日期：2026-10-09
  const m = text.match(/(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T09:00:00+08:00`).getTime();
  return 0;
}

class XjrcCrawler extends BaseCrawler {
  constructor() {
    super('xjrc', { maxConcurrent: 4, maxRetries: 2, timeout: 10000 });
    // 默认抓取配置（可通过环境变量调整）
    this.maxPages = parseInt(process.env.XJRC_MAX_PAGES || '3');     // 每个职位类型抓前 N 页
    this.jobTypes = process.env.XJRC_JOB_TYPES
      ? process.env.XJRC_JOB_TYPES.split(',').map(s => parseInt(s))
      : JOB_TYPES.map(t => t.code);
    this.fetchDetail = process.env.XJRC_FETCH_DETAIL !== 'false';    // 是否抓详情页
    this.detailLimit = parseInt(process.env.XJRC_DETAIL_LIMIT || '30'); // 详情页抓取上限（每次批次）
  }

  // 列表页 URL
  buildListUrl(jobTypeCode, page) {
    const j = jobTypeCode || 0;
    return `https://www.xjhr.com/jobbak/c${CITY_CODE_XJ}j${j}t0y1/p${page}/`;
  }

  // 详情页 URL
  buildDetailUrl(jobId) {
    return `https://www.xjhr.com/zhaopin/job_${jobId}.html`;
  }

  async fetch() {
    const all = [];

    // 1) 主路径：抓取列表页（按职位类型循环）
    let listOkCount = 0;
    for (const jobType of this.jobTypes) {
      for (let page = 1; page <= this.maxPages; page++) {
        const list = await this.fetchListPage(jobType, page);
        if (!list.length) break;  // 该类型无更多职位，跳到下一类型
        listOkCount += list.length;
        all.push(...list);
      }
    }

    // 2) 补充路径：从首页推荐企业入口抓取（沙箱/风控下列表页不通时启用）
    if (listOkCount === 0) {
      console.log('[xjrc] 列表页无数据，尝试首页推荐企业入口...');
      const homeJobs = await this.fetchFromHomepage();
      all.push(...homeJobs);
    }

    // 3) 去重（同一 jobId 在多入口下出现）
    const seen = new Set();
    const unique = all.filter(j => {
      if (seen.has(j.source_id)) return false;
      seen.add(j.source_id);
      return true;
    });

    // 4) 可选：抓取详情页补充字段
    if (this.fetchDetail && unique.length) {
      const toFetch = unique.slice(0, this.detailLimit);
      console.log(`[xjrc] 抓取 ${toFetch.length} 个职位详情...`);
      const results = await this.mapConcurrent(toFetch, this.maxConcurrent, j => this.fetchDetailPage(j));
      let okCount = 0;
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) okCount++;
      }
      console.log(`[xjrc] 详情抓取完成，成功 ${okCount}/${toFetch.length}`);
    }

    if (unique.length === 0) {
      console.warn('[xjrc] 抓取 0 条（沙箱/海外 IP 通常无法访问新疆本地招聘网，部署到国内服务器即可生效）');
    }

    return unique;
  }

  // 备用入口：从首页推荐企业列表抓取
  // 首页有「头条招聘」「最新招聘」版块，含企业名 + 企业主页链接 /zhaopin/{id}.html
  async fetchFromHomepage() {
    const url = 'https://www.xjhr.com/';
    let html;
    try {
      const res = await this.get(url);
      html = res.data;
    } catch (e) {
      return [];
    }
    if (!html || html.length < 500) return [];

    const $ = cheerio.load(html);
    const companies = [];
    // 找所有企业链接 /zhaopin/{companyId}.html（非职位链接 job_xxx）
    $('a[href]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const m = href.match(/\/zhaopin\/(\d+)\.html$/);
      if (m && !/\/zhaopin\/job_/.test(href)) {
        // 只取 <a> 的第一个文本节点（避免拼上"10～50人|行业"等附加信息）
        const firstText = $a.contents().filter(function() { return this.type === 'text'; }).first().text().trim();
        // 兜底：若没有独立 text 节点，用 text() 后按 | 截断
        const name = firstText || $a.text().trim().split(/\||\d+～\d+人/)[0].trim();
        if (name && name.length >= 4 && !/^\d/.test(name)) {
          companies.push({ id: m[1], name, url: 'https://www.xjhr.com' + href });
        }
      }
    });

    // 去重 + 限并发抓企业主页的「招聘职位」列表
    const seen = new Set();
    const unique = companies.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, 15);  // 首页推荐企业数有限，限 15 个

    console.log(`[xjrc] 首页发现 ${unique.length} 家推荐企业，抓取其招聘职位...`);
    const allJobs = [];
    const results = await this.mapConcurrent(unique, 3, c => this.fetchCompanyJobs(c));
    for (const r of results) {
      if (r.status === 'fulfilled') allJobs.push(...r.value);
    }
    return allJobs;
  }

  // 抓企业主页的招聘职位列表 /zhaopin/jobs_{companyId}.html
  async fetchCompanyJobs(company) {
    const url = `https://www.xjhr.com/zhaopin/jobs_${company.id}.html`;
    let html;
    try {
      const res = await this.get(url);
      html = res.data;
    } catch (e) {
      return [];
    }
    if (!html) return [];

    const $ = cheerio.load(html);
    const list = [];
    const fetchedAt = Date.now();
    const seen = new Set();

    // 真实结构：每条职位有详情链接 /zhaopin/job_{jobId}.html
    // 位置：职位名链接 + 邻近的薪资/学历/地点文本（在同一列表项内）
    $('a[href*="/zhaopin/job_"]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const m = href.match(/\/zhaopin\/job_(\d+)\.html/);
      if (!m) return;
      if (seen.has(m[1])) return;
      seen.add(m[1]);

      // 只取 <a> 的第一个文本节点（避免把同级嵌入的"59分钟内"等附加文本拼到标题）
      const firstText = $a.contents().filter(function() { return this.type === 'text'; }).first().text().trim();
      // 兜底：从完整 text 按 K/面议/分钟/日期 等标记截断
      const fallback = $a.text().trim().split(/\d+(?:\.\d+)?K|面议|分钟内|小时内|天内|20\d{2}-/)[0].trim();
      let title = firstText || fallback;

      // 清理标题末尾混入的浏览数/时间数字残留（"安装售后维修师傅59" → "安装售后维修师傅"）
      title = title.replace(/\d{1,4}$/, '').trim();
      // 清理末尾的 "59分钟内" 类残留
      title = title.replace(/\d+\s*(秒|分钟|小时|天)内$/, '').trim();

      if (!title || title.length < 2) return;

      // 找薪资/学历/地点：在 a 的兄弟节点或父列表项内
      const $row = $a.closest('li, tr, div').length ? $a.closest('li, tr, div') : $a.parent();
      const rowText = $row.text();
      const salaryMatch = rowText.match(/\d+(?:\.\d+)?K[-~]\d+(?:\.\d+)?K|面议/);
      const eduMatch = rowText.match(/(不限|大专|本科|硕士|博士|高中|中专|初中)/);
      const refreshMatch = rowText.match(/\d+\s*(秒|分钟|小时|天)内|20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}/);
      const locMatch = rowText.match(/([\u4e00-\u9fa5]{2,8}市[\u4e00-\u9fa5（）\(\)]*)/);

      list.push({
        title,
        company: company.name,
        salary: salaryMatch ? salaryMatch[0] : '',
        city: locMatch ? locMatch[1] : '新疆',
        education: eduMatch ? eduMatch[1] : '',
        experience: '',
        job_type: '全职',
        welfare: [],
        description: '',
        url: 'https://www.xjhr.com' + href,
        source_id: 'job_' + m[1],
        publish_time: refreshMatch ? refreshMatch[0] : '',
        created_at: parseRefreshTime(refreshMatch ? refreshMatch[0] : '', fetchedAt) || fetchedAt
      });
    });
    return list;
  }

  // 抓单页列表，返回职位数组（仅基础字段）
  async fetchListPage(jobTypeCode, page) {
    const url = this.buildListUrl(jobTypeCode, page);
    let html;
    try {
      const res = await this.get(url);
      html = res.data;
    } catch (e) {
      return [];
    }
    if (!html || html.length < 200) return [];

    const fetchedAt = Date.now();
    return this.parseListHtml(html, fetchedAt, jobTypeCode);
  }

  // 解析列表页 HTML：基于真实结构（每条职位 4 个连续 <li>）
  parseListHtml(html, fetchedAt, jobTypeCode) {
    const $ = cheerio.load(html);
    const list = [];

    // 主路径：找到所有职位链接 /zhaopin/job_\d+\.html
    const jobLinks = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/\/zhaopin\/job_(\d+)\.html/);
      if (m) {
        const title = $(el).text().trim();
        if (title && title.length >= 2) {
          jobLinks.push({ jobId: m[1], title, url: 'https://www.xjhr.com' + href, el: $(el) });
        }
      }
    });

    // 去重同一 jobId（页面常重复出现）
    const seen = new Set();
    for (const jl of jobLinks) {
      if (seen.has(jl.jobId)) continue;
      seen.add(jl.jobId);

      // 从该链接的邻近元素（同一行/分组）提取公司/薪资/时间
      // 公司：找 href 匹配 /zhaopin/{companyId}.html 的 <a>（非职位链接）
      const company = this.findNearHref($, jl.el, /\/zhaopin\/(\d+)\.html/);
      // 薪资/时间：按文本内容查找
      const salary = this.findNearText($, jl.el, /\d+(\.\d+)?K[-~]\d+(\.\d+)?K|面议/);
      const refresh = this.findNearText($, jl.el, /\d+\s*(秒|分钟|小时|天)内|20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}/);

      list.push({
        title: jl.title,
        company: company.text || '',
        salary: salary.text || '',
        city: '新疆',  // 列表页只到省级，详情页再补具体市/区
        education: '',
        experience: '',
        job_type: this.jobTypeName(jobTypeCode),
        welfare: [],
        description: '',
        url: jl.url,
        source_id: 'job_' + jl.jobId,
        publish_time: refresh.text || '',
        created_at: parseRefreshTime(refresh.text, fetchedAt) || fetchedAt
      });
    }

    return list;
  }

  // 在元素邻近节点中查找匹配某个 href 模式的 <a>（用于公司链接）
  findNearHref($, $el, pattern) {
    const excludeHref = $el.attr('href') || '';
    const tryContainer = ($c) => {
      let result = '';
      $c.find('a').each((_, el) => {
        if (result) return;
        const $a = $(el);
        const href = $a.attr('href') || '';
        // 跳过职位链接本身
        if (href === excludeHref) return;
        // 跳过职位链接（j{jobId}.html）
        if (/\/zhaopin\/job_\d+\.html/.test(href)) return;
        // 公司链接：/zhaopin/{companyId}.html
        if (pattern.test(href)) {
          const text = $a.text().trim();
          if (text) result = text;
        }
      });
      return result;
    };
    // 1) 列表容器
    const $container = $el.closest('ul, table, tbody, .list, .job-list, .search-list');
    if ($container.length) {
      const found = tryContainer($container);
      if (found) return { text: found };
    }
    // 2) 父级兜底
    const $parent = $el.parent().parent().parent();
    if ($parent.length) {
      const found = tryContainer($parent);
      if (found) return { text: found };
    }
    return { text: '' };
  }

  // 在元素邻近节点中查找匹配某个文本模式的内容（用于薪资/时间）
  findNearText($, $el, pattern) {
    const excludeHref = $el.attr('href') || '';
    const tryContainer = ($c) => {
      let result = '';
      $c.find('li, td, div, span, p, a').each((_, el) => {
        if (result) return;
        const $e = $(el);
        // 跳过含职位链接或公司链接的容器（其 text 会带链接名，污染结果）
        if ($e.children('a').length) return;
        const href = $e.attr('href') || '';
        if (href) return;  // 跳过任何 <a>（其 text 是链接名）
        const text = $e.text().trim();
        if (text && pattern.test(text)) {
          result = text;
        }
      });
      return result;
    };
    const $container = $el.closest('ul, table, tbody, .list, .job-list, .search-list');
    if ($container.length) {
      const found = tryContainer($container);
      if (found) return { text: found };
    }
    const $parent = $el.parent().parent().parent();
    if ($parent.length) {
      const found = tryContainer($parent);
      if (found) return { text: found };
    }
    return { text: '' };
  }

  jobTypeName(code) {
    const t = JOB_TYPES.find(t => t.code === code);
    return t ? t.name : '全职';
  }

  // 抓详情页：补充学历/经验/地点/福利/描述
  async fetchDetailPage(job) {
    const url = job.url;
    if (!url) return null;
    let html;
    try {
      const res = await this.get(url);
      html = res.data;
    } catch (e) {
      return null;
    }
    if (!html || html.length < 500) return null;

    const $ = cheerio.load(html);
    const detail = this.parseDetailHtml($, html);
    // 合并到 job 对象（in-place 更新）
    if (detail.education) job.education = detail.education;
    if (detail.experience) job.experience = detail.experience;
    if (detail.city) job.city = detail.city;
    if (detail.district) job.district = detail.district;
    if (detail.address) job.address = detail.address;
    if (detail.welfare && detail.welfare.length) job.welfare = detail.welfare;
    if (detail.description) job.description = detail.description;
    if (detail.headcount) job.headcount = detail.headcount;
    if (detail.publish_time && !job.publish_time) job.publish_time = detail.publish_time;
    return job;
  }

  // 解析详情页
  parseDetailHtml($, html) {
    const out = { welfare: [] };

    // 福利标签：*餐补* *五险* 这种 *xxx* 模式
    const welfareMatches = html.match(/\*([^*]{2,12})\*/g) || [];
    out.welfare = welfareMatches
      .map(m => m.replace(/\*/g, '').trim())
      .filter(w => !/公司|浏览|申请|评价|简介|主页|招聘职位|动态|描述/.test(w))
      .slice(0, 12);

    // 学历/经验："大专 / 经验不限"
    const eduExpMatch = html.match(/(不限|大专|本科|硕士|博士|高中|中专|初中)\s*\/\s*([^<*\n]{2,15})/);
    if (eduExpMatch) {
      out.education = eduExpMatch[1].trim();
      out.experience = eduExpMatch[2].replace(/\s+/g, '').trim();
    }

    // 地点："乌鲁木齐市*(乌鲁木齐新市区苏州东街650号)*"
    const locMatch = html.match(/([\u4e00-\u9fa5]{2,8}市[\u4e00-\u9fa5（）\(\)]*)\*?\(?([^*）\n]*)\)?\*?/);
    if (locMatch) {
      const loc = parseLocation(locMatch[0]);
      out.city = loc.city;
      out.district = loc.district;
      out.address = loc.address;
    }

    // 招聘人数：「招聘若干人」/ 「招2人」
    const headMatch = html.match(/招(?:聘)?(\d+|若干)人/);
    if (headMatch) out.headcount = parseHeadcount(headMatch[0]);

    // 职位描述：在「职位描述」之后到下一个二级标题之前的文本
    const descMatch = html.match(/职位描述[\s\S]{0,2000}?((?:[\s\S]+?))(?=职位动态|面试评价|公司简介|岗位要求|还没有人对|$)/);
    if (descMatch) {
      out.description = descMatch[1]
        .replace(/<[^>]+>/g, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 1500);
    }

    return out;
  }
}

module.exports = XjrcCrawler;
