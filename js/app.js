/**
 * KRX ETF Intelligence Hub - Main Application Logic
 * Comprehensive Real-time EDA & Interactive Analytics
 */

// Global State
const state = {
  rawItems: [],
  processedItems: [],
  filteredItems: [],
  totalCount: 0,
  updatedAt: null,
  isLiveLoading: false,
  autoRefreshTimer: null,
  currentTab: 'treemap',
  activeTheme: 'dark',
  charts: {},
  sortKey: 'totalNetAssets',
  sortOrder: 'desc',
  page: 1,
  pageSize: 25,
  filters: {
    search: '',
    brands: new Set(),
    categories: new Set(),
    tags: new Set(),
    minAum: 0,
    disparityAlertOnly: false,
    returnPeriod: 'changeRate'
  }
};

// Brand Classification Rules
function getBrandInfo(name) {
  const upper = name.toUpperCase();
  if (upper.startsWith('KODEX')) return { brand: 'KODEX', company: '삼성자산운용', color: '#1e40af' };
  if (upper.startsWith('TIGER')) return { brand: 'TIGER', company: '미래에셋자산운용', color: '#ea580c' };
  if (upper.startsWith('ACE')) return { brand: 'ACE', company: '한국투자신탁운용', color: '#0284c7' };
  if (upper.startsWith('RISE') || upper.startsWith('KBSTAR')) return { brand: 'RISE(KB)', company: 'KB자산운용', color: '#eab308' };
  if (upper.startsWith('PLUS') || upper.startsWith('ARIRANG')) return { brand: 'PLUS(한화)', company: '한화자산운용', color: '#f97316' };
  if (upper.startsWith('SOL')) return { brand: 'SOL', company: '신한자산운용', color: '#2563eb' };
  if (upper.startsWith('TIMEFOLIO')) return { brand: 'TIMEFOLIO', company: '타임폴리오자산운용', color: '#9333ea' };
  if (upper.startsWith('WOORI') || upper.startsWith('WON')) return { brand: 'WOORI', company: '우리자산운용', color: '#0d9488' };
  if (upper.startsWith('KOACT')) return { brand: 'KoAct', company: '삼성액티브자산운용', color: '#3b82f6' };
  if (upper.startsWith('HANARO')) return { brand: 'HANARO', company: 'NH-Amundi자산운용', color: '#16a34a' };
  if (upper.startsWith('KOSEF')) return { brand: 'KOSEF', company: '키움투자자산운용', color: '#dc2626' };
  if (name.startsWith('마이티')) return { brand: '마이티', company: '하나자산운용', color: '#059669' };
  if (upper.startsWith('UNICORN')) return { brand: 'UNICORN', company: '현대자산운용', color: '#d97706' };
  if (upper.startsWith('FOCUS')) return { brand: 'FOCUS', company: '브이아이자산운용', color: '#64748b' };
  if (upper.startsWith('IBK')) return { brand: 'IBK', company: 'IBK자산운용', color: '#4f46e5' };
  return { brand: '기타/중소형', company: '기타 운용사', color: '#6b7280' };
}

// Category and Tag Classification
function categorizeETF(item) {
  const name = item.itemName;
  const rawType = item.etfType || '';
  
  let broadCategory = '국내주식';
  if (rawType.includes('해외주식') || name.includes('미국') || name.includes('차이나') || name.includes('일본') || name.includes('인도') || name.includes('베트남') || name.includes('유럽') || name.includes('글로벌') || name.includes('나스닥') || name.includes('S&P500')) {
    broadCategory = '해외주식';
  } else if (rawType.includes('채권') || name.includes('채권') || name.includes('국고채') || name.includes('회사채') || name.includes('머니마켓') || name.includes('KOFR') || name.includes('CD금리') || name.includes('SOFR')) {
    broadCategory = rawType.includes('해외') ? '해외채권' : '국내채권';
  } else if (rawType.includes('원자재') || rawType.includes('상품') || name.includes('금현물') || name.includes('원유') || name.includes('은선물') || name.includes('구리')) {
    broadCategory = '원자재/실물';
  } else if (rawType.includes('혼합') || name.includes('TRF') || name.includes('TDF')) {
    broadCategory = '혼합/자산배분';
  } else if (rawType.includes('통화') || name.includes('달러') || name.includes('엔선물')) {
    broadCategory = '통화/환율';
  }

  // Tags
  const tags = [];
  if (name.includes('레버리지') || name.includes('2X')) tags.push('레버리지');
  if (name.includes('인버스')) tags.push('인버스');
  if (name.includes('액티브')) tags.push('액티브');
  if (name.includes('커버드콜') || name.includes('배당') || name.includes('고배당') || name.includes('월배당')) tags.push('배당/커버드콜');
  if (name.includes('(H)')) tags.push('환헤지(H)');
  if (name.includes('반도체') || name.includes('AI') || name.includes('빅테크') || name.includes('2차전지') || name.includes('바이오') || name.includes('로봇')) tags.push('핵심테마');
  if (name.includes('금리') || name.includes('KOFR') || name.includes('CD') || name.includes('파킹')) tags.push('파킹/금리형');

  return { broadCategory, tags };
}

// Process single ETF Item into normalized numerical fields
function processItem(raw) {
  const brandInfo = getBrandInfo(raw.itemName || '');
  const { broadCategory, tags } = categorizeETF(raw);
  
  const currentPrice = parseFloat(raw.currentPrice) || 0;
  const changePrice = parseFloat(raw.changePrice) || 0;
  const changeRate = parseFloat(raw.changeRate) || 0;
  const tradingVolume = parseFloat(raw.tradingVolume) || 0;
  const tradingValue = parseFloat(raw.tradingValue) || 0;
  const totalNetAssets = parseFloat(raw.totalNetAssets) || 0;
  const iNav = parseFloat(raw.iNav) || currentPrice;
  
  const returnRate1m = raw.returnRate1m !== null && raw.returnRate1m !== undefined && raw.returnRate1m !== '' ? parseFloat(raw.returnRate1m) : null;
  const returnRate3m = raw.returnRate3m !== null && raw.returnRate3m !== undefined && raw.returnRate3m !== '' ? parseFloat(raw.returnRate3m) : null;
  const returnRate6m = raw.returnRate6m !== null && raw.returnRate6m !== undefined && raw.returnRate6m !== '' ? parseFloat(raw.returnRate6m) : null;
  
  // 괴리율 (%) = ((현재가 - iNAV) / iNAV) * 100
  let disparity = 0;
  if (iNav > 0) {
    disparity = ((currentPrice - iNav) / iNav) * 100;
  }
  
  // 회전율 (%) = 거래대금 / 순자산총액 * 100
  let turnover = 0;
  if (totalNetAssets > 0) {
    turnover = (tradingValue / totalNetAssets) * 100;
  }

  return {
    itemCode: raw.itemCode,
    itemName: raw.itemName,
    currentPrice,
    changePrice,
    changeRate,
    priceMovement: raw.priceMovement || (changeRate > 0 ? 'rising' : changeRate < 0 ? 'falling' : 'steady'),
    tradingVolume,
    tradingValue,
    totalNetAssets,
    iNav,
    disparity,
    turnover,
    returnRate1m,
    returnRate3m,
    returnRate6m,
    rawEtfType: raw.etfType || '',
    brand: brandInfo.brand,
    company: brandInfo.company,
    brandColor: brandInfo.color,
    broadCategory,
    tags
  };
}

