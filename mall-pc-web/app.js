/* ===================== Mall PC 商城 SPA ===================== */
const { createApp, ref, reactive, computed, onMounted, watch } = Vue;
const { createRouter, createWebHashHistory, useRoute, useRouter } = VueRouter;
const ElMessage = ElementPlus.ElMessage;
const ElMessageBox = ElementPlus.ElMessageBox;

/* ---------- API 封装 ---------- */
const api = axios.create({ baseURL: '/api', timeout: 15000 });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('mall_token');
  const head = localStorage.getItem('mall_tokenHead') || 'Bearer ';
  if (token) cfg.headers['Authorization'] = head + token;
  return cfg;
});
api.interceptors.response.use(
  resp => {
    const r = resp.data;
    if (r && typeof r.code !== 'undefined' && r.code !== 200) {
      // 业务错误
      if (r.code === 401) { clearAuth(); if (location.hash.indexOf('#/login') < 0) location.hash = '#/login'; }
      return Promise.reject(r);
    }
    return r;
  },
  err => {
    const status = err.response && err.response.status;
    if (status === 401) { clearAuth(); if (location.hash.indexOf('#/login') < 0) location.hash = '#/login'; }
    return Promise.reject(err.response ? err.response.data : err);
  }
);
function clearAuth() { localStorage.removeItem('mall_token'); localStorage.removeItem('mall_tokenHead'); store.member = null; }

/* ---------- 全局状态 ---------- */
const store = reactive({
  member: null,
  cartCount: 0,
  isLogin() { return !!localStorage.getItem('mall_token'); },
  async refreshMember() {
    if (!this.isLogin()) { this.member = null; return; }
    try { const r = await api.get('/sso/info'); this.member = r.data; } catch (e) { this.member = null; }
  },
  async refreshCart() {
    if (!this.isLogin()) { this.cartCount = 0; return; }
    try { const r = await api.get('/cart/list'); this.cartCount = (r.data || []).length; } catch (e) { this.cartCount = 0; }
  }
});

