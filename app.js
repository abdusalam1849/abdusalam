/**
 * 乌鲁木齐市货车限行地图 - 主应用
 */

(function () {
  'use strict';

  const { center, zones, roads, corridors, isInRestrictedPeriod } = window.URUMQI_DATA;

  // ========== 状态管理 ==========
  const state = {
    vehicleType: 'heavy', // heavy | medium | light | all
    currentTime: 480, // 当前时间（分钟数），默认 08:00
    zoneLayers: {}, // 存储图层引用
    roadLayers: [],
    corridorLayers: [],
    boundaryLayers: [],
    map: null
  };

  // ========== 初始化地图 ==========
  function initMap() {
    state.map = L.map('map', {
      center: center,
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    // 使用高德地图瓦片（国内访问更快）
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 19,
      zoomControl: false
    }).addTo(state.map);

    // 添加缩放控件到右上角
    L.control.zoom({ position: 'topright' }).addTo(state.map);

    // 添加比例尺
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(state.map);

    // 初始绘制所有图层
    drawZones();
    drawCorridors();
    drawBoundaryRoads();

    // 更新显示
    updateDisplay();
  }

  // ========== 绘制限行区域 ==========
  function drawZones() {
    // 清除已有图层
    Object.values(state.zoneLayers).forEach(layer => {
      state.map.removeLayer(layer);
    });
    state.zoneLayers = {};

    // 根据当前筛选条件过滤区域
    const filteredZones = zones.filter(zone => {
      if (state.vehicleType === 'all') return true;
      return zone.vehicleType === state.vehicleType;
    });

    filteredZones.forEach(zone => {
      const timeCheck = isInRestrictedPeriod(state.currentTime, zone.timeRule, zone.vehicleType);
      const fillColor = timeCheck.restricted ? zone.color : '#8bc34a';
      const fillOpacity = timeCheck.restricted ? zone.fillOpacity : 0.12;
      const borderColor = timeCheck.restricted ? zone.color : '#4caf50';

      const polygon = L.polygon(zone.polygon, {
        color: borderColor,
        weight: 2,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        dashArray: timeCheck.restricted ? null : '8, 8'
      });

      // 添加弹窗
      polygon.bindPopup(createPopupContent(zone, timeCheck), {
        maxWidth: 320,
        minWidth: 260
      });

      // 添加到地图
      state.zoneLayers[zone.id] = polygon.addTo(state.map);
    });

    // 绘制限行路段
    drawRoads();
  }

  function drawRoads() {
    // 清除已有路段
    state.roadLayers.forEach(layer => state.map.removeLayer(layer));
    state.roadLayers = [];

    if (state.vehicleType !== 'all' && state.vehicleType !== 'light') return;

    roads.forEach(roadGroup => {
      roadGroup.roads.forEach(road => {
        const timeCheck = isInRestrictedPeriod(state.currentTime, roadGroup.timeRule, 'light');
        const color = timeCheck.restricted ? roadGroup.color : '#8bc34a';
        const weight = timeCheck.restricted ? 5 : 3;
        const opacity = timeCheck.restricted ? 0.9 : 0.4;

        const polyline = L.polyline(road.path, {
          color: color,
          weight: weight,
          opacity: opacity,
          lineCap: 'round',
          lineJoin: 'round'
        });

        polyline.bindPopup(`
          <div class="popup-title">🛣️ ${road.name}</div>
          <div class="popup-desc">轻型及以下货车限行路段</div>
          <div class="popup-time ${timeCheck.restricted ? 'restricted' : 'allowed'}">
            ${timeCheck.restricted ? '⛔ 当前限行中' : '✅ 当前允许通行'}
          </div>
        `);

        state.roadLayers.push(polyline.addTo(state.map));
      });
    });
  }

  function drawCorridors() {
    state.corridorLayers.forEach(layer => state.map.removeLayer(layer));
    state.corridorLayers = [];

    if (state.vehicleType !== 'all' && state.vehicleType !== 'heavy') return;

    corridors.forEach(corridor => {
      const timeCheck = isInRestrictedPeriod(state.currentTime, corridor.timeRule, 'heavy');
      const color = timeCheck.restricted ? '#f44336' : '#4caf50';

      const polyline = L.polyline(corridor.path, {
        color: color,
        weight: 6,
        opacity: 0.85,
        dashArray: timeCheck.restricted ? null : '10, 6',
        lineCap: 'round',
        lineJoin: 'round'
      });

      polyline.bindPopup(`
        <div class="popup-title">🚛 ${corridor.name}</div>
        <div class="popup-desc">${corridor.description}</div>
        <div style="margin-top:6px;font-size:12px;color:#666;">${corridor.timeRule}</div>
        <div class="popup-time ${timeCheck.restricted ? 'restricted' : 'allowed'}" style="margin-top:8px;">
          ${timeCheck.restricted ? '⛔ 当前限行' : '✅ 当前允许通行'}
        </div>
      `);

      state.corridorLayers.push(polyline.addTo(state.map));
    });
  }

  function drawBoundaryRoads() {
    state.boundaryLayers.forEach(layer => state.map.removeLayer(layer));
    state.boundaryLayers = [];

    if (state.vehicleType !== 'all' && state.vehicleType !== 'heavy') return;

    BOUNDARY_ROADS.forEach(road => {
      const timeCheck = isInRestrictedPeriod(state.currentTime, road.timeRule, 'heavy');
      let color = '#4caf50';
      let label = '✅ 不限行';

      if (road.timeRule.includes('全天不限行')) {
        color = '#2196f3';
        label = '✅ 全天不限行';
      } else if (timeCheck.restricted) {
        color = '#ff9800';
        label = '⛔ 当前限行';
      }

      const polyline = L.polyline(road.points, {
        color: color,
        weight: 4,
        opacity: 0.7,
        dashArray: '4, 4'
      });

      polyline.bindPopup(`
        <div class="popup-title">📍 ${road.name}</div>
        <div class="popup-desc">边界道路限行措施</div>
        <div class="popup-time ${timeCheck.restricted ? 'restricted' : 'allowed'}" style="margin-top:6px;">
          ${label}
        </div>
      `);

      state.boundaryLayers.push(polyline.addTo(state.map));
    });
  }

  // ========== 创建弹窗内容 ==========
  function createPopupContent(zone, timeCheck) {
    let statusHtml = timeCheck.restricted
      ? `<div class="popup-time restricted">⛔ 当前限行中</div>`
      : `<div class="popup-time allowed">✅ 当前允许通行</div>`;

    return `
      <div class="popup-title">📍 ${zone.name}</div>
      <div class="popup-desc">${zone.timeRule}</div>
      ${statusHtml}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #eee;">
        <div style="font-size:11px;color:#888;margin-bottom:4px;">边界道路：</div>
        <div style="font-size:12px;color:#555;line-height:1.5;">${zone.description}</div>
      </div>
    `;
  }

  // ========== 更新显示 ==========
  function updateDisplay() {
    // 重新绘制图层
    drawZones();
    drawCorridors();
    drawBoundaryRoads();

    // 更新时间显示
    const hours = Math.floor(state.currentTime / 60);
    const minutes = state.currentTime % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    document.getElementById('timeDisplay').textContent = timeStr;

    // 更新状态条
    const vehicleNames = { heavy: '重型货车', medium: '中型货车', light: '轻型及以下', all: '全部车辆' };
    document.getElementById('currentStatus').textContent =
      `显示中：${vehicleNames[state.vehicleType]} · ${timeStr}`;

    // 更新区域列表
    updateZoneList();

    // 更新规则摘要
    updateRuleSummary();

    // 更新计数
    const totalZones = zones.filter(z =>
      state.vehicleType === 'all' || z.vehicleType === state.vehicleType
    ).length;
    document.getElementById('zoneCount').textContent = `共加载 ${totalZones} 个区域`;
  }

  // ========== 更新区域列表 ==========
  function updateZoneList() {
    const container = document.getElementById('zoneList');
    container.innerHTML = '';

    const filteredZones = zones.filter(zone => {
      if (state.vehicleType === 'all') return true;
      return zone.vehicleType === state.vehicleType;
    });

    const filteredRoads = roads.filter(road => {
      if (state.vehicleType === 'all') return true;
      return road.vehicleType === state.vehicleType;
    });

    const allItems = [
      ...filteredZones.map(z => ({ ...z, isZone: true })),
      ...filteredRoads.map(r => ({ ...r, id: r.id, isZone: false, name: r.name, timeRule: r.timeRule, tagClass: r.tagClass }))
    ];

    allItems.forEach(item => {
      const timeCheck = isInRestrictedPeriod(state.currentTime, item.timeRule, item.vehicleType || 'light');
      const isRestricted = timeCheck.restricted;

      const div = document.createElement('div');
      div.className = 'zone-item';
      div.innerHTML = `
        <input type="checkbox" ${isRestricted ? 'checked' : ''} disabled>
        <div class="zone-info">
          <div class="zone-name">
            ${item.name}
            <span class="zone-tag ${item.tagClass}">${isRestricted ? '限行' : '允许'}</span>
          </div>
          <div class="zone-time">${item.timeRule}</div>
        </div>
      `;

      div.addEventListener('click', () => {
        // 找到对应的图层并触发弹窗
        const layer = state.zoneLayers[item.id] ||
          state.roadLayers.find(l => l && l._popup) ||
          state.corridorLayers.find(l => l && l._popup);
        if (layer) {
          state.map.fitBounds(layer.getBounds(), { padding: [50, 50] });
          layer.openPopup();
        }
      });

      container.appendChild(div);
    });
  }

  // ========== 更新规则摘要 ==========
  function updateRuleSummary() {
    const container = document.getElementById('ruleContent');
    const vehicleNames = {
      heavy: '重型载货汽车（黄牌大货）',
      medium: '中型载货汽车',
      light: '轻型及以下载货汽车（蓝牌小货）',
      all: '所有载货汽车'
    };

    const rules = {
      heavy: [
        { title: '中心区', desc: '每日 8:00-24:00 限行' },
        { title: '核心区', desc: '全天禁止通行（环路内 0:00-8:00 允许）' },
        { title: '重点道路', desc: '府前路、永祥街、益民街等每日 8:00-24:00 限行' }
      ],
      medium: [
        { title: '限行区域', desc: '与轻型货车限行区域一致' },
        { title: '限行时段', desc: '每日 8:00-24:00 限行' },
        { title: '微型厢式货车', desc: '按轻型货车规定执行' }
      ],
      light: [
        { title: '限行区域', desc: '多边形围合区域' },
        { title: '限行时段', desc: '工作日早晚高峰 8:30-10:30、18:30-20:30' },
        { title: '限行路段', desc: '团结路、中山路等20条道路 8:00-22:00 限行' }
      ],
      all: [
        { title: '新能源车辆', desc: '新能源重型/中型按对应规则，新能源轻型全天不限行' },
        { title: '皮卡车', desc: '多用途货车（皮卡车）全天不限行' },
        { title: '高架道路', desc: '所有载货汽车全天禁止驶入高架' }
      ]
    };

    const currentRules = rules[state.vehicleType] || rules.all;

    container.innerHTML = `
      <div class="rule-title">${vehicleNames[state.vehicleType]}</div>
      ${currentRules.map(r => `
        <div style="margin-top:8px;">
          <strong style="font-size:12px;color:#1a73e8;">${r.title}：</strong>
          <span class="rule-desc">${r.desc}</span>
        </div>
      `).join('')}
    `;
  }

  // ========== 事件绑定 ==========
  function bindEvents() {
    // 车辆类型切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.vehicleType = btn.dataset.vehicle;
        updateDisplay();
      });
    });

    // 时间滑块
    const timeSlider = document.getElementById('timeSlider');
    timeSlider.addEventListener('input', (e) => {
      state.currentTime = parseInt(e.target.value);
      updateDisplay();
    });

    // 快速时间按钮
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const time = parseInt(btn.dataset.time);
        state.currentTime = time;
        document.getElementById('timeSlider').value = time;
        updateDisplay();
      });
    });

    // 重置按钮
    document.getElementById('btnReset').addEventListener('click', () => {
      state.vehicleType = 'heavy';
      state.currentTime = 480;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.vehicle === 'heavy');
      });
      document.getElementById('timeSlider').value = 480;
      updateDisplay();
    });

    // 定位按钮
    document.getElementById('btnLocate').addEventListener('click', () => {
      state.map.setView(center, 12, { animate: true });
    });

    // 移动端面板切换
    const toggleBtn = document.getElementById('togglePanel');
    const filterPanel = document.getElementById('filterPanel');

    toggleBtn.addEventListener('click', () => {
      filterPanel.classList.toggle('open');
    });

    // 移动端点击地图关闭面板
    if (window.innerWidth <= 768) {
      state.map.on('click', () => {
        filterPanel.classList.remove('open');
      });
    }

    // 响应式调整
    window.addEventListener('resize', () => {
      state.map.invalidateSize();
    });
  }

  // ========== 启动应用 ==========
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    bindEvents();

    // 地图加载完成提示
    console.log('✅ 乌鲁木齐市货车限行地图已加载');
    console.log('📍 中心坐标:', center);
    console.log('🚛 限行区域数量:', zones.length);
  });

})();