// Formatters
const fmt = {
  num: (n) => (n !== null && n !== undefined && !isNaN(n)) ? Number(n).toLocaleString() : '-',
  currency: (n) => {
    if (!n || isNaN(n)) return '0원';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + '조 원';
    if (n >= 1e8) return (n / 1e8).toFixed(1) + '억 원';
    if (n >= 1e4) return (n / 1e4).toFixed(0) + '만 원';
    return Number(n).toLocaleString() + '원';
  },
  pct: (n, includeSign = true) => {
    if (n === null || n === undefined || isNaN(n)) return '-';
    const val = Number(n).toFixed(2);
    if (!includeSign) return val + '%';
    return (n > 0 ? '+' + val : val) + '%';
  },
  disparityPct: (n) => {
    if (n === null || n === undefined || isNaN(n)) return '0.00%';
    const val = Number(n).toFixed(2);
    return (n > 0 ? '+' + val : val) + '%';
  }
};

// Data Fetching Pipeline
async function fetchETFData(showLoading = true) {
  if (showLoading) showLoadingBar(10);
  state.isLiveLoading = true;
  updateStatusBadge('연동 중...', true);

  const collectedItems = [];
  let success = false;
  let page = 1;
  const maxPages = 15;

  try {
    // Strategy 1: Direct API Call loop
    while (page <= maxPages) {
      if (showLoading) showLoadingBar(Math.min(90, 10 + page * 7));
      const url = `https://stock.naver.com/api/stockSecurity/etfs/v2/domestic?listingType=aumDesc&size=100&index=${page}`;
      
      let res;
      try {
        res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      } catch (err) {
        // Strategy 2: Proxy Fallback if CORS blocked
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        res = await fetch(proxyUrl);
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      collectedItems.push(...items);
      if (!data.hasNext || collectedItems.length >= (parseInt(data.totalCount) || 1200)) break;
      page++;
    }
    
    if (collectedItems.length > 0) {
      state.rawItems = collectedItems;
      state.updatedAt = new Date().toISOString();
      state.totalCount = collectedItems.length;
      success = true;
      console.log(`[API Live] Successfully fetched ${collectedItems.length} ETFs.`);
    }
  } catch (err) {
    console.warn('Direct live fetch failed or restricted. Falling back to local snapshot:', err);
    try {
      let fallbackRes = await fetch('./data/data.json');
      if (!fallbackRes.ok) {
        fallbackRes = await fetch('./data.json');
      }
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        state.rawItems = fallbackData.items || [];
        state.updatedAt = fallbackData.updatedAt || new Date().toISOString();
        state.totalCount = state.rawItems.length;
        success = true;
        console.log(`[Fallback] Loaded ${state.rawItems.length} ETFs from snapshot.`);
      }
    } catch (fbErr) {
      console.error('Snapshot load also failed:', fbErr);
    }
  }

  if (showLoading) {
    showLoadingBar(100);
    setTimeout(hideLoadingBar, 300);
  }
  
  state.isLiveLoading = false;
  
  if (success && state.rawItems.length > 0) {
    state.processedItems = state.rawItems.map(processItem);
    applyFilters();
    renderAllViews();
    updateStatusBadge(`실시간 정상 (${state.processedItems.length}개)`, false);
    updateLastUpdatedTime();
  } else {
    updateStatusBadge('데이터 로드 실패', false);
    alert('ETF 데이터를 가져오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

// UI Helpers
function showLoadingBar(pct) {
  const bar = document.getElementById('loadingBar');
  const container = document.getElementById('loadingContainer');
  if (container && bar) {
    container.style.display = 'block';
    bar.style.width = pct + '%';
  }
}

function hideLoadingBar() {
  const container = document.getElementById('loadingContainer');
  if (container) container.style.display = 'none';
}

function updateStatusBadge(text, isLoading) {
  const badgeText = document.getElementById('statusText');
  const dot = document.getElementById('statusDot');
  if (badgeText) badgeText.innerText = text;
  if (dot) {
    if (isLoading) {
      dot.classList.add('loading');
    } else {
      dot.classList.remove('loading');
    }
  }
}

function updateLastUpdatedTime() {
  const el = document.getElementById('lastUpdateTime');
  if (el && state.updatedAt) {
    const d = new Date(state.updatedAt);
    el.innerText = `업데이트: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }
}

// Filtering & Search Engine
function applyFilters() {
  const f = state.filters;
  const searchLower = f.search.trim().toLowerCase();

  state.filteredItems = state.processedItems.filter(item => {
    // Search keyword
    if (searchLower) {
      const matchName = item.itemName.toLowerCase().includes(searchLower);
      const matchCode = item.itemCode.includes(searchLower);
      const matchBrand = item.brand.toLowerCase().includes(searchLower);
      const matchCompany = item.company.toLowerCase().includes(searchLower);
      const matchCat = item.broadCategory.toLowerCase().includes(searchLower);
      if (!matchName && !matchCode && !matchBrand && !matchCompany && !matchCat) return false;
    }

    // Brand filter
    if (f.brands.size > 0 && !f.brands.has(item.brand)) return false;

    // Category filter
    if (f.categories.size > 0 && !f.categories.has(item.broadCategory)) return false;

    // Tags filter
    if (f.tags.size > 0) {
      const hasAnyTag = item.tags.some(t => f.tags.has(t));
      if (!hasAnyTag) return false;
    }

    // Min AUM
    if (f.minAum > 0 && item.totalNetAssets < f.minAum) return false;

    // Disparity alert (±1% 이상 괴리율)
    if (f.disparityAlertOnly && Math.abs(item.disparity) < 1.0) return false;

    return true;
  });

  // Sort
  sortFilteredItems();
}

function sortFilteredItems() {
  const key = state.sortKey;
  const order = state.sortOrder === 'asc' ? 1 : -1;

  state.filteredItems.sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'string') {
      return va.localeCompare(vb) * order;
    }
    return (va - vb) * order;
  });
}

// Render Master Coordinator
function renderAllViews() {
  renderKPIs();
  renderBrandFilters();
  renderCategoryFilters();
  renderTagFilters();
  renderTabContent(state.currentTab);
  renderTable();
}

// 1. KPI Summary Cards
function renderKPIs() {
  const items = state.processedItems;
  if (!items.length) return;

  const totalAum = items.reduce((sum, item) => sum + item.totalNetAssets, 0);
  const totalTradingVal = items.reduce((sum, item) => sum + item.tradingValue, 0);
  
  const riseCount = items.filter(i => i.changeRate > 0).length;
  const fallCount = items.filter(i => i.changeRate < 0).length;
  const steadyCount = items.length - riseCount - fallCount;

  const risePct = ((riseCount / items.length) * 100).toFixed(1);
  const fallPct = ((fallCount / items.length) * 100).toFixed(1);
  const steadyPct = (100 - risePct - fallPct).toFixed(1);

  // Highest gainer & Highest trading value
  const topGainer = [...items].sort((a, b) => b.changeRate - a.changeRate)[0];
  const topTrader = [...items].sort((a, b) => b.tradingValue - a.tradingValue)[0];

  // Avg disparity
  const validDisparities = items.filter(i => !isNaN(i.disparity));
  const avgDisparity = validDisparities.reduce((sum, i) => sum + i.disparity, 0) / (validDisparities.length || 1);

  document.getElementById('kpiTotalCount').innerText = `${fmt.num(items.length)}개`;
  document.getElementById('kpiTotalAum').innerText = fmt.currency(totalAum);
  document.getElementById('kpiTotalTrade').innerText = fmt.currency(totalTradingVal);
  document.getElementById('kpiAvgDisparity').innerText = fmt.disparityPct(avgDisparity);

  // Breadth bar
  document.getElementById('breadthRiseBar').style.width = risePct + '%';
  document.getElementById('breadthSteadyBar').style.width = steadyPct + '%';
  document.getElementById('breadthFallBar').style.width = fallPct + '%';
  document.getElementById('breadthRiseTxt').innerText = `상승 ${riseCount} (${risePct}%)`;
  document.getElementById('breadthSteadyTxt').innerText = `보합 ${steadyCount}`;
  document.getElementById('breadthFallTxt').innerText = `하락 ${fallCount} (${fallPct}%)`;

  // Mini highlights
  if (topGainer) {
    document.getElementById('kpiTopGainer').innerHTML = `
      <span style="font-weight:700; color:var(--text-main);">${topGainer.itemName}</span>
      <span class="val-rise" style="margin-left:auto;">${fmt.pct(topGainer.changeRate)}</span>
    `;
  }
  if (topTrader) {
    document.getElementById('kpiTopTrader').innerHTML = `
      <span style="font-weight:700; color:var(--text-main);">${topTrader.itemName}</span>
      <span style="color:var(--accent-cyan); margin-left:auto;">${fmt.currency(topTrader.tradingValue)}</span>
    `;
  }
}

// Render dynamic chips
function renderBrandFilters() {
  const container = document.getElementById('brandFilterGroup');
  if (!container) return;

  const brandCounts = {};
  state.processedItems.forEach(i => {
    brandCounts[i.brand] = (brandCounts[i.brand] || 0) + 1;
  });

  const sortedBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);
  
  let html = `<span class="filter-chip ${state.filters.brands.size === 0 ? 'active' : ''}" data-type="brand" data-val="ALL">전체 운용사</span>`;
  sortedBrands.forEach(([brand, count]) => {
    const isActive = state.filters.brands.has(brand);
    html += `<span class="filter-chip ${isActive ? 'active' : ''}" data-type="brand" data-val="${brand}">${brand} <small>(${count})</small></span>`;
  });
  container.innerHTML = html;
}

function renderCategoryFilters() {
  const container = document.getElementById('categoryFilterGroup');
  if (!container) return;

  const cats = ['국내주식', '해외주식', '국내채권', '해외채권', '원자재/실물', '혼합/자산배분', '통화/환율'];
  let html = `<span class="filter-chip ${state.filters.categories.size === 0 ? 'active' : ''}" data-type="cat" data-val="ALL">전체 자산군</span>`;
  
  cats.forEach(c => {
    const count = state.processedItems.filter(i => i.broadCategory === c).length;
    if (count > 0) {
      const isActive = state.filters.categories.has(c);
      html += `<span class="filter-chip ${isActive ? 'active' : ''}" data-type="cat" data-val="${c}">${c} <small>(${count})</small></span>`;
    }
  });
  container.innerHTML = html;
}

function renderTagFilters() {
  const container = document.getElementById('tagFilterGroup');
  if (!container) return;

  const tags = ['배당/커버드콜', '액티브', '레버리지', '인버스', '환헤지(H)', '핵심테마', '파킹/금리형'];
  let html = `<span class="filter-chip ${state.filters.tags.size === 0 ? 'active' : ''}" data-type="tag" data-val="ALL">전체 특성</span>`;
  
  tags.forEach(t => {
    const count = state.processedItems.filter(i => i.tags.includes(t)).length;
    const isActive = state.filters.tags.has(t);
    html += `<span class="filter-chip ${isActive ? 'active' : ''}" data-type="tag" data-val="${t}">${t} <small>(${count})</small></span>`;
  });
  container.innerHTML = html;
}

// Chart Initializers & Renderers
function renderTabContent(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });

  // Delay chart render slightly so DOM dimensions are accurate
  setTimeout(() => {
    switch (tabName) {
      case 'treemap':
        renderTreemapChart();
        break;
      case 'brand':
        renderBrandCharts();
        break;
      case 'category':
        renderCategoryCharts();
        break;
      case 'returns':
        renderReturnCharts();
        break;
      case 'liquidity':
        renderLiquidityCharts();
        break;
      case 'disparity':
        renderDisparityCharts();
        break;
    }
  }, 50);
}

// 1. Treemap Heatmap View
function renderTreemapChart() {
  const chartDom = document.getElementById('treemapChart');
  if (!chartDom) return;

  if (state.charts.treemap) state.charts.treemap.dispose();
  const myChart = echarts.init(chartDom, state.activeTheme === 'dark' ? 'dark' : null);
  state.charts.treemap = myChart;

  const period = document.getElementById('treemapMetricSelect')?.value || 'changeRate';
  const groupMode = document.getElementById('treemapGroupSelect')?.value || 'brand'; // brand or category

  // Grouping
  const groups = {};
  state.filteredItems.forEach(item => {
    const gKey = groupMode === 'brand' ? item.brand : item.broadCategory;
    if (!groups[gKey]) groups[gKey] = [];
    groups[gKey].push(item);
  });

  const treeData = Object.entries(groups).map(([groupName, items]) => {
    return {
      name: groupName,
      children: items.map(i => {
        let valMetric = i[period];
        if (valMetric === null || isNaN(valMetric)) valMetric = 0;
        return {
          name: i.itemName,
          value: [i.totalNetAssets, valMetric], // [0]: size (AUM), [1]: color metric
          itemCode: i.itemCode,
          itemObj: i
        };
      })
    };
  });

  const isReturn = period.includes('Rate') || period === 'changeRate';
  const minColor = isReturn ? -5 : -2;
  const maxColor = isReturn ? 5 : 2;

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: function (info) {
        const d = info.data?.itemObj;
        if (!d) return info.name;
        return `
          <div style="font-size:13px; line-height:1.6; padding:4px;">
            <div style="font-weight:700; margin-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:4px;">
              ${d.itemName} <span style="font-weight:normal; opacity:0.7;">(${d.itemCode})</span>
            </div>
            <div>순자산(AUM): <b>${fmt.currency(d.totalNetAssets)}</b></div>
            <div>현재가: <b>${fmt.num(d.currentPrice)}원</b> (${fmt.pct(d.changeRate)})</div>
            <div>당일 거래대금: <b>${fmt.currency(d.tradingValue)}</b></div>
            <div>1M 수익률: <b style="color:${d.returnRate1m > 0 ? 'var(--rise-color)' : 'var(--fall-color)'}">${fmt.pct(d.returnRate1m)}</b></div>
            <div>3M 수익률: <b style="color:${d.returnRate3m > 0 ? 'var(--rise-color)' : 'var(--fall-color)'}">${fmt.pct(d.returnRate3m)}</b></div>
            <div>iNAV 괴리율: <b>${fmt.disparityPct(d.disparity)}</b></div>
            <div style="margin-top:6px; font-size:11px; color:#38bdf8;">클릭 시 상세 종목 정보 조회</div>
          </div>
        `;
      }
    },
    series: [
      {
        name: 'ETF Market Treemap',
        type: 'treemap',
        visibleMin: 300,
        data: treeData,
        leafDepth: 2,
        roam: false,
        label: {
          show: true,
          formatter: function (params) {
            const d = params.data?.itemObj;
            if (!d) return params.name;
            const metricVal = params.value[1];
            return `{title|${d.itemName}}\n{sub|${fmt.currency(d.totalNetAssets)}}\n{val|${fmt.pct(metricVal)}}`;
          },
          rich: {
            title: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },
            sub: { fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 14 },
            val: { fontSize: 11, fontWeight: 'bold', color: '#ffffff', lineHeight: 16 }
          }
        },
        upperLabel: {
          show: true,
          height: 24,
          color: '#ffffff',
          fontWeight: 'bold',
          backgroundColor: 'rgba(0,0,0,0.3)'
        },
        itemStyle: {
          borderColor: '#111827',
          borderWidth: 1,
          gapWidth: 1
        },
        visualMin: minColor,
        visualMax: maxColor,
        visualDimension: 1,
        levels: [
          {
            itemStyle: { borderColor: '#111827', borderWidth: 2, gapWidth: 2 }
          },
          {
            colorMappingBy: 'value',
            itemStyle: { gapWidth: 1 }
          }
        ],
        color: ['#2563eb', '#3b82f6', '#475569', '#ef4444', '#dc2626']
      }
    ]
  };

  myChart.setOption(option);
  myChart.off('click');
  myChart.on('click', function (params) {
    if (params.data && params.data.itemObj) {
      openModal(params.data.itemObj);
    }
  });
}

// 2. Brand EDA Views
function renderBrandCharts() {
  const items = state.processedItems;
  
  // Brand AUM & Count Aggregation
  const brandStats = {};
  items.forEach(i => {
    if (!brandStats[i.brand]) {
      brandStats[i.brand] = {
        name: i.brand,
        company: i.company,
        aum: 0,
        tradeVal: 0,
        count: 0,
        returns1m: [],
        returns3m: [],
        returns6m: []
      };
    }
    brandStats[i.brand].aum += i.totalNetAssets;
    brandStats[i.brand].tradeVal += i.tradingValue;
    brandStats[i.brand].count += 1;
    if (i.returnRate1m !== null) brandStats[i.brand].returns1m.push(i.returnRate1m);
    if (i.returnRate3m !== null) brandStats[i.brand].returns3m.push(i.returnRate3m);
    if (i.returnRate6m !== null) brandStats[i.brand].returns6m.push(i.returnRate6m);
  });

  const sortedByAum = Object.values(brandStats).sort((a, b) => b.aum - a.aum);

  // Chart 1: Brand Market Share Donut
  const shareDom = document.getElementById('brandShareChart');
  if (shareDom) {
    if (state.charts.brandShare) state.charts.brandShare.dispose();
    const c1 = echarts.init(shareDom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.brandShare = c1;

    const totalMarketAum = sortedByAum.reduce((s, b) => s + b.aum, 0);

    const option1 = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p) => `<b>${p.name}</b><br/>AUM: ${fmt.currency(p.value)} (${p.percent}%)<br/>종목수: ${p.data.count}개`
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: 'var(--text-muted)' }
      },
      series: [
        {
          name: '브랜드별 AUM 점유율',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#111827',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              formatter: (p) => `${p.name}\n${p.percent}%`
            }
          },
          data: sortedByAum.map(b => ({
            name: b.name,
            value: b.aum,
            count: b.count
          }))
        }
      ]
    };
    c1.setOption(option1);
  }

  // Chart 2: Brand Count vs Avg Return Comparison
  const barDom = document.getElementById('brandPerformanceChart');
  if (barDom) {
    if (state.charts.brandPerf) state.charts.brandPerf.dispose();
    const c2 = echarts.init(barDom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.brandPerf = c2;

    const topBrands = sortedByAum.slice(0, 10);
    const names = topBrands.map(b => b.name);
    const counts = topBrands.map(b => b.count);
    const avg1m = topBrands.map(b => {
      const arr = b.returns1m;
      return arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : 0;
    });
    const avg3m = topBrands.map(b => {
      const arr = b.returns3m;
      return arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : 0;
    });

    const option2 = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: {
        data: ['상장 ETF 수 (좌)', '평균 1M 수익률(%) (우)', '평균 3M 수익률(%) (우)'],
        textStyle: { color: 'var(--text-muted)' },
        top: 0
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: [
        {
          type: 'category',
          data: names,
          axisLabel: { color: 'var(--text-muted)' }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: '종목수 (개)',
          position: 'left',
          axisLabel: { color: 'var(--text-muted)' },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        {
          type: 'value',
          name: '수익률 (%)',
          position: 'right',
          axisLabel: { formatter: '{value}%', color: 'var(--text-muted)' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '상장 ETF 수 (좌)',
          type: 'bar',
          data: counts,
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }
        },
        {
          name: '평균 1M 수익률(%) (우)',
          type: 'line',
          yAxisIndex: 1,
          data: avg1m,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 3 }
        },
        {
          name: '평균 3M 수익률(%) (우)',
          type: 'line',
          yAxisIndex: 1,
          data: avg3m,
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 3 }
        }
      ]
    };
    c2.setOption(option2);
  }
}

// 3. Category & Theme EDA Views
function renderCategoryCharts() {
  const items = state.processedItems;
  const catStats = {};

  items.forEach(i => {
    if (!catStats[i.broadCategory]) {
      catStats[i.broadCategory] = {
        name: i.broadCategory,
        aum: 0,
        tradeVal: 0,
        count: 0,
        returns1m: []
      };
    }
    catStats[i.broadCategory].aum += i.totalNetAssets;
    catStats[i.broadCategory].tradeVal += i.tradingValue;
    catStats[i.broadCategory].count += 1;
    if (i.returnRate1m !== null) catStats[i.broadCategory].returns1m.push(i.returnRate1m);
  });

  const catList = Object.values(catStats).sort((a, b) => b.aum - a.aum);

  const catDom = document.getElementById('categoryAumChart');
  if (catDom) {
    if (state.charts.categoryAum) state.charts.categoryAum.dispose();
    const c1 = echarts.init(catDom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.categoryAum = c1;

    c1.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const d = catList[params[0].dataIndex];
          return `<b>${d.name}</b><br/>AUM: ${fmt.currency(d.aum)}<br/>종목수: ${d.count}개<br/>당일 거래대금: ${fmt.currency(d.tradeVal)}`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: catList.map(c => c.name),
        axisLabel: { color: 'var(--text-muted)' }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v / 1e12).toFixed(0) + '조',
          color: 'var(--text-muted)'
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          name: '순자산총액 (AUM)',
          type: 'bar',
          data: catList.map(c => c.aum),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#06b6d4' },
              { offset: 1, color: '#3b82f6' }
            ]),
            borderRadius: [6, 6, 0, 0]
          }
        }
      ]
    });
  }

  // Special Characteristic Distribution (Covered Call, Active, Leverage, Inverse)
  const specialDom = document.getElementById('specialTypeChart');
  if (specialDom) {
    if (state.charts.specialType) state.charts.specialType.dispose();
    const c2 = echarts.init(specialDom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.specialType = c2;

    const tags = ['배당/커버드콜', '액티브', '레버리지', '인버스', '환헤지(H)', '파킹/금리형'];
    const tagAums = tags.map(t => {
      const match = items.filter(i => i.tags.includes(t));
      return {
        name: t,
        value: match.reduce((s, i) => s + i.totalNetAssets, 0),
        count: match.length
      };
    });

    c2.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p) => `<b>${p.name}</b><br/>AUM: ${fmt.currency(p.value)} (${p.percent}%)<br/>종목수: ${p.data.count}개`
      },
      series: [
        {
          type: 'pie',
          radius: '70%',
          center: ['50%', '50%'],
          roseType: 'radius',
          itemStyle: { borderRadius: 5 },
          data: tagAums
        }
      ]
    });
  }
}

// 4. Return Distribution & Performance Views
function renderReturnCharts() {
  const items = state.processedItems;
  const period = document.getElementById('returnPeriodSelect')?.value || '1m';
  const key = period === '1d' ? 'changeRate' : period === '1m' ? 'returnRate1m' : period === '3m' ? 'returnRate3m' : 'returnRate6m';

  const validItems = items.filter(i => i[key] !== null && !isNaN(i[key]));
  
  // Top 10 Gainers & Losers
  const sorted = [...validItems].sort((a, b) => b[key] - a[key]);
  const top10 = sorted.slice(0, 10);
  const bottom10 = sorted.slice(-10).reverse();

  renderRankingList('topGainersList', top10, key);
  renderRankingList('topLosersList', bottom10, key);

  // Return Distribution Histogram
  const histDom = document.getElementById('returnDistChart');
  if (histDom) {
    if (state.charts.returnDist) state.charts.returnDist.dispose();
    const c1 = echarts.init(histDom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.returnDist = c1;

    // Bins
    const bins = [
      { label: '< -20%', min: -Infinity, max: -20, count: 0 },
      { label: '-20~-10%', min: -20, max: -10, count: 0 },
      { label: '-10~-5%', min: -10, max: -5, count: 0 },
      { label: '-5~0%', min: -5, max: 0, count: 0 },
      { label: '0~5%', min: 0, max: 5, count: 0 },
      { label: '5~10%', min: 5, max: 10, count: 0 },
      { label: '10~20%', min: 10, max: 20, count: 0 },
      { label: '> 20%', min: 20, max: Infinity, count: 0 }
    ];

    validItems.forEach(i => {
      const v = i[key];
      const bin = bins.find(b => v >= b.min && v < b.max);
      if (bin) bin.count++;
    });

    c1.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: bins.map(b => b.label),
        axisLabel: { color: 'var(--text-muted)', rotate: 15 }
      },
      yAxis: {
        type: 'value',
        name: '종목수',
        axisLabel: { color: 'var(--text-muted)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          name: '수익률 분포 종목수',
          type: 'bar',
          data: bins.map(b => b.count),
          itemStyle: {
            color: (params) => {
              return params.dataIndex < 4 ? '#3b82f6' : '#ef4444';
            },
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    });
  }

  // Scatter: 1M Return vs 3M Return
  const scatterDom = document.getElementById('returnScatterChart');
  if (scatterDom) {
    if (state.charts.returnScatter) state.charts.returnScatter.dispose();
    const c2 = echarts.init(scatterDom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.returnScatter = c2;

    const scatterData = items
      .filter(i => i.returnRate1m !== null && i.returnRate3m !== null)
      .map(i => ({
        name: i.itemName,
        value: [i.returnRate1m, i.returnRate3m, i.totalNetAssets],
        itemObj: i
      }));

    c2.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (p) => {
          const d = p.data.itemObj;
          return `<b>${d.itemName}</b><br/>1M 수익률: ${fmt.pct(d.returnRate1m)}<br/>3M 수익률: ${fmt.pct(d.returnRate3m)}<br/>AUM: ${fmt.currency(d.totalNetAssets)}`;
        }
      },
      xAxis: {
        type: 'value',
        name: '1M 수익률(%)',
        axisLabel: { formatter: '{value}%', color: 'var(--text-muted)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      yAxis: {
        type: 'value',
        name: '3M 수익률(%)',
        axisLabel: { formatter: '{value}%', color: 'var(--text-muted)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          type: 'scatter',
          data: scatterData,
          symbolSize: (data) => Math.max(6, Math.min(30, Math.sqrt(data[2] / 1e9))),
          itemStyle: {
            color: 'rgba(59, 130, 246, 0.65)',
            borderColor: '#38bdf8',
            borderWidth: 1
          }
        }
      ]
    });
  }
}

function renderRankingList(elemId, items, key) {
  const container = document.getElementById(elemId);
  if (!container) return;

  let html = '';
  items.forEach((item, idx) => {
    const val = item[key];
    const isPositive = val > 0;
    const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
    html += `
      <div class="ranking-item" onclick="window.appOpenModal('${item.itemCode}')">
        <div class="ranking-rank ${rankClass}">${idx + 1}</div>
        <div class="ranking-info">
          <div class="ranking-name">${item.itemName}</div>
          <div class="ranking-sub">${item.brand} · ${fmt.currency(item.totalNetAssets)}</div>
        </div>
        <div class="ranking-val ${isPositive ? 'val-rise' : val < 0 ? 'val-fall' : 'val-steady'}">
          ${fmt.pct(val)}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// 5. Liquidity EDA Views
function renderLiquidityCharts() {
  const items = state.processedItems;

  // Trading Value vs AUM Scatter Chart
  const dom = document.getElementById('liquidityScatterChart');
  if (dom) {
    if (state.charts.liquidityScatter) state.charts.liquidityScatter.dispose();
    const c1 = echarts.init(dom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.liquidityScatter = c1;

    const data = items.map(i => ({
      name: i.itemName,
      value: [i.totalNetAssets, i.tradingValue, i.turnover],
      itemObj: i
    }));

    c1.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (p) => {
          const d = p.data.itemObj;
          return `<b>${d.itemName}</b><br/>AUM: ${fmt.currency(d.totalNetAssets)}<br/>당일 거래대금: ${fmt.currency(d.tradingValue)}<br/>회전율: ${d.turnover.toFixed(2)}%`;
        }
      },
      xAxis: {
        type: 'log',
        name: '순자산총액 (AUM, Log Scale)',
        axisLabel: {
          formatter: (v) => fmt.currency(v),
          color: 'var(--text-muted)'
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      yAxis: {
        type: 'log',
        name: '당일 거래대금 (Log Scale)',
        axisLabel: {
          formatter: (v) => fmt.currency(v),
          color: 'var(--text-muted)'
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          type: 'scatter',
          data: data,
          symbolSize: (data) => Math.max(6, Math.min(25, data[2] * 2)),
          itemStyle: {
            color: 'rgba(16, 185, 129, 0.6)',
            borderColor: '#34d399',
            borderWidth: 1
          }
        }
      ]
    });
  }

  // Top Turnover List
  const topTurnover = [...items].filter(i => i.totalNetAssets > 1e10).sort((a, b) => b.turnover - a.turnover).slice(0, 10);
  renderRankingList('topTurnoverList', topTurnover, 'turnover');
}

// 6. Disparity Risk Views
function renderDisparityCharts() {
  const items = state.processedItems;
  const valid = items.filter(i => !isNaN(i.disparity));

  // Disparity Histogram
  const dom = document.getElementById('disparityHistChart');
  if (dom) {
    if (state.charts.disparityHist) state.charts.disparityHist.dispose();
    const c1 = echarts.init(dom, state.activeTheme === 'dark' ? 'dark' : null);
    state.charts.disparityHist = c1;

    const bins = [
      { label: '< -1.5%', min: -Infinity, max: -1.5, count: 0 },
      { label: '-1.5 ~ -1.0%', min: -1.5, max: -1.0, count: 0 },
      { label: '-1.0 ~ -0.5%', min: -1.0, max: -0.5, count: 0 },
      { label: '-0.5 ~ 0%', min: -0.5, max: 0, count: 0 },
      { label: '0 ~ 0.5%', min: 0, max: 0.5, count: 0 },
      { label: '0.5 ~ 1.0%', min: 0.5, max: 1.0, count: 0 },
      { label: '1.0 ~ 1.5%', min: 1.0, max: 1.5, count: 0 },
      { label: '> 1.5%', min: 1.5, max: Infinity, count: 0 }
    ];

    valid.forEach(i => {
      const v = i.disparity;
      const b = bins.find(bin => v >= bin.min && v < bin.max);
      if (b) b.count++;
    });

    c1.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: bins.map(b => b.label),
        axisLabel: { color: 'var(--text-muted)', rotate: 20 }
      },
      yAxis: {
        type: 'value',
        name: '종목수',
        axisLabel: { color: 'var(--text-muted)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      series: [
        {
          type: 'bar',
          data: bins.map(b => b.count),
          itemStyle: {
            color: (params) => (params.dataIndex === 0 || params.dataIndex === 7 ? '#ef4444' : '#3b82f6'),
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    });
  }

  // Extreme Disparity (Overvalued vs Undervalued)
  const sorted = [...valid].sort((a, b) => b.disparity - a.disparity);
  const overvalued = sorted.slice(0, 10);
  const undervalued = sorted.slice(-10).reverse();

  renderRankingList('overvaluedList', overvalued, 'disparity');
  renderRankingList('undervaluedList', undervalued, 'disparity');
}

// 7. Interactive Explorer Data Table
function renderTable() {
  const tbody = document.getElementById('etfTableBody');
  if (!tbody) return;

  const totalFiltered = state.filteredItems.length;
  const totalPages = Math.ceil(totalFiltered / state.pageSize) || 1;
  if (state.page > totalPages) state.page = 1;

  const startIdx = (state.page - 1) * state.pageSize;
  const pagedItems = state.filteredItems.slice(startIdx, startIdx + state.pageSize);

  if (pagedItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:3rem; color:var(--text-dim);">검색 및 필터 조건에 일치하는 ETF가 없습니다.</td></tr>`;
    renderPagination(0, 1);
    return;
  }

  let html = '';
  pagedItems.forEach((item, idx) => {
    const isRise = item.changeRate > 0;
    const isFall = item.changeRate < 0;
    const rateClass = isRise ? 'val-rise' : isFall ? 'val-fall' : 'val-steady';
    
    // Disparity badge color
    const absDisp = Math.abs(item.disparity);
    const dispBadgeStyle = absDisp >= 1.0 
      ? 'background:rgba(239, 68, 68, 0.2); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.4);'
      : '';

    html += `
      <tr onclick="window.appOpenModal('${item.itemCode}')">
        <td style="color:var(--text-dim); font-size:0.8rem;">${startIdx + idx + 1}</td>
        <td>
          <div class="stock-name-cell">
            <div class="stock-name">
              ${item.itemName}
              <span class="badge-brand">${item.brand}</span>
            </div>
            <div class="stock-code">${item.itemCode} · ${item.broadCategory}</div>
          </div>
        </td>
        <td style="font-weight:700;">${fmt.num(item.currentPrice)}원</td>
        <td class="${rateClass}">${fmt.pct(item.changeRate)}</td>
        <td>${fmt.currency(item.totalNetAssets)}</td>
        <td>${fmt.currency(item.tradingValue)}</td>
        <td>${fmt.num(item.tradingVolume)}</td>
        <td>
          <span class="tag-badge" style="${dispBadgeStyle}">${fmt.disparityPct(item.disparity)}</span>
        </td>
        <td class="${item.returnRate1m > 0 ? 'val-rise' : item.returnRate1m < 0 ? 'val-fall' : 'val-steady'}">${fmt.pct(item.returnRate1m)}</td>
        <td class="${item.returnRate3m > 0 ? 'val-rise' : item.returnRate3m < 0 ? 'val-fall' : 'val-steady'}">${fmt.pct(item.returnRate3m)}</td>
        <td class="${item.returnRate6m > 0 ? 'val-rise' : item.returnRate6m < 0 ? 'val-fall' : 'val-steady'}">${fmt.pct(item.returnRate6m)}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  renderPagination(totalFiltered, totalPages);
}

function renderPagination(totalCount, totalPages) {
  const container = document.getElementById('paginationBar');
  if (!container) return;

  document.getElementById('tableCountText').innerText = `총 ${fmt.num(totalCount)}개 중 ${fmt.num(Math.min((state.page - 1) * state.pageSize + 1, totalCount))}~${fmt.num(Math.min(state.page * state.pageSize, totalCount))} 표시`;

  const controls = document.getElementById('paginationControls');
  let html = `
    <button class="page-btn" ${state.page <= 1 ? 'disabled' : ''} onclick="window.appGoPage(1)">«</button>
    <button class="page-btn" ${state.page <= 1 ? 'disabled' : ''} onclick="window.appGoPage(${state.page - 1})">‹</button>
  `;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, state.page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `<button class="page-btn ${p === state.page ? 'active' : ''}" onclick="window.appGoPage(${p})">${p}</button>`;
  }

  html += `
    <button class="page-btn" ${state.page >= totalPages ? 'disabled' : ''} onclick="window.appGoPage(${state.page + 1})">›</button>
    <button class="page-btn" ${state.page >= totalPages ? 'disabled' : ''} onclick="window.appGoPage(${totalPages})">»</button>
  `;
  controls.innerHTML = html;
}

// Global modal open hook
window.appOpenModal = function(itemCode) {
  const item = state.processedItems.find(i => i.itemCode === itemCode);
  if (!item) return;
  openModal(item);
};

window.appGoPage = function(p) {
  state.page = p;
  renderTable();
};

// Modal Detail Popup
function openModal(item) {
  const modal = document.getElementById('etfModal');
  const body = document.getElementById('modalContent');
  if (!modal || !body) return;

  const isRise = item.changeRate > 0;
  const isFall = item.changeRate < 0;
  const rateClass = isRise ? 'val-rise' : isFall ? 'val-fall' : 'val-steady';

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;">
      <div>
        <div style="font-size:1.4rem; font-weight:800; color:var(--text-main); margin-bottom:0.25rem;">
          ${item.itemName}
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <span style="font-family:monospace; background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.85rem;">${item.itemCode}</span>
          <span class="tag-badge">${item.brand}</span>
          <span class="tag-badge">${item.company}</span>
          <span class="tag-badge">${item.broadCategory}</span>
          ${item.tags.map(t => `<span class="tag-badge" style="background:rgba(59,130,246,0.15); color:#60a5fa;">${t}</span>`).join('')}
        </div>
      </div>
    </div>

    <!-- Quick Price Banner -->
    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.25rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:2px;">현재가</div>
        <div style="font-size:2rem; font-weight:900;">${fmt.num(item.currentPrice)}원</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:2px;">전일대비 등락</div>
        <div class="${rateClass}" style="font-size:1.5rem; font-weight:800;">
          ${fmt.pct(item.changeRate)} (${fmt.num(item.changePrice)}원)
        </div>
      </div>
    </div>

    <!-- Metric Grid -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:1rem;">
        <div style="font-size:0.78rem; color:var(--text-dim);">순자산총액 (AUM)</div>
        <div style="font-size:1.1rem; font-weight:700; margin-top:4px;">${fmt.currency(item.totalNetAssets)}</div>
      </div>
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:1rem;">
        <div style="font-size:0.78rem; color:var(--text-dim);">당일 거래대금</div>
        <div style="font-size:1.1rem; font-weight:700; margin-top:4px;">${fmt.currency(item.tradingValue)}</div>
      </div>
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:1rem;">
        <div style="font-size:0.78rem; color:var(--text-dim);">추정 순자산가치 (iNAV)</div>
        <div style="font-size:1.1rem; font-weight:700; margin-top:4px;">${fmt.num(item.iNav)}원</div>
      </div>
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:1rem;">
        <div style="font-size:0.78rem; color:var(--text-dim);">괴리율 (Disparity)</div>
        <div style="font-size:1.1rem; font-weight:700; margin-top:4px; color:${Math.abs(item.disparity) > 1.0 ? 'var(--rise-color)' : 'var(--text-main)'};">
          ${fmt.disparityPct(item.disparity)}
        </div>
      </div>
    </div>

    <!-- Returns Comparison -->
    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem;">
      <div style="font-size:0.9rem; font-weight:700; margin-bottom:1rem;">기간별 수익률 추이</div>
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.5rem; text-align:center;">
        <div style="background:var(--bg-secondary); padding:0.75rem; border-radius:6px;">
          <div style="font-size:0.75rem; color:var(--text-dim);">당일</div>
          <div class="${rateClass}" style="font-weight:700; font-size:1rem; margin-top:2px;">${fmt.pct(item.changeRate)}</div>
        </div>
        <div style="background:var(--bg-secondary); padding:0.75rem; border-radius:6px;">
          <div style="font-size:0.75rem; color:var(--text-dim);">1개월</div>
          <div class="${item.returnRate1m > 0 ? 'val-rise' : item.returnRate1m < 0 ? 'val-fall' : 'val-steady'}" style="font-weight:700; font-size:1rem; margin-top:2px;">${fmt.pct(item.returnRate1m)}</div>
        </div>
        <div style="background:var(--bg-secondary); padding:0.75rem; border-radius:6px;">
          <div style="font-size:0.75rem; color:var(--text-dim);">3개월</div>
          <div class="${item.returnRate3m > 0 ? 'val-rise' : item.returnRate3m < 0 ? 'val-fall' : 'val-steady'}" style="font-weight:700; font-size:1rem; margin-top:2px;">${fmt.pct(item.returnRate3m)}</div>
        </div>
        <div style="background:var(--bg-secondary); padding:0.75rem; border-radius:6px;">
          <div style="font-size:0.75rem; color:var(--text-dim);">6개월</div>
          <div class="${item.returnRate6m > 0 ? 'val-rise' : item.returnRate6m < 0 ? 'val-fall' : 'val-steady'}" style="font-weight:700; font-size:1rem; margin-top:2px;">${fmt.pct(item.returnRate6m)}</div>
        </div>
      </div>
    </div>

    <!-- External Links & Actions -->
    <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
      <a href="https://finance.naver.com/item/main.naver?code=${item.itemCode}" target="_blank" class="btn btn-primary">
        네이버 증권 상세 페이지 ↗
      </a>
    </div>
  `;

  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('etfModal');
  if (modal) modal.classList.remove('active');
}

// CSV Export
function exportToCSV() {
  const items = state.filteredItems;
  if (!items.length) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const headers = ['종목코드', '종목명', '운용브랜드', '운용사', '자산군', '현재가(원)', '전일등락률(%)', '순자산(원)', '당일거래대금(원)', '당일거래량', 'iNAV(원)', '괴리율(%)', '수익률_1M(%)', '수익률_3M(%)', '수익률_6M(%)'];
  
  const csvRows = [headers.join(',')];
  
  items.forEach(i => {
    const row = [
      `"${i.itemCode}"`,
      `"${i.itemName.replace(/"/g, '""')}"`,
      `"${i.brand}"`,
      `"${i.company}"`,
      `"${i.broadCategory}"`,
      i.currentPrice,
      i.changeRate,
      i.totalNetAssets,
      i.tradingValue,
      i.tradingVolume,
      i.iNav,
      i.disparity.toFixed(4),
      i.returnRate1m !== null ? i.returnRate1m : '',
      i.returnRate3m !== null ? i.returnRate3m : '',
      i.returnRate6m !== null ? i.returnRate6m : ''
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KRX_ETF_EDA_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Event Listeners Setup
function initEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      renderTabContent(btn.dataset.tab);
    });
  });

  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      state.page = 1;
      applyFilters();
      renderAllViews();
    });
  }

  // Filter Chips Click Delegation
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    const type = chip.dataset.type;
    const val = chip.dataset.val;

    if (type === 'brand') {
      if (val === 'ALL') state.filters.brands.clear();
      else {
        if (state.filters.brands.has(val)) state.filters.brands.delete(val);
        else state.filters.brands.add(val);
      }
    } else if (type === 'cat') {
      if (val === 'ALL') state.filters.categories.clear();
      else {
        if (state.filters.categories.has(val)) state.filters.categories.delete(val);
        else state.filters.categories.add(val);
      }
    } else if (type === 'tag') {
      if (val === 'ALL') state.filters.tags.clear();
      else {
        if (state.filters.tags.has(val)) state.filters.tags.delete(val);
        else state.filters.tags.add(val);
      }
    }

    state.page = 1;
    applyFilters();
    renderAllViews();
  });

  // Table Sort Headers
  document.querySelectorAll('.etf-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortOrder = 'desc';
      }

      document.querySelectorAll('.etf-table th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc');

      sortFilteredItems();
      renderTable();
    });
  });

  // Page Size Select
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      state.pageSize = parseInt(e.target.value, 10);
      state.page = 1;
      renderTable();
    });
  }

  // Treemap Controls
  const treemapMetric = document.getElementById('treemapMetricSelect');
  const treemapGroup = document.getElementById('treemapGroupSelect');
  if (treemapMetric) treemapMetric.addEventListener('change', renderTreemapChart);
  if (treemapGroup) treemapGroup.addEventListener('change', renderTreemapChart);

  // Return Period Select
  const returnPeriod = document.getElementById('returnPeriodSelect');
  if (returnPeriod) returnPeriod.addEventListener('change', renderReturnCharts);

  // Live Refresh Button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchETFData(true);
    });
  }

  // Auto Refresh Select
  const autoRefreshSelect = document.getElementById('autoRefreshSelect');
  if (autoRefreshSelect) {
    autoRefreshSelect.addEventListener('change', (e) => {
      if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);
      const intervalSec = parseInt(e.target.value, 10);
      if (intervalSec > 0) {
        state.autoRefreshTimer = setInterval(() => {
          fetchETFData(false);
        }, intervalSec * 1000);
      }
    });
  }

  // Theme Toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      state.activeTheme = state.activeTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.activeTheme);
      themeToggleBtn.innerHTML = state.activeTheme === 'dark' ? '☀️ 라이트 모드' : '🌙 다크 모드';
      // Re-render charts with new theme
      renderTabContent(state.currentTab);
    });
  }

  // Export CSV Button
  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportToCSV);

  // Modal Close
  const modalClose = document.getElementById('modalCloseBtn');
  const modalOverlay = document.getElementById('etfModal');
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Window Resize Hook for ECharts
  window.addEventListener('resize', () => {
    Object.values(state.charts).forEach(chart => {
      if (chart && typeof chart.resize === 'function') {
        chart.resize();
      }
    });
  });
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  fetchETFData(true);
});