/* ---------- 工具 ---------- */
const yuan = v => '¥' + (v == null ? '0.00' : Number(v).toFixed(2));
const PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="%23f0f0f0"/><text x="50%25" y="50%25" fill="%23bbb" font-size="16" text-anchor="middle" dy=".3em">无图</text></svg>';
const imgOf = p => p && p.length ? p.replace(/^https?:\/\/macro-oss\.oss-cn-shenzhen\.aliyuncs\.com\//i, '/img/') : PLACEHOLDER;

/* ===================== 组件 ===================== */

/* 商品卡片（复用） */
const ProductCard = {
  props: ['p'],
  template: `
    <div class="product-card" @click="$router.push('/product/'+p.id)">
      <img class="pimg" :src="img(p.pic)" @error="onErr">
      <div class="pbody">
        <div class="pname">{{ p.name }}</div>
        <div class="psub">{{ p.subTitle || '' }}</div>
        <div class="pprice">{{ price(p.price) }}</div>
      </div>
    </div>`,
  methods: { img: imgOf, price: yuan, onErr(e){ e.target.src = PLACEHOLDER; } }
};

/* 首页 */
const Home = {
  components: { ProductCard },
  template: `
    <div class="container">
      <el-carousel v-if="banners.length" height="400px" class="banner">
        <el-carousel-item v-for="(b,i) in banners" :key="i">
          <img :src="img(b.pic)" style="width:100%;height:400px;object-fit:cover">
        </el-carousel-item>
      </el-carousel>
      <el-skeleton v-if="loading" :rows="8" animated style="margin-top:20px"/>
      <template v-else>
        <div v-if="brands.length">
          <div class="section-title">品牌推荐</div>
          <div class="brand-grid">
            <div class="brand-card" v-for="b in brands" :key="b.id" @click="$router.push({path:'/search',query:{brandId:b.id}})">
              <img :src="img(b.logo)" @error="onErr"><div class="bname">{{ b.name }}</div>
            </div>
          </div>
        </div>
        <div v-if="newProducts.length">
          <div class="section-title">新品上线</div>
          <div class="product-grid"><product-card v-for="p in newProducts" :key="p.id" :p="p"/></div>
        </div>
        <div v-if="hotProducts.length">
          <div class="section-title">人气推荐</div>
          <div class="product-grid"><product-card v-for="p in hotProducts" :key="p.id" :p="p"/></div>
        </div>
      </template>
    </div>`,
  data() { return { loading: true, banners: [], brands: [], newProducts: [], hotProducts: [] }; },
  methods: { img: imgOf, onErr(e){ e.target.src = PLACEHOLDER; } },
  async mounted() {
    try {
      const r = await api.get('/home/content');
      const d = r.data || {};
      this.banners = d.advertiseList || [];
      this.brands = d.brandList || [];
      this.newProducts = d.newProductList || [];
      this.hotProducts = d.hotProductList || [];
    } catch (e) { ElMessage.error('首页加载失败'); }
    finally { this.loading = false; }
  }
};

/* 分类浏览 */
const Category = {
  components: { ProductCard },
  template: `
    <div class="container">
      <div class="cat-layout">
        <div class="cat-side">
          <el-menu>
            <el-sub-menu v-for="c in tree" :key="c.id" :index="String(c.id)">
              <template #title>{{ c.name }}</template>
              <el-menu-item v-for="s in (c.children||[])" :key="s.id" :index="String(s.id)" @click="pick(s.id)">{{ s.name }}</el-menu-item>
            </el-sub-menu>
          </el-menu>
        </div>
        <div class="cat-main">
          <el-skeleton v-if="loading" :rows="6" animated/>
          <div v-else-if="!products.length" class="empty">请选择左侧分类查看商品</div>
          <div v-else class="product-grid col4"><product-card v-for="p in products" :key="p.id" :p="p"/></div>
          <el-pagination v-if="total>pageSize" background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="pageNum+1" @current-change="onPage" style="margin-top:18px;justify-content:center"/>
        </div>
      </div>
    </div>`,
  data() { return { tree: [], products: [], loading: false, pageNum: 0, pageSize: 12, total: 0, curCat: null }; },
  methods: {
    async loadTree() { try { const r = await api.get('/product/categoryTreeList'); this.tree = r.data || []; } catch(e){} },
    pick(id) { this.curCat = id; this.pageNum = 0; this.load(); },
    onPage(p) { this.pageNum = p - 1; this.load(); },
    async load() {
      if (!this.curCat) return;
      this.loading = true;
      try { const r = await api.get('/product/search', { params: { productCategoryId: this.curCat, pageNum: this.pageNum, pageSize: this.pageSize } });
        this.products = r.data.list || []; this.total = r.data.total || 0;
      } catch(e){ ElMessage.error('加载失败'); } finally { this.loading = false; }
    }
  },
  mounted() { this.loadTree(); }
};

/* 搜索结果 */
const SearchList = {
  components: { ProductCard },
  template: `
    <div class="container">
      <div class="toolbar">
        <span>排序：</span>
        <el-radio-group v-model="sort" @change="reload">
          <el-radio-button :value="0">综合</el-radio-button>
          <el-radio-button :value="1">新品</el-radio-button>
          <el-radio-button :value="2">销量</el-radio-button>
          <el-radio-button :value="3">价格↑</el-radio-button>
          <el-radio-button :value="4">价格↓</el-radio-button>
        </el-radio-group>
        <span style="margin-left:auto;color:#999">共 {{ total }} 件商品</span>
      </div>
      <el-skeleton v-if="loading" :rows="6" animated/>
      <div v-else-if="!products.length" class="empty">没有找到相关商品</div>
      <div v-else class="product-grid"><product-card v-for="p in products" :key="p.id" :p="p"/></div>
      <el-pagination v-if="total>pageSize" background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="pageNum+1" @current-change="onPage" style="margin-top:18px;justify-content:center"/>
    </div>`,
  data() { return { products: [], loading: false, pageNum: 0, pageSize: 15, total: 0, sort: 0 }; },
  methods: {
    onPage(p) { this.pageNum = p - 1; this.load(); },
    reload() { this.pageNum = 0; this.load(); },
    async load() {
      this.loading = true;
      const q = this.$route.query;
      try {
        const r = await api.get('/product/search', { params: { keyword: q.keyword, brandId: q.brandId, productCategoryId: q.productCategoryId, pageNum: this.pageNum, pageSize: this.pageSize, sort: this.sort } });
        this.products = r.data.list || []; this.total = r.data.total || 0;
      } catch(e){ ElMessage.error('搜索失败'); } finally { this.loading = false; }
    }
  },
  watch: { '$route.query': { handler(){ this.reload(); } } },
  mounted() { this.load(); }
};

/* 商品详情 */
const ProductDetail = {
  template: `
    <div class="container">
      <el-skeleton v-if="loading" :rows="8" animated/>
      <template v-else-if="product">
        <div class="detail-top">
          <div class="detail-gallery"><img :src="img(product.pic)" @error="onErr"></div>
          <div class="detail-info">
            <h1>{{ product.name }}</h1>
            <div style="color:#999">{{ product.subTitle }}</div>
            <div class="detail-price"><span class="v">{{ price(product.price) }}</span>
              <span v-if="product.originalPrice" style="color:#999;text-decoration:line-through;margin-left:12px">{{ price(product.originalPrice) }}</span>
            </div>
            <div style="margin:14px 0;color:#666">月销 {{ product.sale || 0 }} · 库存 {{ product.stock || 0 }}</div>
            <div style="display:flex;align-items:center;gap:14px;margin:20px 0">
              <span>数量</span><el-input-number v-model="qty" :min="1" :max="product.stock||99"/>
            </div>
            <el-button type="warning" size="large" :icon="Icons.ShoppingCart" @click="addCart">加入购物车</el-button>
            <el-button type="danger" size="large" @click="buyNow">立即购买</el-button>
          </div>
        </div>
        <div class="page-card" style="margin-top:16px" v-if="safeHtml">
          <div class="section-title" style="margin-top:0">商品详情</div>
          <div v-html="safeHtml"></div>
        </div>
      </template>
      <div v-else class="empty">商品不存在</div>
    </div>`,
  data() { return { loading: true, product: null, qty: 1, Icons: ElementPlusIconsVue }; },
  computed: { safeHtml() { const raw = this.product && (this.product.detailHtml || this.product.description) || ''; return window.DOMPurify ? window.DOMPurify.sanitize(raw) : ''; } },
  methods: {
    img: imgOf, price: yuan, onErr(e){ e.target.src = PLACEHOLDER; },
    needLogin() { if (!store.isLogin()) { ElMessage.warning('请先登录'); this.$router.push('/login'); return true; } return false; },
    async addCart() {
      if (this.needLogin()) return;
      try { await api.post('/cart/add', { productId: this.product.id, productSkuId: 0, quantity: this.qty, price: this.product.price, productName: this.product.name, productPic: this.product.pic });
        ElMessage.success('已加入购物车'); store.refreshCart();
      } catch(e){ ElMessage.error((e&&e.message)||'加入失败'); }
    },
    async buyNow() { if (this.needLogin()) return; await this.addCart(); this.$router.push('/cart'); }
  },
  async mounted() {
    try { const r = await api.get('/product/detail/' + this.$route.params.id);
      const d = r.data || {}; this.product = d.product || d;
    } catch(e){ ElMessage.error('加载失败'); } finally { this.loading = false; }
  }
};

/* 购物车 */
const Cart = {
  template: `
    <div class="container">
      <div class="section-title" style="margin-top:0">我的购物车</div>
      <el-skeleton v-if="loading" :rows="5" animated/>
      <div v-else-if="!items.length" class="empty">购物车是空的，<a style="color:#ff6700" @click="$router.push('/')">去逛逛</a></div>
      <div v-else class="page-card">
        <el-table :data="items">
          <el-table-column label="商品">
            <template #default="{row}">
              <div style="display:flex;align-items:center;gap:10px">
                <img :src="img(row.productPic)" style="width:60px;height:60px;object-fit:cover;border-radius:4px" @error="onErr">
                <span>{{ row.productName }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="单价" width="120"><template #default="{row}">{{ price(row.price) }}</template></el-table-column>
          <el-table-column label="数量" width="180"><template #default="{row}">
            <el-input-number v-model="row.quantity" :min="1" size="small" @change="(v)=>changeQty(row,v)"/>
          </template></el-table-column>
          <el-table-column label="小计" width="120"><template #default="{row}"><span style="color:#ff6700">{{ price(row.price*row.quantity) }}</span></template></el-table-column>
          <el-table-column label="操作" width="90"><template #default="{row}"><el-button link type="danger" @click="del(row)">删除</el-button></template></el-table-column>
        </el-table>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
          <el-button @click="clear">清空购物车</el-button>
          <div>合计：<span style="color:#ff6700;font-size:22px;font-weight:700">{{ price(totalAmount) }}</span>
            <el-button type="danger" size="large" style="margin-left:16px" @click="$router.push('/confirm')">去结算</el-button>
          </div>
        </div>
      </div>
    </div>`,
  data() { return { loading: true, items: [] }; },
  computed: { totalAmount() { return this.items.reduce((s,i)=>s + i.price*i.quantity, 0); } },
  methods: {
    img: imgOf, price: yuan, onErr(e){ e.target.src = PLACEHOLDER; },
    async load() { this.loading = true; try { const r = await api.get('/cart/list'); this.items = r.data || []; } catch(e){} finally { this.loading = false; } },
    async changeQty(row, v) { try { await api.get('/cart/update/quantity', { params: { id: row.id, quantity: v } }); } catch(e){ ElMessage.error('修改失败'); } },
    async del(row) { try { await api.post('/cart/delete', null, { params: { ids: row.id } }); ElMessage.success('已删除'); this.load(); store.refreshCart(); } catch(e){ ElMessage.error('删除失败'); } },
    async clear() { try { await api.post('/cart/clear'); this.items = []; store.refreshCart(); } catch(e){} }
  },
  mounted() { if (!store.isLogin()) { this.$router.push('/login'); return; } this.load(); }
};

/* 确认下单 */
const Confirm = {
  template: `
    <div class="container">
      <div class="section-title" style="margin-top:0">确认订单</div>
      <div class="page-card">
        <h3>收货地址</h3>
        <el-radio-group v-model="addrId" v-if="addresses.length">
          <el-radio v-for="a in addresses" :key="a.id" :value="a.id" border style="margin:6px;display:block">
            {{ a.name }} {{ a.phoneNumber }} - {{ a.province }}{{ a.city }}{{ a.region }}{{ a.detailAddress }}
          </el-radio>
        </el-radio-group>
        <div v-else class="empty">暂无收货地址，请到<a style="color:#ff6700" @click="$router.push('/member')">个人中心</a>添加</div>
        <h3 style="margin-top:24px">商品清单</h3>
        <el-table :data="items">
          <el-table-column label="商品" prop="productName"/>
          <el-table-column label="单价" width="120"><template #default="{row}">{{ price(row.price) }}</template></el-table-column>
          <el-table-column label="数量" prop="quantity" width="100"/>
          <el-table-column label="小计" width="120"><template #default="{row}">{{ price(row.price*row.quantity) }}</template></el-table-column>
        </el-table>
        <div style="text-align:right;margin-top:20px">
          应付：<span style="color:#ff6700;font-size:24px;font-weight:700">{{ price(totalAmount) }}</span>
          <el-button type="danger" size="large" style="margin-left:16px" :disabled="!items.length" @click="submit">提交订单</el-button>
        </div>
      </div>
    </div>`,
  data() { return { items: [], addresses: [], addrId: null }; },
  computed: { totalAmount() { return this.items.reduce((s,i)=>s + i.price*i.quantity, 0); } },
  methods: {
    price: yuan,
    async load() {
      try { const c = await api.get('/cart/list'); this.items = c.data || []; } catch(e){}
      try { const a = await api.get('/memberReceiveAddress/list'); this.addresses = a.data || []; if (this.addresses[0]) this.addrId = this.addresses[0].id; } catch(e){}
    },
    async submit() {
      if (!this.addrId) { ElMessage.warning('请选择收货地址'); return; }
      try {
        const cartIds = this.items.map(i=>i.id);
        await api.post('/order/generateOrder', { memberReceiveAddressId: this.addrId, cartIds, payType: 0 });
        ElMessageBox.alert('订单已生成！（demo 环境支付链路为支付宝沙箱，此处不发起真实支付）', '下单成功', { confirmButtonText: '查看我的订单', callback: () => this.$router.push('/orders') });
        store.refreshCart();
      } catch(e){ ElMessage.error((e&&e.message)||'下单失败'); }
    }
  },
  mounted() { if (!store.isLogin()) { this.$router.push('/login'); return; } this.load(); }
};

/* 订单列表 */
const Orders = {
  template: `
    <div class="container">
      <div class="section-title" style="margin-top:0">我的订单</div>
      <el-skeleton v-if="loading" :rows="5" animated/>
      <div v-else-if="!orders.length" class="empty">暂无订单</div>
      <div v-else class="page-card">
        <el-table :data="orders">
          <el-table-column label="订单号" prop="orderSn" width="200"/>
          <el-table-column label="金额" width="120"><template #default="{row}">{{ price(row.totalAmount||row.payAmount) }}</template></el-table-column>
          <el-table-column label="状态" width="120"><template #default="{row}">{{ statusText(row.status) }}</template></el-table-column>
          <el-table-column label="下单时间" prop="createTime"/>
        </el-table>
        <el-pagination v-if="total>pageSize" background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="pageNum" @current-change="onPage" style="margin-top:18px;justify-content:center"/>
      </div>
    </div>`,
  data() { return { loading: true, orders: [], pageNum: 1, pageSize: 10, total: 0 }; },
  methods: {
    price: yuan,
    statusText(s){ return ['待付款','待发货','已发货','已完成','已关闭','无效订单'][s] || '未知'; },
    onPage(p){ this.pageNum = p; this.load(); },
    async load() { this.loading = true;
      try { const r = await api.get('/order/list', { params: { pageNum: this.pageNum, pageSize: this.pageSize } });
        this.orders = r.data.list || []; this.total = r.data.total || 0;
      } catch(e){} finally { this.loading = false; }
    }
  },
  mounted() { if (!store.isLogin()) { this.$router.push('/login'); return; } this.load(); }
};

/* 会员中心 */
const Member = {
  template: `
    <div class="container">
      <div class="page-card">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <el-avatar :size="60" :src="store.member && store.member.icon">{{ (store.member&&store.member.nickname||'U')[0] }}</el-avatar>
          <div><div style="font-size:18px;font-weight:700">{{ store.member && (store.member.nickname||store.member.username) }}</div>
          <div style="color:#999">{{ store.member && store.member.phone }}</div></div>
          <el-button style="margin-left:auto" @click="logout">退出登录</el-button>
        </div>
        <el-tabs v-model="tab" @tab-change="onTab">
          <el-tab-pane label="收货地址" name="addr">
            <el-button type="primary" size="small" @click="addrDialog=true" style="margin-bottom:10px">新增地址</el-button>
            <el-table :data="addresses">
              <el-table-column label="收货人" prop="name" width="100"/>
              <el-table-column label="电话" prop="phoneNumber" width="140"/>
              <el-table-column label="地址"><template #default="{row}">{{ row.province }}{{ row.city }}{{ row.region }}{{ row.detailAddress }}</template></el-table-column>
              <el-table-column width="80"><template #default="{row}"><el-button link type="danger" @click="delAddr(row)">删除</el-button></template></el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="优惠券" name="coupon"><el-table :data="coupons"><el-table-column label="名称" prop="name"/><el-table-column label="面额" width="120"><template #default="{row}">{{ price(row.amount) }}</template></el-table-column></el-table><div v-if="!coupons.length" class="empty">暂无优惠券</div></el-tab-pane>
          <el-tab-pane label="我的收藏" name="collect"><div class="product-grid col4"><product-card v-for="p in collections" :key="p.id" :p="mapColl(p)"/></div><div v-if="!collections.length" class="empty">暂无收藏</div></el-tab-pane>
          <el-tab-pane label="我的关注" name="attention"><div v-if="!attentions.length" class="empty">暂无关注</div><el-table v-else :data="attentions"><el-table-column label="品牌" prop="brandName"/></el-table></el-tab-pane>
          <el-tab-pane label="浏览历史" name="history"><div class="product-grid col4"><product-card v-for="p in histories" :key="p.id" :p="mapColl(p)"/></div><div v-if="!histories.length" class="empty">暂无浏览记录</div></el-tab-pane>
        </el-tabs>
      </div>
      <el-dialog v-model="addrDialog" title="新增收货地址" width="460px">
        <el-form :model="addrForm" label-width="80px">
          <el-form-item label="收货人"><el-input v-model="addrForm.name"/></el-form-item>
          <el-form-item label="电话"><el-input v-model="addrForm.phoneNumber"/></el-form-item>
          <el-form-item label="省"><el-input v-model="addrForm.province"/></el-form-item>
          <el-form-item label="市"><el-input v-model="addrForm.city"/></el-form-item>
          <el-form-item label="区"><el-input v-model="addrForm.region"/></el-form-item>
          <el-form-item label="详细地址"><el-input v-model="addrForm.detailAddress" type="textarea"/></el-form-item>
        </el-form>
        <template #footer><el-button @click="addrDialog=false">取消</el-button><el-button type="primary" @click="saveAddr">保存</el-button></template>
      </el-dialog>
    </div>`,
  components: { ProductCard },
  data() { return { store, tab: 'addr', addresses: [], coupons: [], collections: [], attentions: [], histories: [], addrDialog: false, addrForm: {} }; },
  methods: {
    price: yuan,
    mapColl(c){ return { id: c.productId||c.id, name: c.productName||c.name, pic: c.productPic||c.pic, subTitle: c.productSubTitle||'', price: c.productPrice||c.price }; },
    logout() { api.post('/sso/logout').finally(()=>{ clearAuth(); store.cartCount=0; this.$router.push('/'); }); },
    onTab() { this.loadTab(); },
    async loadTab() {
      try {
        if (this.tab==='addr') { const r=await api.get('/memberReceiveAddress/list'); this.addresses=r.data||[]; }
        else if (this.tab==='coupon') { const r=await api.get('/member/coupon/list'); this.coupons=r.data||[]; }
        else if (this.tab==='collect') { const r=await api.get('/member/productCollection/list',{params:{pageNum:1,pageSize:20}}); this.collections=(r.data&&r.data.list)||r.data||[]; }
        else if (this.tab==='attention') { const r=await api.get('/member/attention/list',{params:{pageNum:1,pageSize:20}}); this.attentions=(r.data&&r.data.list)||r.data||[]; }
        else if (this.tab==='history') { const r=await api.get('/member/readHistory/list',{params:{pageNum:1,pageSize:20}}); this.histories=(r.data&&r.data.list)||r.data||[]; }
      } catch(e){}
    },
    async saveAddr() { try { await api.post('/memberReceiveAddress/add', this.addrForm); ElMessage.success('已保存'); this.addrDialog=false; this.addrForm={}; this.loadTab(); } catch(e){ ElMessage.error('保存失败'); } },
    async delAddr(row) { try { await api.post('/memberReceiveAddress/delete/'+row.id); this.loadTab(); } catch(e){ ElMessage.error('删除失败'); } }
  },
  async mounted() { if (!store.isLogin()) { this.$router.push('/login'); return; } await store.refreshMember(); this.loadTab(); }
};

/* 登录 */
const Login = {
  template: `
    <div class="auth-wrap">
      <h2>会员登录</h2>
      <el-form @submit.prevent="doLogin">
        <el-form-item><el-input v-model="username" placeholder="用户名" :prefix-icon="Icons.User"/></el-form-item>
        <el-form-item><el-input v-model="password" type="password" placeholder="密码" :prefix-icon="Icons.Lock" show-password @keyup.enter="doLogin"/></el-form-item>
        <el-button type="warning" style="width:100%" :loading="loading" @click="doLogin">登录</el-button>
      </el-form>
      <div style="text-align:center;margin-top:14px;color:#999">还没有账号？<a style="color:#ff6700" @click="$router.push('/register')">立即注册</a></div>
      <div style="text-align:center;margin-top:6px;color:#bbb;font-size:12px">测试账号可在注册页创建</div>
    </div>`,
  data() { return { username: '', password: '', loading: false, Icons: ElementPlusIconsVue }; },
  methods: {
    async doLogin() {
      if (!this.username || !this.password) { ElMessage.warning('请输入用户名和密码'); return; }
      this.loading = true;
      try {
        const r = await api.post('/sso/login', null, { params: { username: this.username, password: this.password } });
        localStorage.setItem('mall_token', r.data.token);
        localStorage.setItem('mall_tokenHead', r.data.tokenHead || 'Bearer ');
        await store.refreshMember(); await store.refreshCart();
        ElMessage.success('登录成功'); this.$router.push('/member');
      } catch(e){ ElMessage.error((e&&e.message)||'登录失败'); } finally { this.loading = false; }
    }
  }
};

/* 注册 */
const Register = {
  template: `
    <div class="auth-wrap">
      <h2>会员注册</h2>
      <el-form @submit.prevent="doReg">
        <el-form-item><el-input v-model="f.username" placeholder="用户名"/></el-form-item>
        <el-form-item><el-input v-model="f.password" type="password" placeholder="密码" show-password/></el-form-item>
        <el-form-item><el-input v-model="f.telephone" placeholder="手机号"/></el-form-item>
        <el-form-item>
          <div style="display:flex;gap:8px;width:100%">
            <el-input v-model="f.authCode" placeholder="验证码"/>
            <el-button @click="getCode" :disabled="counting>0">{{ counting>0 ? counting+'s' : '获取验证码' }}</el-button>
          </div>
        </el-form-item>
        <el-button type="warning" style="width:100%" :loading="loading" @click="doReg">注册</el-button>
      </el-form>
      <div style="text-align:center;margin-top:14px;color:#999">已有账号？<a style="color:#ff6700" @click="$router.push('/login')">去登录</a></div>
    </div>`,
  data() { return { f: { username:'', password:'', telephone:'', authCode:'' }, loading: false, counting: 0 }; },
  methods: {
    async getCode() {
      if (!this.f.telephone) { ElMessage.warning('请输入手机号'); return; }
      try { const r = await api.get('/sso/getAuthCode', { params: { telephone: this.f.telephone } });
        ElMessage.success('验证码：' + r.data + '（demo 直接返回）');
        this.counting = 60; const t = setInterval(()=>{ if(--this.counting<=0) clearInterval(t); }, 1000);
      } catch(e){ ElMessage.error('获取失败'); }
    },
    async doReg() {
      this.loading = true;
      try { await api.post('/sso/register', null, { params: this.f }); ElMessage.success('注册成功，请登录'); this.$router.push('/login'); }
      catch(e){ ElMessage.error((e&&e.message)||'注册失败'); } finally { this.loading = false; }
    }
  }
};

/* 布局 */
const Layout = {
  template: `
    <div>
      <div class="topbar"><div class="inner">
        <span>Mall 商城 · 阿里云 ACK 部署 Demo</span>
        <span>
          <template v-if="store.member"><a @click="$router.push('/member')">{{ store.member.nickname || store.member.username }}</a><a @click="logout">退出</a></template>
          <template v-else><a @click="$router.push('/login')">登录</a><a @click="$router.push('/register')">注册</a></template>
          <a @click="$router.push('/orders')">我的订单</a>
        </span>
      </div></div>
      <div class="header"><div class="inner">
        <div class="logo" @click="$router.push('/')">Mall<span>商城</span></div>
        <div class="search-box">
          <el-input v-model="kw" placeholder="搜索商品" @keyup.enter="search">
            <template #append><el-button :icon="Icons.Search" @click="search"/></template>
          </el-input>
        </div>
        <div class="header-cart">
          <el-badge :value="store.cartCount" :hidden="!store.cartCount">
            <el-button :icon="Icons.ShoppingCart" @click="$router.push('/cart')">购物车</el-button>
          </el-badge>
        </div>
      </div></div>
      <div class="nav"><div class="inner">
        <a @click="$router.push('/')" :class="{active:isActive('/')}">首页</a>
        <a @click="$router.push('/category')" :class="{active:isActive('/category')}">全部分类</a>
        <a @click="$router.push({path:'/search',query:{sort:2}})">热销榜</a>
        <a @click="$router.push({path:'/search',query:{sort:1}})">新品</a>
      </div></div>
      <router-view/>
      <div class="footer">Mall 商城 PC 版 · 阿里云 ACK · mall-portal 全功能接入 · 仅供部署演示</div>
    </div>`,
  data() { return { store, kw: '', Icons: ElementPlusIconsVue }; },
  methods: {
    isActive(p){ return this.$route.path === p; },
    search() { this.$router.push({ path: '/search', query: { keyword: this.kw } }); },
    logout() { api.post('/sso/logout').finally(()=>{ clearAuth(); store.cartCount=0; this.$router.push('/'); }); }
  }
};

/* ---------- 路由 ---------- */
const routes = [
  { path: '/', component: Layout, children: [
    { path: '', component: Home },
    { path: 'category', component: Category },
    { path: 'search', component: SearchList },
    { path: 'product/:id', component: ProductDetail },
    { path: 'cart', component: Cart },
    { path: 'confirm', component: Confirm },
    { path: 'orders', component: Orders },
    { path: 'member', component: Member },
    { path: 'login', component: Login },
    { path: 'register', component: Register },
  ]}
];
const router = createRouter({ history: createWebHashHistory(), routes, scrollBehavior(){ return { top: 0 }; } });

/* ---------- 启动 ---------- */
const app = createApp({ template: '<router-view/>' });
app.use(ElementPlus);
app.use(router);
for (const [k, c] of Object.entries(ElementPlusIconsVue)) app.component(k, c);
app.mount('#app');
store.refreshMember();
store.refreshCart();
