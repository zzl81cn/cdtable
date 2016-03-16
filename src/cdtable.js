(function () {
  // 定义几个基础的布局layout
  var TPL_CD_LAYOUT  = [
    '<div data-cd-container="plugin-top"></div>',
    '<div class="cdtable-table-container" data-cd-container="table"></div>',
    '<div data-cd-container="plugin-bottom"></div>'
  ]

  var TPL_CD_EMPTY = '<div class="cdtable-table-empty">没有数据，重新查询</div>';

  var STAT_LOADING = 'STATE_LOADING';
  var STAT_LOADED = 'STAT_LOADED';

  var CdTable = function (option, el) {
    var self = this;
    this.option = option;
    this.$el = $(el).addClass('cdtable-root-container');
    this._initEvent();
  }

  $.extend(CdTable.prototype, {
    /**
     * 监听事件
     */
    _initEvent: function () {
      var self = this;

      self.$el.on('cdtable.reflow', function () {
        self.getTable();
      });
    },

    /**
     * 初始化表格，以及 addons 的 view
     */
    _initView: function () {
      this.$el.html(TPL_CD_LAYOUT);
      this.$topPluginContainer = this.$el.find('[data-cd-container=plugin-top]');
      this.$bottomPluginContainer = this.$el.find('[data-cd-container=plugin-bottom]');
      this.$tableContainer = this.$el.find('[data-cd-container=table]');

      // 初始化
      $.each(this.addons, function () {
        this.initView();
      });
    },

    /**
     * 由 load 事件触发
     * 1. 获取基本数据、以及各个插件的数据
     * 2. 通过 getUrl 获取请求地址
     * 3. 获取 json 数据，并进行渲染
     */
    getTable: function () {
      var self = this;

      // 如果正在请求暂停上一次的数据获取
      if (self._isLoading()) {
        self.ajaxInstance.abort();
      }

      // 拼装插件配置
      var urlData = {};
      $.each(this.addons, function (key) {
        urlData[key] = this.getAddonData();
      });

      var url = self.option.getUrl(urlData);

      if (self._validateUrl(url)) {
        self.ajaxInstance = self.option.getAjaxData ? self.option.getAjaxData(url)
          : self._getAjaxData(url);

        self._startLoading();

        // 成功回调处理
        self.ajaxInstance.done(function (json) {
          var rowData = self.option.getRowsData(json);

          self._endLoading(json);

          if (rowData && rowData.length) {
            self._render(rowData, json);
          } else {
            self._renderEmpty();
          }
        });
      }
    },

    /**
     * 渲染数据为空的情况
     */
    _renderEmpty: function () {
      this.$tableContainer.html(this.option.empty ? this.option.empty() : TPL_CD_EMPTY);
    },

    /**
     * 返回 ajax 对象，可以被 option 中的 getAjaxData 所替换，依照用户设置加入各种其他 ajax 参数
     */
    _getAjaxData: function (url) {
      return $.ajax({
        url: url
      });
    },

    /**
     * 判断是否正在获取数据
     */
    _isLoading: function () {
      return this.__load_state == STAT_LOADING;
    },
    
    /**
     * 开始获取数据
     */
    _startLoading: function () {
      this.__load_state = STAT_LOADING;
      this.$el.addClass('loading');
      this.$el.trigger('cdtable.startloading');

      window.scrollTo(0, this.$el.offset().top - 10);
    },

    /**
     * 结束获取
     */
    _endLoading: function (json) {
      var e = $.Event('cdtable.endloading', {
        json: json
      });
      this.__load_state = STAT_LOADED;
      this.$el.removeClass('loading');
      this.$el.trigger(e);
    },

    /**
     * 表格主体的渲染函数
     */
    _render: function (rowData, json) {
      var self = this, 
        html;

      var tbodyStr = '';

      rowData.forEach(function (data) {
        var str = self.option.rows(data);

        tbodyStr += str;
      });

      html = ['<table class=\"' + (self.option.tableClass || '') + '\">',
        '<thead>',
          self.option.headerRow(rowData, json),
        '</thead>',
          tbodyStr,
        '<tbody>',
        '</tbody>',
      '</table>'].join("");

      self.$tableContainer.html(html);
    },

    /**
     * 验证 url 的正确性
     */
    _validateUrl: function (url) {
      return true;
    },

    /**
     * 验证一个 addon 是否符合规则
     */
    _validateAddon: function (addon) {
      var f = true;

      ['_addonName', 'initView', 'setRoot'].forEach(function (item) {
        if (addon[item] === undefined) {
          f = false;
          return false;
        } 
      });

      return f;
    },

    /**
     * 设置 table 组件的插件列表 , 设置完毕后会初始化各个 addon 的 ui
     * @param 
     */
    setAddons: function (addonsList) {
      var self = this;

      self.addons = {};

      // 初始化各个 addons
      addonsList.forEach(function (addon) {
        if (self._validateAddon(addon)) {
          addon.setRoot(self);
          self.addons[addon.getName()] = addon
        }
      });

      self._initView();

      return self;
    },

  });


  /**
   * jQuery plugin cdtable
   * 注意以下几点:
   * headerRow 函数返回的 html 数据中 td 的个数，必须与 rows 函数 td 个数一致
   * @param {object}   option 插件配置参数
   * @param {function} option.headerRow 表头回调函数，返回表头 html 
   * @param {function} option.rows 每行内容回调函数，返回没行的 html
   *
   * @param {function} option.getUrl 返回获取数据的 url 
   * eg. 
   * function (option) {
   *   var currentPage = option.pagination.current;
   *   var filterArr = option.filter.data;
   *
   *   return '/api/getList?page=' + currentPage + $.param(filterArr);
   * }
   * 
   * @param {function} option.getRowsData 获取当前 ajax 请求的 rows 数据
   * eg. 
   * function (json) {
   *   // 判断当前请求是否有数组数据，如果有则返回, 没有的话就返回 false
   *   if (json.data) {
   *     return json.data
   *   }
   * 
   *   return false
   * }
   *
   * @param {object}   option.filterSetting 筛选相关的配置参数
   * @param {bool}     option.filterSetting.enable 是否启用筛选功能
   * @param {string}   option.filterSetting.container 筛选功能的 container 
   * @param {[filterItem]} option.filterSetting.filters 筛选相关配置数组
   * eg. [{
   *   name: 'usertype',
   *   datas: [
   *     { name: '不限', value: '0' },
   *     { name: '僵尸用户', value: '1' },
   *     { name: '黄金用户', value: '2' }
   *   ]
   * }] 
   *
   * @param {object}   option.paginationSetting 翻页相关配置参数
   * @param {bool}     option.paginationSetting.enable    是否启用翻页功能
   * @param {bool}     option.paginationSetting.container 筛选功能的 container
   * @param {function} option.paginationSetting.callback  返回总页数，当前页数，每页显示个数信息
   * eg. function (json) {
   *   return {
   *     total: json.total_page_number,
   *     current: json.current_page_number,
   *     count: json.per_page_counts
   *   }
   * }
   *
   * @param {object} option.customColumn
   * @param {bool}   option.customColumn.enable 是否启用自定义列功能
   *
   */
  $.fn.cdtable = function (option) {
    if (!option) {
      return this.data('cdtable');
    }

    return this.each(function () {
      var ins = new CdTable(option, $(this));

      $(this).data('cdtable', ins);
    });
  }

  window.cdtable = {};
  window.cdtable.addons = {};
  window.cdtable.tools = {};
})();